const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

const panel = `<div class="card avp-promotions-card"><div class="avp-promotions-head"><div><span class="tag">ATUALIZAÇÃO AUTOMÁTICA</span><h2 class="section-title">Promoções encontradas</h2><div class="small" id="promotionsUpdated">Atualizadas automaticamente e também sob demanda.</div></div><button type="button" class="secondary" id="refreshPromotions">Atualizar agora</button></div><div id="promotionRefreshStatus" class="small"></div><div id="homePromotions"><div class="empty">Carregando promoções monitoradas...</div></div></div>`;

if (!html.includes('id="homePromotions"')) {
  const dashboardPattern = /(<section class="view active" id="dashboard">[\s\S]*?)(<\/section>\s*<section class="view" id="search">)/;
  if (!dashboardPattern.test(html)) throw new Error('Fim do painel inicial não encontrado.');
  html = html.replace(dashboardPattern, `$1${panel}$2`);
} else {
  html = html.replace(/<div class="card avp-promotions-card">[\s\S]*?<div id="homePromotions">/, panel.replace('<div id="homePromotions"><div class="empty">Carregando promoções monitoradas...</div></div></div>','<div id="homePromotions">'));
}

html = html
  .replace(/<style id="avp-home-promotions-style">[\s\S]*?<\/style>/g, '')
  .replace(/<script id="avp-home-promotions-script">[\s\S]*?<\/script>/g, '');

const css = `<style id="avp-home-promotions-style">
.avp-promotions-card{margin-top:13px}.avp-promotions-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}.avp-promotions-head .section-title{margin:4px 0}.avp-promotions-grid{display:grid;grid-template-columns:1fr;gap:10px}.avp-promo{display:block;text-decoration:none;color:inherit;background:var(--panel2);border:1px solid var(--line);border-radius:14px;padding:14px;cursor:pointer}.avp-promo.best{border-color:var(--green);box-shadow:0 0 0 1px #31d69b33}.avp-promo-route{font-size:18px;font-weight:900;margin:5px 0}.avp-promo-price{font-size:24px;font-weight:950;margin:8px 0}.avp-promo-meta{display:grid;gap:4px;color:var(--muted);font-size:12px}.avp-promo-badge{display:inline-block;font-size:10px;font-weight:900;letter-spacing:.08em;color:#56d7ff}.avp-promo-badge.azul{color:#70d8ff}.avp-promo-action{display:flex;align-items:center;justify-content:center;width:100%;margin-top:14px;padding:12px 14px;border-radius:11px;background:linear-gradient(135deg,#087cff,#5748ff);color:#fff;font-size:14px;font-weight:900}.avp-promo-hint{display:block;margin-top:7px;text-align:center;color:var(--muted);font-size:10px}#promotionRefreshStatus{min-height:18px;margin-bottom:8px}#refreshPromotions[disabled]{opacity:.65;cursor:wait}@media(min-width:700px){.avp-promotions-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:1000px){.avp-promotions-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
</style>`;

const js = `<script id="avp-home-promotions-script">
(()=>{
 const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const date=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'—';
 const updated=v=>v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Porto_Velho'}):'aguardando primeira execução';
 async function loadPromotions(){
  const box=document.getElementById('homePromotions'),label=document.getElementById('promotionsUpdated');
  if(!box)return;
  try{
   const r=await fetch('/api/latest-promotions?ts='+Date.now(),{cache:'no-store'}),data=await r.json();
   if(!r.ok||!data.ok)throw new Error(data.error||'Falha ao carregar promoções.');
   if(label)label.textContent='Última atualização: '+updated(data.updatedAt)+' • busca automática a cada 3 horas.';
   const items=Array.isArray(data.promotions)?data.promotions:[];
   if(!items.length){box.innerHTML='<div class="empty">Ainda não há promoção registrada. Salve uma viagem e toque em Atualizar agora.</div>';return}
   box.innerHTML='<div class="avp-promotions-grid">'+items.map((p,i)=>'<a class="avp-promo '+(i===0?'best':'')+'" href="'+p.link+'"><span class="avp-promo-badge '+(p.azul?'azul':'')+'">'+(p.type==='alternative'?'DESTINO ALTERNATIVO':p.azul?'AZUL EM DESTAQUE':'OFERTA MONITORADA')+'</span><div class="avp-promo-route">'+p.origin+' → '+p.destination+'</div><div class="avp-promo-price">'+money(p.price)+'</div><div class="avp-promo-meta"><span>Ida: '+date(p.departure)+(p.returnDate?' • Volta: '+date(p.returnDate):'')+'</span><span>'+p.airline+' • '+(p.stops===0?'voo direto':p.stops+' escala(s)')+'</span></div><span class="avp-promo-action">Ver passagem aérea →</span></a>').join('')+'</div>';
  }catch(error){box.innerHTML='<div class="notice warning">Não foi possível carregar as promoções agora.</div>'}
 }
 async function refreshNow(){
  const button=document.getElementById('refreshPromotions'),status=document.getElementById('promotionRefreshStatus');
  if(!button)return;
  button.disabled=true;button.textContent='Buscando...';if(status)status.textContent='Pesquisando novas ofertas e verificando alertas por e-mail...';
  try{
   const r=await fetch('/api/monitor-trips?force=1&ts='+Date.now(),{cache:'no-store'}),data=await r.json();
   if(!r.ok||data.ok!==true)throw new Error(data.detail||data.error||data.message||'Falha na atualização.');
   await loadPromotions();
   if(status)status.textContent=data.skipped?data.message:'Busca concluída. '+(data.checked||0)+' viagem(ns) verificada(s) e '+(data.alerts||0)+' alerta(s) enviado(s).';
  }catch(error){if(status)status.textContent='Não foi possível atualizar: '+error.message}
  finally{button.disabled=false;button.textContent='Atualizar agora'}
 }
 window.addEventListener('load',()=>{loadPromotions();const b=document.getElementById('refreshPromotions');if(b)b.addEventListener('click',refreshNow)});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadPromotions()});
})();
</script>`;

html = html.replace('</head>', css + '</head>').replace('</body>', js + '</body>');
fs.writeFileSync(path, html, 'utf8');
console.log('Botão Atualizar agora instalado na tela inicial.');