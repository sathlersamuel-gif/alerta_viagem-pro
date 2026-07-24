(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const programNames = { azul: 'Azul Fidelidade', latam: 'LATAM Pass', smiles: 'Smiles', all: 'Todos os programas' };
  const airlineMatches = {
    azul: (name='') => /azul/i.test(name),
    latam: (name='') => /latam/i.test(name),
    smiles: (name='') => /gol|smiles/i.test(name),
    all: () => true
  };

  function iata(value) {
    return (String(value || '').match(/\(([A-Z]{3})\)/) || String(value || '').match(/^([A-Z]{3})$/))?.[1] || '';
  }

  function googleFlightsUrl(search) {
    const from = iata(search.origin);
    const to = iata(search.destination);
    const out = search.departure || '';
    const back = search.return || '';
    const trip = back ? ` returning ${back}` : '';
    const query = `Flights from ${from} to ${to} on ${out}${trip}`;
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}&hl=pt-BR&curr=BRL`;
  }

  function officialProgramUrl(program) {
    if (program === 'azul') return 'https://www.voeazul.com.br/pt/pt/home/selecao-voo';
    if (program === 'latam') return 'https://www.latamairlines.com/br/pt';
    if (program === 'smiles') return 'https://www.smiles.com.br/';
    return 'https://www.google.com/travel/flights?hl=pt-BR&curr=BRL';
  }

  function openUrl(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function renderPointsMonitoring(search) {
    const program = search.loyaltyProgram || 'azul';
    const name = programNames[program] || 'Programa selecionado';
    const balance = Number(search.pointsBalance || 0);
    const balanceText = balance ? `${balance.toLocaleString('pt-BR')} pontos` : 'saldo cadastrado';
    const route = search.any ? 'Qualquer destino barato' : `${iata(search.origin)} → ${iata(search.destination)}`;
    const panel = $('#resultsPanel');
    const recommendation = $('#aiRecommendation');
    const cards = $('#resultCards');
    if (!panel || !recommendation || !cards) return;

    recommendation.innerHTML = `<b>✓ Monitoramento preparado</b><br>O sistema salvou ${route}, o perfil de viajantes e o filtro de ${name}. Você será avisado somente quando houver uma emissão real confirmada que caiba em ${balanceText}.`;
    cards.innerHTML = `
      <article class="result-card action-card points-monitor-card" role="button" tabindex="0" data-open-program="${program}">
        <span class="tag">MONITORAMENTO EM PONTOS</span>
        <h4>${name}</h4>
        <div class="route">${route}</div>
        <div class="price-main">Aguardando valor real</div>
        <div class="price-sub">Nenhuma pontuação estimada será exibida.</div>
        <div class="result-meta">
          <span>✓ Perfil de viajantes aplicado</span>
          <span>✓ Saldo máximo: ${balanceText}</span>
          <span>✓ Toque para consultar no canal oficial</span>
        </div>
        <button type="button" class="primary result-action">Abrir ${name}</button>
      </article>`;
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const card = cards.querySelector('[data-open-program]');
    const activate = () => openUrl(officialProgramUrl(program));
    card?.addEventListener('click', activate);
    card?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  }

  const originalRenderResults = window.renderResults;
  window.renderResults = function auditedRenderResults() {
    if (typeof originalRenderResults === 'function') originalRenderResults();
    const search = {
      origin: $('#origin')?.value || '', destination: $('#destination')?.value || '',
      departure: $('#departure')?.value || '', return: $('#return')?.value || ''
    };
    const selectedProgram = $('#loyaltyProgram')?.value || 'all';
    const preference = $('#preference')?.value || 'cash';

    $$('.result-card').forEach((card) => {
      const title = card.querySelector('h4')?.textContent || '';
      const tag = card.querySelector('.tag')?.textContent || '';
      if (preference === 'cash' && selectedProgram !== 'all' && /PASSAGEM/i.test(tag)) {
        const matcher = airlineMatches[selectedProgram] || airlineMatches.all;
        if (!matcher(title)) { card.remove(); return; }
      }
      card.classList.add('action-card');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      const isHotel = /HOTEL/i.test(tag);
      const label = isHotel ? 'Abrir opções de hotel' : 'Ver voo e reservar';
      if (!card.querySelector('.result-action')) card.insertAdjacentHTML('beforeend', `<button type="button" class="primary result-action">${label}</button>`);
      const activate = () => openUrl(isHotel ? `https://www.google.com/travel/hotels?q=${encodeURIComponent('Hotéis em ' + ($('#destination')?.value || ''))}&hl=pt-BR&curr=BRL` : googleFlightsUrl(search));
      card.addEventListener('click', (e) => { if (!e.target.closest('button')) activate(); });
      card.querySelector('.result-action')?.addEventListener('click', (e) => { e.stopPropagation(); activate(); });
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') activate(); });
    });
  };

  const form = $('#searchForm');
  if (form) {
    const previousSubmit = form.onsubmit;
    form.onsubmit = async function auditedSubmit(event) {
      const preference = $('#preference')?.value || 'cash';
      if (preference === 'points' || preference === 'mixed') {
        event.preventDefault();
        const ages = $$('.child-age').map((s) => Number(s.value));
        let wallet = {};
        try { wallet = JSON.parse(localStorage.getItem('avpro_state') || '{}').wallet || {}; } catch {}
        const selectedProgram = $('#loyaltyProgram')?.value || 'azul';
        const pointSearch = {
          origin: $('#origin')?.value || '', destination: $('#destination')?.value || '',
          any: Boolean($('#anyDestination')?.checked), departure: $('#departure')?.value || '', return: $('#return')?.value || '',
          adults: Number($('#adults')?.value || 1), children: Number($('#children')?.value || 0), ages,
          preference, loyaltyProgram: selectedProgram, tripType: $('#tripType')?.value || 'flight',
          onlyWithinPointsBalance: Boolean($('#onlyWithinPointsBalance')?.checked),
          pointsBalance: Number(wallet[programNames[selectedProgram]] || 0),
          createdAt: new Date().toISOString(), monitorPoints: true
        };
        if (!pointSearch.origin) return window.toast?.('Informe a origem');
        if (!pointSearch.departure) return window.toast?.('Informe a data de ida');
        if (!pointSearch.any && !pointSearch.destination) return window.toast?.('Informe o destino');
        window.__avproPointSearch = pointSearch;
        renderPointsMonitoring(pointSearch);
        return;
      }
      return previousSubmit?.call(this, event);
    };
  }

  const saveSearchButton = $('#saveSearch');
  saveSearchButton?.addEventListener('click', (event) => {
    const pointSearch = window.__avproPointSearch;
    if (!pointSearch || !['points','mixed'].includes(pointSearch.preference)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const savedState = JSON.parse(localStorage.getItem('avpro_state') || '{}');
      savedState.saved = Array.isArray(savedState.saved) ? savedState.saved : [];
      savedState.saved.unshift({ ...pointSearch, id: Date.now(), active: true });
      localStorage.setItem('avpro_state', JSON.stringify(savedState));
      window.toast?.('Busca em pontos salva e monitoramento ativado');
    } catch { window.toast?.('Não foi possível salvar a busca'); }
  }, true);

  const heroTitle = $('.hero-copy h2');
  const heroText = $('.hero-copy p');
  if (heroTitle) heroTitle.textContent = 'Encontre viagens que caibam nos seus pontos ou no seu orçamento.';
  if (heroText) heroText.textContent = 'Salve seus viajantes, escolha os programas de fidelidade e receba ofertas personalizadas de passagens, hotéis e pacotes.';
  const dealsTitle = $('#dealList')?.closest('.panel')?.querySelector('h3');
  if (dealsTitle) dealsTitle.textContent = 'Ofertas para o seu perfil';
  const submit = $('#searchForm button[type="submit"]');
  if (submit) submit.innerHTML = '<span>✦</span> Buscar ofertas';
  const footerCopy = $('.search-footer > div');
  if (footerCopy) footerCopy.innerHTML = '<b>Pontos sempre confirmados</b><small>Quando não houver fonte oficial conectada, o sistema prepara o monitoramento sem inventar valores.</small>';
})();