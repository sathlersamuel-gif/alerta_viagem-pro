(() => {
  const select = document.querySelector('#tripType');
  const anyDestination = document.querySelector('#anyDestination');
  if (!select || !anyDestination) return;

  function syncTripType() {
    if (anyDestination.checked) {
      select.value = 'flight';
      select.disabled = true;
    } else {
      select.disabled = false;
    }
  }

  anyDestination.addEventListener('change', syncTripType);
  window.addEventListener('pageshow', syncTripType);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncTripType();
  });
  syncTripType();
})();