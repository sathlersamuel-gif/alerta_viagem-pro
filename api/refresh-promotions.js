const { list, get, put } = require('@vercel/blob');

function streamToJson(stream) {
  return (async () => {
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  })();
}

const isAzulFlight = item => (item?.flights || []).some(leg => /azul/i.test(String(leg?.airline || '')));

function summarizeFlight(item) {
  const legs = Array.isArray(item?.flights) ? item.flights : [];
  const first = legs[0] || {};
  const last = legs[legs.length - 1] || {};
  const airlines = [...new Set(legs.map(leg => leg.airline).filter(Boolean))];
  return {
    price: Number(item?.price) || null,
    airline: airlines.join(' + ') || 'Companhia não informada',
    azul: isAzulFlight(item),
    departure: first.departure_airport?.time || '',
    arrival: last.arrival_airport?.time || '',
    stops: Math.max(0, legs.length - 1),
    duration: Number(item?.total_duration) || null
  };
}

function buildSearchParams(trip) {
  const params = new URLSearchParams({
    engine: 'google_flights',
    api_key: process.env.SERPAPI_API_KEY,
    hl: 'pt',
    gl: 'br',
    currency: 'BRL',
    type: trip.return ? '1' : '2',
    departure_id: trip.origin,
    arrival_id: trip.destination,
    outbound_date: trip.departure,
    adults: String(trip.adults || 1),
    children: String(trip.children || 0),
    sort_by: '2'
  });
  if (trip.return) params.set('return_date', trip.return);
  return params;
}

async function refreshTrip(trip) {
  if (!trip.active) return trip;
  if (!/^[A-Z]{3}$/.test(trip.origin) || !/^[A-Z]{3}$/.test(trip.destination)) {
    return { ...trip, lastCheckedAt: new Date().toISOString(), lastError: 'Código IATA inválido.' };
  }

  try {
    const response = await fetch(`https://serpapi.com/search.json?${buildSearchParams(trip).toString()}`);
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'Falha na consulta da SerpApi');

    const suggestions = [...(data.best_flights || []), ...(data.other_flights || [])]
      .filter(item => Number(item.price) > 0)
      .sort((a, b) => Number(a.price) - Number(b.price))
      .slice(0, 6)
      .map(summarizeFlight)
      .filter(item => item.price);

    const best = suggestions[0] || null;
    return {
      ...trip,
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
      lastSuggestion: best,
      lastSuggestions: suggestions,
      bestPrice: best && (!trip.bestPrice || best.price < Number(trip.bestPrice)) ? best.price : trip.bestPrice
    };
  } catch (error) {
    return {
      ...trip,
      lastCheckedAt: new Date().toISOString(),
      lastError: error.message || 'Erro durante a atualização manual.'
    };
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.SERPAPI_API_KEY) {
    return res.status(200).json({ ok: false, configured: false, error: 'Configuração do monitoramento incompleta.' });
  }

  try {
    let cursor;
    let checked = 0;
    let updated = 0;
    let errors = 0;

    do {
      const page = await list({ prefix: 'monitoring/', limit: 100, cursor });
      cursor = page.cursor;

      await Promise.all(page.blobs.map(async blob => {
        if (blob.pathname === 'monitoring/system-last-run.json') return;
        const stored = await get(blob.pathname, { access: 'private' });
        if (!stored || stored.statusCode !== 200 || !stored.stream) return;

        const document = await streamToJson(stored.stream);
        const originalTrips = Array.isArray(document.trips) ? document.trips : [];
        checked += originalTrips.filter(trip => trip.active).length;
        const trips = await Promise.all(originalTrips.map(refreshTrip));
        updated += trips.filter(trip => trip.active && trip.lastSuggestion?.price).length;
        errors += trips.filter(trip => trip.active && trip.lastError).length;

        await put(blob.pathname, JSON.stringify({
          ...document,
          trips,
          updatedAt: new Date().toISOString()
        }), {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json',
          cacheControlMaxAge: 0
        });
      }));
    } while (cursor);

    return res.status(200).json({ ok: true, checked, updated, errors });
  } catch (error) {
    console.error('Refresh promotions error:', error);
    return res.status(500).json({ ok: false, error: 'Falha ao atualizar promoções.', detail: error.message || 'Erro desconhecido.' });
  }
};