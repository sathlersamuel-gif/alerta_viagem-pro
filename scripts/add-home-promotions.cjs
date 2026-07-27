const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

if (html.includes('id="homePromotions"')) {
  console.log('Painel de promoções já instalado.');
  process.exit(0);
}

const panel = `<div class="card avp-promotions-card"><div class="avp-promotions-head"><div><span class="tag">ATUALIZAÇÃO AUTOMÁTICA</span><h2 class="section-title">Promoções encontradas</h2><div class="small" id="promotionsUpdated">Atualizadas a cada 3 horas.</div></div><button type="button" class="secondary" data-go="search">Nova busca</button></div><div id="homePromotions"><div class="empty">Carregando promoções monitoradas...</div></div></div>`;

const dashboardPattern = /(<section class="view active" id="dashboard">[\s\S]*?)(<\/section>\s*<section class="view" id="search">)/;
if (!dashboardPattern.test(html)) throw new Error('Fim do painel inicial não encontrado.');
html = html.replace(dashboardPattern, `$1${panel}$2`);

const css = `<style id="avp-home-promotions-style">
.avp-promotions-card{margin-top:13px}.avp-promotions-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.avp-promotions-head .section-title{margin:4px 0}.avp-promotions-grid{display:grid;grid-template-columns:1fr;gap:10px}.avp-promo{display:block;text-decoration:none;color:inherit;background:var(--panel2);border:1px solid var(--line);border-radius:14px;padding:14px}.avp-promo.best{border-color:var(--green);box-shadow:0 0 0 1px #31d69b33}.avp-promo-route{font-size:18px;font-weight:900;margin:5px 0}.avp-promo-price{font-size:24px;font-weight:950;margin:8px 0}.avp-promo-meta{display:grid;gap:4px;color:var(--muted);font-size:12px}.avp-promo-badge{display:inline-block;font-size:10px;font-weight:900;letter-spacing:.08em;color:#56d7ff}.avp-promo-badge.azul{color:#70d8ff}@media(min-width:700px){.avp-promotions-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(min-width:1000px){.avp-promotions-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
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
   const r=await fetch('/api/latest-promotions',{cache:'no-store'}),data=await r.json();
   if(!r.ok||!data.ok)throw new Error(data.error||'Falha ao carregar promoções.');
   if(label)label.textContent='Última atualização: '+updated(data.updatedAt)+' • novas consultas a cada 3 horas.';
   const items=Array.isArray(data.promotions)?data.promotions:[];
   if(!items.length){box.innerHTML='<div class="empty">Ainda não há promoção registrada. Salve uma viagem e aguarde a próxima busca automática.</div>';return}
   box.innerHTML='<div class="avp-promotions-grid">'+items.map((p,i)=>'<a class="avp-promo '+(i===0?'best':'')+'" href="'+p.link+'"><span class="avp-promo-badge '+(p.azul?'azul':'')+'">'+(p.type==='alternative'?'DESTINO ALTERNATIVO':p.azul?'AZUL EM DESTAQUE':'OFERTA MONITORADA')+'</span><div class="avp-promo-route">'+p.origin+' → '+p.destination+'</div><div class="avp-promo-price">'+money(p.price)+'</div><div class="avp-promo-meta"><span>Ida: '+date(p.departure)+(p.returnDate?' • Volta: '+date(p.returnDate):'')+'</span><span>'+p.airline+' • '+(p.stops===0?'voo direto':p.stops+' escala(s)')+'</span><span>'+(p.adults||1)+' adulto(s)'+(p.children?' + '+p.children+' criança(s)':'')+'</span></div></a>').join('')+'</div>';
  }catch(error){box.innerHTML='<div class="notice warning">Não foi possível carregar as promoções agora. O monitoramento continua ativo.</div>'}
 }
 window.addEventListener('load',loadPromotions);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadPromotions()});
})();
</script>`;

html = html.replace('</head>', css + '</head>').replace('</body>', js + '</body>');
fs.writeFileSync(path, html, 'utf8');
console.log('Promoções monitoradas adicionadas ao início do aplicativo.');