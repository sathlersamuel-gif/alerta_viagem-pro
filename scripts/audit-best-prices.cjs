const fs = require('fs');

const path = 'api/monitor-trips.js';
let code = fs.readFileSync(path, 'utf8');
let changes = 0;

function safeReplace(from, to) {
  if (!code.includes(from)) return false;
  code = code.replace(from, to);
  changes++;
  return true;
}

safeReplace(
  ".sort((a, b) => trip?.program === 'azul'\n      ? Number(isAzulFlight(b)) - Number(isAzulFlight(a)) || Number(a.price) - Number(b.price)\n      : Number(a.price) - Number(b.price));",
  ".sort((a, b) => Number(a.price) - Number(b.price));"
);

const minutesLine = "function minutesLabel(v){if(!v)return'';const h=Math.floor(v/60),m=v%60;return`${h}h${m?` ${m}min`:''}`}";
const helpers = `${minutesLine}
function brl(value){return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function installmentHtml(value){
  const total=Number(value)||0;
  if(!total)return'';
  const plans=[15,12,10,6].map(months=>({months,value:total/months}));
  const best=plans[0];
  const others=plans.slice(1).map(plan=>\`${'${plan.months}'}x de ${'${brl(plan.value)}'}\`).join(' • ');
  return \`<br><b>Menor parcela simulada:</b> ${'${best.months}'}x de ${'${brl(best.value)}'} sem juros<br><small>Outras simulações: ${'${others}'}. Confirme quantidade de parcelas e juros com o fornecedor.</small>\`;
}`;
if (!code.includes('function installmentHtml(value)')) safeReplace(minutesLine, helpers);

safeReplace(
  "${item.airline} • R$ ${item.price.toLocaleString('pt-BR')}<br>",
  "${item.airline} • <b>${brl(item.price)}</b>${installmentHtml(item.price)}<br>"
);

safeReplace(
  "${item.airline||'companhia não informada'}${item.azul?' • Azul':''}`",
  "${item.airline||'companhia não informada'}${item.azul?' • Azul':''}${installmentHtml(item.price)}`"
);

safeReplace(
  "agentMode:true,knowledgeVersion:KNOWLEDGE_VERSION",
  "agentMode:true,priceAudit:{ranking:'menor preço primeiro',installmentSimulation:[15,12,10,6]},knowledgeVersion:KNOWLEDGE_VERSION"
);

fs.writeFileSync(path, code, 'utf8');
console.log(`Auditoria de preços concluída com ${changes} ajuste(s).`);
