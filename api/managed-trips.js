const { put, get } = require('@vercel/blob');

const CLIENT_PATTERN = /^[a-f0-9]{32}$/;
const pathFor = clientId => `monitoring/${clientId}.json`;
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

async function checkTrip(trip) {
  if (!trip.active) return trip;
  if (!process.env.SERPAPI_API_KEY) {
    trip.lastCheckedAt = new Date().toISOString();
    trip.lastError = 'A chave SERPAPI_API_KEY ainda não está configurada na Vercel.';
    return trip;
  }

  try {
    const params = new URLSearchParams({
      engine: 'google_flights', api_key: process.env.SERPAPI_API_KEY, hl: 'pt', gl: 'br', currency: 'BRL',
      type: trip.return ? '1' : '2', departure_id: trip.origin, arrival_id: trip.destination,
      outbound_date: trip.departure, adults: String(trip.adults || 1), children: String(trip.children || 0), sort_by: '2'
    });
    if (trip.return) params.set('return_date', trip.return);

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      headers: { Accept: 'application/json' }, cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || 'Falha na consulta de voos.');

    const flights = [...(data.best_flights || []), ...(data.other_flights || [])]
      .filter(item => Number(item.price) > 0)
      .sort((a, b) => trip.program === 'azul'
        ? Number(isAzulFlight(b)) - Number(isAzulFlight(a)) || Number(a.price) - Number(b.price)
        : Number(a.price) - Number(b.price));

    trip.lastCheckedAt = new Date().toISOString();
    trip.lastError = null;
    trip.lastSuggestion = flights[0] ? summarizeFlight(flights[0]) : null;
    trip.azulOptionsFound = flights.filter(isAzulFlight).length;

    if (flights[0]) {
      const price = Number(flights[0].price);
      trip.currentPrice = price;
      if (!trip.bestPrice || price < Number(trip.bestPrice)) trip.bestPrice = price;
    } else {
      trip.lastError = 'Nenhum voo com preço disponível foi encontrado nesta consulta.';
    }
  } catch (error) {
    trip.lastCheckedAt = new Date().toISOString();
    trip.lastError = error.message || 'Erro durante a consulta de voos.';
  }
  return trip;
}

function sanitizeTrips(input) {
  const trips = Array.isArray(input) ? input.slice(0, 50) : [];
  return trips.map(trip => ({
    id: Number(trip.id) || Date.now(),
    origin: String(trip.origin || '').trim().toUpperCase().slice(0, 3),
    destination: String(trip.destination || '').trim().toUpperCase().slice(0, 3),
    originLabel: String(trip.originLabel || trip.origin || '').trim().slice(0, 160),
    destinationLabel: String(trip.destinationLabel || trip.destination || '').trim().slice(0, 160),
    departure: String(trip.departure || '').slice(0, 10),
    return: String(trip.return || '').slice(0, 10),
    adults: Math.min(9, Math.max(1, Number(trip.adults) || 1)),
    children: Math.min(8, Math.max(0, Number(trip.children) || 0)),
    childAges: Array.isArray(trip.childAges) ? trip.childAges.slice(0, 8).map(Number) : [],
    preference: ['cash', 'points', 'mixed'].includes(trip.preference) ? trip.preference : 'mixed',
    channel: ['email', 'whatsapp', 'both'].includes(trip.channel) ? trip.channel : 'email',
    frequency: ['instant', 'daily', 'weekly'].includes(trip.frequency) ? trip.frequency : 'instant',
    program: trip.program === 'azul' ? 'azul' : 'all',
    agentSuggestions: trip.agentSuggestions !== false,
    extraAlternative: Boolean(trip.extraAlternative),
    active: trip.active !== false,
    bestPrice: Number(trip.bestPrice) || null,
    currentPrice: Number(trip.currentPrice) || null,
    lastCheckedAt: trip.lastCheckedAt || null,
    lastAlertAt: trip.lastAlertAt || null,
    lastError: trip.lastError || null,
    lastSuggestion: trip.lastSuggestion || null,
    azulOptionsFound: Number(trip.azulOptionsFound) || 0,
    createdAt: trip.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })).filter(trip =>
    /^[A-Z]{3}$/.test(trip.origin) &&
    /^[A-Z]{3}$/.test(trip.destination) &&
    /^\d{4}-\d{2}-\d{2}$/.test(trip.departure)
  );
}

module.exports = async function handler(req, res) {
  const clientId = String(req.query.clientId || req.body?.clientId || '').toLowerCase();
  if (!CLIENT_PATTERN.test(clientId)) {
    return res.status(400).json({ error: 'Identificador do monitoramento inválido.' });
  }

  const blobEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  try {
    if (req.method === 'GET') {
      if (!blobEnabled) return res.status(200).json({ ok: true, mode: 'device', trips: [] });

      const result = await get(pathFor(clientId), { access: 'private' });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return res.status(200).json({ ok: true, mode: 'online', trips: [] });
      }
      const data = await streamToJson(result.stream);
      return res.status(200).json({ ok: true, mode: 'online', trips: Array.isArray(data.trips) ? data.trips : [] });
    }

    if (req.method === 'POST') {
      let sanitized = sanitizeTrips(req.body?.trips);
      sanitized = await Promise.all(sanitized.map(checkTrip));

      if (blobEnabled) {
        await put(
          pathFor(clientId),
          JSON.stringify({ clientId, trips: sanitized, updatedAt: new Date().toISOString() }),
          { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 0 }
        );
      }

      return res.status(200).json({
        ok: true,
        mode: blobEnabled ? 'online' : 'device',
        persistent: blobEnabled,
        checkedNow: true,
        trips: sanitized
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error('Managed trips error:', error);
    return res.status(500).json({
      ok: false,
      code: 'SYNC_FAILED',
      error: error?.message ? `Não foi possível sincronizar as viagens: ${error.message}` : 'Não foi possível sincronizar as viagens.'
    });
  }
};
