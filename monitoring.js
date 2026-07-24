(() => {
  const KEY = 'avpro_monitors';
  const INTERNAL_FLEX_DAYS = 5;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = (items) => localStorage.setItem(KEY, JSON.stringify(items));
  const formatDate = (v) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informada';
  const labels = {
    preference: { points: 'Somente pontos', cash: 'Somente reais', mixed: 'Pontos + reais' },
    channel: { whatsapp: 'WhatsApp', email: 'E-mail', both: 'WhatsApp e e-mail' },
    frequency: { instant: 'Quando surgir algo melhor', daily: 'Resumo diário', weekly: 'Resumo semanal' },
    program: { azul: 'Azul Fidelidade', latam: 'LATAM Pass', smiles: 'Smiles', all: 'Todos os programas' }
  };

  document.querySelector('#monitorPreferences')?.remove();

  const savedNav = document.querySelector('[data-view="saved"]');
  if (savedNav) savedNav.innerHTML = '<span>◎</span>Gerenciamento de viagens';

  const savedView = document.querySelector('#view-saved');
  if (!savedView) return;
  savedView.innerHTML = `
    <section class="panel glass">
      <div class="panel-head">
        <div><span class="eyebrow">MONITORAMENTO INTELIGENTE</span><h3>Gerenciamento de viagens</h3></div>
        <button id="newManagedTrip" class="primary compact" type="button">+ Nova viagem</button>
      </div>
      <p class="management-intro">Cadastre uma viagem uma única vez. A IA usará essas informações para procurar oportunidades e enviar os avisos escolhidos.</p>
      <div id="managedTripFormWrap" class="managed-form-wrap hidden">
        <form id="managedTripForm" class="form-grid">
          <div class="field span-2"><label>Origem</label><input id="mOrigin" placeholder="Cidade ou aeroporto" required></div>
          <div class="field span-2"><label>Destino</label><input id="mDestination" placeholder="Cidade ou aeroporto" required></div>
          <div class="field"><label>Data de ida</label><input type="date" id="mDeparture" required></div>
          <div class="field"><label>Data de volta</label><input type="date" id="mReturn"></div>
          <div class="field"><label>Adultos</label><input type="number" id="mAdults" min="1" value="1" required></div>
          <div class="field"><label>Crianças</label><input type="number" id="mChildren" min="0" value="0"></div>
          <div id="mChildAges" class="child-ages span-4 hidden"></div>
          <div class="field span-2"><label>Preferência</label><select id="mPreference"><option value="mixed">Pontos + reais</option><option value="points">Somente pontos</option><option value="cash">Somente reais</option></select></div>
          <div class="field span-2"><label>Programa de fidelidade</label><select id="mProgram"><option value="azul">Azul Fidelidade</option><option value="latam">LATAM Pass</option><option value="smiles">Smiles</option><option value="all">Todos os programas</option></select></div>
          <div class="field span-2"><label>Receber por</label><select id="mChannel"><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="both">WhatsApp e e-mail</option></select></div>
          <div class="field span-2"><label>Frequência dos avisos</label><select id="mFrequency"><option value="instant">Quando surgir algo melhor</option><option value="daily">Resumo diário</option><option value="weekly">Resumo semanal</option></select></div>
          <div class="span-4 managed-form-actions"><button class="primary" type="submit">Salvar e ativar viagem</button><button id="cancelManagedTrip" class="secondary" type="button">Cancelar</button></div>
        </form>
      </div>
      <div id="managedTripList" class="saved-list"></div>
    </section>`;

  const style = document.createElement('style');
  style.textContent = `.management-intro{margin:0 0 18px;color:#9fb6ca;line-height:1.55}.managed-form-wrap{padding:18px;margin-bottom:20px;border:1px solid rgba(115,196,255,.18);border-radius:16px;background:rgba(255,255,255,.025)}.managed-form-actions{display:flex;gap:10px;flex-wrap:wrap}.managed-trip-card{padding:16px;border:1px solid rgba(115,196,255,.2);border-radius:16px;margin-bottom:12px;background:rgba(255,255,255,.03)}.managed-trip-card h4{margin:0 0 8px}.managed-trip-meta{display:grid;gap:6px;color:#afc6d9;font-size:13px}.managed-trip-actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}.managed-trip-actions button{flex:1;min-width:90px}.managed-empty{padding:28px;text-align:center;color:#afc6d9}.child-age-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}@media(max-width:768px){.managed-form-wrap{padding:14px}.managed-trip-actions button{min-width:calc(50% - 4px)}}`;
  document.head.appendChild(style);

  const formWrap = $('#managedTripFormWrap');
  const form = $('#managedTripForm');
  const list = $('#managedTripList');

  function setFormOpen(open) {
    formWrap.classList.toggle('hidden', !open);
    if (open) setTimeout(() => $('#mOrigin')?.focus(), 50);
  }

  function renderChildAges() {
    const count = Math.max(0, Number($('#mChildren').value || 0));
    const box = $('#mChildAges');
    box.classList.toggle('hidden', count === 0);
    box.innerHTML = count ? `<label>Idade das crianças</label><div class="child-age-grid">${Array.from({ length: count }, (_, i) => `<div class="field"><input type="number" class="mChildAge" min="0" max="17" placeholder="Criança ${i + 1}" required></div>`).join('')}</div>` : '';
  }

  function render() {
    const items = load();
    if (!items.length) {
      list.innerHTML = '<div class="managed-empty">Nenhuma viagem cadastrada para monitoramento.</div>';
      return;
    }
    list.innerHTML = items.map(item => {
      const adults = Number(item.adults ?? item.passengers ?? 1);
      const children = Number(item.children ?? 0);
      return `<article class="managed-trip-card" data-id="${item.id}">
        <h4>${item.origin} → ${item.destination}</h4>
        <div class="managed-trip-meta">
          <span>Ida: ${formatDate(item.departure)}${item.return ? ` • Volta: ${formatDate(item.return)}` : ''}</span>
          <span>${adults} adulto(s)${children ? ` • ${children} criança(s)` : ''}</span>
          <span>Preferência: ${labels.preference[item.preference] || 'Pontos + reais'}</span>
          <span>Programa: ${labels.program[item.program] || item.program || 'Todos os programas'}</span>
          <span>Avisos: ${labels.channel[item.channel] || item.channel} • ${labels.frequency[item.frequency] || item.frequency}</span>
          <span>Status: <b>${item.active ? 'Monitorando' : 'Pausado'}</b></span>
        </div>
        <div class="managed-trip-actions"><button class="secondary" data-toggle>${item.active ? 'Pausar' : 'Ativar'}</button><button class="secondary" data-delete>Excluir</button></div>
      </article>`;
    }).join('');

    $$('.managed-trip-card', list).forEach(card => {
      const id = Number(card.dataset.id);
      $('[data-toggle]', card).onclick = () => {
        const all = load();
        const item = all.find(x => x.id === id);
        if (item) item.active = !item.active;
        save(all); render();
      };
      $('[data-delete]', card).onclick = () => {
        save(load().filter(x => x.id !== id));
        render();
      };
    });
  }

  $('#newManagedTrip').addEventListener('click', () => setFormOpen(true));
  $('#cancelManagedTrip').addEventListener('click', () => setFormOpen(false));
  $('#mChildren').addEventListener('input', renderChildAges);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const item = {
      id: Date.now(),
      origin: $('#mOrigin').value.trim(),
      destination: $('#mDestination').value.trim(),
      departure: $('#mDeparture').value,
      return: $('#mReturn').value,
      adults: Math.max(1, Number($('#mAdults').value || 1)),
      children: Math.max(0, Number($('#mChildren').value || 0)),
      childAges: $$('.mChildAge').map(input => Number(input.value)),
      preference: $('#mPreference').value,
      program: $('#mProgram').value,
      channel: $('#mChannel').value,
      frequency: $('#mFrequency').value,
      flexDays: INTERNAL_FLEX_DAYS,
      active: true,
      createdAt: new Date().toISOString()
    };
    const items = load();
    items.unshift(item); save(items);
    form.reset(); $('#mAdults').value = '1'; $('#mChildren').value = '0'; renderChildAges();
    setFormOpen(false); render(); window.toast?.('Viagem salva e monitoramento ativado');
  });

  savedNav?.addEventListener('click', () => {
    const title = $('#pageTitle');
    if (title) title.textContent = 'Gerenciamento de viagens';
    render();
  });

  render();
})();