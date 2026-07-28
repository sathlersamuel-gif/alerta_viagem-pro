const fs = require('fs');

const path = 'api/monitor-trips.js';
let code = fs.readFileSync(path, 'utf8');

function replaceRequired(from, to, label) {
  if (!code.includes(from)) throw new Error(`Auditoria: trecho não encontrado (${label}).`);
  code = code.replace(from, to);
}

replaceRequired(
`function allFlights(data, trip) {
  return [...(data.best_flights || []), ...(data.other_flights || [])]
    .filter(item => Number(item.price) > 0)
    .sort((a, b) => trip?.program === 'azul'
      ? Number(isAzulFlight(b)) - Number(isAzulFlight(a)) || Number(a.price) - Number(b.price)
      : Number(a.price) - Number(b.price));
}`,
`function allFlights(data) {
  const unique = new Map();
  for (const item of [...(data.best_flights || []), ...(data.other_flights || [])]) {
    const price = Number(item?.price);
    if (!(price > 0)) continue;
    const legs = Array.isArray(item?.flights) ? item.flights : [];
    const signature = [price, ...legs.map(leg => \`${'${leg?.airline || \'\'}'}:${'${leg?.flight_number || \'\'}'}:${'${leg?.departure_airport?.time || \'\'}'}\`)].join('|');
    if (!unique.has(signature)) unique.set(signature, item);
  }
  return [...unique.values()].sort((a, b) => Number(a.price) - Number(b.price));
}`,
'ordenação pelo menor preço'
);

replaceRequired(
`function minutesLabel(v){if(!v)return'';const h=Math.floor(v/60),m=v%60;return\`${'${h}'}h${'${m?` ${m}min`:\'\'}'}\`}`,
`function minutesLabel(v){if(!v)return'';const h=Math.floor(v/60),m=v%60;return\`${'${h}'}h${'${m?` ${m}min`:\'\'}'}\`}
function brl(value){return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function installmentOptions(value){
  const total=Number(value)||0;
  if(!total)return[];
  return [15,12,10,6].map(months=>({months,value:total/months}));
}
function installmentHtml(value){
  const options=installmentOptions(value);
  if(!options.length)return'';
  const best=options[0];
  return \`<br><b>Menor parcela simulada:</b> ${'${best.months}'}x de ${'${brl(best.value)'}'} sem juros<br><small>Outras simulações: ${'${options.slice(1).map(x=>`${x.months}x de ${brl(x.value)}`).join(\' • \')}'}. A quantidade real de parcelas e eventuais juros dependem do fornecedor e do cartão.</small>\`;
}`,
'cálculo de parcelas'
);

replaceRequired(
`<br>${'${item.airline}'} • R$ ${'${item.price.toLocaleString(\'pt-BR\')}'}<br>${'${item.departure&&item.arrival?`${item.departure} → ${item.arrival}`:\'\'}'}${'${item.stops===0?\' • voo direto\':` • ${item.stops} escala(s)`}'}${'${item.duration?` • ${minutesLabel(item.duration)}`:\'\'}'}<br><a href=`,
`<br>${'${item.airline}'} • <b>${'${brl(item.price)}'}</b>${'${installmentHtml(item.price)}'}<br>${'${item.departure&&item.arrival?`${item.departure} → ${item.arrival}`:\'\'}'}${'${item.stops===0?\' • voo direto\':` • ${item.stops} escala(s)`}'}${'${item.duration?` • ${minutesLabel(item.duration)}`:\'\'}'}<br><a href=`,
'parcelas no alerta principal'
);

replaceRequired(
`<br>${'${trip.origin}'} → ${'${item.destination}'}<br>${'${item.airline}'} • R$ ${'${item.price.toLocaleString(\'pt-BR\')}'}<br>${'${item.departure&&item.arrival?`${item.departure} → ${item.arrival}`:\'\'}'}`,
`<br>${'${trip.origin}'} → ${'${item.destination}'}<br>${'${item.airline}'} • <b>${'${brl(item.price)}'}</b>${'${installmentHtml(item.price)}'}<br>${'${item.departure&&item.arrival?`${item.departure} → ${item.arrival}`:\'\'}'}`,
'parcelas nas oportunidades alternativas'
);

const summaryNeedle = `<b>Companhia:</b> ${'${item.airline||\'não informada\'}'}${'${item.azul?\' • Azul\':\'\'}'}`;
if (!code.includes(summaryNeedle)) throw new Error('Auditoria: relatório detalhado ainda não foi aplicado.');
code = code.replace(summaryNeedle, `${summaryNeedle}${'${installmentHtml(item.price)}'}`);

replaceRequired(
`agentMode:true,knowledgeVersion:KNOWLEDGE_VERSION`,
`agentMode:true,priceAudit:{ranking:'menor preço total primeiro',duplicatesRemoved:true,installmentSimulation:[15,12,10,6]},knowledgeVersion:KNOWLEDGE_VERSION`,
'metadados da auditoria'
);

fs.writeFileSync(path, code, 'utf8');
console.log('Auditoria aplicada: menor preço real primeiro, duplicidades removidas e parcelas simuladas.');
