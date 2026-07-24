// Ofertas em destaque reais e clicáveis
(() => {
  const PREF_KEY = 'avpro_featured_offer_preferences';
  const DEFAULT_PREFS = { program: 'azul', useTravelerProfile: true };
  const fallbackOffers = [
    { origin: 'OAL', destination: 'GRU', program: 'azul', airline: 'Azul', payment: 'points', label: 'Consultar oferta' },
    { origin: 'PVH', destination: 'REC', program: 'azul', airline: 'Azul', payment: 'points', label: 'Consultar oferta' },
    { origin: 'CGB', destination: 'MCZ', program: 'azul', airline: 'Azul', payment: 'points', label: 'Consultar oferta' }
  ];
  let loadedOffers = [];

  const airportList = () => (typeof airports !== 'undefined' && Array.isArray(airports)) ? airports : [];
  const airportByCode = code => airportList().find(item => item[0] === code);
  const airportText = code => {
    const item = airportByCode(code);
    return item && typeof airportLabel === 'function' ? airportLabel(item) : code;
  };

  function loadPrefs() {
    try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREF_KEY)) || {}) }; }
    catch { return { ...DEFAULT_PREFS }; }
  }

  function savePrefs(prefs) { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }

  function getTravelerSummary() {
    try {
      const raw = JSON.parse(localStorage.getItem('avpro_travelers') || 'null');
      if (!raw) return 'Perfil padrão salvo';
      const adults = Number(raw.adults || raw.members?.filter?.(m => m.type === 'adult')?.length || 0);
      const children = Number(raw.children || raw.members?.filter?.(m => m.type === 'child')?.length || 0);
      return `${adults || 1} adulto(s)${children ? ` + ${children} criança(s)` : ''}`;
    } catch { return 'Perfil padrão salvo'; }
  }

  function ensureControls() {
    const panel = document.querySelector('#dealList')?.closest('.panel');
    if (!panel || panel.querySelector('#featuredOfferProgram')) return;
    const head = panel.querySelector('.panel-head');
    const controls = document.createElement('div');
    controls.className = 'featured-offer-controls';
    controls.innerHTML = `
      <label><span>Ofertas que quero receber</span>
        <select id="featuredOfferProgram">
          <option value="azul">Somente Azul Fidelidade</option>
          <option value="all">Todos os programas</option>
        </select>
      </label>
      <small id="featuredProfileNote"></small>`;
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
    if (typeof showView === 'function') showView('search');
    else document.querySelector('[data-view="search"]')?.click();
    const origin = document.querySelector('#origin');
    const destination = document.querySelector('#destination');
    const anyDestination = document.querySelector('#anyDestination');
    const tripType = document.querySelector('#tripType');
    const preference = document.querySelector('#preference');
    const loyaltyProgram = document.querySelector('#loyaltyProgram');
    const departure = document.querySelector('#departure');

    if (anyDestination) {
      anyDestination.checked = false;
      anyDestination.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (origin) origin.value = airportText(offer.origin);
    if (destination) destination.value = airportText(offer.destination);
    if (departure && offer.departure_date) departure.value = offer.departure_date;
    if (tripType) tripType.value = 'flight';
    if (preference) {
      preference.value = offer.payment === 'points' ? 'points' : 'cash';
      preference.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (loyaltyProgram) {
      loyaltyProgram.value = offer.program || 'azul';
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
    const source = loadedOffers.length ? loadedOffers : fallbackOffers;
    const filtered = prefs.program === 'all' ? source : source.filter(o => o.program === prefs.program);
    const note = document.querySelector('#featuredProfileNote');
    if (note) note.textContent = loadedOffers.length
      ? `Ofertas públicas reais da Azul • ${getTravelerSummary()}`
      : `Rotas preparadas para consulta • ${getTravelerSummary()}`;

    if (!filtered.length) {
      box.innerHTML = '<div class="ai-note"><span>⌕</span><p>Nenhuma oferta pública disponível agora. Toque em Nova busca para pesquisar uma rota específica.</p></div>';
      return;
    }

    box.innerHTML = filtered.slice(0,6).map((offer, index) => `
      <button type="button" class="deal featured-offer" data-featured-index="${index}">
        <div class="logo">${(offer.airline || 'Azul')[0]}</div>
        <div class="deal-copy">
          <b>${offer.origin} → ${offer.destination}</b>
          <small>${programLabel(offer.program || 'azul')} • ${offer.departure_date ? offer.departure_date.split('-').reverse().join('/') : 'data flexível'}</small>
          <em>Toque para abrir a busca preparada</em>
        </div>
        <div class="deal-price">
          <strong>${offer.points ? `${Number(offer.points).toLocaleString('pt-BR')} pontos` : (offer.label || 'Consultar oferta')}</strong>
          <small>${offer.points ? 'por pessoa' : 'Buscar agora'}</small>
        </div>
        <span class="featured-arrow">›</span>
      </button>`).join('');

    box.querySelectorAll('[data-featured-index]').forEach(button => {
      button.addEventListener('click', () => prepareOffer(filtered[Number(button.dataset.featuredIndex)]));
    });
  }

  async function loadRealOffers() {
    const box = document.querySelector('#dealList');
    if (box) box.innerHTML = '<div class="ai-note"><span>✦</span><p>Buscando ofertas públicas reais da Azul...</p></div>';
    try {
      const response = await fetch('/api/azul-points', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Falha ao consultar ofertas');
      loadedOffers = (Array.isArray(data.offers) ? data.offers : [])
        .filter(o => o.origin && o.destination && Number(o.points) > 0)
        .map(o => ({ ...o, program: 'azul', airline: 'Azul', payment: 'points' }));
    } catch (error) {
      console.error('Featured offers error:', error);
      loadedOffers = [];
    }
    renderFeaturedOffers();
  }

  window.addEventListener('load', () => setTimeout(loadRealOffers, 80));
  document.addEventListener('DOMContentLoaded', () => setTimeout(loadRealOffers, 120));
})();

(() => {
  if (document.querySelector('script[data-monitoring-loader]')) return;
  const script = document.createElement('script');
  script.src = 'monitoring.js?v=2';
  script.defer = true;
  script.dataset.monitoringLoader = '1';
  document.body.appendChild(script);
})();