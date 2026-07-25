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
            kind: 'package', type: 'COMPARAÇÃO VOO + HOTEL',
            name: `${flight.name} + ${hotel.name}`, route: flight.route,
            price: money(total), sub: `Voo ${money(flight.cash)} + hotel ${money(hotel.cash)}`,
            score: Math.max(70, 97 - fi * 3 - hi * 2),
            meta: [...(flight.meta || []).slice(0, 2), ...(hotel.meta || []).slice(0, 2), 'Links individuais das fontes'],
            best: false, cash: total, flight, hotel
          });
        }));
        return list.sort((a, b) => a.cash - b.cash).slice(0, 8);
      };
    }
  } catch (error) {
    console.error('Falha ao preparar comparação exata:', error);
  }

  function iataFrom(value) {
    if (typeof extractIata === 'function') {
      const found = String(extractIata(value) || '').toUpperCase();
      if (/^[A-Z]{3}$/.test(found)) return found;
    }
    const raw = String(value || '').toUpperCase();
    return (raw.match(/\(([A-Z]{3})\)/) || raw.match(/\b([A-Z]{3})\b/))?.[1] || '';
  }

  function routeIatas(result) {
    const route = String(result?.route || '');
    const codes = [...route.matchAll(/\b([A-Z]{3})\b/g)].map(match => match[1]);
    return { departure: codes[0] || '', arrival: codes[1] || '' };
  }

  function buildBookingUrl(result, search) {
    if (!result || (!result.bookingToken && !result.departureToken)) return '';
    const routeCodes = routeIatas(result);
    const departureId = iataFrom(search?.origin) || routeCodes.departure;
    const arrivalId = iataFrom(search?.destination) || routeCodes.arrival;
    if (!departureId || !arrivalId || !search?.departure) return '';

    const params = new URLSearchParams({
      departure_id: departureId,
      arrival_id: arrivalId,
      outbound_date: search.departure,
      adults: String(search?.adults || 1),
      children: String(search?.children || 0),
      airline: String(result.name || ''),
      price: String(result.cash || '')
    });
    if (search?.return) params.set('return_date', search.return);
    if (result.bookingToken) params.set('booking_token', result.bookingToken);
    if (result.departureToken) params.set('departure_token', result.departureToken);
    params.set('_v', '4');
    return `/api/flight-booking?${params.toString()}`;
  }

  function openLink(url) {
    if (!url) return;
    const absolute = new URL(url, window.location.origin).toString();
    // No iPhone/Safari, abrir na mesma aba evita bloqueio de pop-up e tela em branco.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
    if (isIOS || isSafari) window.location.assign(absolute);
    else window.open(absolute, '_blank', 'noopener,noreferrer');
  }

  function button(label, className, url) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = label;
    element.onclick = () => openLink(url);
    return element;
  }

  function unavailable(oldAction, text = 'Oferta sem link direto') {
    oldAction.removeAttribute('data-url');
    oldAction.disabled = true;
    oldAction.textContent = text;
    oldAction.onclick = null;
  }

  function applyExactLinks() {
    const { results, search } = (() => {
      try { return { results: Array.isArray(currentResults) ? currentResults : [], search: currentSearch || null }; }
      catch { return { results: [], search: null }; }
    })();

    const cards = [...document.querySelectorAll('#resultCards .result-card')];
    cards.forEach((card, index) => {
      const result = results[index];
      const oldAction = card.querySelector('.result-action');
      if (!result || !oldAction) return;

      if (result.kind === 'points') {
        if (result.sourceUrl) {
          oldAction.dataset.url = result.sourceUrl;
          oldAction.textContent = 'Abrir oferta oficial da Azul';
          oldAction.onclick = () => openLink(result.sourceUrl);
        } else unavailable(oldAction);
        return;
      }

      if (result.kind === 'flight') {
        const url = buildBookingUrl(result, search);
        if (!url) return unavailable(oldAction, 'Não foi possível montar o link desta tarifa');
        oldAction.dataset.url = url;
        oldAction.textContent = `Abrir tarifa de ${result.name || 'voo'} no vendedor`;
        oldAction.onclick = () => openLink(url);
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
        oldAction.onclick = () => openLink(result.link);
      }
    });
  }

  if (resultsBox) {
    let scheduled = false;
    new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        applyExactLinks();
      });
    }).observe(resultsBox, { childList: true, subtree: true });
    requestAnimationFrame(applyExactLinks);
  }
})();