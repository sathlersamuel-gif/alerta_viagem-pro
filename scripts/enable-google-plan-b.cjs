const fs = require('fs');

const path = 'api/monitor-trips.js';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes('const GOOGLE_PLAN_B_INTERVAL')) {
  source = source.replace(
    /const FALLBACK_INTERVAL\s*=\s*[^;]+;/,
    match => `${match}\nconst GOOGLE_PLAN_B_INTERVAL = 3 * 60 * 60 * 1000;`
  );
} else {
  source = source.replace(
    /const GOOGLE_PLAN_B_INTERVAL\s*=\s*[^;]+;/,
    'const GOOGLE_PLAN_B_INTERVAL = 3 * 60 * 60 * 1000;'
  );
}

if (!source.includes('function googlePlanBTargets(')) {
  const marker = 'function passengerLabel(trip){';
  const helper = `function googlePlanBTargets(trip){
  const national=['SSA','REC','FOR','MCZ','NAT','GIG','GRU','FLN','CWB','IGU'];
  const international=['EZE','SCL','ASU','LIM','MVD','BOG','PTY','CUN','MIA','LIS','MAD'];
  const rotation=Math.floor(Date.now()/(3*60*60*1000));
  const rotate=list=>list.slice(rotation%list.length).concat(list.slice(0,rotation%list.length));
  return [...rotate(national).slice(0,3),...rotate(international).slice(0,4)]
    .filter(code=>code!==trip.origin&&code!==trip.destination);
}
function shouldSendGooglePlanB(trip,now){
  if(!trip.lastGooglePlanBAt)return true;
  return now-new Date(trip.lastGooglePlanBAt).getTime()>=GOOGLE_PLAN_B_INTERVAL;
}
async function sendGooglePlanBAlert(resend,trip){
  const targets=googlePlanBTargets(trip);
  const exact=flightSearchUrl(trip,trip.destination);
  const cards=[trip.destination,...targets].map((destination,index)=>{
    const label=index===0?'Sua rota monitorada':(index<=3?'Sugestão no Brasil':'Sugestão internacional');
    return \`<div style="padding:14px;margin:12px 0;border:1px solid #d7e6f5;border-radius:12px"><b>\${label}: \${trip.origin} → \${destination}</b><br>Ida: \${trip.departure}\${trip.return?\` • Volta: \${trip.return}\`:''}<br>\${passengerLabel(trip)}<br><a href="\${flightSearchUrl(trip,destination)}" style="display:inline-block;margin-top:10px;padding:10px 14px;background:#0057b8;color:#fff;text-decoration:none;border-radius:8px">Abrir no Google Voos</a></div>\`;
  }).join('');
  const html=\`<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#102235"><h2>Plano B — Google Voos</h2><p>A fonte automática de preços atingiu o limite mensal. Enquanto ela não renova, o Alerta Viagem PRO continuará enviando rotas prontas para conferência no Google Voos.</p><p><b>Importante:</b> este e-mail não confirma uma promoção nem um preço. Os valores atualizados aparecem ao abrir cada pesquisa.</p>\${cards}<p><a href="\${exact}" style="display:inline-block;padding:11px 16px;background:#0b7a53;color:#fff;text-decoration:none;border-radius:8px">Conferir sua rota principal</a></p><small>As sugestões são alternadas automaticamente a cada 3 horas, incluindo destinos nacionais e internacionais.</small></div>\`;
  const sent=await resend.emails.send({from:ALERT_FROM,to:ALERT_EMAIL,subject:\`🔎 Plano B: rotas para conferir saindo de \${trip.origin}\`,html});
  if(sent?.error)throw new Error(sent.error.message||'Resend recusou o alerta do Plano B.');
}
`;
  if (!source.includes(marker)) throw new Error('Ponto de inserção do Plano B não encontrado.');
  source = source.replace(marker, helper + marker);
} else {
  source = source
    .replace(/Date\.now\(\)\/\(12\*60\*60\*1000\)/g, 'Date.now()/(3*60*60*1000)')
    .replace(/a cada 12 horas/g, 'a cada 3 horas');
}

source = source.replace(
  /}catch\(error\)\{trip\.lastCheckedAt=new Date\(\)\.toISOString\(\);trip\.lastError=error\.message\|\|'Erro durante a consulta';errors\+\+;summaries\.push\(/g,
  `}catch(error){trip.lastCheckedAt=new Date().toISOString();trip.lastError=error.message||'Erro durante a consulta';const quotaError=/run out of searches|quota|limit/i.test(trip.lastError);if(quotaError&&resend&&['email','both'].includes(trip.channel)&&shouldSendGooglePlanB(trip,now)){try{await sendGooglePlanBAlert(resend,trip);trip.lastGooglePlanBAt=new Date().toISOString()}catch(planBError){console.error('Google Plan B email error:',planBError)}}errors++;summaries.push(`
);

source = source.replace(
  /if\(resend&&!providerQuotaExhausted\)\{await sendRunSummary\(resend,summaries,now\);summarySent=true\}/,
  `if(resend&&!providerQuotaExhausted){await sendRunSummary(resend,summaries,now);summarySent=true}`
);

fs.writeFileSync(path, source, 'utf8');
console.log('Plano B do Google Voos ativado com alertas rotativos a cada 3 horas.');