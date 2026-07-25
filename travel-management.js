(() => {
  const KEY = 'avpro_managed_trips';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const airportData = () => (typeof airports !== 'undefined' && Array.isArray(airports) ? airports : []);
  const extractCode = v => (((String(v || '').match(/\(([A-Z]{3})\)/i) || String(v || '').match(/^([A-Z]{3})$/i)) || [])[1] || '').toUpperCase();
  const resolveAirport = v => {
    const raw = String(v || '').trim();
    const code = extractCode(raw);
    if (code) return airportData().find(a => a[0] === code) || null;
    const q = norm(raw);
    return q ? airportData().find(a => norm(a[1]) === q) || airportData().find(a => norm(a.join(' ')).includes(q)) || null : null;
  };
  const airportLabel = a => `${a[1]} (${a[0]}) — ${a[3]}${a[2] ? `, ${a[2]}` : ''}`;
  const fmt = v => v ? new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR') : '';

  function readTrips() {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        const parsed = JSON.parse(storage.getItem(KEY) || '[]');
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  }

  function writeTrips(items) {
    const text = JSON.stringify(items);
    let saved = false;
    try { localStorage.setItem(KEY, text); saved = localStorage.getItem(KEY) === text; } catch {}
    if (!saved) {
      try { sessionStorage.setItem(KEY, text); saved = sessionStorage.getItem(KEY) === text; } catch {}
    }
    if (!saved) throw new Error('O navegador bloqueou o armazenamento local.');
  }

  const nav = $('.sidebar nav');
  if (nav && !$('[data-view="travel-management"]')) {
    const button = document.createElement('button');
    button.className = 'nav-item';
    button.dataset.view = 'travel-management';
    button.innerHTML = '<span>◷</span>Gerenciamento de viagens';
    nav.insertBefore(button, $('[data-view="alerts"]'));
  }

  const main = $('.main');
  if (!main) return;
  let view = $('#view-travel-management');
  if (!view) {
    view = document.createElement('section');
    view.className = 'view';
    view.id = 'view-travel-management';
    view.innerHTML = `
      <section class="panel glass managed-panel">
        <div class="panel-head"><div><span class="eyebrow">MONITORAMENTO INTELIGENTE</span><h3>Gerenciamento de viagens</h3></div><button class="primary compact" id="newManagedTrip">+ Nova viagem</button></div>
        <p class="info-note">Digite a cidade ou aeroporto e selecione a opção correta.</p>
        <div id="managedTripFormWrap" class="managed-form-wrap hidden">
          <form id="managedTripForm" class="form-grid" novalidate>
            <input type="hidden" id="managedTripId">
            <div class="field span-2"><label>Local de origem</label><input id="managedOrigin" autocomplete="off"><input type="hidden" id="managedOriginCode"></div>
            <div class="field span-2"><label>Local de destino</label><input id="managedDestination" autocomplete="off"><input type="hidden" id="managedDestinationCode"></div>
            <div class="field span-2"><label>Data de ida</label><input type="date" id="managedDeparture"></div>
            <div class="field span-2"><label>Data de volta</label><input type="date" id="managedReturn"></div>
            <div class="field"><label>Adultos</label><input type="number" id="managedAdults" min="1" max="9" value="1"></div>
            <div class="field"><label>Crianças</label><input type="number" id="managedChildren" min="0" max="8" value="0"></div>
            <div class="field span-2"><label>Preferência</label><select id="managedPreference"><option value="mixed">Pontos + reais</option><option value="points">Somente pontos</option><option value="cash">Somente reais</option></select></div>
            <div class="field span-2"><label>Receber por</label><select id="managedChannel"><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="both">WhatsApp e e-mail</option></select></div>
            <div class="field span-2"><label>Frequência dos avisos</label><select id="managedFrequency"><option value="instant">Quando encontrar algo melhor</option><option value="daily">Resumo diário</option><option value="weekly">Resumo semanal</option></select></div>
            <label class="switch-line span-4"><input type="checkbox" id="managedAgentSuggestions" checked><span class="switch"></span><span><b>Modo agente de viagem</b><small>Sugere horários, companhias, escalas e opções úteis.</small></span></label>
            <label class="switch-line span-4"><input type="checkbox" id="managedExtraAlternative"><span class="switch"></span><span><b>Permitir uma consulta alternativa</b><small>Somente se a rota principal não tiver resultado.</small></span></label>
            <div id="managedSaveMessage" class="span-4" role="status"></div>
            <div class="span-4 managed-actions"><button class="primary" id="saveManagedTripButton" type="submit">Salvar e ativar viagem</button><button class="secondary" type="button" id="cancelManagedTrip">Cancelar</button></div>
          </form>
        </div>
        <div id="managedTripList" class="saved-list"></div>
      </section>`;
    main.appendChild(view);
  }

  if (!$('#managedSaveFixStyle')) {
    const style = document.createElement('style');
    style.id = 'managedSaveFixStyle';
    style.textContent = `.managed-form-wrap{margin:16px 0;padding:16px;border-radius:18px;border:1px solid rgba(115,196,255,.22);background:#0b1d31}.managed-form-wrap.hidden{display:none}.managed-actions{display:flex;gap:10px}.managed-actions button{min-height:52px}.managed-trip-card{padding:16px;border:1px solid rgba(115,196,255,.18);border-radius:16px;margin-bottom:12px;background:#0b1d31}.managed-meta{display:grid;gap:5px;color:#afc6d9;font-size:13px}.managed-card-actions{display:flex;gap:8px;margin-top:12px}.managed-card-actions button{flex:1}.managed-empty{padding:28px;text-align:center;color:#afc6d9}#managedSaveMessage{display:none;padding:12px;border-radius:12px;background:rgba(255,170,30,.12)}#managedSaveMessage.ok{display:block;background:rgba(43,227,140,.12)}@media(max-width:768px){.managed-actions,.managed-card-actions{flex-direction:column}.managed-actions button{width:100%}}`;
    document.head.appendChild(style);
  }

  const message = (text, ok = false) => {
    const box = $('#managedSaveMessage');
    if (!box) return;
    box.textContent = text;
    box.classList.toggle('ok', ok);
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  function render() {
    const list = $('#managedTripList');
    if (!list) return;
    const items = readTrips();
    if (!items.length) { list.innerHTML = '<div class="managed-empty">Nenhuma viagem salva ainda.</div>'; return; }
    list.innerHTML = items.map(item => `<article class="managed-trip-card" data-id="${item.id}"><h4>${item.originLabel || item.origin} → ${item.destinationLabel || item.destination}</h4><div class="managed-meta"><span>Aeroportos: ${item.origin} → ${item.destination}</span><span>Ida: ${fmt(item.departure)}${item.return ? ` • Volta: ${fmt(item.return)}` : ''}</span><span>${item.adults} adulto(s)${item.children ? ` • ${item.children} criança(s)` : ''}</span><span>Status: ${item.active ? 'Monitorando' : 'Pausado'}</span></div><div class="managed-card-actions"><button class="secondary" data-toggle>${item.active ? 'Pausar' : 'Ativar'}</button><button class="secondary" data-delete>Excluir</button></div></article>`).join('');
    $$('.managed-trip-card', list).forEach(card => {
      const id = Number(card.dataset.id);
      $('[data-toggle]', card).onclick = () => { const all = readTrips(); const item = all.find(x => x.id === id); if (item) item.active = !item.active; writeTrips(all); render(); };
      $('[data-delete]', card).onclick = () => { writeTrips(readTrips().filter(x => x.id !== id)); render(); };
    });
  }

  function openView() {
    $$('.view').forEach(v => v.classList.remove('active'));
    $$('.nav-item').forEach(b => b.classList.remove('active'));
    view.classList.add('active');
    $('[data-view="travel-management"]')?.classList.add('active');
    if ($('#pageTitle')) $('#pageTitle').textContent = 'Gerenciamento de viagens';
    render();
  }

  $('[data-view="travel-management"]')?.addEventListener('click', openView);
  $('#newManagedTrip')?.addEventListener('click', () => $('#managedTripFormWrap')?.classList.remove('hidden'));
  $('#cancelManagedTrip')?.addEventListener('click', () => $('#managedTripFormWrap')?.classList.add('hidden'));

  const form = $('#managedTripForm');
  const saveHandler = event => {
    event?.preventDefault();
    event?.stopPropagation();
    const originText = $('#managedOrigin')?.value.trim() || '';
    const destinationText = $('#managedDestination')?.value.trim() || '';
    const originAirport = resolveAirport(originText);
    const destinationAirport = resolveAirport(destinationText);
    const origin = ($('#managedOriginCode')?.value || extractCode(originText) || originAirport?.[0] || '').toUpperCase();
    const destination = ($('#managedDestinationCode')?.value || extractCode(destinationText) || destinationAirport?.[0] || '').toUpperCase();
    const departure = $('#managedDeparture')?.value || '';
    const returnDate = $('#managedReturn')?.value || '';
    if (!origin) return message('Informe uma origem válida, como Cacoal (OAL).');
    if (!destination) return message('Informe um destino válido.');
    if (!departure) return message('Informe a data de ida.');
    if (returnDate && returnDate < departure) return message('A data de volta não pode ser anterior à ida.');

    const button = $('#saveManagedTripButton');
    if (button) { button.disabled = true; button.textContent = 'Salvando viagem...'; }
    try {
      const id = Number($('#managedTripId')?.value || 0) || Date.now();
      const item = { id, origin, destination, originLabel: originAirport ? airportLabel(originAirport) : originText, destinationLabel: destinationAirport ? airportLabel(destinationAirport) : destinationText, departure, return: returnDate, adults: Math.max(1, Number($('#managedAdults')?.value || 1)), children: Math.max(0, Number($('#managedChildren')?.value || 0)), preference: $('#managedPreference')?.value || 'mixed', channel: $('#managedChannel')?.value || 'whatsapp', frequency: $('#managedFrequency')?.value || 'instant', agentSuggestions: !!$('#managedAgentSuggestions')?.checked, extraAlternative: !!$('#managedExtraAlternative')?.checked, active: true, updatedAt: new Date().toISOString() };
      const items = readTrips();
      const index = items.findIndex(x => x.id === id);
      if (index >= 0) items[index] = { ...items[index], ...item }; else items.unshift({ ...item, createdAt: new Date().toISOString() });
      writeTrips(items);
      render();
      message('Viagem salva e monitoramento ativado.', true);
      setTimeout(() => $('#managedTripFormWrap')?.classList.add('hidden'), 900);
    } catch (error) {
      console.error(error);
      message(`Não foi possível salvar: ${error.message || 'erro do navegador'}.`);
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Salvar e ativar viagem'; }
    }
  };

  form?.addEventListener('submit', saveHandler, true);
  $('#saveManagedTripButton')?.addEventListener('click', saveHandler, true);
  render();
})();