const fs = require('fs');

const path = 'api/monitor-trips.js';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes('const MANUAL_RUN_INTERVAL')) {
  source = source.replace(
    'const FALLBACK_INTERVAL = 20 * 60 * 60 * 1000;',
    'const FALLBACK_INTERVAL = 20 * 60 * 60 * 1000;\nconst MANUAL_RUN_INTERVAL = 60 * 1000;'
  );
} else {
  source = source.replace(/const MANUAL_RUN_INTERVAL\s*=\s*[^;]+;/, 'const MANUAL_RUN_INTERVAL = 60 * 1000;');
}

source = source.replace(
  /async function canRun\(now(?:,\s*force\s*=\s*false)?\)\s*\{/,
  'async function canRun(now, force = false) {'
);

source = source.replace(
  /if\(state\.lastRunAt&&now-new Date\(state\.lastRunAt\)\.getTime\(\)<MIN_RUN_INTERVAL\)return false;/,
  "if(force&&state.lastManualRunAt&&now-new Date(state.lastManualRunAt).getTime()<MANUAL_RUN_INTERVAL)return false;if(!force&&state.lastRunAt&&now-new Date(state.lastRunAt).getTime()<MIN_RUN_INTERVAL)return false;"
);

source = source.replace(
  /await put\(RUN_STATE_PATH,JSON\.stringify\(\{lastRunAt:new Date\(now\)\.toISOString\(\)\}\),/,
  "await put(RUN_STATE_PATH,JSON.stringify({lastRunAt:new Date(now).toISOString(),...(force?{lastManualRunAt:new Date(now).toISOString()}:{})}),"
);

if (!/const force\s*=\s*req\.method\s*===\s*'GET'/.test(source)) {
  source = source.replace(
    /(const resend=[^;]+;const now=Date\.now\(\);)/,
    "$1const force=req.method==='GET'&&String(req.query?.force||'')==='1';"
  );
}

source = source.replace(
  /if\(!\(await canRun\(now(?:,force)?\)\)\)return res\.status\(200\)\.json\(\{ok:true,skipped:true,[^}]*\}\);/,
  "if(!(await canRun(now,force)))return res.status(200).json({ok:true,skipped:true,manual:force,message:force?'Aguarde 1 minuto para pesquisar novamente.':'Monitor já executado nas últimas 3 horas.'});"
);

source = source.replace(
  "return res.status(200).json({ok:true,configured:true,checked,activeTrips,emailTrips,alerts,fallbackAlerts,summarySent,errors,azulFound,emailEnabled:",
  "return res.status(200).json({ok:true,configured:true,manual:force,checked,activeTrips,emailTrips,alerts,fallbackAlerts,summarySent,errors,azulFound,emailEnabled:"
);

source = source.replace(
  /const FALLBACK_DESTINATIONS = \[[^\]]+\];(?:\nconst INTERNATIONAL_DESTINATIONS = new Set\(\[[^\]]+\]\);)?/,
  "const FALLBACK_DESTINATIONS = ['BSB','GRU','CGH','GIG','SDU','CNF','SSA','REC','FOR','MCZ','NAT','JPA','CWB','FLN','IGU','POA','BEL','MAO','CGB','PVH','JPR','OAL','BVH','EZE','AEP','SCL','LIM','MVD','ASU','BOG','CTG','PTY','CUN','PUJ','MEX','MIA','MCO','FLL','JFK','LAX','LIS','OPO','MAD','BCN','CDG','ORY','FCO','MXP','LHR','AMS'];\nconst INTERNATIONAL_DESTINATIONS = new Set(['EZE','AEP','SCL','LIM','MVD','ASU','BOG','CTG','PTY','CUN','PUJ','MEX','MIA','MCO','FLL','JFK','LAX','LIS','OPO','MAD','BCN','CDG','ORY','FCO','MXP','LHR','AMS']);"
);

source = source.replace(
  /function fallbackTargets\(trip\) \{[\s\S]*?\n\}/,
`function fallbackTargets(trip) {
  const rotation = Math.floor(Date.now() / (60 * 1000));
  const score = code => [...code].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rotate = list => list
    .filter(code => code !== trip.origin && code !== trip.destination)
    .sort((a, b) => ((score(a) + rotation * 11) % 101) - ((score(b) + rotation * 11) % 101));
  const national = rotate(FALLBACK_DESTINATIONS.filter(code => !INTERNATIONAL_DESTINATIONS.has(code))).slice(0, 5);
  const international = rotate(FALLBACK_DESTINATIONS.filter(code => INTERNATIONAL_DESTINATIONS.has(code))).slice(0, 7);
  return [...national, ...international];
}`
);

source = source.replace(
  /async function searchFallbackDeals\(trip\) \{[\s\S]*?\n\}/,
`async function searchFallbackDeals(trip) {
  const results = await Promise.allSettled(fallbackTargets(trip).map(destination => searchTrip(trip, destination)));
  const deals = results
    .filter(item => item.status === 'fulfilled' && item.value.price)
    .map(item => ({ destination:item.value.destination, ...item.value.suggestions[0] }));
  const national = deals.filter(item => !INTERNATIONAL_DESTINATIONS.has(item.destination)).sort((a,b) => a.price-b.price).slice(0,4);
  const international = deals.filter(item => INTERNATIONAL_DESTINATIONS.has(item.destination)).sort((a,b) => a.price-b.price).slice(0,6);
  return [...national, ...international];
}`
);

source = source.replace(
  'trip.lastCheckedAt=new Date().toISOString();trip.lastError=null;trip.lastSuggestion=result.suggestions[0]||null;trip.lastDecision=decision;',
  'trip.lastCheckedAt=new Date().toISOString();trip.lastError=null;trip.lastSuggestion=result.suggestions[0]||null;trip.lastSuggestions=result.suggestions;trip.currentPrice=result.price||null;trip.lastDecision=decision;'
);

source = source.replace(
  /\s*if\(!sentExact&&resend&&\['email','both'\]\.includes\(trip\.channel\)&&trip\.agentSuggestions!==false&&shouldSendFallback\(trip,now\)\)\{[\s\S]*?\n\s*\}/,
`\n            if(trip.agentSuggestions!==false){
              const deals=await searchFallbackDeals(trip);
              trip.lastFallbackDeals=deals;
              trip.lastFallbackCheckedAt=new Date().toISOString();
              if(!sentExact&&resend&&['email','both'].includes(trip.channel)&&deals.length&&shouldSendFallback(trip,now)){
                await sendFallbackAlert(resend,trip,deals);trip.lastFallbackAlertAt=new Date().toISOString();fallbackAlerts++;
              }
            }`
);

const checks = [
  /async function canRun\(now, force = false\)/,
  /canRun\(now,force\)/,
  /trip\.lastFallbackDeals=deals/,
  /INTERNATIONAL_DESTINATIONS/,
  /slice\(0, 7\)/,
  /const international = deals\.filter/,
  /const MANUAL_RUN_INTERVAL = 60 \* 1000;/
];
if (checks.some(pattern => !pattern.test(source))) {
  throw new Error('Falha ao validar a busca internacional ampliada.');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Busca ampliada: 5 destinos nacionais e 7 internacionais, preservando resultados das duas categorias.');