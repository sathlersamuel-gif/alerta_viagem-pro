(() => {
  const KEY = 'avpro_monitors';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = (items) => localStorage.setItem(KEY, JSON.stringify(items));
  const formatDate = (v) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR') : '';

  const hideSearchPreferences = () => document.querySelector('#monitorPreferences')?.remove();
  hideSearchPreferences();
  new MutationObserver(hideSearchPreferences).observe(document.body, { childList:true, subtree:true });

  const nav = document.querySelector('.sidebar nav');
  if (nav && !document.querySelector('[data-view="monitoring"]')) {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.view = 'monitoring';
    btn.innerHTML = '<span>◷</span>Monitoramentos';
    nav.insertBefore(btn, nav.querySelector('[data-view="alerts"]'));
  }

  const main = document.querySelector('.main');
  if (!main || document.querySelector('#view-monitoring')) return;
  const section = document.createElement('section');
  section.className = 'view';
  section.id = 'view-monitoring';
  section.innerHTML = `
    <div class="two-col alerts-layout">
      <section class="panel glass">
        <div class="panel-head"><div><span class="eyebrow">MONITORAMENTO AUTOMÁTICO</span><h3>Configurar viagem</h3></div><span class="status-on">Fica salva</span></div>
        <form id="monitorForm" class="form-grid">
          <div class="field span-2"><label>Origem</label><input id="mOrigin" placeholder="Cidade ou aeroporto" required></div>
          <div class="field span-2"><label>Destino</label><input id="mDestination" placeholder="Cidade ou aeroporto" required></div>
          <div class="field"><label>Data desejada</label><input type="date" id="mDeparture" required></div>
          <div class="field"><label>Volta</label><input type="date" id="mReturn"></div>
          <div class="field"><label>Flexibilidade</label><select id="mFlex"><option value="0">Data exata</option><option value="3">± 3 dias</option><option value="5" selected>± 5 dias</option><option value="7">± 7 dias</option><option value="15">± 15 dias</option><option value="30">± 30 dias</option></select></div>
          <div class="field"><label>Passageiros</label><input type="number" id="mPassengers" min="1" value="1"></div>
          <div class="field span-2"><label>Preferência principal</label><select id="mPreference"><option value="points">Somente milhas/pontos</option><option value="cash">Somente dinheiro</option><option value="best">Melhor oportunidade</option><option value="mixed">Pontos + dinheiro</option></select></div>
          <div class="field span-2"><label>Programa</label><select id="mProgram"><option value="azul">Azul Fidelidade</option><option value="latam">LATAM Pass</option><option value="smiles">Smiles</option><option value="all">Todos</option></select></div>
          <div class="field span-2"><label>Receber por</label><select id="mChannel"><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="both">WhatsApp e e-mail</option><option value="app">Somente aplicativo</option></select></div>
          <div class="field span-2"><label>Frequência</label><select id="mFrequency"><option value="instant">Quando surgir algo melhor</option><option value="daily">Resumo diário</option><option value="weekly">Resumo semanal</option></select></div>
          <label class="switch-line span-4"><input type="checkbox" id="mAlternatives" checked><span class="switch"></span><span><b>Avisar também se aparecer uma opção melhor fora da preferência</b><small>Sua escolha continua sendo prioridade.</small></span></label>
          <div class="span-4"><button class="primary" type="submit">Salvar monitoramento</button></div>
        </form>
      </section>
      <section class="panel glass"><div class="panel-head"><div><span class="eyebrow">REGISTROS SALVOS</span><h3>Viagens monitoradas</h3></div></div><div id="monitorList" class="saved-list"></div></section>
    </div>`;
  main.appendChild(section);

  const dashboard = document.querySelector('#view-dashboard .hero-panel');
  if (dashboard && !document.querySelector('#quickMonitorCard')) {
    const card = document.createElement('button');
    card.type = 'button';
    card.id = 'quickMonitorCard';
    card.className = 'quick-monitor-card glass';
    card.innerHTML = '<span class="quick-monitor-icon">◷</span><span><b>Monitorar uma viagem</b><small>Datas, passageiros, milhas e alertas ficam salvos</small></span><em>Configurar ›</em>';
    dashboard.insertAdjacentElement('afterend', card);
  }

  const style = document.createElement('style');
  style.textContent = `.quick-monitor-card{width:100%;display:flex;align-items:center;gap:12px;text-align:left;margin:14px 0 18px;padding:13px 16px;border:1px solid rgba(115,196,255,.18);border-radius:15px;background:rgba(255,255,255,.025);color:inherit;cursor:pointer}.quick-monitor-card:hover{border-color:rgba(56,217,255,.35)}.quick-monitor-card span:nth-child(2){display:grid;gap:2px;flex:1}.quick-monitor-card small{color:#9fb6ca;font-size:12px}.quick-monitor-card em{font-style:normal;color:#68dfff;font-size:13px}.quick-monitor-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:rgba(56,217,255,.09)}.monitor-card{padding:16px;border:1px solid rgba(115,196,255,.2);border-radius:16px;margin-bottom:12px;background:rgba(255,255,255,.03)}.monitor-card h4{margin:0 0 6px}.monitor-meta{display:grid;gap:5px;color:#afc6d9;font-size:13px}.monitor-actions{display:flex;gap:8px;margin-top:12px}.monitor-actions button{flex:1}.monitor-empty{padding:24px;text-align:center;color:#afc6d9}@media(max-width:768px){.quick-monitor-card{margin-top:10px;padding:12px}.quick-monitor-card em{display:none}}`;
  document.head.appendChild(style);

  function showView() {
    $$('.view').forEach(v => v.classList.remove('active'));
    $$('.nav-item').forEach(b => b.classList.remove('active'));
    section.classList.add('active');
    document.querySelector('[data-view="monitoring"]')?.classList.add('active');
    const title = document.querySelector('#pageTitle'); if (title) title.textContent = 'Monitoramentos';
    render();
  }
  document.querySelector('[data-view="monitoring"]')?.addEventListener('click', showView);
  document.querySelector('#quickMonitorCard')?.addEventListener('click', showView);

  function render() {
    const list = $('#monitorList');
    const items = load();
    if (!items.length) { list.innerHTML = '<div class="monitor-empty">Nenhum monitoramento salvo ainda.</div>'; return; }
    list.innerHTML = items.map(item => `<article class="monitor-card" data-id="${item.id}"><h4>${item.origin} → ${item.destination}</h4><div class="monitor-meta"><span>Data: ${formatDate(item.departure)}${item.flexDays ? ` • flexível ±${item.flexDays} dias` : ''}</span><span>${item.passengers} passageiro(s) • ${item.preference === 'points' ? 'Milhas/pontos' : item.preference === 'cash' ? 'Dinheiro' : item.preference === 'mixed' ? 'Pontos + dinheiro' : 'Melhor oportunidade'}</span><span>Programa: ${item.program} • Avisos: ${item.channel}</span><span>Status: ${item.active ? 'Ativo' : 'Pausado'}</span></div><div class="monitor-actions"><button class="secondary" data-toggle>${item.active ? 'Pausar' : 'Ativar'}</button><button class="secondary" data-delete>Excluir</button></div></article>`).join('');
    $$('.monitor-card', list).forEach(card => {
      const id = Number(card.dataset.id);
      $('[data-toggle]', card).onclick = () => { const all=load(); const item=all.find(x=>x.id===id); if(item)item.active=!item.active; save(all); render(); };
      $('[data-delete]', card).onclick = () => { save(load().filter(x=>x.id!==id)); render(); };
    });
  }

  $('#monitorForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const item = {
      id: Date.now(), origin: $('#mOrigin').value.trim(), destination: $('#mDestination').value.trim(),
      departure: $('#mDeparture').value, return: $('#mReturn').value, flexDays: Number($('#mFlex').value),
      passengers: Number($('#mPassengers').value || 1), preference: $('#mPreference').value,
      program: $('#mProgram').value, channel: $('#mChannel').value, frequency: $('#mFrequency').value,
      allowAlternatives: $('#mAlternatives').checked, active: true, createdAt: new Date().toISOString()
    };
    const items = load(); items.unshift(item); save(items); e.target.reset(); $('#mPassengers').value='1'; $('#mFlex').value='5'; $('#mAlternatives').checked=true; render(); window.toast?.('Monitoramento salvo e ativado');
  });

  render();
})();