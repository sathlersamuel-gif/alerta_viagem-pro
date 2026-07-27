function shift(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function validCode(value) {
  return /^[A-Z]{3}$/.test(String(value || '').toUpperCase());
}

async function searchOne({ origin, destination, departure, returnDate, adults, children, offset }) {
  const params = new URLSearchParams({
    engine: 'google_flights',
    api_key: process.env.SERPAPI_API_KEY,
    hl: 'pt',
    gl: 'br',
    currency: 'BRL',
    type: '1',
    departure_id: origin,
    arrival_id: destination,
    outbound_date: departure,
    return_date: returnDate,
    adults: String(adults || 1),
    children: String(children || 0),
    sort_by: '2'
  });

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) return null;

  const flights = [...(data.best_flights || []), ...(data.other_flights || [])]
    .filter(item => Number(item.price) > 0)
    .sort((a, b) => Number(a.price) - Number(b.price));

  if (!flights[0]) return null;
  return {
    departure,
    returnDate,
    offset,
    selectedDates: offset === 0,
    price: Number(flights[0].price),
    airline: (flights[0].flights || []).map(x => x.airline).filter(Boolean).join(' + ')
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!process.env.SERPAPI_API_KEY) return res.status(200).json({ options: [], configured: false });

  const body = req.body || {};
  const origin = String(body.origin || '').toUpperCase();
  const destination = String(body.destination || '').toUpperCase();
  const departure = String(body.departure || '');
  const returnDate = String(body.returnDate || '');
  const adults = Math.max(1, Math.min(9, Number(body.adults) || 1));
  const children = Math.max(0, Math.min(8, Number(body.children) || 0));

  if (!validCode(origin) || !validCode(destination) || !/^\d{4}-\d{2}-\d{2}$/.test(departure) || !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) {
    return res.status(400).json({ error: 'Dados da viagem inválidos.' });
  }

  const stayDays = Math.max(1, Math.round((new Date(`${returnDate}T12:00:00Z`) - new Date(`${departure}T12:00:00Z`)) / 86400000));
  const offsets = [-7, -5, -3, -2, -1, 0, 1, 2, 3, 5, 7];

  const results = await Promise.allSettled(offsets.map(offset => {
    const dep = shift(departure, offset);
    return searchOne({
      origin,
      destination,
      departure: dep,
      returnDate: shift(dep, stayDays),
      adults,
      children,
      offset
    });
  }));

  const available = results
    .filter(item => item.status === 'fulfilled' && item.value)
    .map(item => item.value)
    .sort((a, b) => a.price - b.price);

  const selected = available.find(item => item.selectedDates) || null;
  const cheapest = available[0] || null;
  const options = available.slice(0, 6).map(item => ({
    ...item,
    saving: selected && item.price < selected.price ? selected.price - item.price : 0,
    recommended: Boolean(cheapest && item.departure === cheapest.departure && item.returnDate === cheapest.returnDate)
  }));

  return res.status(200).json({
    configured: true,
    selectedAvailable: Boolean(selected),
    selectedPrice: selected?.price || null,
    cheapest,
    options
  });
};