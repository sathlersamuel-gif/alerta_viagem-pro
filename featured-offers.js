// Promoções reais personalizadas com aeroportos alternativos e acesso direto à reserva.
(() => {
  const REGIONAL_ORIGINS = ['OAL', 'JPR', 'PVH', 'BVH', 'CGB'];
  const DESTINATIONS = ['GRU', 'CGH', 'BSB', 'GIG', 'SDU', 'REC', 'MCZ', 'SSA', 'FOR', 'CWB'];

  const addDays = days => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const departureDate = addDays(30);
  const returnDate = addDays(37);

  function profile() {
    return window.getDefaultTravelerProfile?.() || {
      enabled: true,
      origin: 'OAL',
      adults: 1,
      children: 0,
      childAges: []
    };
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function originLabel(code) {
    return ({
      OAL: 'Cacoal',
      JPR: 'Ji-Paraná',
      PVH: 'Porto Velho',
      BVH: 'Vilhena',
      CGB: 'Cuiabá'
    })[code] || code;
  }

  function routesForProfile(current) {
    const preferred = /^[A-Z]{3}$/.test(current.origin || '') ? current.origin : 'OAL';
    const origins = unique([preferred, ...REGIONAL_ORIGINS]);
    const routes = [];

    // Primeiro tenta várias opções saindo do aeroporto escolhido.
    for (const destination of DESTINATIONS.slice(0, 6)) {
      if (destination !== preferred) routes.push([preferred, destination, true]);
    }

    // Depois amplia para aeroportos próximos de Rondônia e Cuiabá.
    for (const origin of origins.filter(code => code !== preferred)) {
      for (const destination of DESTINATIONS.slice(0, 3)) {
        if (destination !== origin) routes.push([origin, destination, false]);
      }
    }

    return routes.slice(0, 18);
  }

  function fallbackUrl(origin, destination, current) {
    const travelers = `${current.adults} adulto(s)${current.children ? ` e ${current.children} criança(s)` : ''}`;
    const ages = current.children && current.childAges?.length
      ? `, idades ${current.childAges.join(', ')}`
      : '';
    const query = `Voos de ${origin} para ${destination}, ida ${departureDate}, volta ${returnDate}, ${travelers}${ages}`;
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}&hl=pt-BR&curr=BRL`;
  }

  function validUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null;
  }

  function exactOfferUrl(flight, data, origin, destination, current) {
    const bookingOptions = Array.isArray(flight?.booking_options) ? flight.booking_options : [];
    const directBooking = bookingOptions
      .map(option => validUrl(option?.link || option?.url || option?.booking_url))
      .find(Boolean);

    return directBooking ||
      validUrl(flight?.booking_url) ||
      validUrl(flight?.link) ||
      validUrl(flight?.exact_search_url) ||
      validUrl(data?.exact_search_url) ||
      fallbackUrl(origin, destination, current);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function renderStatus(message) {
    const box = document.querySelector('#dealList');
    if (box) box.innerHTML = `<div class="ai-note"><span>✦</span><p>${escapeHtml(message)}</p></div>`;
  }

  function renderOffers(offers, current) {
    const box = document.querySelector('#dealList');
    if (!box) return;

    const total = Number(current.adults) + Number(current.children);
    const passengerText = `${total} passageiro(s): ${current.adults} adulto(s)${current.children ? ` + ${current.children} criança(s)` : ''}`;

    box.innerHTML = offers.slice(0, 8).map((offer, index) => `
      <button type="button" class="deal featured-offer" data-offer-index="${index}">
        <div class="logo">✈</div>
        <div class="deal-copy">
          <b>${escapeHtml(offer.origin)} → ${escapeHtml(offer.destination)}</b>
          <small>${escapeHtml(originLabel(offer.origin))} • ${escapeHtml(offer.airline || 'Google Voos')} • ${escapeHtml(passengerText)}</small>
          <em>${offer.preferredOrigin ? 'Saindo da sua origem preferida' : 'Alternativa por aeroporto próximo'} • toque para reservar</em>
        </div>
        <div class="deal-price">
          <strong>${offer.price ? `R$ ${Number(offer.price).toLocaleString('pt-BR')}` : 'Ver oferta'}</strong>
          <small>${offer.price ? 'total para todos os passageiros' : 'consultar valor disponível'}</small>
        </div>
        <span class="featured-arrow">›</span>
      </button>`).join('');

    box.querySelectorAll('[data-offer-index]').forEach(button => {
      button.addEventListener('click', () => {
        const offer = offers[Number(button.dataset.offerIndex)];
        if (offer?.url) window.location.assign(offer.url);
      });
    });
  }

  async function fetchRoute(origin, destination, preferredOrigin, current) {
    const response = await fetch('/api/flights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        departure_id: origin,
        arrival_id: destination,
        outbound_date: departureDate,
        return_date: returnDate,
        adults: Number(current.adults || 1),
        children: Number(current.children || 0),
        children_ages: current.children
          ? (current.childAges || []).map(age => Math.max(1, Number(age))).join(',')
          : undefined,
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
      preferredOrigin,
      airline: firstLeg?.airline || 'Comparador de voos',
      price: Number(cheapest.price),
      url: exactOfferUrl(cheapest, data, origin, destination, current)
    };
  }

  async function loadOffers() {
    const current = profile();
    if (!current.enabled) {
      renderStatus('Promoções personalizadas estão desativadas. Ative acima quando quiser voltar a pesquisar.');
      return;
    }

    const routes = routesForProfile(current);
    const passengerCount = Number(current.adults) + Number(current.children);
    renderStatus(`Buscando para ${passengerCount} passageiro(s). Primeiro ${current.origin}; depois Cacoal, Ji-Paraná, Porto Velho, Vilhena e Cuiabá...`);

    const offers = [];
    for (const [origin, destination, preferredOrigin] of routes) {
      try {
        const offer = await fetchRoute(origin, destination, preferredOrigin, current);
        if (offer) {
          offers.push(offer);
          renderOffers([...offers].sort((a, b) => Number(a.price) - Number(b.price)), current);
        }
      } catch (error) {
        console.warn(`Promoção ${origin}-${destination} indisponível:`, error);
      }
    }

    // Nunca deixa a área vazia: apresenta consultas já configuradas para todos os passageiros.
    if (!offers.length) {
      renderOffers(routes.slice(0, 8).map(([origin, destination, preferredOrigin]) => ({
        origin,
        destination,
        preferredOrigin,
        airline: 'Google Voos',
        price: null,
        url: fallbackUrl(origin, destination, current)
      })), current);
    }
  }

  window.addEventListener('avpro-profile-updated', loadOffers);
  document.addEventListener('DOMContentLoaded', loadOffers, { once: true });
  if (document.readyState !== 'loading') loadOffers();
})();