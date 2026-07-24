(() => {
  const preference = document.querySelector('#preference');
  const tripType = document.querySelector('#tripType');
  const resultsBox = document.querySelector('#resultCards');

  function enforcePointsOnly() {
    if (!preference || !tripType) return;
    const pointsOnly = preference.value === 'points';
    const complete = tripType.querySelector('option[value="complete"]');
    const hotel = tripType.querySelector('option[value="hotel"]');
    if (complete) complete.disabled = pointsOnly;
    if (hotel) hotel.disabled = pointsOnly;
    if (pointsOnly) tripType.value = 'flight';
  }

  preference?.addEventListener('change', enforcePointsOnly);
  document.querySelector('#searchForm')?.addEventListener('submit', enforcePointsOnly, true);
  enforcePointsOnly();

  if (typeof buildPackages === 'function') {
    buildPackages = function buildExactPackages(flights, hotels) {
      const list = [];
      flights.slice(0, 3).forEach((flight, fi) => {
        hotels.slice(0, 3).forEach((hotel, hi) => {
          const total = Number(flight.cash || 0) + Number(hotel.cash || 0);
          list.push({
            kind: 'package',
            type: 'COMPARAÇÃO VOO + HOTEL',
            name: `${flight.name} + ${hotel.name}`,
            route: flight.route,
            price: money(total),
            sub: `Voo ${money(flight.cash)} + hotel ${money(hotel.cash)}`,
            score: Math.max(70, 97 - fi * 3 - hi * 2),
            meta: [...(flight.meta || []).slice(0, 2), ...(hotel.meta || []).slice(0, 2), 'Reservas feitas separadamente'],
            best: false,
            cash: total,
            flight,
            hotel
          });
        });
      });
      return list.sort((a, b) => a.cash - b.cash).slice(0, 8);
    };
  }

  function bookingUrl(flight, search) {
    if (!flight || (!flight.bookingToken && !flight.departureToken)) return '';
    const route = String(flight.route || '').split('→').map(value => value.trim());
    const params = new URLSearchParams({
      departure_id: (route[0] || '').slice(0, 3),
      arrival_id: (route[1] || '').slice(0, 3),
      outbound_date: search?.departure || '',
      adults: String(search?.adults || 1),
      children: String(search?.children || 0),
      airline: String(flight.name || '')
    });
    if (search?.return) params.set('return_date', search.return);
    if (flight.bookingToken) params.set('booking_token', flight.bookingToken);
    if (flight.departureToken) params.set('departure_token', flight.departureToken);
    return `/api/flight-booking?${params.toString()}`;
  }

  function openButton(label, className, url) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', () => window.open(url, '_blank', 'noopener,noreferrer'));
    return button;
  }

  function getState() {
    try {
      return { results: currentResults || [], search: currentSearch || null };
    } catch {
      return { results: [], search: null };
    }
  }

  function apply() {
    const { results, search } = getState();
    const cards = [...document.querySelectorAll('#resultCards .result-card')];
    cards.forEach((card, index) => {
      const result = results[index];
      const old = card.querySelector('.result-action');
      if (!result || !old) return;

      if (result.kind === 'package') {
        if (!result.flight || !result.hotel) {
          old.disabled = true;
          old.textContent = 'Oferta sem link exato — faça nova busca';
          old.removeAttribute('data-url');
          old.onclick = null;
          return;
        }
        const actions = document.createElement('div');
        actions.className = 'package-exact-actions';
        const flightLink = bookingUrl(result.flight, search);
        const hotelLink = result.hotel.link || '';
        if (flightLink) actions.appendChild(openButton(`Reservar voo na ${result.flight.name}`, 'primary', flightLink));
        if (hotelLink) actions.appendChild(openButton(`Abrir oferta exata do ${result.hotel.name}`, 'secondary', hotelLink));
        if (actions.children.length) old.replaceWith(actions);
        else {
          old.disabled = true;
          old.textContent = 'Oferta sem link direto disponível';
        }
        return;
      }

      if (result.kind === 'flight') {
        const url = bookingUrl(result, search);
        if (url) {
          old.textContent = `Reservar na ${result.name}`;
          old.dataset.url = url;
          old.onclick = () => window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          old.disabled = true;
          old.textContent = 'Companhia não forneceu reserva direta';
          old.removeAttribute('data-url');
        }
      }

      if (result.kind === 'hotel') {
        if (result.link) {
          old.textContent = 'Abrir esta oferta exata do hotel';
          old.dataset.url = result.link;
          old.onclick = () => window.open(result.link, '_blank', 'noopener,noreferrer');
        } else {
          old.disabled = true;
          old.textContent = 'Hotel sem link direto disponível';
          old.removeAttribute('data-url');
        }
      }
    });
  }

  if (resultsBox) {
    new MutationObserver(() => setTimeout(apply, 0)).observe(resultsBox, { childList: true, subtree: true });
  }
})();