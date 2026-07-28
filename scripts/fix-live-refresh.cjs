const fs = require('fs');

const path = 'api/monitor-trips.js';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const FALLBACK_DESTINATIONS = ['BSB', 'GRU', 'GIG', 'CNF', 'SSA', 'REC', 'FOR', 'MCZ', 'NAT', 'FLN'];",
  "const FALLBACK_DESTINATIONS = ['BSB','GRU','CGH','GIG','SDU','CNF','SSA','REC','FOR','MCZ','NAT','JPA','CWB','FLN','IGU','POA','BEL','MAO','CGB','PVH','JPR','OAL','BVH','EZE','AEP','SCL','LIM','MVD','ASU','CUN','MIA','MCO','FLL','LIS','OPO','MAD','BCN'];"
);

code = code.replace(
`function fallbackTargets(trip) {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return FALLBACK_DESTINATIONS
    .filter(code => code !== trip.origin && code !== trip.destination)
    .sort((a, b) => ((a.charCodeAt(0) + dayIndex) % 11) - ((b.charCodeAt(0) + dayIndex) % 11))
    .slice(0, 4);
}`,
`function fallbackTargets(trip) {
  const rotation = Math.floor(Date.now() / (60 * 60 * 1000));
  const score = code => [...code].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return FALLBACK_DESTINATIONS
    .filter(code => code !== trip.origin && code !== trip.destination)
    .sort((a, b) => ((score(a) + rotation * 7) % 97) - ((score(b) + rotation * 7) % 97))
    .slice(0, 8);
}`
);

code = code.replace(
  'async function canRun(now) {',
  'async function canRun(now, force = false) {'
);
code = code.replace(
  "      if(state.lastRunAt&&now-new Date(state.lastRunAt).getTime()<MIN_RUN_INTERVAL)return false;",
  "      if(!force&&state.lastRunAt&&now-new Date(state.lastRunAt).getTime()<MIN_RUN_INTERVAL)return false;"
);

code = code.replace(
  "  const resend=",
  "  const force=String(req.query?.force||req.body?.force||'')==='1';\n  const resend="
);
code = code.replace(
  "    if(!(await canRun(now)))return res.status(200).json({ok:true,skipped:true,message:'Monitor já executado nas últimas 3 horas.'});",
  "    if(!(await canRun(now,force)))return res.status(200).json({ok:true,skipped:true,message:'Monitor já executado nas últimas 3 horas.'});"
);

code = code.replace(
  "trip.lastCheckedAt=new Date().toISOString();trip.lastError=null;trip.lastSuggestion=result.suggestions[0]||null;trip.lastDecision=decision;",
  "trip.lastCheckedAt=new Date().toISOString();trip.lastError=null;trip.lastSuggestion=result.suggestions[0]||null;trip.lastSuggestions=result.suggestions;trip.currentPrice=result.price||null;trip.lastDecision=decision;"
);

code = code.replace(
`            if(!sentExact&&resend&&['email','both'].includes(trip.channel)&&trip.agentSuggestions!==false&&shouldSendFallback(trip,now)){
              const deals=await searchFallbackDeals(trip);
              if(deals.length){await sendFallbackAlert(resend,trip,deals);trip.lastFallbackAlertAt=new Date().toISOString();trip.lastFallbackDeals=deals;fallbackAlerts++}
            }`,
`            if(trip.agentSuggestions!==false){
              const deals=await searchFallbackDeals(trip);
              trip.lastFallbackDeals=deals;
              trip.lastFallbackCheckedAt=new Date().toISOString();
              if(!sentExact&&resend&&['email','both'].includes(trip.channel)&&deals.length&&shouldSendFallback(trip,now)){
                await sendFallbackAlert(resend,trip,deals);trip.lastFallbackAlertAt=new Date().toISOString();fallbackAlerts++
              }
            }`
);

fs.writeFileSync(path, code, 'utf8');
console.log('Atualização real corrigida: força manual, rotação de destinos e promoções alternativas renovadas.');
