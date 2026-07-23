const airports=[
['OAL','Cacoal','RO','Aeroporto Capital do Café'],['JPR','Ji-Paraná','RO','Aeroporto José Coleto'],['BVH','Vilhena','RO','Aeroporto Brigadeiro Camarão'],['PVH','Porto Velho','RO','Aeroporto Governador Jorge Teixeira'],['CGB','Cuiabá','MT','Aeroporto Marechal Rondon'],['GRU','São Paulo','SP','Aeroporto Internacional de Guarulhos'],['CGH','São Paulo','SP','Aeroporto de Congonhas'],['VCP','Campinas','SP','Aeroporto de Viracopos'],['GIG','Rio de Janeiro','RJ','Aeroporto do Galeão'],['SDU','Rio de Janeiro','RJ','Aeroporto Santos Dumont'],['BSB','Brasília','DF','Aeroporto Internacional de Brasília'],['CNF','Belo Horizonte','MG','Aeroporto de Confins'],['CWB','Curitiba','PR','Aeroporto Afonso Pena'],['FLN','Florianópolis','SC','Aeroporto Hercílio Luz'],['SSA','Salvador','BA','Aeroporto de Salvador'],['REC','Recife','PE','Aeroporto dos Guararapes'],['FOR','Fortaleza','CE','Aeroporto Pinto Martins'],['MCZ','Maceió','AL','Aeroporto Zumbi dos Palmares'],['NAT','Natal','RN','Aeroporto de Natal'],['MAO','Manaus','AM','Aeroporto Eduardo Gomes'],['BEL','Belém','PA','Aeroporto de Belém'],['IGU','Foz do Iguaçu','PR','Aeroporto das Cataratas']];
const programs=['Azul Fidelidade','LATAM Pass','Smiles','Livelo'];
const defaults={wallet:{'Azul Fidelidade':160000,'LATAM Pass':0,'Smiles':0,'Livelo':0},alerts:{master:true,flights:true,hotels:true,packages:true,cheap:true,whatsapp:true,email:false},saved:[],theme:'dark'};
const state=JSON.parse(localStorage.getItem('avpro_state')||'null')||structuredClone(defaults);
let currentSearch=null,currentResults=[];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function persist(){localStorage.setItem('avpro_state',JSON.stringify(state));renderStats()}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function showView(name){$$('.view').forEach(v=>v.classList.remove('active'));$(`#view-${name}`).classList.add('active');$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$('#pageTitle').textContent={dashboard:'Visão geral',search:'Nova busca',saved:'Minhas buscas',alerts:'Alertas',admin:'Administração'}[name];$('#sidebar').classList.remove('open');scrollTo({top:0,behavior:'smooth'})}
$$('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));$$('.nav-item').forEach(b=>b.onclick=()=>showView(b.dataset.view));$('#quickSearch').onclick=()=>showView('search');$('#menuBtn').onclick=()=>$('#sidebar').classList.toggle('open');
$('#themeBtn').onclick=()=>{state.theme=state.theme==='light'?'dark':'light';applyTheme();persist()};function applyTheme(){document.body.classList.toggle('light',state.theme==='light')}applyTheme();
function airportLabel(a){return `${a[1]} (${a[0]}) — ${a[3]}`}
function setupAutocomplete(input,box){input.addEventListener('input',()=>{const q=input.value.toLowerCase().trim();if(!q){box.classList.remove('show');return}const list=airports.filter(a=>a.join(' ').toLowerCase().includes(q)).slice(0,7);box.innerHTML=list.map(a=>`<div class="suggestion" data-value="${airportLabel(a)}"><b>${a[1]} — ${a[0]}</b><small>${a[3]}, ${a[2]}</small></div>`).join('');box.classList.toggle('show',!!list.length);box.querySelectorAll('.suggestion').forEach(i=>i.onclick=()=>{input.value=i.dataset.value;box.classList.remove('show')})});input.addEventListener('blur',()=>setTimeout(()=>box.classList.remove('show'),180))}
setupAutocomplete($('#origin'),$('#originSuggestions'));setupAutocomplete($('#destination'),$('#destinationSuggestions'));
$('#anyDestination').onchange=e=>{$('#destination').disabled=e.target.checked;$('#destination').value=e.target.checked?'Qualquer destino barato':''};
const counters={adults:{min:1,max:9},children:{min:0,max:8}};$$('[data-counter]').forEach(b=>b.onclick=()=>{const id=b.dataset.counter,input=$(`#${id}`),cfg=counters[id];input.value=Math.max(cfg.min,Math.min(cfg.max,+input.value+(+b.dataset.delta)));if(id==='children')renderChildAges()});
function renderChildAges(){const n=+$('#children').value,box=$('#childAges');box.innerHTML='';box.classList.toggle('hidden',n===0);for(let i=0;i<n;i++){const d=document.createElement('div');d.className='field';d.innerHTML=`<label>Idade da criança ${i+1}</label><select class="child-age">${Array.from({length:18},(_,age)=>`<option value="${age}">${age===0?'Menos de 1 ano (bebê)':age+' '+(age===1?'ano':'anos')}</option>`).join('')}</select>`;box.appendChild(d)}}
function setDates(){const d=new Date();d.setDate(d.getDate()+20);$('#departure').value=d.toISOString().slice(0,10);d.setDate(d.getDate()+5);$('#return').value=d.toISOString().slice(0,10)}setDates();
const deals=[['OAL → GRU','Azul','32.000 pts + R$ 118','-26%'],['CGB → MCZ','LATAM','R$ 1.284','-18%'],['PVH → REC','Smiles','44.500 milhas','-21%']];function renderDeals(){$('#dealList').innerHTML=deals.map(d=>`<div class="deal"><div class="logo">${d[1][0]}</div><div class="deal-copy"><b>${d[0]}</b><small>${d[1]} • ida e volta</small></div><div class="deal-price"><strong>${d[2]}</strong><small>${d[3]}</small></div></div>`).join('')}
function renderWallet(){const total=Object.values(state.wallet).reduce((a,b)=>a+b,0);$('#walletList').innerHTML=programs.map((p,i)=>`<div class="wallet-item"><div class="wallet-logo">${p[0]}</div><div class="wallet-copy"><b>${p}</b><small>${state.wallet[p].toLocaleString('pt-BR')} pontos</small></div></div>`).join('');$('#statPoints').textContent=total>=1000?`${Math.round(total/1000)} mil`:total;$('#walletInputs').innerHTML=programs.map(p=>`<label class="wallet-input"><span>${p}</span><input type="number" min="0" data-program="${p}" value="${state.wallet[p]}"></label>`).join('')}
$$('[data-open="wallet"]').forEach(b=>b.onclick=()=>{renderWallet();$('#walletDialog').showModal()});$('#saveWallet').onclick=e=>{e.preventDefault();$$('#walletInputs input').forEach(i=>state.wallet[i.dataset.program]=Math.max(0,+i.value||0));persist();renderWallet();$('#walletDialog').close();toast('Carteira atualizada')};
function makeResults(search){const pax=search.adults+search.children;const route=search.any?'Destino econômico surpresa':`${search.origin.split('—')[0]} → ${search.destination.split('—')[0]}`;const base=890+Math.floor(Math.random()*640);const points=Math.round((base*33)/500)*500;const nights=Math.max(1,Math.round((new Date(search.return)-new Date(search.departure))/86400000)||4);return[
{type:'PASSAGEM',name:'Azul Fidelidade',route,price:`${(points*pax).toLocaleString('pt-BR')} pontos`,sub:`+ R$ ${(118.4*pax).toFixed(2).replace('.',',')} em taxas`,score:94,meta:['1 escala','Bagagem: consultar','Economia estimada: 24%'],best:true,cash:base*pax},
{type:'PASSAGEM',name:'Melhor preço em dinheiro',route,price:(base*.92*pax).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),sub:'Total para todos os passageiros',score:88,meta:['Voo econômico','Taxas incluídas','Economia estimada: 17%'],cash:base*.92*pax},
{type:'PACOTE COMPLETO',name:'Voo + hotel recomendado',route,price:(base*pax+nights*310).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),sub:`${nights} noites • total estimado`,score:91,meta:['Hotel bem avaliado','Café da manhã','Melhor equilíbrio geral'],cash:base*pax+nights*310}
]}
$('#searchForm').onsubmit=e=>{e.preventDefault();const ages=$$('.child-age').map(s=>+s.value);currentSearch={origin:$('#origin').value,destination:$('#destination').value,any:$('#anyDestination').checked,departure:$('#departure').value,return:$('#return').value,adults:+$('#adults').value,children:+$('#children').value,ages,preference:$('#preference').value,tripType:$('#tripType').value,createdAt:new Date().toISOString()};if(!currentSearch.origin)return toast('Informe a origem');if(!currentSearch.any&&!currentSearch.destination)return toast('Informe o destino');currentResults=makeResults(currentSearch);renderResults();$('#resultsPanel').classList.remove('hidden');$('#resultsPanel').scrollIntoView({behavior:'smooth',block:'start'})};
function renderResults(){const best=currentResults.find(r=>r.best);$('#aiRecommendation').innerHTML=`<b>✦ Recomendação da IA:</b> ${best.name} oferece o melhor valor estimado para esta viagem. A opção em pontos preserva aproximadamente <b>${(best.cash*.24).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b> em dinheiro.`;$('#resultCards').innerHTML=currentResults.map(r=>`<article class="result-card ${r.best?'best':''}"><span class="tag">${r.type}</span><h4>${r.name}</h4><div class="route">${r.route}</div><div class="price-main">${r.price}</div><div class="price-sub">${r.sub}</div><div class="result-meta">${r.meta.map(m=>`<span>✓ ${m}</span>`).join('')}</div></article>`).join('');const saving=Math.max(...currentResults.map(r=>r.cash))-Math.min(...currentResults.map(r=>r.cash));$('#statSaving').textContent=saving.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0})}
$('#saveSearch').onclick=()=>{if(!currentSearch)return;state.saved.unshift({...currentSearch,id:Date.now(),active:true});persist();renderSaved();toast('Busca salva e monitoramento ativado')};
$('#exportResults').onclick=()=>{if(!currentSearch)return;const lines=['ALERTA VIAGEM PRO','',`Rota: ${currentSearch.origin} → ${currentSearch.any?'Qualquer destino barato':currentSearch.destination}`,`Datas: ${currentSearch.departure} a ${currentSearch.return}`,'',...currentResults.flatMap(r=>[r.name,r.price,r.sub,''])];const blob=new Blob([lines.join('\n')],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='resumo-viagem.txt';a.click();URL.revokeObjectURL(a.href)};
function renderSaved(){const box=$('#savedList');if(!state.saved.length){box.innerHTML='<div class="ai-note"><span>⌕</span><p>Nenhuma busca salva ainda. Crie uma busca e ative o monitoramento.</p></div>';return}box.innerHTML=state.saved.map(s=>`<div class="saved-item"><div class="saved-info"><b>${s.origin.split('—')[0]} → ${s.any?'Qualquer destino barato':s.destination.split('—')[0]}</b><small>${s.departure} até ${s.return||'somente ida'} • ${s.adults+s.children} passageiro(s)</small></div><div class="saved-actions"><button class="secondary" data-toggle="${s.id}">${s.active?'Pausar':'Ativar'}</button><button class="secondary" data-delete="${s.id}">Excluir</button></div></div>`).join('');$$('[data-toggle]').forEach(b=>b.onclick=()=>{const s=state.saved.find(x=>x.id==b.dataset.toggle);s.active=!s.active;persist();renderSaved()});$$('[data-delete]').forEach(b=>b.onclick=()=>{state.saved=state.saved.filter(x=>x.id!=b.dataset.delete);persist();renderSaved();toast('Busca removida')})}
const alertDefs=[['master','Receber avisos','Liga ou pausa todos os alertas'],['flights','Passagens','Queda de preço e boas emissões'],['hotels','Hotéis','Tarifas e disponibilidade'],['packages','Pacotes completos','Voo + hotel com vantagem'],['cheap','Destinos muito baratos','Oportunidades fora da rota escolhida'],['whatsapp','WhatsApp','Avisos rápidos no celular'],['email','E-mail','Resumo detalhado das ofertas']];function renderAlerts(){$('#alertControls').innerHTML=alertDefs.map(([k,t,s])=>`<label class="alert-row"><span><b>${t}</b><small>${s}</small></span><span class="switch-line" style="padding:0;border:0;background:none"><input type="checkbox" data-alert="${k}" ${state.alerts[k]?'checked':''}><span class="switch"></span></span></label>`).join('');$$('[data-alert]').forEach(i=>i.onchange=()=>{state.alerts[i.dataset.alert]=i.checked;if(i.dataset.alert==='master')Object.keys(state.alerts).forEach(k=>state.alerts[k]=i.checked);persist();renderAlerts()});$('#alertStatus').textContent=state.alerts.master?'Ativas':'Pausadas';$('#alertStatus').style.color=state.alerts.master?'var(--green)':'var(--danger)'}
const users=[['Marcos Silva','Mensal','active','Ativo','12/08/2026'],['Ana Souza','Teste','pending','Pendente','—'],['Carlos Lima','Premium','active','Ativo','30/08/2026'],['Fernanda Rocha','Mensal','blocked','Bloqueado','Suspenso']];function renderUsers(){$('#userTable').innerHTML=users.map(u=>`<tr><td><b>${u[0]}</b></td><td>${u[1]}</td><td><span class="status ${u[2]}">${u[3]}</span></td><td>${u[4]}</td><td><button class="secondary">Gerenciar</button></td></tr>`).join('')}
function renderStats(){$('#statSearches').textContent=state.saved.length;$('#statAlerts').textContent=Object.values(state.alerts).filter(Boolean).length}
renderDeals();renderWallet();renderSaved();renderAlerts();renderUsers();renderStats();renderChildAges();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

function extractIata(value){
  const match=String(value||'').match(/\(([A-Z]{3})\)/)||String(value||'').match(/^([A-Z]{3})$/);
  return match?match[1]:'';
}
function extractCity(value){return String(value||'').split('(')[0].split('—')[0].trim()}
function formatMinutes(total){const h=Math.floor((total||0)/60),m=(total||0)%60;return `${h}h${m?` ${m}min`:''}`}
function nightsBetween(checkIn,checkOut){return Math.max(1,Math.round((new Date(checkOut)-new Date(checkIn))/86400000))}
function money(value){return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function mapFlightOption(item,index){
  const legs=Array.isArray(item.flights)?item.flights:[];
  const first=legs[0]||{},last=legs[legs.length-1]||{};
  const airlines=[...new Set(legs.map(f=>f.airline).filter(Boolean))];
  const stops=Math.max(0,legs.length-1);
  return {kind:'flight',type:'PASSAGEM REAL',name:airlines.join(' + ')||'Opção de voo',route:`${first.departure_airport?.id||''} → ${last.arrival_airport?.id||''}`,price:money(item.price),sub:`${first.departure_airport?.time||''} → ${last.arrival_airport?.time||''}`,score:Math.max(70,96-index*2),meta:[stops===0?'Voo direto':`${stops} escala(s)`,formatMinutes(item.total_duration||legs.reduce((a,f)=>a+(f.duration||0),0)),item.type||''].filter(Boolean),best:false,cash:Number(item.price||0),bookingToken:item.booking_token||'',departureToken:item.departure_token||''};
}
function mapHotelOption(item,index,nights){
  const total=Number(item.total_rate?.extracted_lowest||0);
  const nightly=Number(item.rate_per_night?.extracted_lowest||item.extracted_price||0);
  const cash=total||nightly*nights;
  const rating=item.overall_rating?`${item.overall_rating.toFixed?.(1)||item.overall_rating}/5`:'';
  const amenities=(item.amenities||item.essential_info||[]).slice(0,2);
  return {kind:'hotel',type:'HOTEL REAL',name:item.name||'Hospedagem',route:extractCity(currentSearch?.destination)||'Destino',price:money(cash),sub:`${nights} noite(s)${nightly?` • ${money(nightly)}/noite`:''}`,score:Math.max(70,95-index*2),meta:[rating,item.reviews?`${item.reviews} avaliações`:'',item.free_cancellation?'Cancelamento grátis':'',...amenities].filter(Boolean),best:false,cash,propertyToken:item.property_token||'',link:item.link||''};
}
async function postJson(url,payload){
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Não foi possível concluir a consulta agora.');
  return data;
}
async function searchRealFlights(search){
  const departureId=extractIata(search.origin),arrivalId=extractIata(search.destination);
  if(!departureId)throw new Error('Selecione um aeroporto de origem da lista.');
  if(search.any)throw new Error('Escolha um destino para esta busca real.');
  if(!arrivalId)throw new Error('Selecione um aeroporto de destino da lista.');
  const data=await postJson('/api/flights',{departure_id:departureId,arrival_id:arrivalId,outbound_date:search.departure,return_date:search.return||undefined,adults:search.adults,children:search.children,deep_search:true});
  const options=[...(data.best_flights||[]),...(data.other_flights||[])].slice(0,10).map(mapFlightOption);
  if(!options.length)throw new Error('Nenhum voo foi encontrado para essa rota e data.');
  return options;
}
async function searchRealHotels(search){
  if(search.any)throw new Error('Escolha um destino para pesquisar hotéis.');
  if(!search.return)throw new Error('Informe a data de saída do hotel no campo Volta.');
  const city=extractCity(search.destination);
  if(!city)throw new Error('Informe a cidade de destino.');
  const data=await postJson('/api/hotels',{q:`Hotéis em ${city}`,check_in_date:search.departure,check_out_date:search.return,adults:search.adults,children:search.children,children_ages:search.children?search.ages.map(age=>Math.max(1,age)).join(','):undefined});
  const nights=nightsBetween(search.departure,search.return);
  const options=(data.properties||[]).filter(p=>p.total_rate?.extracted_lowest||p.rate_per_night?.extracted_lowest||p.extracted_price).slice(0,10).map((p,i)=>mapHotelOption(p,i,nights));
  if(!options.length)throw new Error('Nenhum hotel com preço disponível foi encontrado para essas datas.');
  return options;
}
function buildPackages(flights,hotels){
  const list=[];
  flights.slice(0,3).forEach((flight,fi)=>hotels.slice(0,3).forEach((hotel,hi)=>{
    const total=flight.cash+hotel.cash;
    list.push({kind:'package',type:'PACOTE REAL',name:`${flight.name} + ${hotel.name}`,route:flight.route,price:money(total),sub:`Voo ${money(flight.cash)} + hotel ${money(hotel.cash)}`,score:Math.max(70,97-fi*3-hi*2),meta:[...flight.meta.slice(0,2),...hotel.meta.slice(0,2)],best:false,cash:total});
  }));
  return list.sort((a,b)=>a.cash-b.cash).slice(0,8);
}
function markBest(results){results.forEach(r=>r.best=false);const valid=results.filter(r=>Number.isFinite(r.cash)&&r.cash>0);if(valid.length)valid.reduce((a,b)=>a.cash<=b.cash?a:b).best=true;return results}
$('#searchForm').onsubmit=async e=>{
  e.preventDefault();
  const submit=e.submitter||$('#searchForm button[type="submit"]'),original=submit?.innerHTML;
  const ages=$$('.child-age').map(s=>+s.value);
  currentSearch={origin:$('#origin').value,destination:$('#destination').value,any:$('#anyDestination').checked,departure:$('#departure').value,return:$('#return').value,adults:+$('#adults').value,children:+$('#children').value,ages,preference:$('#preference').value,tripType:$('#tripType').value,createdAt:new Date().toISOString()};
  if(!currentSearch.origin)return toast('Informe a origem');
  if(!currentSearch.any&&!currentSearch.destination)return toast('Informe o destino');
  try{
    if(submit){submit.disabled=true;submit.textContent='Buscando preços reais...'}
    let recommendation='';
    if(currentSearch.tripType==='flight'){
      currentResults=markBest(await searchRealFlights(currentSearch));
      recommendation='Voos reais encontrados no Google Flights via SerpApi.';
    }else if(currentSearch.tripType==='hotel'){
      currentResults=markBest(await searchRealHotels(currentSearch));
      recommendation='Hotéis reais encontrados no Google Hotels via SerpApi.';
    }else{
      if(!currentSearch.return)throw new Error('Para uma viagem completa, informe também a data de volta/saída do hotel.');
      const [flights,hotels]=await Promise.all([searchRealFlights(currentSearch),searchRealHotels(currentSearch)]);
      currentResults=markBest(buildPackages(flights,hotels));
      recommendation='Pacotes calculados com preços reais de voo e hotel. O total soma as duas opções encontradas.';
    }
    renderResults();
    $('#aiRecommendation').innerHTML=`<b>✦ Resultado real:</b> ${recommendation}`;
    $('#resultsPanel').classList.remove('hidden');
    $('#resultsPanel').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){console.error(error);toast(error.message||'Erro ao buscar opções.');}
  finally{if(submit){submit.disabled=false;submit.innerHTML=original}}
};
