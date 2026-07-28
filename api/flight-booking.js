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
  if (!requestedAirline) return false;
  const wanted = normalize(requestedAirline);
  const values = [choice?.airline, choice?.seller, choice?.booking_request?.url]
    .map(normalize)
    .filter(Boolean);
  return values.some(value => value.includes(wanted) || wanted.includes(value));
}

function isBlockedRedirect(value) {
  try {
    const hostname = new URL(String(value || '')).hostname.toLowerCase().replace(/^www\./, '');
    const blocked = ['google.com', 'googleusercontent.com', 'googleadservices.com', 'googlesyndication.com', 'doubleclick.net', 'g.co', 'goo.gl'];
    return blocked.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return true;
  }
}

function priceNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value || '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function directChoices(data) {
  const seen = new Set();
  return (data.booking_options || [])
    .flatMap(option => bookingParts(option))
    .filter(choice => {
      const request = choice?.booking_request;
      if (!request?.url || isBlockedRedirect(request.url)) return false;
      const key = `${request.url}|${request.post_data || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function chooseBookingRequest(data, requestedAirline, targetPrice) {
  const choices = directChoices(data);
  if (!choices.length) return null;
  const airlineChoices = requestedAirline ? choices.filter(choice => airlineMatches(choice, requestedAirline)) : [];
  const pool = airlineChoices.length ? airlineChoices : choices;
  const wantedPrice = priceNumber(targetPrice);
  if (wantedPrice > 0) {
    const priced = pool
      .map(choice => ({ choice, difference: Math.abs(priceNumber(choice.price) - wantedPrice) }))
      .filter(item => priceNumber(item.choice.price) > 0)
      .sort((a, b) => a.difference - b.difference);
    if (priced.length) return priced[0].choice;
  }
  return pool.find(choice => choice.airline) || pool.find(choice => choice.seller) || pool[0];
}

function htmlEscape(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function submitPage(request) {
  const url = safe(request.url, 8000);
  if (!url || isBlockedRedirect(url)) throw new Error('O fornecedor não disponibilizou um endereço direto para esta tarifa.');
  const postData = safe(request.post_data, 20000);
  if (!postData) return { redirect: url };
  const fields = [...new URLSearchParams(postData).entries()]
    .map(([name, value]) => `<input type="hidden" name="${htmlEscape(name)}" value="${htmlEscape(value)}">`)
    .join('');
  return {
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Abrindo fornecedor</title></head><body style="font-family:Arial,sans-serif;background:#06111f;color:white;text-align:center;padding:40px"><p>Abrindo diretamente o fornecedor desta tarifa...</p><form id="booking" method="post" action="${htmlEscape(url)}">${fields}<button type="submit">Continuar para reservar</button></form><script>document.getElementById('booking').submit();</script></body></html>`
  };
}

function baseSearchParams(query) {
  const departureId = safe(query.departure_id, 3).toUpperCase();
  const arrivalId = safe(query.arrival_id, 3).toUpperCase();
  const outboundDate = safe(query.outbound_date, 10);
  if (!/^[A-Z]{3}$/.test(departureId)) throw new Error('A origem do voo não foi identificada. Faça uma nova pesquisa.');
  if (!/^[A-Z]{3}$/.test(arrivalId)) throw new Error('O destino do voo não foi identificado. Faça uma nova pesquisa.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(outboundDate)) throw new Error('A data de ida não foi identificada. Faça uma nova pesquisa.');

  const params = new URLSearchParams({
    departure_id: departureId,
    arrival_id: arrivalId,
    outbound_date: outboundDate,
    adults: String(Math.min(9, Math.max(1, Number(query.adults) || 1))),
    children: String(Math.min(8, Math.max(0, Number(query.children) || 0))),
    type: query.return_date ? '1' : '2'
  });
  if (query.return_date) params.set('return_date', safe(query.return_date, 10));
  return params;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Método não permitido.');
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return res.status(500).send('Pesquisa de voos ainda não configurada.');

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Referrer-Policy', 'no-referrer');

  try {
    const params = baseSearchParams(req.query);
    let bookingToken = safe(req.query.booking_token);
    const departureToken = safe(req.query.departure_token);
    const requestedAirline = safe(req.query.airline, 120);
    const targetPrice = safe(req.query.price, 40);

    if (!bookingToken && departureToken) {
      params.set('departure_token', departureToken);
      params.set('sort_by', '2');
      params.set('deep_search', 'true');
      const returnData = await serpSearch(params, apiKey);
      bookingToken = allFlights(returnData).find(item => item.booking_token)?.booking_token || '';
      params.delete('departure_token');
      params.delete('sort_by');
      params.delete('deep_search');
    }

    if (!bookingToken) throw new Error('A companhia não forneceu um link direto para este itinerário.');
    params.set('booking_token', bookingToken);
    const bookingData = await serpSearch(params, apiKey);
    const choice = chooseBookingRequest(bookingData, requestedAirline, targetPrice);
    if (!choice) throw new Error('Esta tarifa não possui link direto de companhia ou agência. Escolha outra oferta disponível.');

    const page = submitPage(choice.booking_request);
    if (page.redirect) return res.redirect(302, page.redirect);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(page.html);
  } catch (error) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(502).send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial,sans-serif;padding:28px"><h2>Não foi possível abrir a reserva direta</h2><p>${htmlEscape(error.message)}</p><button onclick="history.back()">Voltar</button></body></html>`);
  }
};