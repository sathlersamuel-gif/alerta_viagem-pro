(() => {
  const form = document.querySelector('#searchForm');
  const departure = document.querySelector('#departure');
  if (!form || !departure) return;

  const field = departure.closest('.field');
  if (field && !document.querySelector('#monitorPreferences')) {
    const block = document.createElement('section');
    block.id = 'monitorPreferences';
    block.className = 'monitor-preferences span-4';
    block.innerHTML = `
      <div class="monitor-title"><b>Preferências do monitoramento</b><small>A IA salva estas escolhas e usa como prioridade nas próximas verificações.</small></div>
      <div class="monitor-grid">
        <div class="field"><label>Período desejado</label><select id="dateMode"><option value="exact">Data escolhida</option><option value="month">Mês inteiro</option></select></div>
        <div class="field hidden" id="travelMonthField"><label>Mês da viagem</label><input type="month" id="travelMonth"></div>
        <div class="field"><label>Flexibilidade</label><select id="flexibleDays"><option value="0">Somente a data escolhida</option><option value="3">Até 3 dias antes/depois</option><option value="5" selected>Até 5 dias antes/depois</option><option value="7">Até 7 dias antes/depois</option><option value="15">Até 15 dias antes/depois</option><option value="30">Até 30 dias antes/depois</option></select></div>
        <div class="field"><label>Prioridade dos resultados</label><select id="monitorPriority"><option value="follow">Seguir a forma de pagamento escolhida</option><option value="points">Priorizar somente milhas/pontos</option><option value="cash">Priorizar dinheiro</option><option value="best">Mostrar sempre a melhor oportunidade</option></select></div>
        <div class="field"><label>Máximo de pontos (opcional)</label><input type="number" id="maxMonitorPoints" min="0" inputmode="numeric" placeholder="Ex.: 120000"></div>
        <div class="field"><label>Máximo em reais (opcional)</label><input type="number" id="maxMonitorCash" min="0" step="0.01" inputmode="decimal" placeholder="Ex.: 3000"></div>
        <div class="field"><label>Receber avisos por</label><select id="notifyChannel"><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="both">WhatsApp e e-mail</option><option value="app">Somente no aplicativo</option></select></div>
        <div class="field"><label>Frequência</label><select id="notifyFrequency"><option value="instant">Quando encontrar algo melhor</option><option value="daily">Resumo diário</option><option value="weekly">Resumo semanal</option></select></div>
      </div>
      <label class="switch-line monitor-switch"><input type="checkbox" id="allowBetterAlternatives" checked><span class="switch"></span><span><b>Avisar também sobre oportunidades melhores fora da preferência</b><small>Exemplo: você escolheu milhas, mas aparece uma promoção excepcional em dinheiro.</small></span></label>
      <label class="switch-line monitor-switch"><input type="checkbox" id="autoSaveMonitor" checked><span class="switch"></span><span><b>Salvar e ativar monitoramento ao pesquisar</b><small>A busca aparecerá automaticamente em “Minhas buscas”.</small></span></label>`;
    const returnField = document.querySelector('#return')?.closest('.field');
    (returnField || field).insertAdjacentElement('afterend', block);
  }

  const style = document.createElement('style');
  style.textContent = `
    .monitor-preferences{padding:16px;border-radius:18px;border:1px solid rgba(56,217,255,.25);background:rgba(56,217,255,.05)}
    .monitor-title{display:grid;gap:4px;margin-bottom:14px}.monitor-title b{font-size:16px}.monitor-title small{color:#a9bfd2;line-height:1.4}
    .monitor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.monitor-switch{margin-top:12px!important}
    .monitor-preferences .field input,.monitor-preferences .field select{width:100%}.monitor-preferences .hidden{display:none!important}
    .nearby-date-results{grid-column:1/-1;padding:16px;border-radius:16px;border:1px solid rgba(56,217,255,.28);background:rgba(56,217,255,.06)}
    @media(max-width:768px){.monitor-grid{grid-template-columns:1fr}.monitor-preferences{padding:14px}.monitor-switch{align-items:flex-start!important}}
  `;
  document.head.appendChild(style);

  const dateMode = document.querySelector('#dateMode');
  const travelMonth = document.querySelector('#travelMonth');
  const travelMonthField = document.querySelector('#travelMonthField');
  dateMode?.addEventListener('change', () => travelMonthField?.classList.toggle('hidden', dateMode.value !== 'month'));

  const addDays = (date, days) => {
    const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0,10);
  };
  const formatDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');
  const iata = value => (String(value || '').match(/\(([A-Z]{3})\)/) || String(value || '').match(/^([A-Z]{3})$/i))?.[1]?.toUpperCase() || '';

  function saveMonitor(search) {
    try {
      const stored = JSON.parse(localStorage.getItem('avpro_state') || '{}');
      stored.saved = Array.isArray(stored.saved) ? stored.saved : [];
      const same = stored.saved.find(item => item.origin === search.origin && item.destination === search.destination && item.departure === search.departure && item.tripType === search.tripType);
      if (same) Object.assign(same, search, { active:true, updatedAt:new Date().toISOString() });
      else stored.saved.unshift({ ...search, id:Date.now(), active:true, createdAt:new Date().toISOString() });
      localStorage.setItem('avpro_state', JSON.stringify(stored));
      if (window.state) window.state.saved = stored.saved;
      window.renderSaved?.(); window.renderStats?.();
    } catch (error) { console.error('Falha ao salvar monitoramento', error); }
  }

  async function searchNearby(search, range) {
    if (!range || search.any || search.tripType === 'hotel') return;
    const from = iata(search.origin), to = iata(search.destination);
    if (!from || !to || !search.departure) return;
    const step = range <= 7 ? 1 : range <= 15 ? 3 : 5;
    const offsets = [];
    for (let n=-range;n<=range;n+=step) if(n!==0) offsets.push(n);
    const limited = offsets.slice(0,12);
    const tripDays = search.return ? Math.max(1, Math.round((new Date(`${search.return}T12:00:00`) - new Date(`${search.departure}T12:00:00`)) / 86400000)) : 0;
    const settled = await Promise.allSettled(limited.map(async offset => {
      const out = addDays(search.departure, offset); const ret = tripDays ? addDays(out, tripDays) : '';
      const data = await postJson('/api/flights',{departure_id:from,arrival_id:to,outbound_date:out,return_date:ret||undefined,adults:search.adults,children:search.children,deep_search:false});
      const item=[...(data.best_flights||[]),...(data.other_flights||[])].filter(x=>Number(x.price)>0).sort((a,b)=>Number(a.price)-Number(b.price))[0];
      return item?{offset,departure:out,return:ret,price:Number(item.price)}:null;
    }));
    const alternatives=settled.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value).sort((a,b)=>a.price-b.price).slice(0,4);
    if(!alternatives.length)return;
    const cards=document.querySelector('#resultCards'), recommendation=document.querySelector('#aiRecommendation');
    if(!cards||!recommendation)return;
    const bestAlt=alternatives[0];
    recommendation.insertAdjacentHTML('beforeend',`<br><br><b>Datas flexíveis:</b> melhor alternativa próxima em ${formatDate(bestAlt.departure)} por ${bestAlt.price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}.`);
    alternatives.forEach(alt=>{
      const url=`https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${from} to ${to} on ${alt.departure}${alt.return?` returning ${alt.return}`:''}`)}&hl=pt-BR&curr=BRL`;
      const direction=alt.offset<0?`${Math.abs(alt.offset)} dia(s) antes`:`${alt.offset} dia(s) depois`;
      cards.insertAdjacentHTML('beforeend',`<article class="result-card nearby-date-results"><span class="tag">DATA PRÓXIMA</span><h4>${formatDate(alt.departure)} • ${direction}</h4><div class="route">${from} → ${to}${alt.return?` • volta ${formatDate(alt.return)}`:''}</div><div class="price-main">${alt.price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div><button type="button" class="primary result-action" data-url="${url}">Ver voo nessa data</button></article>`);
    });
    cards.querySelectorAll('.nearby-date-results .result-action').forEach(btn=>btn.onclick=()=>window.open(btn.dataset.url,'_blank','noopener,noreferrer'));
  }

  form.addEventListener('submit', () => {
    let selectedDeparture = departure.value;
    if (dateMode?.value === 'month' && travelMonth?.value) {
      selectedDeparture = `${travelMonth.value}-15`;
      departure.value = selectedDeparture;
    }
    const range=Number(document.querySelector('#flexibleDays')?.value||0);
    const preference=document.querySelector('#preference')?.value||'cash';
    const priority=document.querySelector('#monitorPriority')?.value||'follow';
    const search={
      origin:document.querySelector('#origin')?.value||'',destination:document.querySelector('#destination')?.value||'',any:Boolean(document.querySelector('#anyDestination')?.checked),
      departure:selectedDeparture,return:document.querySelector('#return')?.value||'',adults:Number(document.querySelector('#adults')?.value||1),children:Number(document.querySelector('#children')?.value||0),
      ages:[...document.querySelectorAll('.child-age')].map(x=>Number(x.value)),preference,loyaltyProgram:document.querySelector('#loyaltyProgram')?.value||'azul',tripType:document.querySelector('#tripType')?.value||'flight',
      dateMode:dateMode?.value||'exact',travelMonth:travelMonth?.value||'',flexibleDates:range>0,flexibleDays:range,monitorPriority:priority,
      maxPoints:Number(document.querySelector('#maxMonitorPoints')?.value||0),maxCash:Number(document.querySelector('#maxMonitorCash')?.value||0),notifyChannel:document.querySelector('#notifyChannel')?.value||'app',
      notifyFrequency:document.querySelector('#notifyFrequency')?.value||'instant',allowBetterAlternatives:Boolean(document.querySelector('#allowBetterAlternatives')?.checked),active:true
    };
    if(!search.origin||(!search.any&&!search.destination)||!search.departure)return;
    if(document.querySelector('#autoSaveMonitor')?.checked!==false){saveMonitor(search);window.toast?.('Busca salva com suas preferências');}
    if(range>0)setTimeout(()=>searchNearby(search,range).catch(error=>console.error('Busca de datas próximas',error)),1200);
  });
})();