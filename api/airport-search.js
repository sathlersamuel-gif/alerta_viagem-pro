let cache = null;
let cacheAt = 0;
const CACHE_MS = 12 * 60 * 60 * 1000;
const BASE = 'https://api.travelpayouts.com/aviasales_resources/v3';

function normalize(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Fonte mundial respondeu ${response.status}`);
  return response.json();
}

async function loadDatabase() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;

  const [airportsRaw, citiesRaw, countriesRaw] = await Promise.all([
    fetchJson(`${BASE}/airports.json?locale=pt`),
    fetchJson(`${BASE}/cities.json?locale=pt`),
    fetchJson(`${BASE}/countries.json?locale=pt`).catch(() => [])
  ]);

  const airports = Array.isArray(airportsRaw) ? airportsRaw : Object.values(airportsRaw || {});
  const cities = Array.isArray(citiesRaw) ? citiesRaw : Object.values(citiesRaw || {});
  const countries = Array.isArray(countriesRaw) ? countriesRaw : Object.values(countriesRaw || {});

  const cityByCode = new Map(cities.filter(Boolean).map(city => [city.code, city]));
  const countryByCode = new Map(countries.filter(Boolean).map(country => [country.code, country.name || country.name_translations?.pt || country.name_translations?.en]));

  cache = airports
    .filter(item => item && /^[A-Z0-9]{3}$/i.test(String(item.code || '')) && item.flightable !== false)
    .map(item => {
      const city = cityByCode.get(item.city_code) || {};
      const cityName = city.name || city.name_translations?.pt || city.name_translations?.en || item.city_name || item.name || item.code;
      const airportName = item.name || item.name_translations?.pt || item.name_translations?.en || `Aeroporto ${item.code}`;
      const countryCode = item.country_code || city.country_code || '';
      const countryName = countryByCode.get(countryCode) || countryCode;
      return {
        code: String(item.code).toUpperCase(),
        city: cityName,
        airport: airportName,
        country: countryName,
        countryCode,
        cityCode: item.city_code || city.code || '',
        lat: item.coordinates?.lat ?? null,
        lon: item.coordinates?.lon ?? null
      };
    });
  cacheAt = Date.now();
  return cache;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const query = normalize(req.query.q || '');
  if (query.length < 2) return res.status(200).json({ results: [] });

  try {
    const database = await loadDatabase();
    const codeQuery = query.toUpperCase();
    const scored = database.map(item => {
      const city = normalize(item.city), airport = normalize(item.airport), country = normalize(item.country), code = item.code;
      let score = 0;
      if (code === codeQuery) score = 100;
      else if (city === query) score = 90;
      else if (city.startsWith(query)) score = 75;
      else if (airport.startsWith(query)) score = 65;
      else if (city.includes(query)) score = 55;
      else if (airport.includes(query)) score = 45;
      else if (country === query) score = 35;
      else if (country.includes(query)) score = 25;
      return { item, score };
    }).filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.city.localeCompare(b.item.city, 'pt-BR'))
      .slice(0, 15)
      .map(entry => entry.item);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ results: scored, source: 'Travelpayouts global airport database' });
  } catch (error) {
    console.error('Airport search error:', error);
    return res.status(502).json({ error: 'A base mundial de aeroportos não respondeu agora.', results: [] });
  }
};