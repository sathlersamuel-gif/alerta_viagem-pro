(() => {
  const KEY = 'avpro_managed_trips';
  const INTERNAL_FLEX_DAYS = 5;
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
        <div><span class="eyebrow">MONITORAMENTO INTELIGENTE</span><h3>Gerenciamento de viagens</h3></div>
        <button class="primary compact" id="newManagedTrip">+ Nova viagem</button>
      </div>
      <p class="info-note">A rota pedida sempre tem prioridade. O modo agente pode sugerir horários, companhias e opções melhores encontradas na mesma consulta, sem pesquisar destinos aleatórios.</p>
      <div id="managedTripFormWrap" class="managed-form-wrap hidden">
        <form id="managedTripForm" class="form-grid">
          <input type="hidden" id="managedTripId">
          <div class="field span-2"><label>Origem</label><input id="managedOrigin" placeholder="Cidade ou aeroporto" required></div>
          <div class="field span-2"><label>Destino</label><input id="managedDestination" placeholder="Cidade ou aeroporto" required></div>
          <div class="field span-2"><label>Data de ida</label><input type="date" id="managedDeparture" required></div>
          <div class="field span-2"><label>Data de volta</label><input type="date" id="managedReturn"></div>
          <div class="field"><label>Adultos</label><input type="number" id="managedAdults" min="1" value="1" required></div>
          <div class="field"><label>Crianças</label><input type="number" id="managedChildren" min="0" value="0"></div>
          <div id="managedChildAges" class="child-ages span-4 hidden"></div>
          <div class="field span-2"><label>Preferência</label><select id="managedPreference"><option value="mixed">Pontos + reais</option><option value="points">Somente pontos</option><option value="cash">Somente reais</option></select></div>
          <div class="field span-2"><label>Receber por</label><select id="managedChannel"><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="both">WhatsApp e e-mail</option></select></div>
          <div class="field span-2"><label>Frequência dos avisos</label><select id="managedFrequency"><option value="instant">Quando encontrar algo melhor</option><option value="daily">Resumo diário</option><option value="weekly">Resumo semanal</option></select></div>
          <label class="switch-line span-4"><input type="checkbox" id="managedAgentSuggestions" checked><span class="switch"></span><span><b>Modo agente de viagem</b><small>Sugere melhores horários, companhias, escalas e opções próximas encontradas na mesma pesquisa, sem gastar consultas extras.</small></span></label>
          <label class="switch-line span-4"><input type="checkbox" id="managedExtraAlternative"><span class="switch"></span><span><b>Permitir uma consulta alternativa</b><small>Somente quando a rota principal não tiver resultado. Pode usar até 1 consulta extra e nunca procura destinos aleatórios.</small></span></label>
          <div class="span-4 managed-actions"><button class="primary" type="submit">Salvar e ativar viagem</button><button class="secondary" type="button" id="cancelManagedTrip">Cancelar</button></div>
        </form>
      </div>
      <div id="managedTripList" class="saved-list"></div>
    </section>`;
  main.appendChild(view);

  const style = document.createElement('style');
  style.textContent = `.managed-form-wrap{margin:16px 0;padding:16px;border-radius:18px;border:1px solid rgba(115,196,255,.22);background:rgba(255,255,255,.025)}.managed-form-wrap.hidden{display:none}.managed-actions{display:flex;gap:10px}.managed-trip-card{padding:16px;border:1px solid rgba(115,196,255,.18);border-radius:16px;margin-bottom:12px;background:rgba(255,255,255,.025)}.managed-trip-card h4{margin:0 0 8px}.managed-meta{display:grid;gap:5px;color:#afc6d9;font-size:13px}.managed-card-actions{display:flex;gap:8px;margin-top:12px}.managed-card-actions button{flex:1}.managed-empty{padding:28px;text-align:center;color:#afc6d9}.managed-age-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:8px}@media(max-width:768px){.managed-actions,.managed-card-actions{flex-direction:column}.managed-form-wrap{padding:14px}}`;
  document.head.appendChild(style);

  const preferenceLabel = value => value === 'points' ? 'Somente pontos' : value === 'cash' ? 'Somente reais' : 'Pontos + reais';
  const channelLabel = value => value === 'whatsapp' ? 'WhatsApp' : value === 'email' ? 'E-mail' : 'WhatsApp e e-mail';
  const frequencyLabel = value => value === 'instant' ? 'quando melhorar' : value === 'daily' ? 'diário' : 'semanal';

  function openView() {
    $$('.view').forEach(v => v.classList.remove('active'));
    $$('.nav-item').forEach(b => b.classList.remove('active'));
    view.classList.add('active');
    $('[data-view="travel-management"]')?.classList.add('active');
    $('#sidebar')?.classList.remove('open');
    document.body.classList.remove('menu-open');
    const title = $('#pageTitle'); if (title) title.textContent = 'Gerenciamento de viagens';
    render();
  }
  $('[data-view="travel-management"]')?.addEventListener('click', openView);

  function renderChildAges(values = []) {
    const count = Math.max(0, Number($('#managedChildren').value || 0));
    const box = $('#managedChildAges');
    box.classList.toggle('hidden', count === 0);
    box.innerHTML = count ? `<label>Idade das crianças</label><div class="managed-age-grid">${Array.from({ length: count }, (_, i) => `<div class="field"><input type="number" class="managedChildAge" min="0" max="17" value="${values[i] ?? ''}" placeholder="Criança ${i + 1}" required></div>`).join('')}</div>` : '';
  }

  function resetForm() {
    $('#managedTripForm').reset(); $('#managedTripId').value = ''; $('#managedAdults').value = '1'; $('#managedChildren').value = '0'; $('#managedPreference').value = 'mixed'; $('#managedAgentSuggestions').checked = true; $('#managedExtraAlternative').checked = false; renderChildAges();
  }

  function render() {
    const list = $('#managedTripList'); const items = load();
    if (!items.length) { list.innerHTML = '<div class="managed-empty">Nenhuma viagem salva ainda.</div>'; return; }
    list.innerHTML = items.map(item => `<article class="managed-trip-card" data-id="${item.id}"><h4>${item.origin} → ${item.destination}</h4><div class="managed-meta"><span>Ida: ${fmt(item.departure)}${item.return ? ` • Volta: ${fmt(item.return)}` : ''}</span><span>${item.adults} adulto(s)${item.children ? ` • ${item.children} criança(s)` : ''}</span><span>Preferência: ${preferenceLabel(item.preference)}</span><span>Avisos: ${channelLabel(item.channel)} • ${frequencyLabel(item.frequency)}</span><span>Agente de viagem: ${item.agentSuggestions !== false ? 'Ativo' : 'Desativado'}${item.extraAlternative ? ' • até 1 consulta alternativa' : ' • sem consultas extras'}</span><span>Status: ${item.active ? 'Monitorando' : 'Pausado'}</span></div><div class="managed-card-actions"><button class="secondary" data-edit>Editar</button><button class="secondary" data-toggle>${item.active ? 'Pausar' : 'Ativar'}</button><button class="secondary" data-delete>Excluir</button></div></article>`).join('');
    $$('.managed-trip-card', list).forEach(card => {
      const id = Number(card.dataset.id);
      $('[data-edit]', card).onclick = () => { const item = load().find(x => x.id === id); if (!item) return; $('#managedTripId').value=item.id; $('#managedOrigin').value=item.origin; $('#managedDestination').value=item.destination; $('#managedDeparture').value=item.departure; $('#managedReturn').value=item.return||''; $('#managedAdults').value=item.adults; $('#managedChildren').value=item.children; $('#managedPreference').value=item.preference; $('#managedChannel').value=item.channel; $('#managedFrequency').value=item.frequency; $('#managedAgentSuggestions').checked=item.agentSuggestions!==false; $('#managedExtraAlternative').checked=Boolean(item.extraAlternative); renderChildAges(item.childAges||[]); $('#managedTripFormWrap').classList.remove('hidden'); };
      $('[data-toggle]', card).onclick = () => { const all=load(); const item=all.find(x=>x.id===id); if(item)item.active=!item.active; save(all); render(); };
      $('[data-delete]', card).onclick = () => { save(load().filter(x=>x.id!==id)); render(); };
    });
  }

  $('#newManagedTrip').onclick = () => { resetForm(); $('#managedTripFormWrap').classList.remove('hidden'); };
  $('#cancelManagedTrip').onclick = () => { resetForm(); $('#managedTripFormWrap').classList.add('hidden'); };
  $('#managedChildren').addEventListener('input', () => renderChildAges());
  $('#managedTripForm').addEventListener('submit', event => {
    event.preventDefault(); const id=Number($('#managedTripId').value||0);
    const item={id:id||Date.now(),origin:$('#managedOrigin').value.trim().toUpperCase(),destination:$('#managedDestination').value.trim().toUpperCase(),departure:$('#managedDeparture').value,return:$('#managedReturn').value,adults:Math.max(1,Number($('#managedAdults').value||1)),children:Math.max(0,Number($('#managedChildren').value||0)),childAges:$$('.managedChildAge').map(input=>Number(input.value)),preference:$('#managedPreference').value,channel:$('#managedChannel').value,frequency:$('#managedFrequency').value,agentSuggestions:$('#managedAgentSuggestions').checked,extraAlternative:$('#managedExtraAlternative').checked,active:true,internalFlexDays:INTERNAL_FLEX_DAYS,updatedAt:new Date().toISOString()};
    const items=load(); const index=items.findIndex(x=>x.id===item.id); if(index>=0)items[index]={...items[index],...item}; else items.unshift({...item,createdAt:new Date().toISOString()}); save(items); resetForm(); $('#managedTripFormWrap').classList.add('hidden'); render(); window.toast?.('Viagem salva com modo agente configurado');
  });
  render();
})();