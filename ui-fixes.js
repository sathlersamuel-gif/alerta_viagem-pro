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

  function moveAnyDestinationOption() {
    const checkbox = document.querySelector('#anyDestination');
    const form = document.querySelector('#searchForm');
    const label = checkbox?.closest('label');
    if (!checkbox || !form || !label) return;

    let section = document.querySelector('#avp-any-destination-section');
    if (!section) {
      section = document.createElement('div');
      section.id = 'avp-any-destination-section';
      section.className = 'avp-any-destination-section';
      section.innerHTML = '<div class="small" style="margin-bottom:8px;font-weight:800;color:#c4d6e4">Busca alternativa</div>';
    }

    if (!section.contains(label)) {
      label.classList.remove('full');
      section.appendChild(label);
    }

    const searchButton = document.querySelector('#searchButton');
    const buttonContainer = searchButton?.parentElement;
    if (buttonContainer && buttonContainer.parentElement === form) {
      form.insertBefore(section, buttonContainer);
    } else if (searchButton && searchButton.parentElement) {
      searchButton.parentElement.insertBefore(section, searchButton);
    } else {
      form.appendChild(section);
    }

    if (!document.querySelector('#avp-any-destination-style')) {
      const style = document.createElement('style');
      style.id = 'avp-any-destination-style';
      style.textContent = `
        .avp-any-destination-section {
          margin-top: 22px;
          margin-bottom: 14px;
          padding: 14px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--panel2);
          position: relative;
          z-index: 1;
          clear: both;
        }
        .avp-any-destination-section label {
          margin: 0 !important;
          width: 100%;
        }
      `;
      document.head.appendChild(style);
    }
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

  function initializeFixes() {
    activateDeals();
    moveAnyDestinationOption();
    installAutocompleteTouchFix();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFixes, {once:true});
  } else {
    initializeFixes();
  }

  setTimeout(moveAnyDestinationOption, 300);
  setTimeout(moveAnyDestinationOption, 1000);

  const list = document.querySelector('#dealList');
  if (list) new MutationObserver(activateDeals).observe(list, {childList:true});
})();