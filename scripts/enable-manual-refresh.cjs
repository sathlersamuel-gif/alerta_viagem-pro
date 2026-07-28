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
  "const FALLBACK_DESTINATIONS = ['BSB','GRU','GIG','CNF','SSA','REC','FOR','MCZ','NAT','CWB','FLN','EZE','SCL','LIM','MVD','ASU','BOG','PTY','CUN','MIA','LIS','MAD'];\nconst INTERNATIONAL_DESTINATIONS = new Set(['EZE','SCL','LIM','MVD','ASU','BOG','PTY','CUN','MIA','LIS','MAD']);"
);

source = source.replace(
  /function fallbackTargets\(trip\) \{[\s\S]*?\n\}/,
`function fallbackTargets(trip) {
  const rotation = Math.floor(Date.now() / (60 * 1000));
  const score = code => [...code].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rotate = list => list
    .filter(code => code !== trip.origin && code !== trip.destination)
    .sort((a, b) => ((score(a) + rotation * 11) % 101) - ((score(b) + rotation * 11) % 101));
  const national = rotate(FALLBACK_DESTINATIONS.filter(code => !INTERNATIONAL_DESTINATIONS.has(code))).slice(0, 3);
  const internationalPriority = ['EZE','SCL','ASU','LIM','MVD','BOG','PTY','CUN','MIA','LIS','MAD'];
  const international = rotate(internationalPriority).slice(0, 3);
  return { national, international };
}`
);

if (!source.includes('function shiftDate(')) {
  source = source.replace(
    /async function searchFallbackDeals\(trip\) \{/,
`function shiftDate(value, days) {
  const date = new Date(value + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function flexibleTrip(trip, index) {
  const offsets = [0, -7, 7, -14, 14, 21, 28, 35];
  const offset = offsets[index % offsets.length];
  const stayDays = trip.return ? Math.max(2, Math.round((new Date(trip.return) - new Date(trip.departure)) / 86400000)) : 0;
  const departure = shiftDate(trip.departure, offset);
  const returning = trip.return ? shiftDate(departure, stayDays) : '';
  return { ...trip, departure, return: returning };
}
async function searchFallbackDeals(trip) {`
  );
}

source = source.replace(
  /async function searchFallbackDeals\(trip\) \{[\s\S]*?\n\}/,
`async function searchFallbackDeals(trip) {
  const targets = fallbackTargets(trip);
  const runGroup = async (destinations, category, startIndex) => {
    const results = await Promise.allSettled(destinations.map((destination, index) => {
      const candidateTrip = flexibleTrip(trip, startIndex + index + Math.floor(Date.now() / 60000));
      return searchTrip(candidateTrip, destination).then(result => ({ ...result, candidateTrip, category }));
    }));
    return {
      attempts: destinations.length,
      successes: results.filter(item => item.status === 'fulfilled' && item.value.price).length,
      failures: results.filter(item => item.status === 'rejected').map(item => String(item.reason?.message || item.reason || 'Falha')).slice(0, 3),
      deals: results
        .filter(item => item.status === 'fulfilled' && item.value.price)
        .map(item => ({
          destination:item.value.destination,
          category:item.value.category,
          departureDate:item.value.candidateTrip.departure,
          returnDate:item.value.candidateTrip.return || '',
          ...item.value.suggestions[0]
        }))
    };
  };
  const nationalResult = await runGroup(targets.national, 'national', 0);
  const internationalResult = await runGroup(targets.international, 'international', 3);
  const national = nationalResult.deals.sort((a,b) => a.price-b.price).slice(0,3);
  const international = internationalResult.deals.sort((a,b) => a.price-b.price).slice(0,3);
  return {
    deals:[...national, ...international],
    diagnostics:{
      nationalAttempts:nationalResult.attempts,
      nationalSuccesses:nationalResult.successes,
      internationalAttempts:internationalResult.attempts,
      internationalSuccesses:internationalResult.successes,
      failures:[...nationalResult.failures, ...internationalResult.failures]
    }
  };
}`
);

source = source.replace(
  'trip.lastCheckedAt=new Date().toISOString();trip.lastError=null;trip.lastSuggestion=result.suggestions[0]||null;trip.lastDecision=decision;',
  'trip.lastCheckedAt=new Date().toISOString();trip.lastError=null;trip.lastSuggestion=result.suggestions[0]||null;trip.lastSuggestions=result.suggestions;trip.currentPrice=result.price||null;trip.lastDecision=decision;'
);

source = source.replace(
  /\s*if\(!sentExact&&resend&&\['email','both'\]\.includes\(trip\.channel\)&&trip\.agentSuggestions!==false&&shouldSendFallback\(trip,now\)\)\{[\s\S]*?\n\s*\}/,
`\n            if(trip.agentSuggestions!==false){
              const fallbackResult=await searchFallbackDeals(trip);
              const deals=fallbackResult.deals;
              trip.lastFallbackDiagnostics=fallbackResult.diagnostics;
              trip.lastFallbackCheckedAt=new Date().toISOString();
              if(deals.length){
                const previous=Array.isArray(trip.lastFallbackDeals)?trip.lastFallbackDeals:[];
                const merged=[...deals,...previous];
                const unique=new Map();
                merged.forEach(item=>{const key=\`${'${item.destination}-${item.departureDate||trip.departure}-${item.returnDate||trip.return}-${item.airline}-${item.price}'}\`;if(!unique.has(key))unique.set(key,item)});
                trip.lastFallbackDeals=[...unique.values()].slice(0,12);
              }
              if(!sentExact&&resend&&['email','both'].includes(trip.channel)&&deals.length&&shouldSendFallback(trip,now)){
                await sendFallbackAlert(resend,trip,deals);trip.lastFallbackAlertAt=new Date().toISOString();fallbackAlerts++;
              }
            }`
);

const checks = [
  /async function canRun\(now, force = false\)/,
  /canRun\(now,force\)/,
  /function flexibleTrip\(/,
  /internationalSuccesses/,
  /trip\.lastFallbackDiagnostics/,
  /const MANUAL_RUN_INTERVAL = 60 \* 1000;/
];
if (checks.some(pattern => !pattern.test(source))) {
  throw new Error('Falha ao validar a busca promocional confiável.');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Busca promocional revisada: nacional e internacional em lotes menores, com diagnóstico e preservação de resultados.');