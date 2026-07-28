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

const indexPath = 'index.html';
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(
  "if(label)label.textContent='Última atualização: '+updated(data.updatedAt)+' • Brasil e exterior.';const national=",
  "if(data.providerQuotaExhausted){if(label)label.textContent='Fonte de pesquisa sem consultas disponíveis.';box.innerHTML='<div class=\"notice warning\"><b>Busca temporariamente indisponível.</b><br>A conta da fonte de preços atingiu o limite de consultas. As ofertas antigas foram ocultadas para não parecerem atualizadas.</div>';return}if(label)label.textContent='Última atualização: '+updated(data.updatedAt)+' • Brasil e exterior.';const national="
);
html = html.replace(
  "await loadPromotions();if(status)status.textContent=data.skipped?data.message:'Busca concluída no Brasil e no exterior. '+(data.checked||0)+' viagem(ns) monitorada(s).';",
  "await loadPromotions();if(status)status.textContent=data.providerQuotaExhausted?data.message:(data.skipped?data.message:'Busca concluída no Brasil e no exterior. '+(data.checked||0)+' viagem(ns) monitorada(s).');"
);
fs.writeFileSync(indexPath, html, 'utf8');

console.log('Tratamento de limite aplicado ao monitor, e-mail e tela inicial.');
