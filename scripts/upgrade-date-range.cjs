const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

const searchDates = '<div class="field"><label>Data de ida</label><input type="date" id="departure" required></div><div class="field"><label>Data de volta</label><input type="date" id="returnDate"></div>';
const manageDates = '<div class="field"><label>Data de ida</label><input type="date" id="mDeparture" required></div><div class="field"><label>Data de volta</label><input type="date" id="mReturn"></div>';

const searchRange = '<div class="field full avp-range-field"><label>Datas da viagem</label><button type="button" class="avp-range-button" id="searchRangeButton"><span id="searchRangeText">Selecione a ida e a volta</span><small>Primeiro toque: ida • Segundo toque: volta</small></button><input type="date" id="departure" required hidden><input type="date" id="returnDate" hidden><div id="searchDateAlternatives"></div></div>';
const manageRange = '<div class="field full avp-range-field"><label>Datas da viagem</label><button type="button" class="avp-range-button" id="manageRangeButton"><span id="manageRangeText">Selecione a ida e a volta</span><small>Primeiro toque: ida • Segundo toque: volta</small></button><input type="date" id="mDeparture" required hidden><input type="date" id="mReturn" hidden><div id="manageDateAlternatives"></div></div>';

if (!html.includes(searchDates) || !html.includes(manageDates)) {
  throw new Error('Campos originais de datas não encontrados.');
}

html = html.replace(searchDates, searchRange).replace(manageDates, manageRange);

const css = `
<style id="avp-date-range-style">
.avp-range-button{width:100%;min-height:72px;border:1px solid var(--line);border-radius:12px;background:#071a2b;color:#fff;padding:12px 14px;text-align:left;display:grid;gap:5px}.avp-range-button span{font-size:17px;font-weight:800}.avp-range-button small{color:var(--muted)}
.avp-calendar-backdrop{position:fixed;inset:0;background:#000b;z-index:9000;display:grid;place-items:end center;padding:12px}.avp-calendar{width:min(520px,100%);max-height:88dvh;overflow:auto;background:#111c27;border:1px solid #31526e;border-radius:22px;padding:16px;box-shadow:0 24px 70px #000}.avp-cal-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}.avp-cal-head strong{font-size:18px}.avp-cal-nav{border:0;background:#18344c;color:#fff;border-radius:10px;width:44px;height:44px;font-size:24px}.avp-week,.avp-days{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.avp-week span{text-align:center;color:#8ea6b8;font-size:11px;font-weight:900;padding:6px 0}.avp-day{border:0;border-radius:12px;min-height:43px;background:transparent;color:#fff;font-weight:750}.avp-day:disabled{opacity:.22}.avp-day.start,.avp-day.end{background:linear-gradient(135deg,var(--blue),var(--violet));color:#fff}.avp-day.in-range{background:#18446a}.avp-cal-hint{color:#b9cad7;font-size:13px;margin:8px 0 13px}.avp-cal-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px}.avp-date-options{margin-top:10px;padding:12px;border:1px solid #675722;background:#3a3116;border-radius:12px}.avp-date-options b{display:block;margin-bottom:8px}.avp-date-chip{border:1px solid #56728a;background:#173653;color:#fff;border-radius:10px;padding:9px 10px;margin:4px 4px 0 0}
</style>`;

const js = String.raw`
<script id="avp-date-range-script">
(()=>{
 const pt=d=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
 const iso=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day};
 const setups=[
  {button:'searchRangeButton',text:'searchRangeText',start:'departure',end:'returnDate',alt:'searchDateAlternatives',origin:'origin',destination:'destination'},
  {button:'manageRangeButton',text:'manageRangeText',start:'mDeparture',end:'mReturn',alt:'manageDateAlternatives',origin:'mOrigin',destination:'mDestination'}
 ];
 function refresh(c){const a=document.getElementById(c.start)?.value,b=document.getElementById(c.end)?.value,t=document.getElementById(c.text);if(!t)return;t.textContent=a?(pt(a)+(b?' → '+pt(b):' → selecione a volta')):'Selecione a ida e a volta'}
 function calendar(c){let start=document.getElementById(c.start).value||'',end=document.getElementById(c.end).value||'',cursor=new Date((start||iso(new Date()))+'T12:00:00');cursor.setDate(1);
  const backdrop=document.createElement('div');backdrop.className='avp-calendar-backdrop';backdrop.innerHTML='<div class="avp-calendar"><div class="avp-cal-head"><button class="avp-cal-nav" data-prev>‹</button><strong data-title></strong><button class="avp-cal-nav" data-next>›</button></div><div class="avp-cal-hint" data-hint></div><div class="avp-week"><span>DOM</span><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span></div><div class="avp-days" data-days></div><div class="avp-cal-actions"><button class="secondary" data-reset>Redefinir</button><button class="primary" data-done>Confirmar</button></div></div>';document.body.appendChild(backdrop);
  const render=()=>{backdrop.querySelector('[data-title]').textContent=cursor.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});backdrop.querySelector('[data-hint]').textContent=!start?'Toque na data de ida.':!end?'Agora toque na data de volta.':'Período selecionado.';const days=backdrop.querySelector('[data-days]');days.innerHTML='';for(let i=0;i<new Date(cursor.getFullYear(),cursor.getMonth(),1).getDay();i++)days.appendChild(document.createElement('span'));const total=new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate();const today=iso(new Date());for(let n=1;n<=total;n++){const d=new Date(cursor.getFullYear(),cursor.getMonth(),n),v=iso(d),b=document.createElement('button');b.type='button';b.className='avp-day';b.textContent=n;b.disabled=v<today;if(v===start)b.classList.add('start');if(v===end)b.classList.add('end');if(start&&end&&v>start&&v<end)b.classList.add('in-range');b.onclick=()=>{if(!start||(start&&end)||v<start){start=v;end=''}else if(v===start){start='';end=''}else end=v;render()};days.appendChild(b)}};
  backdrop.querySelector('[data-prev]').onclick=()=>{cursor.setMonth(cursor.getMonth()-1);render()};backdrop.querySelector('[data-next]').onclick=()=>{cursor.setMonth(cursor.getMonth()+1);render()};backdrop.querySelector('[data-reset]').onclick=()=>{start='';end='';render()};backdrop.querySelector('[data-done]').onclick=()=>{if(!start||!end){backdrop.querySelector('[data-hint]').textContent='Selecione primeiro a ida e depois a volta.';return}document.getElementById(c.start).value=start;document.getElementById(c.end).value=end;refresh(c);backdrop.remove()};backdrop.onclick=e=>{if(e.target===backdrop)backdrop.remove()};render();
 }
 setups.forEach(c=>{document.getElementById(c.button)?.addEventListener('click',()=>calendar(c));refresh(c)});
 window.addEventListener('load',()=>setTimeout(()=>setups.forEach(refresh),100));
 async function suggest(c){const a=document.getElementById(c.start)?.value,b=document.getElementById(c.end)?.value,o=(document.getElementById(c.origin)?.value.match(/\(([A-Z]{3})\)/)||[])[1],d=(document.getElementById(c.destination)?.value.match(/\(([A-Z]{3})\)/)||[])[1],box=document.getElementById(c.alt);if(!a||!b||!o||!d||!box)return;box.innerHTML='<div class="notice warning">A IA está procurando datas próximas com voos disponíveis...</div>';try{const r=await fetch('/api/available-dates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin:o,destination:d,departure:a,returnDate:b,adults:Number(document.getElementById(c.button==='searchRangeButton'?'adults':'mAdults')?.value||1),children:Number(document.getElementById(c.button==='searchRangeButton'?'children':'mChildren')?.value||0)})});const data=await r.json();if(!data.options?.length){box.innerHTML='<div class="notice warning">Não encontrei voos nas datas próximas. O monitoramento continuará procurando.</div>';return}box.innerHTML='<div class="avp-date-options"><b>Datas próximas com disponibilidade:</b>'+data.options.map((x,i)=>'<button type="button" class="avp-date-chip" data-i="'+i+'">'+pt(x.departure)+' → '+pt(x.returnDate)+(x.price?' • '+Number(x.price).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'')+'</button>').join('')+'</div>';box.querySelectorAll('[data-i]').forEach(btn=>btn.onclick=()=>{const x=data.options[Number(btn.dataset.i)];document.getElementById(c.start).value=x.departure;document.getElementById(c.end).value=x.returnDate;refresh(c);box.innerHTML='<div class="notice">Datas alternativas aplicadas.</div>'})}catch{box.innerHTML='<div class="notice warning">Não foi possível consultar datas alternativas agora. O monitor continuará tentando.</div>'}}
 const observer=new MutationObserver(()=>{const results=document.getElementById('results'),msg=document.getElementById('searchMessage');const noFlight=/Nenhuma opção disponível|Nenhum voo|não foi encontrada/i.test((results?.textContent||'')+' '+(msg?.textContent||''));if(noFlight&&!observer.busy){observer.busy=true;suggest(setups[0]).finally(()=>setTimeout(()=>observer.busy=false,1500))}});const target=document.getElementById('search');if(target)observer.observe(target,{subtree:true,childList:true,characterData:true});
})();
</script>`;

html = html.replace('</head>', css + '</head>').replace('</body>', js + '</body>');
fs.writeFileSync(path, html, 'utf8');
console.log('Seletor único de período e sugestões de datas instalados.');
