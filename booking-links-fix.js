(() => {
  const buildBookingUrl = (result, search) => {
    if (!result || result.kind !== 'flight' || (!result.bookingToken && !result.departureToken)) return '';
    const route = String(result.route || '').split('→').map(v => v.trim());
    const departureId = (route[0] || window.extractIata?.(search?.origin) || '').slice(0, 3);
    const arrivalId = (route[1] || window.extractIata?.(search?.destination) || '').slice(0, 3);
    const params = new URLSearchParams({
      departure_id: departureId,
      arrival_id: arrivalId,
      outbound_date: search?.departure || '',
      adults: String(search?.adults || 1),
      children: String(search?.children || 0)
    });
    if (search?.return) params.set('return_date', search.return);
    if (result.bookingToken) params.set('booking_token', result.bookingToken);
    if (result.departureToken) params.set('departure_token', result.departureToken);
    return `/api/flight-booking?${params.toString()}`;
  };

  const apply = () => {
    const cards = [...document.querySelectorAll('#resultCards .result-card')];
    cards.forEach((card, index) => {
      const button = card.querySelector('.result-action');
      const result = Array.isArray(window.currentResults) ? window.currentResults[index] : currentResults?.[index];
      const search = window.currentSearch || currentSearch;
      const bookingUrl = buildBookingUrl(result, search);
      if (!button || !bookingUrl) return;
      button.dataset.url = bookingUrl;
      button.textContent = 'Reservar este voo';
      button.onclick = () => window.open(bookingUrl, '_blank', 'noopener,noreferrer');
    });
  };

  const target = document.getElementById('resultCards');
  if (!target) return;
  new MutationObserver(() => setTimeout(apply, 0)).observe(target, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    if (event.target.closest('#searchForm button[type="submit"]')) setTimeout(apply, 1000);
  });
})();