// Ofertas em destaque atualizadas com preços reais e links clicáveis.
(() => {
  const routes = [
    ['OAL', 'GRU'],
    ['PVH', 'REC'],
    ['CGB', 'MCZ'],
    ['PVH', 'GRU'],
    ['CGB', 'GIG'],
    ['PVH', 'BSB']
  ];

  const addDays = days => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const departureDate = addDays(30);
  const returnDate = addDays(37);

  function bookingUrl(origin, destination, departure = departureDate, returning = returnDate) {
    const query = `Flights from ${origin} to ${destination} on ${departure} returning ${returning}`;
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}&hl=pt-BR&curr=BRL`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function renderLoading() {
    const box = document.querySelector('#dealList');
    if (box) box.innerHTML = '<div class="ai-note"><span>✦</span><p>Atualizando promoções e preços reais...</p></div>';
  }

  function renderOffers(offers) {
    const box = document.querySelector('#dealList');
    if (!box) return;

    if (!offers.length) {
      box.innerHTML = '<div class="ai-note"><span>⌕</span><p>Não encontrei promoções disponíveis agora. Toque em Nova busca para pesquisar outra rota.</p></div>';
      return;
    }

    box.innerHTML = offers.slice(0, 6).map((offer, index) => `
      <button type="button" class="deal featured-offer" data-offer-index="${index}">
        <div class="logo">✈</div>
        <div class="deal-copy">
          <b>${escapeHtml(offer.origin)} → ${escapeHtml(offer.destination)}</b>
          <small>${escapeHtml(offer.airline)} • ida ${departureDate.split('-').reverse().join('/')} • volta ${returnDate.split('-').reverse().join('/')}</small>
          <em>Preço consultado agora • toque para reservar</em>
        </div>
        <div class="deal-price">
          <strong>R$ ${Number(offer.price).toLocaleString('pt-BR')}</strong>
          <small>valor total exibido</small>
        </div>
        <span class="featured-arrow">›</span>
      </button>`).join('');

    box.querySelectorAll('[data-offer-index]').forEach(button => {
      button.addEventListener('click', () => {
        const offer = offers[Number(button.dataset.offerIndex)];
        window.open(offer.url, '_blank', 'noopener,noreferrer');
      });
    });
  }

  async function fetchRoute(origin, destination) {
    const response = await fetch('/api/flights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        departure_id: origin,
        arrival_id: destination,
        outbound_date: departureDate,
        return_date: returnDate,
        adults: 1,
        children: 0,
        sort_by: 2,
        deep_search: false
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Falha ao consultar a rota');

    const flights = [...(data.best_flights || []), ...(data.other_flights || [])]
      .filter(item => Number(item.price) > 0)
      .sort((a, b) => Number(a.price) - Number(b.price));

    const cheapest = flights[0];
    if (!cheapest) return null;
    const firstLeg = Array.isArray(cheapest.flights) ? cheapest.flights[0] : null;

    return {
      origin,
      destination,
      airline: firstLeg?.airline || 'Comparador de voos',
      price: Number(cheapest.price),
      url: bookingUrl(origin, destination)
    };
  }

  async function loadOffers() {
    renderLoading();
    const results = await Promise.allSettled(routes.map(route => fetchRoute(...route)));
    const offers = results
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value)
      .sort((a, b) => a.price - b.price);
    renderOffers(offers);
  }

  document.addEventListener('DOMContentLoaded', loadOffers, { once: true });
  if (document.readyState !== 'loading') loadOffers();
})();

(() => {
  if (document.querySelector('script[data-monitoring-loader]')) return;
  const script = document.createElement('script');
  script.src = 'monitoring.js?v=3';
  script.defer = true;
  script.dataset.monitoringLoader = '1';
  document.body.appendChild(script);
})();