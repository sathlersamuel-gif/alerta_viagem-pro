function safe(value, max = 5000) {
  return String(value || '').slice(0, max);
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function serpSearch(params, apiKey) {
  params.set('engine', 'google_flights');
  params.set('api_key', apiKey);
  params.set('hl', 'pt');
  params.set('gl', 'br');
  params.set('currency', 'BRL');
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    headers: { Accept: 'application/json' }
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || 'Não foi possível abrir esta reserva.');
  return data;
}

function allFlights(data) {
  return [...(data.best_flights || []), ...(data.other_flights || [])]
    .filter(item => item && (item.booking_token || item.departure_token))
    .sort((a, b) => Number(a.price || Infinity) - Number(b.price || Infinity));
}

function bookingParts(option) {
  return [option?.together, option?.departing, option?.returning].filter(Boolean);
}

function airlineMatches(choice, requestedAirline) {
  if (!requestedAirline) return true;
  const wanted = normalize(requestedAirline);
  const airline = normalize(choice?.airline);
  const seller = normalize(choice?.seller);
  const url = normalize(choice?.booking_request?.url);
  return airline.includes(wanted) || wanted.includes(airline) || seller.includes(wanted) || wanted.includes(seller) || url.includes(wanted);
}

function chooseBookingRequest(data, requestedAirline) {
  const choices = (data.booking_options || []).flatMap(option => bookingParts(option));
  const valid = choices.filter(choice => choice?.booking_request?.url);
  if (!requestedAirline) return valid.find(choice => choice.airline) || valid[0] || null;
  return valid.find(choice => airlineMatches(choice, requestedAirline)) || null;
}

function htmlEscape(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function submitPage(request) {
  const url = safe(request.url, 8000);
  const postData = safe(request.post_data, 20000);
  if (!postData) return { redirect: url };
  const fields = [...new URLSearchParams(postData).entries()]
    .map(([name, value]) => `<input type="hidden" name="${htmlEscape(name)}" value="${htmlEscape(value)}">`)
    .join('');
  return {
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Abrindo reserva</title></head><body style="font-family:Arial,sans-serif;background:#06111f;color:white;text-align:center;padding:40px"><p>Abrindo a reserva completa do voo...</p><form id="booking" method="post" action="${htmlEscape(url)}">${fields}<button type="submit">Continuar para reservar</button></form><script>document.getElementById('booking').submit();</script></body></html>`
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Método não permitido.');
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return res.status(500).send('Pesquisa de voos ainda não configurada.');

  try {
    let bookingToken = safe(req.query.booking_token);
    const departureToken = safe(req.query.departure_token);
    const requestedAirline = safe(req.query.airline, 120);

    if (!bookingToken && departureToken) {
      const params = new URLSearchParams({
        departure_id: safe(req.query.departure_id, 3).toUpperCase(),
        arrival_id: safe(req.query.arrival_id, 3).toUpperCase(),
        outbound_date: safe(req.query.outbound_date, 10),
        adults: String(Math.min(9, Math.max(1, Number(req.query.adults) || 1))),
        children: String(Math.min(8, Math.max(0, Number(req.query.children) || 0))),
        type: req.query.return_date ? '1' : '2',
        departure_token: departureToken,
        sort_by: '2',
        deep_search: 'true'
      });
      if (req.query.return_date) params.set('return_date', safe(req.query.return_date, 10));
      const returnData = await serpSearch(params, apiKey);
      bookingToken = allFlights(returnData).find(item => item.booking_token)?.booking_token || '';
    }

    if (!bookingToken) throw new Error('A companhia não forneceu um link direto para este itinerário.');
    const bookingData = await serpSearch(new URLSearchParams({ booking_token: bookingToken }), apiKey);
    const choice = chooseBookingRequest(bookingData, requestedAirline);
    if (!choice) throw new Error(`Não encontrei uma opção de reserva direta na ${requestedAirline || 'companhia selecionada'} para esta tarifa.`);

    const page = submitPage(choice.booking_request);
    if (page.redirect) return res.redirect(302, page.redirect);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(page.html);
  } catch (error) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(502).send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial,sans-serif;padding:28px"><h2>Não foi possível abrir a reserva direta</h2><p>${htmlEscape(error.message)}</p><button onclick="history.back()">Voltar</button></body></html>`);
  }
};