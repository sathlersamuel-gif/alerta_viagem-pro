const { list, get } = require('@vercel/blob');

async function streamToJson(stream) {
  const reader = stream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function compactDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1].slice(2)}${match[2]}${match[3]}` : '';
}

function bookingUrl(trip, suggestion, destination = trip.destination) {
  const origin = String(trip.origin || '').trim().toLowerCase();
  const arrival = String(destination || '').trim().toLowerCase();
  const departure = compactDate(trip.departure);
  const returning = compactDate(trip.return);
  const adults = Math.max(1, Math.min(9, Number(trip.adults) || 1));
  const children = Math.max(0, Math.min(8, Number(trip.children) || 0));

  if (!/^[a-z]{3}$/.test(origin) || !/^[a-z]{3}$/.test(arrival) || !/^\d{6}$/.test(departure)) return '#';

  const routePath = returning ? `${origin}/${arrival}/${departure}/${returning}` : `${origin}/${arrival}/${departure}`;
  const params = new URLSearchParams({
    adultsv2: String(adults), cabinclass: 'economy',
    childrenv2: children ? Array.from({ length: children }, () => '10').join('|') : '',
    currency: 'BRL', locale: 'pt-BR', market: 'BR', preferdirects: 'false', ref: 'home'
  });
  return `https://www.skyscanner.com.br/transport/flights/${routePath}/?${params.toString()}`;
}

function addPromotion(promotions, trip, suggestion, type = 'saved', destination = trip.destination, checkedAt = null) {
  if (!suggestion?.price) return;
  promotions.push({
    type, origin: trip.origin, destination, departure: trip.departure, returnDate: trip.return || '',
    adults: trip.adults || 1, children: trip.children || 0, price: Number(suggestion.price),
    airline: suggestion.airline || 'Companhia não informada', stops: Number(suggestion.stops) || 0,
    azul: Boolean(suggestion.azul), checkedAt, link: bookingUrl(trip, suggestion, destination)
  });
}

function diversify(promotions, updatedAt) {
  const exactUnique = new Map();
  promotions.sort((a, b) => a.price - b.price).forEach(item => {
    const key = `${item.origin}-${item.destination}-${item.departure}-${item.returnDate}-${item.airline}-${item.price}-${item.stops}`;
    if (!exactUnique.has(key)) exactUnique.set(key, item);
  });

  const all = [...exactUnique.values()];
  const bestByRoute = new Map();
  for (const item of all) {
    const routeKey = `${item.origin}-${item.destination}-${item.departure}-${item.returnDate}`;
    if (!bestByRoute.has(routeKey)) bestByRoute.set(routeKey, item);
  }

  const routes = [...bestByRoute.values()].sort((a, b) => a.price - b.price);
  if (!routes.length) return [];

  // A cada nova execução do monitor, muda o ponto de início sem inventar ofertas.
  const seed = String(updatedAt || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const offset = seed % routes.length;
  const rotated = routes.slice(offset).concat(routes.slice(0, offset));

  // Primeiro mostra rotas/destinos diferentes; só depois completa com outras tarifas reais.
  const selected = rotated.slice(0, 12);
  const selectedKeys = new Set(selected.map(item => `${item.origin}-${item.destination}-${item.departure}-${item.returnDate}-${item.airline}-${item.price}-${item.stops}`));
  for (const item of all) {
    const key = `${item.origin}-${item.destination}-${item.departure}-${item.returnDate}-${item.airline}-${item.price}-${item.stops}`;
    if (!selectedKeys.has(key) && selected.length < 30) {
      selected.push(item);
      selectedKeys.add(key);
    }
  }
  return selected;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(200).json({ ok: true, configured: false, updatedAt: null, promotions: [] });

  try {
    const promotions = [];
    let updatedAt = null;
    let cursor;
    do {
      const page = await list({ prefix: 'monitoring/', limit: 100, cursor });
      cursor = page.cursor;
      for (const blob of page.blobs) {
        if (blob.pathname === 'monitoring/system-last-run.json') continue;
        const stored = await get(blob.pathname, { access: 'private' });
        if (!stored || stored.statusCode !== 200 || !stored.stream) continue;
        const document = await streamToJson(stored.stream);
        if (document.updatedAt && (!updatedAt || document.updatedAt > updatedAt)) updatedAt = document.updatedAt;

        for (const trip of Array.isArray(document.trips) ? document.trips : []) {
          if (!trip.active) continue;
          const checkedAt = trip.lastCheckedAt || document.updatedAt || null;
          const suggestions = Array.isArray(trip.lastSuggestions) && trip.lastSuggestions.length ? trip.lastSuggestions : [trip.lastSuggestion].filter(Boolean);
          suggestions.slice(0, 6).forEach(suggestion => addPromotion(promotions, trip, suggestion, 'saved', trip.destination, checkedAt));
          for (const alternative of Array.isArray(trip.lastFallbackDeals) ? trip.lastFallbackDeals : []) {
            addPromotion(promotions, trip, alternative, 'alternative', alternative.destination, trip.lastFallbackCheckedAt || checkedAt);
          }
        }
      }
    } while (cursor);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json({ ok: true, configured: true, updatedAt, refreshHours: 3, promotions: diversify(promotions, updatedAt) });
  } catch (error) {
    console.error('Latest promotions error:', error);
    return res.status(500).json({ ok: false, error: 'Não foi possível carregar as promoções monitoradas.' });
  }
};