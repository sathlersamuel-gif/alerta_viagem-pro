const { list, get, put } = require('@vercel/blob');
const { Resend } = require('resend');
const { analyze, KNOWLEDGE_VERSION } = require('../lib/travel-agent-knowledge');

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'sathlersamuel@gmail.com';
const ALERT_FROM = process.env.ALERT_FROM || 'Alerta Viagem PRO <onboarding@resend.dev>';
const APP_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'alerta-viagem-pro.vercel.app'}`;
const AZUL_POINTS_URL = 'https://passagens.voeazul.com.br/pt/pontos';
const isAzulFlight = item => (item?.flights || []).some(leg => /azul/i.test(String(leg?.airline || '')));

function allFlights(data, trip) {
  return [...(data.best_flights || []), ...(data.other_flights || [])]
    .filter(item => Number(item.price) > 0)
    .sort((a, b) => trip?.program === 'azul'
      ? Number(isAzulFlight(b)) - Number(isAzulFlight(a)) || Number(a.price) - Number(b.price)
      : Number(a.price) - Number(b.price));
}
function summarizeFlight(item) {
  const legs = Array.isArray(item?.flights) ? item.flights : [], first = legs[0] || {}, last = legs[legs.length - 1] || {};
  const airlines = [...new Set(legs.map(leg => leg.airline).filter(Boolean))];
  return { price:Number(item?.price)||null, airline:airlines.join(' + ')||'Companhia não informada', azul:isAzulFlight(item), departure:first.departure_airport?.time||'', arrival:last.arrival_airport?.time||'', stops:Math.max(0,legs.length-1), duration:Number(item?.total_duration)||null, bookingToken:item?.booking_token||'', departureToken:item?.departure_token||'' };
}
function buildSuggestions(data, trip) { return allFlights(data, trip).slice(0, 6).map(summarizeFlight).filter(item => item.price); }
function shouldEmail(trip, price, now) {
  if (!price) return false;
  if (!trip.lastAlertAt) return true;
  const elapsed = now - new Date(trip.lastAlertAt).getTime();
  return elapsed >= 2.75 * 60 * 60 * 1000;
}
async function searchTrip(trip) {
  const params = new URLSearchParams({ engine:'google_flights', api_key:process.env.SERPAPI_API_KEY, hl:'pt', gl:'br', currency:'BRL', type:trip.return?'1':'2', departure_id:trip.origin, arrival_id:trip.destination, outbound_date:trip.departure, adults:String(trip.adults||1), children:String(trip.children||0), sort_by:'2' });
  if (trip.return) params.set('return_date', trip.return);
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || 'Falha na consulta da SerpApi');
  const suggestions = buildSuggestions(data, trip);
  return { price:suggestions[0]?.price||null, suggestions, data };
}
function plainText(html=''){return String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim()}
async function findPublicAzulPoints(trip) {
  if (trip.program !== 'azul' && !['points','mixed'].includes(trip.preference)) return null;
  try {
    const response = await fetch(AZUL_POINTS_URL,{headers:{'Accept-Language':'pt-BR,pt;q=0.9','User-Agent':'AlertaViagemPro/1.0'},cache:'no-store'});
    if(!response.ok)return null; const text=plainText(await response.text());
    const pattern=/([A-Za-zÀ-ÿ .'-]+)\s*\(([A-Z]{3})\)\s*(?:Para)?\s*([A-Za-zÀ-ÿ .'-]+)\s*\(([A-Z]{3})\)\s*(?:Só ida|Ida e volta)?\s*Ida:\s*(\d{2}\/\d{2}\/\d{4})[\s\S]{0,80}?A partir de\s*([\d.,]+)\s*pontos/gi;
    let match; const candidates=[];
    while((match=pattern.exec(text))!==null){const dateBr=match[5],pointsRaw=match[6];const[day,month,year]=dateBr.split('/');const date=`${year}-${month}-${day}`;const origin=match[2],dest=match[4];if(origin===trip.origin&&dest===trip.destination&&date===trip.departure)candidates.push(Number(pointsRaw.replace(/[^\d]/g,'')))}
    const points=candidates.filter(Boolean).sort((a,b)=>a-b)[0]; return points?{points,exactInventory:false,source:'Azul Fidelidade',sourceUrl:AZUL_POINTS_URL}:null;
  } catch{return null}
}
function minutesLabel(v){if(!v)return'';const h=Math.floor(v/60),m=v%60;return`${h}h${m?` ${m}min`:''}`}
function flightBookingUrl(trip,item){
  const q=new URLSearchParams({departure_id:trip.origin,arrival_id:trip.destination,outbound_date:trip.departure,adults:String(trip.adults||1),children:String(trip.children||0),airline:item.airline||'',price:String(item.price||'')});
  if(trip.return)q.set('return_date',trip.return);if(item.bookingToken)q.set('booking_token',item.bookingToken);if(item.departureToken)q.set('departure_token',item.departureToken);
  return `${APP_URL}/api/flight-booking?${q.toString()}`;
}
function hotelBookingUrl(trip){
  const q=new URLSearchParams({ss:trip.destination,checkin:trip.departure,checkout:trip.return||trip.departure,group_adults:String(trip.adults||1),group_children:String(trip.children||0),no_rooms:'1'});
  return `https://www.booking.com/searchresults.pt-br.html?${q.toString()}`;
}
async function sendAlert(resend,trip,result,oldPrice,decision,pointsOffer){
  const price=result.price,saving=oldPrice&&oldPrice>price?oldPrice-price:null,options=trip.agentSuggestions!==false?result.suggestions:result.suggestions.slice(0,1);
  const suggestionsHtml=options.map((item,index)=>`<div style="padding:12px 14px;margin:10px 0;border:1px solid ${item.azul?'#00a8e8':'#d7e6f5'};border-radius:12px"><b>${item.azul?'Azul em destaque':index===0?'Melhor opção encontrada':`Sugestão ${index+1}`}</b><br>${item.airline} • R$ ${item.price.toLocaleString('pt-BR')}<br>${item.departure&&item.arrival?`${item.departure} → ${item.arrival}`:''}${item.stops===0?' • voo direto':` • ${item.stops} escala(s)`}${item.duration?` • ${minutesLabel(item.duration)}`:''}<br><a href="${flightBookingUrl(trip,item)}" style="display:inline-block;margin-top:10px;padding:10px 14px;background:#0057b8;color:white;text-decoration:none;border-radius:8px">Reservar esta passagem</a></div>`).join('');
  const pointsHtml=pointsOffer?`<p><b>Referência pública Azul:</b> ${Number(pointsOffer.points).toLocaleString('pt-BR')} pontos por pessoa. <a href="${AZUL_POINTS_URL}">Consultar na Azul</a>.</p>`:(trip.program==='azul'?'<p><b>Azul Fidelidade:</b> não foi encontrada emissão pública confirmada para esta rota e data.</p>':'');
  const hotelLink=hotelBookingUrl(trip);
  const subject=`✈️ Atualização de viagem: ${trip.origin} → ${trip.destination}`;
  const html=`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#102235"><h2>Alerta Viagem PRO</h2><p><b>Atualização automática das últimas 3 horas.</b></p><p><b>Análise da IA:</b> ${decision.reason}</p><h3>${trip.origin} → ${trip.destination}</h3>${pointsHtml}${suggestionsHtml}${saving?`<p>Economia de R$ ${saving.toLocaleString('pt-BR')}.</p>`:'<p>Este é o melhor valor encontrado nesta verificação.</p>'}<p><a href="${hotelLink}" style="display:inline-block;padding:10px 14px;background:#0b7a53;color:white;text-decoration:none;border-radius:8px">Pesquisar e reservar hotel</a></p><p><b>Recomendação:</b> ${decision.title}.</p><small>Conhecimento ${KNOWLEDGE_VERSION}. Os preços podem mudar ao abrir o fornecedor; confirme antes de pagar.</small></div>`;
  const sent=await resend.emails.send({from:ALERT_FROM,to:ALERT_EMAIL,subject,html});
  if(sent?.error)throw new Error(sent.error.message||'Resend recusou o envio do alerta.');
}
async function streamToJson(stream) {
  const reader = stream.getReader(); const chunks = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(Buffer.from(value)); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
module.exports=async function handler(req,res){
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método não permitido.'});
  if(process.env.CRON_SECRET&&req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Não autorizado.'});
  const missing=[];if(!process.env.BLOB_READ_WRITE_TOKEN)missing.push('BLOB_READ_WRITE_TOKEN');if(!process.env.SERPAPI_API_KEY)missing.push('SERPAPI_API_KEY');if(missing.length)return res.status(200).json({ok:false,configured:false,skipped:true,missing,message:'Monitoramento aguardando configuração.'});
  const resend=process.env.RESEND_API_KEY?new Resend(process.env.RESEND_API_KEY):null;const now=Date.now();let checked=0,alerts=0,errors=0,azulFound=0;
  try{
    let cursor;
    do{
      const page=await list({prefix:'monitoring/',limit:100,cursor}); cursor=page.cursor;
      for(const blob of page.blobs){
        const pathname=blob.pathname || new URL(blob.url).pathname.replace(/^\//,'');
        const stored=await get(pathname,{access:'private'}); if(!stored||stored.statusCode!==200||!stored.stream)continue;
        const document=await streamToJson(stored.stream); const trips=Array.isArray(document.trips)?document.trips:[];
        for(const trip of trips){
          if(!trip.active)continue; checked++;
          try{
            if(!/^[A-Z]{3}$/.test(trip.origin)||!/^[A-Z]{3}$/.test(trip.destination))throw new Error('Código IATA inválido.');
            const oldPrice=Number(trip.bestPrice)||null; const[result,pointsOffer]=await Promise.all([searchTrip(trip),findPublicAzulPoints(trip)]);
            azulFound+=result.suggestions.filter(x=>x.azul).length;
            const decision=analyze({trip,cashPrice:result.price,oldBest:oldPrice,flightData:result.data,pointsOffer});
            trip.lastCheckedAt=new Date().toISOString();trip.lastError=null;trip.lastSuggestion=result.suggestions[0]||null;trip.lastDecision=decision;trip.lastPointsReference=pointsOffer;trip.azulOptionsFound=result.suggestions.filter(x=>x.azul).length;
            if(result.price){if(shouldEmail(trip,result.price,now)&&resend&&['email','both'].includes(trip.channel)){await sendAlert(resend,trip,result,oldPrice,decision,pointsOffer);trip.lastAlertAt=new Date().toISOString();alerts++}if(!oldPrice||result.price<oldPrice)trip.bestPrice=result.price}
          }catch(error){trip.lastCheckedAt=new Date().toISOString();trip.lastError=error.message||'Erro durante a consulta';errors++}
        }
        await put(pathname,JSON.stringify({...document,trips,knowledgeVersion:KNOWLEDGE_VERSION,updatedAt:new Date().toISOString()}),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',cacheControlMaxAge:0});
      }
    }while(cursor);
    return res.status(200).json({ok:true,configured:true,checked,alerts,errors,azulFound,emailEnabled:Boolean(resend),agentMode:true,knowledgeVersion:KNOWLEDGE_VERSION});
  }catch(error){console.error('Monitor trips error:',error);return res.status(500).json({ok:false,error:'Falha ao executar o monitoramento automático.',detail:error?.message||'Erro desconhecido'});}
};