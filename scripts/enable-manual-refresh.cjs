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

if (!source.includes('if(force&&state.lastManualRunAt')) {
  source = source.replace(
    "if(state.lastRunAt&&now-new Date(state.lastRunAt).getTime()<MIN_RUN_INTERVAL)return false;",
    "if(force&&state.lastManualRunAt&&now-new Date(state.lastManualRunAt).getTime()<MANUAL_RUN_INTERVAL)return false;if(!force&&state.lastRunAt&&now-new Date(state.lastRunAt).getTime()<MIN_RUN_INTERVAL)return false;"
  );
}

if (!source.includes('...(force?{lastManualRunAt:')) {
  source = source.replace(
    "await put(RUN_STATE_PATH,JSON.stringify({lastRunAt:new Date(now).toISOString()}),",
    "await put(RUN_STATE_PATH,JSON.stringify({lastRunAt:new Date(now).toISOString(),...(force?{lastManualRunAt:new Date(now).toISOString()}:{})}),"
  );
}

if (!source.includes("const force=req.method==='GET'")) {
  source = source.replace(
    "const resend=process.env.RESEND_API_KEY?new Resend(process.env.RESEND_API_KEY):null;const now=Date.now();",
    "const resend=process.env.RESEND_API_KEY?new Resend(process.env.RESEND_API_KEY):null;const now=Date.now();const force=req.method==='GET'&&String(req.query?.force||'')==='1';"
  );
}

source = source.replace(
  "if(!(await canRun(now)))return res.status(200).json({ok:true,skipped:true,message:'Monitor já executado nas últimas 3 horas.'});",
  "if(!(await canRun(now,force)))return res.status(200).json({ok:true,skipped:true,manual:force,message:force?'Atualização manual disponível novamente em alguns minutos.':'Monitor já executado nas últimas 3 horas.'});"
);

if (!source.includes('manual:force,checked')) {
  source = source.replace(
    "return res.status(200).json({ok:true,configured:true,checked,activeTrips,emailTrips,alerts,fallbackAlerts,summarySent,errors,azulFound,emailEnabled:Boolean(resend),",
    "return res.status(200).json({ok:true,configured:true,manual:force,checked,activeTrips,emailTrips,alerts,fallbackAlerts,summarySent,errors,azulFound,emailEnabled:Boolean(resend),"
  );
}

if (!/async function canRun\(now, force = false\)/.test(source)) {
  throw new Error('Não foi possível configurar o parâmetro force em canRun.');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Atualização manual de promoções ativada e validada.');
