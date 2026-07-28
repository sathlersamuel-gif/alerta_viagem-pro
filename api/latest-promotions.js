const { list, get } = require('@vercel/blob');

const INTERNATIONAL_DESTINATIONS = new Set(['EZE','SCL','LIM','MVD','ASU','BOG','PTY','CUN','PUJ','MEX','MIA','MCO','LIS','MAD','BCN','CDG','FCO']);

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
  const departureValue = suggestion?.departureDate || trip.departure;
  const returnValue = suggestion?.returnDate || trip.return;
  const departure = compactDate(departureValue);
  const returning = compactDate(returnValue);
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
  const code = String(destination).toUpperCase();
  const category = INTERNATIONAL_DESTINATIONS.has(code) ? 'international' : 'national';
  const departure = suggestion.departureDate || trip.departure;
  const returnDate = suggestion.returnDate || trip.return || '';
  promotions.push({
    type, category, origin: trip.origin, destination: code, departure, returnDate,
    adults: trip.adults || 1, children: trip.children || 0, price: Number(suggestion.price),
    airline: suggestion.airline || 'Companhia não informada', stops: Number(suggestion.stops) || 0,
    azul: Boolean(suggestion.azul), checkedAt, link: bookingUrl(trip, suggestion, code)
  });
}

function diversify(promotions, updatedAt) {
  const exactUnique = new Map();
  promotions.sort((a, b) => a.price - b.price).forEach(item => {
    const key = `${item.origin}-${item.destination}-${item.departure}-${item.returnDate}-${item.airline}-${item.price}-${item.stops}`;
    if (!exactUnique.has(key)) exactUnique.set(key, item);
  });
  const all = [...exactUnique.values()];
  const bestByRouteDate = new Map();
  for (const item of all) {
    const routeKey = `${item.origin}-${item.destination}-${item.departure}-${item.returnDate}`;
    if (!bestByRouteDate.has(routeKey)) bestByRouteDate.set(routeKey, item);
  }
  const routes = [...bestByRouteDate.values()];
  const seed = String(updatedAt || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rotate = list => {
    const sorted = list.sort((a, b) => a.price - b.price);
    if (!sorted.length) return [];
    const offset = seed % sorted.length;
    return sorted.slice(offset).concat(sorted.slice(0, offset));
  };
  const national = rotate(routes.filter(item => item.category === 'national')).slice(0, 10);
  const international = rotate(routes.filter(item => item.category === 'international')).slice(0, 10);
  return [...national, ...international];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(200).json({ ok: true, configured: false, updatedAt: null, promotions: [], national: [], international: [] });
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
          suggestions.slice(0, 3).forEach(suggestion => addPromotion(promotions, trip, suggestion, 'saved', trip.destination, checkedAt));
          for (const alternative of Array.isArray(trip.lastFallbackDeals) ? trip.lastFallbackDeals : []) {
            addPromotion(promotions, trip, alternative, 'alternative', alternative.destination, trip.lastFallbackCheckedAt || checkedAt);
          }
        }
      }
    } while (cursor);
    const diversified = diversify(promotions, updatedAt);
    const national = diversified.filter(item => item.category === 'national');
    const international = diversified.filter(item => item.category === 'international');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json({ ok: true, configured: true, updatedAt, refreshHours: 3, promotions: diversified, national, international });
  } catch (error) {
    console.error('Latest promotions error:', error);
    return res.status(500).json({ ok: false, error: 'Não foi possível carregar as promoções monitoradas.' });
  }
};