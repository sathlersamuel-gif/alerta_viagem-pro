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

function bookingUrl(trip, suggestion, destination = trip.destination) {
  const q = new URLSearchParams({
    departure_id: trip.origin,
    arrival_id: destination,
    outbound_date: trip.departure,
    adults: String(trip.adults || 1),
    children: String(trip.children || 0),
    airline: suggestion?.airline || '',
    price: String(suggestion?.price || '')
  });
  if (trip.return) q.set('return_date', trip.return);
  if (suggestion?.bookingToken) q.set('booking_token', suggestion.bookingToken);
  if (suggestion?.departureToken) q.set('departure_token', suggestion.departureToken);
  return `/api/flight-booking?${q.toString()}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(200).json({ ok: true, configured: false, updatedAt: null, promotions: [] });
  }

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
          const suggestion = trip.lastSuggestion;
          if (suggestion?.price) {
            promotions.push({
              type: 'saved',
              origin: trip.origin,
              destination: trip.destination,
              departure: trip.departure,
              returnDate: trip.return || '',
              adults: trip.adults || 1,
              children: trip.children || 0,
              price: Number(suggestion.price),
              airline: suggestion.airline || 'Companhia não informada',
              stops: Number(suggestion.stops) || 0,
              azul: Boolean(suggestion.azul),
              checkedAt: trip.lastCheckedAt || document.updatedAt || null,
              link: bookingUrl(trip, suggestion)
            });
          }

          for (const alternative of Array.isArray(trip.lastFallbackDeals) ? trip.lastFallbackDeals : []) {
            if (!alternative?.price) continue;
            promotions.push({
              type: 'alternative',
              origin: trip.origin,
              destination: alternative.destination,
              departure: trip.departure,
              returnDate: trip.return || '',
              adults: trip.adults || 1,
              children: trip.children || 0,
              price: Number(alternative.price),
              airline: alternative.airline || 'Companhia não informada',
              stops: Number(alternative.stops) || 0,
              azul: Boolean(alternative.azul),
              checkedAt: trip.lastFallbackAlertAt || trip.lastCheckedAt || document.updatedAt || null,
              link: bookingUrl(trip, alternative, alternative.destination)
            });
          }
        }
      }
    } while (cursor);

    const unique = new Map();
    promotions
      .sort((a, b) => a.price - b.price)
      .forEach(item => {
        const key = `${item.origin}-${item.destination}-${item.departure}-${item.returnDate}`;
        if (!unique.has(key)) unique.set(key, item);
      });

    res.setHeader('Cache-Control', 'public, s-maxage=10800, stale-while-revalidate=300');
    return res.status(200).json({
      ok: true,
      configured: true,
      updatedAt,
      refreshHours: 3,
      promotions: [...unique.values()].slice(0, 12)
    });
  } catch (error) {
    console.error('Latest promotions error:', error);
    return res.status(500).json({ ok: false, error: 'Não foi possível carregar as promoções monitoradas.' });
  }
};