(() => {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const timers = new Map();
  const controllers = new Map();

  function label(item) {
    return `${item.city} (${item.code}) — ${item.airport}${item.country ? `, ${item.country}` : ''}`;
  }

  function attach(inputId, codeId, boxId, statusId) {
    const input = document.getElementById(inputId);
    const code = document.getElementById(codeId);
    const box = document.getElementById(boxId);
    const status = document.getElementById(statusId);
    if (!input || !code || !box || !status || input.dataset.worldSearchReady) return;
    input.dataset.worldSearchReady = 'true';

    input.addEventListener('input', () => {
      const query = normalize(input.value);
      clearTimeout(timers.get(inputId));
      controllers.get(inputId)?.abort();
      if (query.length < 2) return;

      timers.set(inputId, setTimeout(async () => {
        const controller = new AbortController();
        controllers.set(inputId, controller);
        try {
          const response = await fetch(`/api/airport-search?q=${encodeURIComponent(input.value.trim())}`, {
            signal: controller.signal,
            cache: 'force-cache'
          });
          const data = await response.json();
          if (!response.ok || !Array.isArray(data.results) || !data.results.length) return;

          box.innerHTML = data.results.map(item => `
            <div class="managed-suggestion world-airport-option"
              data-code="${item.code}"
              data-city="${encodeURIComponent(item.city || '')}"
              data-airport="${encodeURIComponent(item.airport || '')}"
              data-country="${encodeURIComponent(item.country || '')}">
              <b>${item.city} — ${item.code}</b>
              <small>${item.airport}${item.country ? `, ${item.country}` : ''}</small>
            </div>`).join('');
          box.classList.add('show');

          box.querySelectorAll('.world-airport-option').forEach(option => {
            option.addEventListener('pointerdown', event => {
              event.preventDefault();
              const item = {
                code: option.dataset.code,
                city: decodeURIComponent(option.dataset.city),
                airport: decodeURIComponent(option.dataset.airport),
                country: decodeURIComponent(option.dataset.country)
              };
              input.value = label(item);
              code.value = item.code;
              input.dataset.worldAirport = JSON.stringify(item);
              status.textContent = `Aeroporto confirmado: ${item.city} (${item.code}) — ${item.country}`;
              box.classList.remove('show');
              input.dispatchEvent(new Event('change', { bubbles: true }));
            });
          });
        } catch (error) {
          if (error.name !== 'AbortError') console.warn('Busca mundial indisponível:', error);
        }
      }, 280));
    }, { capture: true });
  }

  function initialize() {
    attach('managedOrigin', 'managedOriginCode', 'managedOriginSuggestions', 'managedOriginSelected');
    attach('managedDestination', 'managedDestinationCode', 'managedDestinationSuggestions', 'managedDestinationSelected');
  }

  const observer = new MutationObserver(initialize);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  initialize();
})();