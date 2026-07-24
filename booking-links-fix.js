(() => {
  const preference = document.querySelector('#preference');
  const tripType = document.querySelector('#tripType');
  const form = document.querySelector('#searchForm');
  const resultsBox = document.querySelector('#resultCards');

  function enforcePointsMode() {
    if (!preference || !tripType) return;
    const pointsOnly = preference.value === 'points';
    const completeOption = tripType.querySelector('option[value="complete"]');
    const hotelOption = tripType.querySelector('option[value="hotel"]');
    if (completeOption) completeOption.disabled = pointsOnly;
    if (hotelOption) hotelOption.disabled = pointsOnly;
    if (pointsOnly) tripType.value = 'flight';
  }

  preference?.addEventListener('change', enforcePointsMode);
  form?.addEventListener('submit', enforcePointsMode, true);
  enforcePointsMode();

  try {
    if (typeof buildPackages === 'function') {
      buildPackages = function exactPackages(flights, hotels) {
        const usableFlights = flights.filter(flight => flight.bookingToken || flight.departureToken);
        const usableHotels = hotels.filter(hotel => hotel.link);
        const list = [];
        usableFlights.slice(0, 3).forEach((flight, fi) => usableHotels.slice(0, 3).forEach((hotel, hi) => {
          const total = Number(flight.cash || 0) + Number(hotel.cash || 0);
          list.push({
            kind: 'package',
            type: 'COMPARAÇÃO VOO + HOTEL',
            name: `${flight.name} + ${hotel.name}`,
            route: flight.route,
            price: money(total),
            sub: `Voo ${money(flight.cash)} + hotel ${money(hotel.cash)}`,
            score: Math.max(70, 97 - fi * 3 - hi * 2),
            meta: [...(flight.meta || []).slice(0, 2), ...(hotel.meta || []).slice(0, 2), 'Links individuais das fontes'],
            best: false,
            cash: total,
            flight,
            hotel
          });
        }));
        return list.sort((a, b) => a.cash - b.cash).slice(0, 8);
      };
    }
  } catch (error) {
    console.error('Falha ao preparar comparação exata:', error);
  }

  function buildBookingUrl(result, search) {
    if (!result || (!result.bookingToken && !result.departureToken)) return '';
    const route = String(result.route || '').split('→').map(value => value.trim());
    const params = new URLSearchParams({
      departure_id: (route[0] || '').slice(0, 3),
      arrival_id: (route[1] || '').slice(0, 3),
      outbound_date: search?.departure || '',
      adults: String(search?.adults || 1),
      children: String(search?.children || 0)
    });
    if (search?.return) params.set('return_date', search.return);
    if (result.bookingToken) params.set('booking_token', result.bookingToken);
    if (result.departureToken) params.set('departure_token', result.departureToken);
    return `/api/flight-booking?${params.toString()}`;
  }

  function readState() {
    try {
      return {
        results: Array.isArray(currentResults) ? currentResults : [],
        search: currentSearch || null
      };
    } catch {
      return { results: [], search: null };
    }
  }

  function button(label, className, url) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = label;
    element.onclick = () => window.open(url, '_blank', 'noopener,noreferrer');
    return element;
  }

  function unavailable(oldAction, text = 'Oferta sem link direto') {
    oldAction.removeAttribute('data-url');
    oldAction.disabled = true;
    oldAction.textContent = text;
    oldAction.onclick = null;
  }

  function applyExactLinks() {
    const { results, search } = readState();
    const cards = [...document.querySelectorAll('#resultCards .result-card')];

    cards.forEach((card, index) => {
      const result = results[index];
      const oldAction = card.querySelector('.result-action');
      if (!result || !oldAction) return;

      if (result.kind === 'points') {
        if (result.sourceUrl) {
          oldAction.dataset.url = result.sourceUrl;
          oldAction.textContent = 'Abrir oferta oficial da Azul';
          oldAction.onclick = () => window.open(result.sourceUrl, '_blank', 'noopener,noreferrer');
        } else unavailable(oldAction);
        return;
      }

      if (result.kind === 'flight') {
        const url = buildBookingUrl(result, search);
        if (!url) return unavailable(oldAction);
        oldAction.dataset.url = url;
        oldAction.textContent = `Abrir esta tarifa de ${result.name || 'voo'}`;
        oldAction.onclick = () => window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      if (result.kind === 'package' && result.flight && result.hotel) {
        const actions = document.createElement('div');
        actions.className = 'package-exact-actions';
        const flightUrl = buildBookingUrl(result.flight, search);
        const hotelUrl = result.hotel.link || '';
        if (flightUrl) actions.appendChild(button(`Abrir voo de ${result.flight.name}`, 'primary', flightUrl));
        if (hotelUrl) actions.appendChild(button(`Abrir hotel: ${result.hotel.name}`, 'secondary', hotelUrl));
        if (actions.children.length === 2) oldAction.replaceWith(actions);
        else unavailable(oldAction, 'Pacote sem os dois links diretos');
        return;
      }

      if (result.kind === 'hotel') {
        if (!result.link) return unavailable(oldAction);
        oldAction.dataset.url = result.link;
        oldAction.textContent = 'Abrir esta oferta do hotel';
        oldAction.onclick = () => window.open(result.link, '_blank', 'noopener,noreferrer');
      }
    });
  }

  if (resultsBox) {
    new MutationObserver(() => setTimeout(applyExactLinks, 0))
      .observe(resultsBox, { childList: true, subtree: true });
    setTimeout(applyExactLinks, 0);
  }
})();