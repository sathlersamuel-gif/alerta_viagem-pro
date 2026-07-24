const { put, list } = require('@vercel/blob');

const CLIENT_PATTERN = /^[a-f0-9]{32}$/;
const pathFor = clientId => `monitoring/${clientId}.json`;

module.exports = async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'O banco online ainda não foi conectado ao projeto na Vercel.' });
  }

  const clientId = String(req.query.clientId || req.body?.clientId || '').toLowerCase();
  if (!CLIENT_PATTERN.test(clientId)) return res.status(400).json({ error: 'Identificador do monitoramento inválido.' });

  try {
    if (req.method === 'GET') {
      const result = await list({ prefix: pathFor(clientId), limit: 1 });
      if (!result.blobs.length) return res.status(200).json({ trips: [] });
      const response = await fetch(result.blobs[0].url, { cache: 'no-store' });
      if (!response.ok) return res.status(200).json({ trips: [] });
      const data = await response.json();
      return res.status(200).json({ trips: Array.isArray(data.trips) ? data.trips : [] });
    }

    if (req.method === 'POST') {
      const trips = Array.isArray(req.body?.trips) ? req.body.trips.slice(0, 50) : [];
      const sanitized = trips.map(trip => ({
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
        agentSuggestions: trip.agentSuggestions !== false,
        extraAlternative: Boolean(trip.extraAlternative),
        active: trip.active !== false,
        bestPrice: Number(trip.bestPrice) || null,
        lastCheckedAt: trip.lastCheckedAt || null,
        lastAlertAt: trip.lastAlertAt || null,
        lastError: trip.lastError || null,
        lastSuggestion: trip.lastSuggestion || null,
        createdAt: trip.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })).filter(trip => /^[A-Z]{3}$/.test(trip.origin) && /^[A-Z]{3}$/.test(trip.destination) && /^\d{4}-\d{2}-\d{2}$/.test(trip.departure));

      const body = JSON.stringify({ clientId, trips: sanitized, updatedAt: new Date().toISOString() });
      await put(pathFor(clientId), body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 0 });
      return res.status(200).json({ ok: true, trips: sanitized });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (error) {
    console.error('Managed trips error:', error);
    return res.status(500).json({ error: 'Não foi possível sincronizar as viagens.' });
  }
};