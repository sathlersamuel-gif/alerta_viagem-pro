// Interações adicionais da tela inicial
(() => {
  function airportByCode(code) {
    try {
      const item = airports.find(a => a[0] === code);
      return item ? airportLabel(item) : code;
    } catch (_) {
      return code;
    }
  }

  function openDeal(route) {
    const [originCode, destinationCode] = String(route || '').split('→').map(v => v.trim());
    if (!originCode || !destinationCode) return;

    const origin = document.querySelector('#origin');
    const destination = document.querySelector('#destination');
    const anyDestination = document.querySelector('#anyDestination');
    const tripType = document.querySelector('#tripType');

    if (anyDestination) {
      anyDestination.checked = false;
      anyDestination.dispatchEvent(new Event('change', {bubbles:true}));
    }
    if (origin) origin.value = airportByCode(originCode);
    if (destination) {
      destination.disabled = false;
      destination.value = airportByCode(destinationCode);
    }
    if (tripType) {
      tripType.disabled = false;
      tripType.value = 'flight';
    }

    if (typeof showView === 'function') showView('search');
    setTimeout(() => {
      document.querySelector('#searchForm')?.scrollIntoView({behavior:'smooth', block:'start'});
      if (typeof toast === 'function') toast(`Oferta ${originCode} → ${destinationCode} carregada. Escolha as datas e pesquise.`);
    }, 120);
  }

  function activateDeals() {
    document.querySelectorAll('#dealList .deal').forEach(deal => {
      if (deal.dataset.clickReady === '1') return;
      const route = deal.querySelector('.deal-copy b')?.textContent?.trim();
      deal.dataset.clickReady = '1';
      deal.setAttribute('role', 'button');
      deal.setAttribute('tabindex', '0');
      deal.setAttribute('aria-label', `Abrir busca da oferta ${route || ''}`);
      deal.addEventListener('click', () => openDeal(route));
      deal.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDeal(route);
        }
      });
    });
  }

  function installAutocompleteTouchFix() {
    if (!document.querySelector('#avp-autocomplete-touch-fix')) {
      const style = document.createElement('style');
      style.id = 'avp-autocomplete-touch-fix';
      style.textContent = `
        .field { position: relative; z-index: 0; }
        .field.avp-touch-open { z-index: 30000 !important; }
        .avp-autocomplete.open {
          z-index: 30001 !important;
          pointer-events: auto !important;
          touch-action: manipulation;
          -webkit-overflow-scrolling: touch;
          isolation: isolate;
        }
        .avp-autocomplete.open .avp-ac-item {
          position: relative;
          z-index: 30002;
          pointer-events: auto !important;
          touch-action: manipulation;
        }
      `;
      document.head.appendChild(style);
    }

    const syncOpenState = () => {
      document.querySelectorAll('.avp-autocomplete').forEach(box => {
        box.parentElement?.classList.toggle('avp-touch-open', box.classList.contains('open'));
      });
    };

    syncOpenState();
    new MutationObserver(syncOpenState).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });

    const protectSuggestionTouch = event => {
      const item = event.target.closest?.('.avp-autocomplete.open .avp-ac-item');
      if (!item) return;
      event.stopPropagation();
    };

    document.addEventListener('pointerdown', protectSuggestionTouch, true);
    document.addEventListener('touchstart', protectSuggestionTouch, {capture:true, passive:true});
    document.addEventListener('click', protectSuggestionTouch, true);
  }

  activateDeals();
  installAutocompleteTouchFix();
  const list = document.querySelector('#dealList');
  if (list) new MutationObserver(activateDeals).observe(list, {childList:true});
})();