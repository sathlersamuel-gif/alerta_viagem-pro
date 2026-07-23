const ALLOWED_FIELDS = new Set([
  'departure_id','arrival_id','outbound_date','return_date','adults','children',
  'infants_in_seat','infants_on_lap','travel_class','stops','sort_by','deep_search'
]);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'A chave SERPAPI_API_KEY ainda não foi configurada no servidor.' });
  }

  const input = req.body && typeof req.body === 'object' ? req.body : {};
  const departure = String(input.departure_id || '').toUpperCase();
  const arrival = String(input.arrival_id || '').toUpperCase();
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!/^[A-Z]{3}$/.test(departure) || !/^[A-Z]{3}$/.test(arrival)) {
    return res.status(400).json({ error: 'Origem e destino precisam ser códigos IATA válidos.' });
  }
  if (!datePattern.test(String(input.outbound_date || ''))) {
    return res.status(400).json({ error: 'Informe uma data de ida válida.' });
  }
  if (input.return_date && !datePattern.test(String(input.return_date))) {
    return res.status(400).json({ error: 'Informe uma data de volta válida.' });
  }

  const params = new URLSearchParams({
    engine: 'google_flights',
    api_key: apiKey,
    hl: 'pt',
    gl: 'br',
    currency: 'BRL',
    type: input.return_date ? '1' : '2',
    departure_id: departure,
    arrival_id: arrival,
    outbound_date: String(input.outbound_date),
    adults: String(Math.min(9, Math.max(1, Number(input.adults) || 1))),
    children: String(Math.min(8, Math.max(0, Number(input.children) || 0))),
    sort_by: '2'
  });

  if (input.return_date) params.set('return_date', String(input.return_date));
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_FIELDS.has(key) || value === undefined || value === null || value === '') continue;
    if (['departure_id','arrival_id','outbound_date','return_date','adults','children'].includes(key)) continue;
    params.set(key, String(value));
  }

  try {
    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      return res.status(response.status || 502).json({ error: data.error || 'Erro retornado pela SerpApi.' });
    }

    return res.status(200).json({
      best_flights: data.best_flights || [],
      other_flights: data.other_flights || [],
      price_insights: data.price_insights || null,
      airports: data.airports || null
    });
  } catch (error) {
    console.error('SerpApi error:', error);
    return res.status(502).json({ error: 'Falha de comunicação com o serviço de voos.' });
  }
};
