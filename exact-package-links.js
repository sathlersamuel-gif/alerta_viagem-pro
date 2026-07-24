(() => {
  const originalBuildPackages = typeof buildPackages === 'function' ? buildPackages : null;

  if (originalBuildPackages) {
    buildPackages = function exactBuildPackages(flights, hotels) {
      const list = [];
      flights.slice(0, 3).forEach((flight, fi) => hotels.slice(0, 3).forEach((hotel, hi) => {
        const total = Number(flight.cash || 0) + Number(hotel.cash || 0);
        list.push({
          kind: 'package',
          type: 'PACOTE REAL',
          name: `${flight.name} + ${hotel.name}`,
          route: flight.route,
          price: money(total),
          sub: `Voo ${money(flight.cash)} + hotel ${money(hotel.cash)}`,
          score: Math.max(70, 97 - fi * 3 - hi * 2),
          meta: [...(flight.meta || []).slice(0, 2), ...(hotel.meta || []).slice(0, 2)],
          best: false,
          cash: total,
          flightName: flight.name,
          bookingToken: flight.bookingToken || '',
          departureToken: flight.departureToken || '',
          hotelName: hotel.name,
          hotelLink: hotel.link || ''
        });
      }));
      return list.sort((a, b) => a.cash - b.cash).slice(0, 8);
    };
  }

  function flightBookingUrl(result, search) {
    if (!result || (!result.bookingToken && !result.departureToken)) return '';
    const route = String(result.route || '').split('→').map(v => v.trim());
    const params = new URLSearchParams({
      departure_id: (route[0] || '').slice(0, 3),
      arrival_id: (route[1] || '').slice(0, 3),
      outbound_date: search?.departure || '',
      adults: String(search?.adults || 1),
      children: String(search?.children || 0),
      airline: String(result.flightName || result.name || '')
    });
    if (search?.return) params.set('return_date', search.return);
    if (result.bookingToken) params.set('booking_token', result.bookingToken);
    if (result.departureToken) params.set('departure_token', result.departureToken);
    return `/api/flight-booking?${params.toString()}`;
  }

  function applyExactLinks() {
    const cards = [...document.querySelectorAll('#resultCards .result-card')];
    cards.forEach((card, index) => {
      const result = Array.isArray(currentResults) ? currentResults[index] : null;
      if (!result) return;

      const oldButton = card.querySelector('.result-action');
      if (result.kind === 'package') {
        const flightUrl = flightBookingUrl(result, currentSearch);
        const hotelUrl = result.hotelLink || '';
        const actions = document.createElement('div');
        actions.className = 'package-exact-actions';
        actions.style.display = 'grid';
        actions.style.gap = '10px';
        actions.style.marginTop = '16px';

        if (flightUrl) {
          const flightButton = document.createElement('button');
          flightButton.type = 'button';
          flightButton.className = 'primary';
          flightButton.textContent = `Reservar voo na ${result.flightName || 'companhia'}`;
          flightButton.onclick = () => window.open(flightUrl, '_blank', 'noopener,noreferrer');
          actions.appendChild(flightButton);
        }

        if (hotelUrl) {
          const hotelButton = document.createElement('button');
          hotelButton.type = 'button';
          hotelButton.className = 'secondary';
          hotelButton.textContent = `Abrir oferta do ${result.hotelName || 'hotel'}`;
          hotelButton.onclick = () => window.open(hotelUrl, '_blank', 'noopener,noreferrer');
          actions.appendChild(hotelButton);
        }

        if (!flightUrl && !hotelUrl) {
          const warning = document.createElement('div');
          warning.className = 'ai-note';
          warning.innerHTML = '<p>Esta combinação não forneceu links diretos de reserva. Faça outra busca para obter uma oferta reservável.</p>';
          actions.appendChild(warning);
        }

        oldButton?.replaceWith(actions);
        return;
      }

      if (result.kind === 'flight') {
        const flightUrl = flightBookingUrl(result, currentSearch);
        if (oldButton && flightUrl) {
          oldButton.dataset.url = flightUrl;
          oldButton.textContent = `Reservar na ${result.name || 'companhia'}`;
          oldButton.onclick = () => window.open(flightUrl, '_blank', 'noopener,noreferrer');
        } else if (oldButton && !flightUrl) {
          oldButton.disabled = true;
          oldButton.textContent = 'Reserva direta indisponível';
          oldButton.removeAttribute('data-url');
        }
      }
    });
  }

  const target = document.getElementById('resultCards');
  if (target) new MutationObserver(() => setTimeout(applyExactLinks, 0)).observe(target, { childList: true, subtree: true });
})();