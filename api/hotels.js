const ALLOWED_FIELDS = new Set([
  'q','check_in_date','check_out_date','adults','children','children_ages',
  'sort_by','hotel_class','free_cancellation','special_offers','vacation_rentals'
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
  const query = String(input.q || '').trim();
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (query.length < 2 || query.length > 120) {
    return res.status(400).json({ error: 'Informe uma cidade ou destino válido para buscar hotéis.' });
  }
  if (!datePattern.test(String(input.check_in_date || '')) || !datePattern.test(String(input.check_out_date || ''))) {
    return res.status(400).json({ error: 'Informe datas válidas de entrada e saída.' });
  }
  if (String(input.check_out_date) <= String(input.check_in_date)) {
    return res.status(400).json({ error: 'A data de saída precisa ser posterior à entrada.' });
  }

  const adults = Math.min(9, Math.max(1, Number(input.adults) || 1));
  const children = Math.min(8, Math.max(0, Number(input.children) || 0));
  const params = new URLSearchParams({
    engine: 'google_hotels',
    api_key: apiKey,
    q: query,
    check_in_date: String(input.check_in_date),
    check_out_date: String(input.check_out_date),
    adults: String(adults),
    children: String(children),
    hl: 'pt',
    gl: 'br',
    currency: 'BRL',
    sort_by: '3'
  });

  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_FIELDS.has(key) || value === undefined || value === null || value === '') continue;
    if (['q','check_in_date','check_out_date','adults','children'].includes(key)) continue;
    params.set(key, String(value));
  }

  try {
    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      headers: { Accept: 'application/json' }
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      return res.status(response.status || 502).json({ error: data.error || 'Erro retornado pela SerpApi.' });
    }

    return res.status(200).json({
      properties: data.properties || [],
      search_information: data.search_information || null,
      brands: data.brands || []
    });
  } catch (error) {
    console.error('SerpApi hotels error:', error);
    return res.status(502).json({ error: 'Falha de comunicação com o serviço de hotéis.' });
  }
};
