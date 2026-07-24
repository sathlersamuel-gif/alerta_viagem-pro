(() => {
  const form = document.querySelector('#searchForm');
  const departure = document.querySelector('#departure');
  if (!form || !departure) return;

  const field = departure.closest('.field');
  if (field && !document.querySelector('#flexibleDates')) {
    const block = document.createElement('label');
    block.className = 'switch-line span-4 flexible-date-control';
    block.innerHTML = `
      <input type="checkbox" id="flexibleDates" checked>
      <span class="switch"></span>
      <span>
        <b>Procurar também em datas próximas</b>
        <small>A IA compara opções até 5 dias antes e 5 dias depois da data escolhida.</small>
      </span>
      <select id="flexibleDays" aria-label="Margem de datas">
        <option value="3">Até 3 dias</option>
        <option value="5" selected>Até 5 dias</option>
        <option value="7">Até 7 dias</option>
      </select>`;
    const returnField = document.querySelector('#return')?.closest('.field');
    (returnField || field).insertAdjacentElement('afterend', block);
  }

  const style = document.createElement('style');
  style.textContent = `
    .flexible-date-control{display:grid!important;grid-template-columns:auto auto 1fr minmax(125px,170px);gap:12px;align-items:center}
    .flexible-date-control select{height:44px;border-radius:12px;border:1px solid rgba(115,196,255,.25);background:#081c2e;color:#eaf6ff;padding:0 10px;font:inherit}
    .nearby-date-results{grid-column:1/-1;padding:16px;border-radius:16px;border:1px solid rgba(56,217,255,.28);background:rgba(56,217,255,.06)}
    .nearby-date-results h4{margin:0 0 6px}.nearby-date-results p{margin:0;color:#afc6d9}
    @media(max-width:768px){.flexible-date-control{grid-template-columns:auto auto 1fr!important}.flexible-date-control select{grid-column:1/-1;width:100%;height:52px}}
  `;
  document.head.appendChild(style);

  const addDays = (date, days) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
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
      if (typeof window.renderSaved === 'function') window.renderSaved();
      if (typeof window.renderStats === 'function') window.renderStats();
    } catch (error) {
      console.error('Falha ao salvar monitoramento flexível', error);
    }
  }

  async function searchNearby(search, range) {
    if (search.any || search.tripType === 'hotel') return;
    const from = iata(search.origin), to = iata(search.destination);
    if (!from || !to || !search.departure) return;

    const offsets = range <= 3 ? [-3,-1,1,3] : range <= 5 ? [-5,-3,-1,1,3,5] : [-7,-5,-3,-1,1,3,5,7];
    const tripDays = search.return ? Math.max(1, Math.round((new Date(`${search.return}T12:00:00`) - new Date(`${search.departure}T12:00:00`)) / 86400000)) : 0;
    const requests = offsets.map(async offset => {
      const out = addDays(search.departure, offset);
      const ret = tripDays ? addDays(out, tripDays) : '';
      const data = await postJson('/api/flights', {
        departure_id: from, arrival_id: to, outbound_date: out,
        return_date: ret || undefined, adults: search.adults, children: search.children, deep_search:false
      });
      const options = [...(data.best_flights || []), ...(data.other_flights || [])]
        .filter(item => Number(item.price) > 0)
        .sort((a,b) => Number(a.price) - Number(b.price));
      return options[0] ? { offset, departure:out, return:ret, price:Number(options[0].price), item:options[0] } : null;
    });

    const settled = await Promise.allSettled(requests);
    const alternatives = settled.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value).sort((a,b) => a.price-b.price).slice(0,4);
    if (!alternatives.length) return;

    const cards = document.querySelector('#resultCards');
    const recommendation = document.querySelector('#aiRecommendation');
    if (!cards || !recommendation) return;

    const exactPrices = [...cards.querySelectorAll('.price-main')].map(el => Number(el.textContent.replace(/[^\d,]/g,'').replace(',','.'))).filter(Number.isFinite);
    const bestAlt = alternatives[0];
    recommendation.insertAdjacentHTML('beforeend', `<br><br><b>Datas flexíveis:</b> encontrei alternativas entre ${range} dias antes e ${range} dias depois. A melhor data próxima foi ${formatDate(bestAlt.departure)} por ${bestAlt.price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}.`);

    alternatives.forEach(alt => {
      const url = `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${from} to ${to} on ${alt.departure}${alt.return ? ` returning ${alt.return}` : ''}`)}&hl=pt-BR&curr=BRL`;
      const direction = alt.offset < 0 ? `${Math.abs(alt.offset)} dia(s) antes` : `${alt.offset} dia(s) depois`;
      cards.insertAdjacentHTML('beforeend', `<article class="result-card nearby-date-results">
        <span class="tag">DATA PRÓXIMA</span><h4>${formatDate(alt.departure)} • ${direction}</h4>
        <div class="route">${from} → ${to}${alt.return ? ` • volta ${formatDate(alt.return)}` : ''}</div>
        <div class="price-main">${alt.price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
        <div class="price-sub">Preço encontrado para todos os passageiros nessa alternativa.</div>
        <button type="button" class="primary result-action" data-url="${url}">Ver voo nessa data</button>
      </article>`);
    });
    cards.querySelectorAll('.nearby-date-results .result-action').forEach(btn => btn.onclick = () => window.open(btn.dataset.url, '_blank', 'noopener,noreferrer'));
  }

  form.addEventListener('submit', event => {
    const flexible = document.querySelector('#flexibleDates')?.checked !== false;
    const range = Number(document.querySelector('#flexibleDays')?.value || 5);
    const search = {
      origin:document.querySelector('#origin')?.value || '', destination:document.querySelector('#destination')?.value || '',
      any:Boolean(document.querySelector('#anyDestination')?.checked), departure:departure.value,
      return:document.querySelector('#return')?.value || '', adults:Number(document.querySelector('#adults')?.value || 1),
      children:Number(document.querySelector('#children')?.value || 0), preference:document.querySelector('#preference')?.value || 'cash',
      loyaltyProgram:document.querySelector('#loyaltyProgram')?.value || 'azul', tripType:document.querySelector('#tripType')?.value || 'flight',
      flexibleDates:flexible, flexibleDays:range, active:true
    };
    if (!search.origin || (!search.any && !search.destination) || !search.departure) return;
    saveMonitor(search);
    if (typeof window.toast === 'function') window.toast('Busca salva e monitoramento ativado');
    if (flexible) setTimeout(() => searchNearby(search, range).catch(error => console.error('Busca de datas próximas', error)), 1200);
  });
})();