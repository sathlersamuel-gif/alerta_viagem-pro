// Ofertas em destaque personalizadas por perfil e programa
(() => {
  const PREF_KEY = 'avpro_featured_offer_preferences';
  const DEFAULT_PREFS = { program: 'azul', useTravelerProfile: true };

  const airportByCode = code => (window.airports || []).find(item => item[0] === code);
  const airportText = code => {
    const item = airportByCode(code);
    return item && typeof window.airportLabel === 'function' ? window.airportLabel(item) : code;
  };

  function loadPrefs() {
    try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREF_KEY)) || {}) }; }
    catch { return { ...DEFAULT_PREFS }; }
  }

  function savePrefs(prefs) {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  }

  function getTravelerSummary() {
    try {
      const raw = JSON.parse(localStorage.getItem('avpro_travelers') || 'null');
      if (!raw) return 'Perfil padrão salvo';
      const adults = Number(raw.adults || raw.members?.filter?.(m => m.type === 'adult')?.length || 0);
      const children = Number(raw.children || raw.members?.filter?.(m => m.type === 'child')?.length || 0);
      return `${adults || 1} adulto(s)${children ? ` + ${children} criança(s)` : ''}`;
    } catch {
      return 'Perfil padrão salvo';
    }
  }

  const offers = [
    { origin: 'OAL', destination: 'GRU', program: 'azul', airline: 'Azul', payment: 'points' },
    { origin: 'CGB', destination: 'MCZ', program: 'latam', airline: 'LATAM', payment: 'cash' },
    { origin: 'PVH', destination: 'REC', program: 'smiles', airline: 'Smiles', payment: 'points' }
  ];

  function ensureControls() {
    const panel = document.querySelector('#dealList')?.closest('.panel');
    if (!panel || panel.querySelector('#featuredOfferProgram')) return;
    const head = panel.querySelector('.panel-head');
    const controls = document.createElement('div');
    controls.className = 'featured-offer-controls';
    controls.innerHTML = `
      <label>
        <span>Ofertas que quero receber</span>
        <select id="featuredOfferProgram">
          <option value="azul">Somente Azul Fidelidade</option>
          <option value="all">Todos os programas</option>
        </select>
      </label>
      <small id="featuredProfileNote"></small>
    `;
    head.insertAdjacentElement('afterend', controls);

    const prefs = loadPrefs();
    const select = controls.querySelector('#featuredOfferProgram');
    select.value = prefs.program;
    select.addEventListener('change', () => {
      prefs.program = select.value;
      savePrefs(prefs);
      renderFeaturedOffers();
    });
  }

  function programLabel(program) {
    return ({ azul: 'Azul Fidelidade', latam: 'LATAM Pass', smiles: 'Smiles' })[program] || program;
  }

  function prepareOffer(offer) {
    if (typeof window.showView === 'function') window.showView('search');
    else document.querySelector('[data-view="search"]')?.click();

    const origin = document.querySelector('#origin');
    const destination = document.querySelector('#destination');
    const anyDestination = document.querySelector('#anyDestination');
    const tripType = document.querySelector('#tripType');
    const preference = document.querySelector('#preference');
    const loyaltyProgram = document.querySelector('#loyaltyProgram');

    if (anyDestination) {
      anyDestination.checked = false;
      anyDestination.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (origin) origin.value = airportText(offer.origin);
    if (destination) destination.value = airportText(offer.destination);
    if (tripType) tripType.value = 'flight';
    if (preference) {
      preference.value = offer.payment === 'points' ? 'points' : 'cash';
      preference.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (loyaltyProgram) {
      loyaltyProgram.value = offer.program;
      loyaltyProgram.dispatchEvent(new Event('change', { bubbles: true }));
    }

    setTimeout(() => {
      const form = document.querySelector('#searchForm');
      if (form?.requestSubmit) form.requestSubmit();
      else form?.querySelector('button[type="submit"]')?.click();
    }, 250);
  }

  function renderFeaturedOffers() {
    ensureControls();
    const box = document.querySelector('#dealList');
    if (!box) return;
    const prefs = loadPrefs();
    const filtered = prefs.program === 'all' ? offers : offers.filter(o => o.program === prefs.program);
    const note = document.querySelector('#featuredProfileNote');
    if (note) note.textContent = `Usando ${getTravelerSummary()} e suas preferências salvas.`;

    if (!filtered.length) {
      box.innerHTML = '<div class="ai-note"><span>⌕</span><p>Nenhuma oferta disponível para o filtro selecionado.</p></div>';
      return;
    }

    box.innerHTML = filtered.map((offer, index) => `
      <button type="button" class="deal featured-offer" data-featured-index="${offers.indexOf(offer)}">
        <div class="logo">${offer.airline[0]}</div>
        <div class="deal-copy">
          <b>${offer.origin} → ${offer.destination}</b>
          <small>${programLabel(offer.program)} • ida e volta • perfil salvo</small>
          <em>Toque para abrir a busca preparada</em>
        </div>
        <div class="deal-price">
          <strong>${offer.payment === 'points' ? 'Consultar pontos reais' : 'Consultar preço real'}</strong>
          <small>Busca ao tocar</small>
        </div>
        <span class="featured-arrow">›</span>
      </button>
    `).join('');

    box.querySelectorAll('[data-featured-index]').forEach(button => {
      button.addEventListener('click', () => prepareOffer(offers[Number(button.dataset.featuredIndex)]));
    });
  }

  // Sobrescreve a renderização estática antiga depois que os demais scripts carregarem.
  window.addEventListener('load', () => setTimeout(renderFeaturedOffers, 50));
  document.addEventListener('DOMContentLoaded', () => setTimeout(renderFeaturedOffers, 100));
})();
