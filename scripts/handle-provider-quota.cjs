const fs = require('fs');

const monitorPath = 'api/monitor-trips.js';
let source = fs.readFileSync(monitorPath, 'utf8');

source = source.replace(
  /let checked=0,alerts=0,fallbackAlerts=0,errors=0,azulFound=0,activeTrips=0,emailTrips=0,summarySent=false;/,
  'let checked=0,alerts=0,fallbackAlerts=0,errors=0,azulFound=0,activeTrips=0,emailTrips=0,summarySent=false,providerQuotaExhausted=false;'
);

source = source.replace(
  /}catch\(error\)\{trip\.lastCheckedAt=new Date\(\)\.toISOString\(\);trip\.lastError=error\.message\|\|'Erro durante a consulta';errors\+\+;summaries\.push\(/g,
  "}catch(error){trip.lastCheckedAt=new Date().toISOString();trip.lastError=error.message||'Erro durante a consulta';if(/run out of searches|quota|limit/i.test(trip.lastError))providerQuotaExhausted=true;errors++;summaries.push("
);

source = source.replace(
  /if\(resend\)\{await sendRunSummary\(resend,summaries,now\);summarySent=true\}/,
  'if(resend&&!providerQuotaExhausted){await sendRunSummary(resend,summaries,now);summarySent=true}'
);

source = source.replace(
  /return res\.status\(200\)\.json\(\{ok:true,configured:true,manual:force,checked,activeTrips,emailTrips,alerts,fallbackAlerts,summarySent,errors,azulFound,emailEnabled:/,
  "return res.status(200).json({ok:true,configured:true,manual:force,providerQuotaExhausted,message:providerQuotaExhausted?'A fonte de pesquisa atingiu o limite mensal. Nenhuma nova tarifa pôde ser consultada.':'Busca concluída.',checked,activeTrips,emailTrips,alerts,fallbackAlerts,summarySent,errors,azulFound,emailEnabled:"
);

fs.writeFileSync(monitorPath, source, 'utf8');
console.log('Tratamento de limite da fonte aplicado ao monitor.');
