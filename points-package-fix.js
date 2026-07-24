(() => {
  const $ = selector => document.querySelector(selector);
  const preference = $('#preference');
  const tripType = $('#tripType');
  const form = $('#searchForm');
  const resultsBox = $('#resultCards');

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
      buildPackages = function buildPackagesWithExactLinks(flights, hotels) {
        const list = [];
        flights.slice(0, 3).forEach((flight, fi) => hotels.slice(0, 3).forEach((hotel, hi) => {
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
        }));
        return list.sort((a, b) => a.cash - b.cash).slice(0, 8);
      };
    }
  } catch (error) {
    console.error('Não foi possível atualizar os pacotes:', error);
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

  function applyPackageButtons() {
    let results = [];
    let search = null;
    try {
      results = Array.isArray(currentResults) ? currentResults : [];
      search = currentSearch;
    } catch {}

    [...document.querySelectorAll('#resultCards .result-card')].forEach((card, index) => {
      const result = results[index];
      if (!result || result.kind !== 'package' || !result.flight || !result.hotel) return;

      const oldButton = card.querySelector('.result-action');
      const flightUrl = bookingUrl(result.flight, search);
      const hotelUrl = result.hotel.link || '';
      const actions = document.createElement('div');
      actions.className = 'package-exact-actions';

      if (flightUrl) {
        const flightButton = document.createElement('button');
        flightButton.type = 'button';
        flightButton.className = 'primary';
        flightButton.textContent = `Reservar voo na ${result.flight.name}`;
        flightButton.onclick = () => window.open(flightUrl, '_blank', 'noopener,noreferrer');
        actions.appendChild(flightButton);
      }

      if (hotelUrl) {
        const hotelButton = document.createElement('button');
        hotelButton.type = 'button';
        hotelButton.className = 'secondary';
        hotelButton.textContent = `Abrir oferta do ${result.hotel.name}`;
        hotelButton.onclick = () => window.open(hotelUrl, '_blank', 'noopener,noreferrer');
        actions.appendChild(hotelButton);
      }

      if (actions.children.length) oldButton?.replaceWith(actions);
    });
  }

  if (resultsBox) {
    new MutationObserver(() => setTimeout(applyPackageButtons, 0))
      .observe(resultsBox, { childList: true, subtree: true });
  }
})();
