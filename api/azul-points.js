const SOURCE_URL = 'https://passagens.voeazul.com.br/pt/pontos';

function normalizeText(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOffers(html) {
  const text = normalizeText(html);
  const pattern = /([A-Za-zÀ-ÿ .'-]+)\s*\(([A-Z]{3})\)\s*(?:Para)?\s*([A-Za-zÀ-ÿ .'-]+)\s*\(([A-Z]{3})\)\s*(?:Só ida|Ida e volta)?\s*Ida:\s*(\d{2}\/\d{2}\/\d{4})[\s\S]{0,80}?A partir de\s*([\d.,]+)\s*pontos/gi;
  const offers = [];
  const seen = new Set();
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const [, originCity, origin, destinationCity, destination, dateBr, pointsRaw] = match;
    const [day, month, year] = dateBr.split('/');
    const key = `${origin}-${destination}-${year}-${month}-${day}-${pointsRaw}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push({
      origin,
      destination,
      origin_city: originCity.trim(),
      destination_city: destinationCity.trim(),
      departure_date: `${year}-${month}-${day}`,
      points: Number(pointsRaw.replace(/[^\d]/g, '')),
      trip_type: 'one_way',
      source: 'Azul Linhas Aéreas',
      source_url: SOURCE_URL,
      observed_within_hours: 48
    });
  }

  return offers.filter((offer) => offer.points > 0);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const input = req.method === 'GET' ? req.query : (req.body || {});
  const origin = String(input.origin || '').toUpperCase().trim();
  const destination = String(input.destination || '').toUpperCase().trim();
  const departureDate = String(input.departure_date || '').trim();
  const maxPoints = Math.max(0, Number(input.max_points) || 0);

  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'AlertaViagemPro/1.0 (+public-fare-monitor)'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'A página pública da Azul não respondeu.', status: response.status });
    }

    let offers = parseOffers(await response.text());
    if (origin) offers = offers.filter((offer) => offer.origin === origin);
    if (destination) offers = offers.filter((offer) => offer.destination === destination);
    if (departureDate) offers = offers.filter((offer) => offer.departure_date === departureDate);
    if (maxPoints) offers = offers.filter((offer) => offer.points <= maxPoints);

    offers.sort((a, b) => a.points - b.points || a.departure_date.localeCompare(b.departure_date));

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json({
      offers,
      source: SOURCE_URL,
      exact_inventory: false,
      note: 'Ofertas públicas divulgadas pela Azul, coletadas pela própria Azul nas últimas 48 horas e sujeitas a alteração na reserva.'
    });
  } catch (error) {
    console.error('Azul points source error:', error);
    return res.status(502).json({ error: 'Falha ao consultar as ofertas públicas em pontos da Azul.' });
  }
};
