const fs = require('fs');

const path = 'api/monitor-trips.js';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes('const MANUAL_RUN_INTERVAL')) {
  source = source.replace(
    'const FALLBACK_INTERVAL = 20 * 60 * 60 * 1000;',
    'const FALLBACK_INTERVAL = 20 * 60 * 60 * 1000;\nconst MANUAL_RUN_INTERVAL = 5 * 60 * 1000;'
  );
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
  "if(!(await canRun(now,force)))return res.status(200).json({ok:true,skipped:true,manual:force,message:force?'Atualização manual disponível novamente em alguns minutos.':'Monitor já executado nas últimas 3 horas.'});"
);

source = source.replace(
  "return res.status(200).json({ok:true,configured:true,checked,activeTrips,emailTrips,alerts,fallbackAlerts,summarySent,errors,azulFound,emailEnabled:",
  "return res.status(200).json({ok:true,configured:true,manual:force,checked,activeTrips,emailTrips,alerts,fallbackAlerts,summarySent,errors,azulFound,emailEnabled:"
);

const hasDeclaration = /const force\s*=\s*req\.method\s*===\s*'GET'/.test(source);
const hasCanRunParameter = /async function canRun\(now, force = false\)/.test(source);
const hasCanRunCall = /canRun\(now,force\)/.test(source);

if (!hasDeclaration || !hasCanRunParameter || !hasCanRunCall) {
  throw new Error('Falha ao validar a atualização manual: a variável force não foi definida corretamente.');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Atualização manual validada: variável force definida corretamente.');