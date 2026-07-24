(() => {
  const KEY = 'avpro_managed_trips';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = items => localStorage.setItem(KEY, JSON.stringify(items));
  const fmt = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '';

  const nav = $('.sidebar nav');
  if (nav && !$('[data-view="travel-management"]')) {
    const button = document.createElement('button');
    button.className = 'nav-item';
    button.dataset.view = 'travel-management';
    button.innerHTML = '<span>◷</span>Gerenciamento de viagens';
    nav.insertBefore(button, $('[data-view="alerts"]'));
  }

  const main = $('.main');
  if (!main || $('#view-travel-management')) return;

  const view = document.createElement('section');
  view.className = 'view';
  view.id = 'view-travel-management';
  view.innerHTML = `
    <section class="panel glass">
      <div class="panel-head">
        <div><span class="eyebrow">VIAGENS SALVAS</span><h3>Gerenciamento de viagens</h3></div>
        <button class="primary compact" id="newManagedTrip">+ Nova viagem</button>
      </div>
      <p class="info-note">Cadastre uma vez. A viagem fica salva para o monitoramento usar como referência.</p>
      <div id="managedTripFormWrap" class="managed-form-wrap hidden">
        <form id="managedTripForm" class="form-grid">
          <input type="hidden" id="managedTripId">
          <div class="field span-2"><label>Origem</label><input id="managedOrigin" placeholder="Cidade ou aeroporto" required></div>
          <div class="field span-2"><label>Destino</label><input id="managedDestination" placeholder="Cidade ou aeroporto" required></div>
          <div class="field span-2"><label>Data escolhida</label><input type="date" id="managedDeparture" required></div>
          <div class="field span-2"><label>Volta</label><input type="date" id="managedReturn"></div>
          <div class="field"><label>Adultos</label><input type="number" id="managedAdults" min="1" value="1" required></div>
          <div class="field"><label>Crianças</label><input type="number" id="managedChildren" min="0" value="0"></div>
          <div class="field span-2"><label>Preferência</label><select id="managedPreference"><option value="points">Somente pontos</option><option value="cash">Somente reais</option><option value="mixed">Pontos + reais</option></select></div>
          <div class="field span-2"><label>Receber por</label><select id="managedChannel"><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="both">WhatsApp e e-mail</option></select></div>
          <div class="field span-2"><label>Frequência</label><select id="managedFrequency"><option value="instant">Quando encontrar algo melhor</option><option value="daily">Resumo diário</option><option value="weekly">Resumo semanal</option></select></div>
          <div class="span-4 managed-actions"><button class="primary" type="submit">Salvar viagem</button><button class="secondary" type="button" id="cancelManagedTrip">Cancelar</button></div>
        </form>
      </div>
      <div id="managedTripList" class="saved-list"></div>
    </section>`;
  main.appendChild(view);

  const style = document.createElement('style');
  style.textContent = `
    .managed-form-wrap{margin:16px 0;padding:16px;border-radius:18px;border:1px solid rgba(115,196,255,.22);background:rgba(255,255,255,.025)}
    .managed-form-wrap.hidden{display:none}.managed-actions{display:flex;gap:10px}.managed-trip-card{padding:16px;border:1px solid rgba(115,196,255,.18);border-radius:16px;margin-bottom:12px;background:rgba(255,255,255,.025)}
    .managed-trip-card h4{margin:0 0 8px}.managed-meta{display:grid;gap:5px;color:#afc6d9;font-size:13px}.managed-card-actions{display:flex;gap:8px;margin-top:12px}.managed-card-actions button{flex:1}.managed-empty{padding:28px;text-align:center;color:#afc6d9}
    @media(max-width:768px){.managed-actions,.managed-card-actions{flex-direction:column}.managed-form-wrap{padding:14px}}
  `;
  document.head.appendChild(style);

  function preferenceLabel(value) {
    return value === 'points' ? 'Somente pontos' : value === 'cash' ? 'Somente reais' : 'Pontos + reais';
  }

  function channelLabel(value) {
    return value === 'whatsapp' ? 'WhatsApp' : value === 'email' ? 'E-mail' : 'WhatsApp e e-mail';
  }

  function openView() {
    $$('.view').forEach(v => v.classList.remove('active'));
    $$('.nav-item').forEach(b => b.classList.remove('active'));
    view.classList.add('active');
    $('[data-view="travel-management"]')?.classList.add('active');
    const title = $('#pageTitle'); if (title) title.textContent = 'Gerenciamento de viagens';
    render();
  }

  $('[data-view="travel-management"]')?.addEventListener('click', openView);

  function resetForm() {
    $('#managedTripForm').reset();
    $('#managedTripId').value = '';
    $('#managedAdults').value = '1';
    $('#managedChildren').value = '0';
  }

  function render() {
    const list = $('#managedTripList');
    const items = load();
    if (!items.length) {
      list.innerHTML = '<div class="managed-empty">Nenhuma viagem salva ainda.</div>';
      return;
    }
    list.innerHTML = items.map(item => `
      <article class="managed-trip-card" data-id="${item.id}">
        <h4>${item.origin} → ${item.destination}</h4>
        <div class="managed-meta">
          <span>Data: ${fmt(item.departure)}${item.return ? ` • volta ${fmt(item.return)}` : ''}</span>
          <span>${item.adults} adulto(s)${item.children ? ` • ${item.children} criança(s)` : ''}</span>
          <span>Preferência: ${preferenceLabel(item.preference)}</span>
          <span>Avisos: ${channelLabel(item.channel)} • ${item.frequency === 'instant' ? 'quando melhorar' : item.frequency === 'daily' ? 'diário' : 'semanal'}</span>
          <span>Status: ${item.active ? 'Monitorando' : 'Pausado'}</span>
        </div>
        <div class="managed-card-actions">
          <button class="secondary" data-edit>Editar</button>
          <button class="secondary" data-toggle>${item.active ? 'Pausar' : 'Ativar'}</button>
          <button class="secondary" data-delete>Excluir</button>
        </div>
      </article>`).join('');

    $$('.managed-trip-card', list).forEach(card => {
      const id = Number(card.dataset.id);
      $('[data-edit]', card).onclick = () => {
        const item = load().find(x => x.id === id); if (!item) return;
        $('#managedTripId').value = item.id;
        $('#managedOrigin').value = item.origin;
        $('#managedDestination').value = item.destination;
        $('#managedDeparture').value = item.departure;
        $('#managedReturn').value = item.return || '';
        $('#managedAdults').value = item.adults;
        $('#managedChildren').value = item.children;
        $('#managedPreference').value = item.preference;
        $('#managedChannel').value = item.channel;
        $('#managedFrequency').value = item.frequency;
        $('#managedTripFormWrap').classList.remove('hidden');
      };
      $('[data-toggle]', card).onclick = () => {
        const all = load(); const item = all.find(x => x.id === id); if (item) item.active = !item.active; save(all); render();
      };
      $('[data-delete]', card).onclick = () => { save(load().filter(x => x.id !== id)); render(); };
    });
  }

  $('#newManagedTrip').onclick = () => { resetForm(); $('#managedTripFormWrap').classList.remove('hidden'); };
  $('#cancelManagedTrip').onclick = () => { resetForm(); $('#managedTripFormWrap').classList.add('hidden'); };

  $('#managedTripForm').addEventListener('submit', event => {
    event.preventDefault();
    const id = Number($('#managedTripId').value || 0);
    const item = {
      id: id || Date.now(),
      origin: $('#managedOrigin').value.trim(),
      destination: $('#managedDestination').value.trim(),
      departure: $('#managedDeparture').value,
      return: $('#managedReturn').value,
      adults: Number($('#managedAdults').value || 1),
      children: Number($('#managedChildren').value || 0),
      preference: $('#managedPreference').value,
      channel: $('#managedChannel').value,
      frequency: $('#managedFrequency').value,
      active: true,
      internalFlexDays: 5,
      updatedAt: new Date().toISOString()
    };
    const items = load();
    const index = items.findIndex(x => x.id === item.id);
    if (index >= 0) items[index] = { ...items[index], ...item };
    else items.unshift({ ...item, createdAt: new Date().toISOString() });
    save(items);
    resetForm();
    $('#managedTripFormWrap').classList.add('hidden');
    render();
    window.toast?.('Viagem salva e monitoramento ativado');
  });

  render();
})();