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

  function formatDate(value) {
    if (!value) return '';
    return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
  }

  function googleFlightsUrl(search) {
    const from = iata(search.origin);
    const to = iata(search.destination);
    const trip = search.return ? ` returning ${search.return}` : '';
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${from} to ${to} on ${search.departure}${trip}`)}&hl=pt-BR&curr=BRL`;
  }

  function officialProgramUrl(program) {
    if (program === 'azul') return 'https://passagens.voeazul.com.br/pt/pontos';
    if (program === 'latam') return 'https://www.latamairlines.com/br/pt';
    if (program === 'smiles') return 'https://www.smiles.com.br/';
    return 'https://www.google.com/travel/flights?hl=pt-BR&curr=BRL';
  }

  function openUrl(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function bindActionCards() {
    $$('.result-card[data-open-url]').forEach((card) => {
      if (card.dataset.bound === '1') return;
      card.dataset.bound = '1';
      const activate = () => openUrl(card.dataset.openUrl);
      card.addEventListener('click', (event) => { if (!event.target.closest('button')) activate(); });
      card.querySelector('.result-action')?.addEventListener('click', (event) => { event.stopPropagation(); activate(); });
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
    });
  }

  function showPanel(message, html) {
    const panel = $('#resultsPanel');
    const recommendation = $('#aiRecommendation');
    const cards = $('#resultCards');
    if (!panel || !recommendation || !cards) return;
    recommendation.innerHTML = message;
    cards.innerHTML = html;
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    bindActionCards();
  }

  async function searchAzulPoints(search) {
    const origin = iata(search.origin);
    const destination = iata(search.destination);
    const balance = Number(search.pointsBalance || 0);

    showPanel('<b>Consultando ofertas oficiais da Azul em pontos…</b><br>Aguarde alguns segundos.', '<article class="result-card"><h4>Buscando na Azul</h4><div class="price-sub">Consulta gratuita à página pública oficial.</div></article>');

    const params = new URLSearchParams({ origin, destination, departure_date: search.departure });
    if (search.onlyWithinPointsBalance && balance) params.set('max_points', String(balance));

    try {
      const response = await fetch(`/api/azul-points?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha na consulta');

      const offers = Array.isArray(data.offers) ? data.offers : [];
      if (!offers.length) {
        const route = `${origin} → ${destination}`;
        showPanel(
          `<b>Nenhuma oferta pública encontrada para ${route} nessa data.</b><br>A Azul divulga apenas parte das tarifas em pontos na página pública. A busca ficou salva para novas verificações.`,
          `<article class="result-card action-card" role="button" tabindex="0" data-open-url="${officialProgramUrl('azul')}"><span class="tag">AZUL FIDELIDADE</span><h4>${route}</h4><div class="price-main">Sem oferta pública agora</div><div class="price-sub">Toque para consultar todo o inventário diretamente na Azul.</div><button type="button" class="primary result-action">Abrir Azul</button></article>`
        );
        return;
      }

      const cards = offers.slice(0, 20).map((offer) => {
        const totalPoints = offer.points * Math.max(1, search.adults + search.children);
        const fits = balance ? totalPoints <= balance : null;
        const status = fits === null ? 'Saldo não informado' : fits ? '✓ Cabe no seu saldo' : 'Saldo insuficiente';
        return `<article class="result-card action-card" role="button" tabindex="0" data-open-url="${officialProgramUrl('azul')}">
          <span class="tag">OFERTA OFICIAL AZUL</span>
          <h4>${offer.origin_city} (${offer.origin}) → ${offer.destination_city} (${offer.destination})</h4>
          <div class="route">Ida em ${formatDate(offer.departure_date)}</div>
          <div class="price-main">${offer.points.toLocaleString('pt-BR')} pontos por pessoa</div>
          <div class="price-sub">Total estimado para ${search.adults + search.children} passageiro(s): ${totalPoints.toLocaleString('pt-BR')} pontos</div>
          <div class="result-meta"><span>${status}</span><span>Divulgada pela Azul nas últimas 48 horas</span><span>Valor sujeito a confirmação na reserva</span></div>
          <button type="button" class="primary result-action">Abrir Azul e reservar</button>
        </article>`;
      }).join('');

      showPanel(`<b>✓ Encontramos ${offers.length} oferta(s) oficial(is) da Azul em pontos.</b><br>Os valores vêm da página pública da própria Azul e são confirmados ao abrir a reserva.`, cards);
    } catch (error) {
      showPanel(`<b>Não foi possível consultar a Azul agora.</b><br>${error.message}`, `<article class="result-card action-card" role="button" tabindex="0" data-open-url="${officialProgramUrl('azul')}"><h4>Abrir consulta oficial</h4><button type="button" class="primary result-action">Abrir Azul</button></article>`);
    }
  }

  const originalRenderResults = window.renderResults;
  window.renderResults = function auditedRenderResults() {
    if (typeof originalRenderResults === 'function') originalRenderResults();
    const search = { origin: $('#origin')?.value || '', destination: $('#destination')?.value || '', departure: $('#departure')?.value || '', return: $('#return')?.value || '' };
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
      const url = isHotel ? `https://www.google.com/travel/hotels?q=${encodeURIComponent('Hotéis em ' + ($('#destination')?.value || ''))}&hl=pt-BR&curr=BRL` : googleFlightsUrl(search);
      card.dataset.openUrl = url;
      if (!card.querySelector('.result-action')) card.insertAdjacentHTML('beforeend', `<button type="button" class="primary result-action">${isHotel ? 'Abrir opções de hotel' : 'Ver voo e reservar'}</button>`);
    });
    bindActionCards();
  };

  const form = $('#searchForm');
  if (form) {
    const previousSubmit = form.onsubmit;
    form.onsubmit = async function auditedSubmit(event) {
      const preference = $('#preference')?.value || 'cash';
      if (preference === 'points' || preference === 'mixed') {
        event.preventDefault();
        let wallet = {};
        try { wallet = JSON.parse(localStorage.getItem('avpro_state') || '{}').wallet || {}; } catch {}
        const selectedProgram = $('#loyaltyProgram')?.value || 'azul';
        const search = {
          origin: $('#origin')?.value || '', destination: $('#destination')?.value || '', departure: $('#departure')?.value || '', return: $('#return')?.value || '',
          adults: Number($('#adults')?.value || 1), children: Number($('#children')?.value || 0), preference,
          loyaltyProgram: selectedProgram, onlyWithinPointsBalance: Boolean($('#onlyWithinPointsBalance')?.checked),
          pointsBalance: Number(wallet[programNames[selectedProgram]] || 0), createdAt: new Date().toISOString(), monitorPoints: true
        };
        if (!search.origin) return window.toast?.('Informe a origem');
        if (!search.departure) return window.toast?.('Informe a data de ida');
        if (!search.destination) return window.toast?.('Informe o destino');
        if (selectedProgram !== 'azul') return showPanel(`<b>${programNames[selectedProgram]} ainda não possui fonte gratuita conectada.</b><br>Selecione Azul Fidelidade para consultar pontos reais sem mensalidade.`, `<article class="result-card"><h4>Fonte ainda indisponível</h4></article>`);
        window.__avproPointSearch = search;
        await searchAzulPoints(search);
        return;
      }
      return previousSubmit?.call(this, event);
    };
  }

  const saveSearchButton = $('#saveSearch');
  saveSearchButton?.addEventListener('click', (event) => {
    const search = window.__avproPointSearch;
    if (!search) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      const state = JSON.parse(localStorage.getItem('avpro_state') || '{}');
      state.saved = Array.isArray(state.saved) ? state.saved : [];
      state.saved.unshift({ ...search, id: Date.now(), active: true });
      localStorage.setItem('avpro_state', JSON.stringify(state));
      window.toast?.('Busca em pontos salva');
    } catch { window.toast?.('Não foi possível salvar a busca'); }
  }, true);

  const heroTitle = $('.hero-copy h2');
  if (heroTitle) heroTitle.textContent = 'Encontre viagens que caibam nos seus pontos ou no seu orçamento.';
  const footerCopy = $('.search-footer > div');
  if (footerCopy) footerCopy.innerHTML = '<b>Pontos reais da Azul</b><small>Consulta gratuita às ofertas públicas oficiais, sem inventar conversão de reais para pontos.</small>';
})();
