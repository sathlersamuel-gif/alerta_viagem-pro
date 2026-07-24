(() => {
  const KEY = 'avpro_managed_trips';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const airportData = () => typeof airports !== 'undefined' && Array.isArray(airports) ? airports : [];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
  const save = items => localStorage.setItem(KEY, JSON.stringify(items));
  const fmt = v => v ? new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR') : '';
  const airportLabel = a => `${a[1]} (${a[0]}) — ${a[3]}${a[2] ? `, ${a[2]}` : ''}`;
  const extractCode = v => (((String(v || '').match(/\(([A-Z]{3})\)/i) || String(v || '').match(/^([A-Z]{3})$/i)) || [])[1] || '').toUpperCase();
  const resolveAirport = v => {
    const raw = String(v || '').trim();
    const code = extractCode(raw);
    if (code) return airportData().find(a => a[0] === code) || null;
    const q = norm(raw);
    return q ? airportData().find(a => norm(a[1]) === q) || airportData().find(a => norm(a.join(' ')).includes(q)) || null : null;
  };

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
    <section class="panel glass managed-panel">
      <div class="panel-head"><div><span class="eyebrow">MONITORAMENTO INTELIGENTE</span><h3>Gerenciamento de viagens</h3></div><button class="primary compact" id="newManagedTrip">+ Nova viagem</button></div>
      <p class="info-note">Digite a cidade ou o aeroporto e toque em uma opção da lista.</p>
      <div id="managedTripFormWrap" class="managed-form-wrap hidden">
        <form id="managedTripForm" class="form-grid" novalidate>
          <input type="hidden" id="managedTripId">
          <div class="field span-2 managed-airport-field"><label>Local de origem</label><input id="managedOrigin" autocomplete="off" placeholder="Ex.: Cacoal, Porto Velho ou Cuiabá"><input type="hidden" id="managedOriginCode"><div class="managed-suggestions" id="managedOriginSuggestions"></div><small id="managedOriginSelected">Digite e escolha uma opção da lista.</small></div>
          <div class="field span-2 managed-airport-field"><label>Local de destino</label><input id="managedDestination" autocomplete="off" placeholder="Ex.: Recife, Orlando ou Lisboa"><input type="hidden" id="managedDestinationCode"><div class="managed-suggestions" id="managedDestinationSuggestions"></div><small id="managedDestinationSelected">Digite e escolha uma opção da lista.</small></div>
          <div class="field span-2"><label>Data de ida</label><input type="date" id="managedDeparture"></div>
          <div class="field span-2"><label>Data de volta</label><input type="date" id="managedReturn"></div>
          <div class="field"><label>Adultos</label><input type="number" id="managedAdults" min="1" max="9" value="1"></div>
          <div class="field"><label>Crianças</label><input type="number" id="managedChildren" min="0" max="8" value="0"></div>
          <div id="managedChildAges" class="child-ages span-4 hidden"></div>
          <div class="field span-2"><label>Preferência</label><select id="managedPreference"><option value="mixed">Pontos + reais</option><option value="points">Somente pontos</option><option value="cash">Somente reais</option></select></div>
          <div class="field span-2"><label>Receber por</label><select id="managedChannel"><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="both">WhatsApp e e-mail</option></select></div>
          <div class="field span-2"><label>Frequência dos avisos</label><select id="managedFrequency"><option value="instant">Quando encontrar algo melhor</option><option value="daily">Resumo diário</option><option value="weekly">Resumo semanal</option></select></div>
          <label class="switch-line span-4"><input type="checkbox" id="managedAgentSuggestions" checked><span class="switch"></span><span><b>Modo agente de viagem</b><small>Sugere horários, companhias, escalas e opções úteis da mesma pesquisa.</small></span></label>
          <label class="switch-line span-4"><input type="checkbox" id="managedExtraAlternative"><span class="switch"></span><span><b>Permitir uma consulta alternativa</b><small>Somente se a rota principal não tiver resultado.</small></span></label>
          <div id="managedSaveMessage" class="span-4" role="status"></div>
          <div class="span-4 managed-actions"><button class="primary" id="saveManagedTripButton" type="submit">Salvar e ativar viagem</button><button class="secondary" type="button" id="cancelManagedTrip">Cancelar</button></div>
        </form>
      </div>
      <div id="managedTripList" class="saved-list"></div>
    </section>`;
  main.appendChild(view);

  const style = document.createElement('style');
  style.textContent = `
    html,body{background:#06111f!important;overscroll-behavior-y:none}
    .managed-panel{overflow:visible}.managed-form-wrap{margin:16px 0;padding:16px;border-radius:18px;border:1px solid rgba(115,196,255,.22);background:#0b1d31;overflow:visible}.managed-form-wrap.hidden{display:none}
    .managed-actions{display:flex;gap:10px;background:transparent!important}.managed-actions button{min-height:52px}.managed-trip-card{padding:16px;border:1px solid rgba(115,196,255,.18);border-radius:16px;margin-bottom:12px;background:#0b1d31}.managed-meta{display:grid;gap:5px;color:#afc6d9;font-size:13px}.managed-card-actions{display:flex;gap:8px;margin-top:12px}.managed-card-actions button{flex:1}.managed-empty{padding:28px;text-align:center;color:#afc6d9}
    .managed-age-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:8px}.managed-airport-field{position:relative}.managed-airport-field small{color:#8da4ba;font-size:11px}.managed-suggestions{display:none;position:absolute;z-index:200;top:76px;left:0;right:0;max-height:260px;overflow:auto;background:#0d2035;border:1px solid rgba(86,183,255,.35);border-radius:14px;box-shadow:0 20px 45px rgba(0,0,0,.55)}.managed-suggestions.show{display:block}.managed-suggestion{padding:12px 14px;border-bottom:1px solid rgba(144,195,255,.13);cursor:pointer}.managed-suggestion b,.managed-suggestion small{display:block}
    #managedSaveMessage{display:none;margin:4px 0 2px;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,190,80,.45);background:rgba(255,170,30,.12);font-size:14px;line-height:1.4;color:#fff}#managedSaveMessage.ok{border-color:rgba(43,227,140,.5);background:rgba(43,227,140,.12)}#saveManagedTripButton{font-size:16px;font-weight:800}
    @media(max-width:768px){.managed-actions,.managed-card-actions{flex-direction:column}.managed-form-wrap{padding:14px}.managed-actions button{width:100%}}
  `;
  document.head.appendChild(style);

  const message = (text, ok = false) => {
    const box = $('#managedSaveMessage');
    box.textContent = text;
    box.classList.toggle('ok', ok);
    box.style.display = 'block';
    box.scrollIntoView({behavior:'smooth',block:'center'});
    window.toast?.(text);
  };

  function setupPicker(inputId, codeId, boxId, statusId) {
    const input = $(`#${inputId}`), code = $(`#${codeId}`), box = $(`#${boxId}`), status = $(`#${statusId}`);
    input.addEventListener('input', () => {
      code.value = '';
      status.textContent = 'Escolha uma opção da lista para confirmar o aeroporto.';
      $('#managedSaveMessage').style.display = 'none';
      const q = norm(input.value);
      if (!q) { box.classList.remove('show'); return; }
      const list = airportData().filter(a => norm(a.join(' ')).includes(q)).slice(0, 8);
      box.innerHTML = list.map(a => `<div class="managed-suggestion" data-code="${a[0]}"><b>${a[1]} — ${a[0]}</b><small>${a[3]}${a[2] ? `, ${a[2]}` : ''}</small></div>`).join('');
      box.classList.toggle('show', !!list.length);
      $$('.managed-suggestion', box).forEach(option => option.addEventListener('pointerdown', e => {
        e.preventDefault();
        const a = airportData().find(x => x[0] === option.dataset.code);
        if (!a) return;
        input.value = airportLabel(a); code.value = a[0]; status.textContent = `Aeroporto confirmado: ${a[1]} (${a[0]})`; box.classList.remove('show');
      }));
    });
    input.addEventListener('blur', () => setTimeout(() => box.classList.remove('show'), 250));
  }
  setupPicker('managedOrigin','managedOriginCode','managedOriginSuggestions','managedOriginSelected');
  setupPicker('managedDestination','managedDestinationCode','managedDestinationSuggestions','managedDestinationSelected');

  const prefLabel = v => v === 'points' ? 'Somente pontos' : v === 'cash' ? 'Somente reais' : 'Pontos + reais';
  const channelLabel = v => v === 'whatsapp' ? 'WhatsApp' : v === 'email' ? 'E-mail' : 'WhatsApp e e-mail';
  const frequencyLabel = v => v === 'instant' ? 'quando melhorar' : v === 'daily' ? 'diário' : 'semanal';

  function renderChildAges(values = []) {
    const count = Math.max(0, Math.min(8, Number($('#managedChildren').value || 0)));
    const box = $('#managedChildAges');
    box.classList.toggle('hidden', count === 0);
    box.innerHTML = count ? `<label>Idade das crianças</label><div class="managed-age-grid">${Array.from({length:count},(_,i)=>`<div class="field"><label>Criança ${i+1}</label><select class="managedChildAge">${Array.from({length:18},(_,age)=>`<option value="${age}" ${Number(values[i] ?? 0)===age?'selected':''}>${age===0?'Menos de 1 ano':age+' ano'+(age===1?'':'s')}</option>`).join('')}</select></div>`).join('')}</div>` : '';
  }

  function resetForm() {
    $('#managedTripForm').reset();
    $('#managedTripId').value = ''; $('#managedOriginCode').value = ''; $('#managedDestinationCode').value = '';
    $('#managedAdults').value = 1; $('#managedChildren').value = 0; $('#managedPreference').value = 'mixed';
    $('#managedAgentSuggestions').checked = true; $('#managedExtraAlternative').checked = false;
    $('#managedOriginSelected').textContent = 'Digite e escolha uma opção da lista.'; $('#managedDestinationSelected').textContent = 'Digite e escolha uma opção da lista.';
    $('#managedSaveMessage').style.display = 'none'; renderChildAges();
  }

  function render() {
    const list = $('#managedTripList'), items = load();
    if (!items.length) { list.innerHTML = '<div class="managed-empty">Nenhuma viagem salva ainda.</div>'; return; }
    list.innerHTML = items.map(item => `<article class="managed-trip-card" data-id="${item.id}"><h4>${item.originLabel || item.origin} → ${item.destinationLabel || item.destination}</h4><div class="managed-meta"><span>Aeroportos: ${item.origin} → ${item.destination}</span><span>Ida: ${fmt(item.departure)}${item.return ? ` • Volta: ${fmt(item.return)}` : ''}</span><span>${item.adults} adulto(s)${item.children ? ` • ${item.children} criança(s)` : ''}</span><span>Preferência: ${prefLabel(item.preference)}</span><span>Avisos: ${channelLabel(item.channel)} • ${frequencyLabel(item.frequency)}</span><span>Status: ${item.active ? 'Monitorando' : 'Pausado'}</span></div><div class="managed-card-actions"><button class="secondary" data-edit>Editar</button><button class="secondary" data-toggle>${item.active?'Pausar':'Ativar'}</button><button class="secondary" data-delete>Excluir</button></div></article>`).join('');
    $$('.managed-trip-card', list).forEach(card => {
      const id = Number(card.dataset.id);
      $('[data-edit]', card).onclick = () => {
        const item = load().find(x => x.id === id); if (!item) return;
        $('#managedTripId').value=item.id; $('#managedOrigin').value=item.originLabel||item.origin; $('#managedOriginCode').value=item.origin; $('#managedDestination').value=item.destinationLabel||item.destination; $('#managedDestinationCode').value=item.destination; $('#managedDeparture').value=item.departure; $('#managedReturn').value=item.return||''; $('#managedAdults').value=item.adults; $('#managedChildren').value=item.children; $('#managedPreference').value=item.preference; $('#managedChannel').value=item.channel; $('#managedFrequency').value=item.frequency; $('#managedAgentSuggestions').checked=item.agentSuggestions!==false; $('#managedExtraAlternative').checked=!!item.extraAlternative; renderChildAges(item.childAges||[]); $('#managedTripFormWrap').classList.remove('hidden');
      };
      $('[data-toggle]', card).onclick = () => { const all=load(), item=all.find(x=>x.id===id); if(item)item.active=!item.active; save(all); render(); };
      $('[data-delete]', card).onclick = () => { save(load().filter(x=>x.id!==id)); render(); };
    });
  }

  function openView() {
    $$('.view').forEach(v=>v.classList.remove('active')); $$('.nav-item').forEach(b=>b.classList.remove('active'));
    view.classList.add('active'); $('[data-view="travel-management"]')?.classList.add('active'); $('#sidebar')?.classList.remove('open'); document.body.classList.remove('menu-open'); if($('#pageTitle')) $('#pageTitle').textContent='Gerenciamento de viagens'; render();
  }
  $('[data-view="travel-management"]')?.addEventListener('click', openView);
  $('#newManagedTrip').onclick = () => { resetForm(); $('#managedTripFormWrap').classList.remove('hidden'); };
  $('#cancelManagedTrip').onclick = () => { resetForm(); $('#managedTripFormWrap').classList.add('hidden'); };
  $('#managedChildren').addEventListener('input', () => renderChildAges());

  $('#managedTripForm').addEventListener('submit', event => {
    event.preventDefault();
    const originText=$('#managedOrigin').value.trim(), destinationText=$('#managedDestination').value.trim();
    const originAirport=resolveAirport(originText), destinationAirport=resolveAirport(destinationText);
    const origin=($('#managedOriginCode').value||extractCode(originText)||originAirport?.[0]||'').toUpperCase();
    const destination=($('#managedDestinationCode').value||extractCode(destinationText)||destinationAirport?.[0]||'').toUpperCase();
    const departure=$('#managedDeparture').value, returnDate=$('#managedReturn').value;
    if(!originText){message('Informe a cidade ou aeroporto de origem.');return;}
    if(!origin){message('Toque em uma opção da lista para confirmar a origem.');return;}
    if(!destinationText){message('Informe a cidade ou aeroporto de destino.');return;}
    if(!destination){message('Toque em uma opção da lista para confirmar o destino.');return;}
    if(!departure){message('Informe a data de ida.');return;}
    if(returnDate && returnDate < departure){message('A data de volta não pode ser anterior à ida.');return;}
    const button=$('#saveManagedTripButton'); button.disabled=true; button.textContent='Salvando viagem...';
    try {
      const id=Number($('#managedTripId').value||0);
      const item={id:id||Date.now(),origin,destination,originLabel:originAirport?airportLabel(originAirport):originText,destinationLabel:destinationAirport?airportLabel(destinationAirport):destinationText,departure,return:returnDate,adults:Math.max(1,Number($('#managedAdults').value||1)),children:Math.max(0,Number($('#managedChildren').value||0)),childAges:$$('.managedChildAge').map(s=>Number(s.value)),preference:$('#managedPreference').value,channel:$('#managedChannel').value,frequency:$('#managedFrequency').value,agentSuggestions:$('#managedAgentSuggestions').checked,extraAlternative:$('#managedExtraAlternative').checked,active:true,internalFlexDays:5,updatedAt:new Date().toISOString()};
      const items=load(), index=items.findIndex(x=>x.id===item.id); if(index>=0)items[index]={...items[index],...item};else items.unshift({...item,createdAt:new Date().toISOString()}); save(items); render(); message('Viagem salva e monitoramento ativado.',true); setTimeout(()=>{$('#managedTripFormWrap').classList.add('hidden');resetForm();},700);
    } catch(e) { console.error(e); message('Não foi possível salvar a viagem neste aparelho.'); }
    finally { button.disabled=false; button.textContent='Salvar e ativar viagem'; }
  });

  render();
})();