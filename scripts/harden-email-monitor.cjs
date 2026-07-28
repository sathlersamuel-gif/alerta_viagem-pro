const fs = require('fs');

const path = 'api/monitor-trips.js';
let code = fs.readFileSync(path, 'utf8');

const replacements = [
  [
    "const missing=[];if(!process.env.BLOB_READ_WRITE_TOKEN)missing.push('BLOB_READ_WRITE_TOKEN');if(!process.env.SERPAPI_API_KEY)missing.push('SERPAPI_API_KEY');",
    "const missing=[];if(!process.env.BLOB_READ_WRITE_TOKEN)missing.push('BLOB_READ_WRITE_TOKEN');if(!process.env.SERPAPI_API_KEY)missing.push('SERPAPI_API_KEY');if(!process.env.RESEND_API_KEY)missing.push('RESEND_API_KEY');if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(ALERT_EMAIL))missing.push('ALERT_EMAIL');"
  ],
  [
    "const resend=process.env.RESEND_API_KEY?new Resend(process.env.RESEND_API_KEY):null;",
    "const resend=new Resend(process.env.RESEND_API_KEY);"
  ],
  ["&&resend&&", "&&"],
  [
    "if(resend){await sendRunSummary(resend,summaries,now);summarySent=true}",
    "await sendRunSummary(resend,summaries,now);summarySent=true"
  ],
  [
    "emailEnabled:Boolean(resend),emailConfiguration:resend?'ativa':'RESEND_API_KEY ausente'",
    "emailEnabled:true,emailConfiguration:'ativa',recipient:ALERT_EMAIL"
  ]
];

for (const [from, to] of replacements) {
  if (!code.includes(from)) throw new Error(`Trecho obrigatório não encontrado: ${from.slice(0, 80)}`);
  code = code.replaceAll(from, to);
}

if (!code.includes('function summarySearchUrl(item)')) {
  code = code.replace(
    'async function sendRunSummary(resend, summaries, runAt){',
    `function summarySearchUrl(item){
  const compact=value=>{const match=String(value||'').match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);return match?\`${'${match[1].slice(2)}${match[2]}${match[3]}'}\`:''};
  const origin=String(item.origin||'').trim().toLowerCase(),destination=String(item.destination||'').trim().toLowerCase();
  const departure=compact(item.departure),returning=compact(item.return);
  const adults=Math.max(1,Number(String(item.passengers||'').match(/^(\\d+)/)?.[1])||1);
  const children=Math.max(0,Number(String(item.passengers||'').match(/\\+\\s*(\\d+)\\s*criança/)?.[1])||0);
  const route=returning?\`${'${origin}/${destination}/${departure}/${returning}'}\`:\`${'${origin}/${destination}/${departure}'}\`;
  const params=new URLSearchParams({adultsv2:String(adults),cabinclass:'economy',childrenv2:children?Array.from({length:children},()=> '10').join('|'):'',currency:'BRL',locale:'pt-BR',market:'BR',preferdirects:'false',ref:'home'});
  return \`https://www.skyscanner.com.br/transport/flights/${'${route}'}/?${'${params.toString()}'}\`;
}
async function sendRunSummary(resend, summaries, runAt){`
  );
}

const oldRows = "  const rows=summaries.length?summaries.map(item=>`<div style=\"padding:12px 14px;margin:10px 0;border:1px solid #d7e6f5;border-radius:12px\"><b>${item.origin} ⇄ ${item.destination}</b><br>Ida: ${item.departure}${item.return?` • Volta: ${item.return}`:' • sem volta cadastrada'}<br>${item.passengers}<br>Preferência: ${item.preference} • Programa: ${item.program}<br>${item.error?`⚠️ ${item.error}`:item.price?`Melhor valor encontrado: <b>R$ ${Number(item.price).toLocaleString('pt-BR')}</b> • ${item.airline||'companhia não informada'}${item.azul?' • Azul':''}<br><a href=\"${item.link}\" style=\"display:inline-block;margin-top:10px;padding:10px 14px;background:#0057b8;color:white;text-decoration:none;border-radius:8px\">Abrir pesquisa deste voo</a>`:'Nenhum preço disponível nesta verificação.'}${item.points?`<br>Referência Azul: ${Number(item.points).toLocaleString('pt-BR')} pontos por pessoa.`:''}</div>`).join(''):'<p>Nenhuma preferência de viagem ativa foi encontrada. Abra o aplicativo e ative ao menos um monitoramento.</p>';";

const newRows = "  const rows=summaries.length?summaries.map(item=>{const tripType=item.return?'Ida e volta':'Somente ida';const status=item.error?`<b>Valor:</b> não disponível nesta consulta.<br>⚠️ ${item.error}`:item.price?`<b>Melhor valor encontrado:</b> <span style=\"font-size:18px\"><b>R$ ${Number(item.price).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</b></span><br><b>Valor referente a:</b> ${tripType}, para ${item.passengers}<br><b>Companhia:</b> ${item.airline||'não informada'}${item.azul?' • Azul':''}<br><b>Menor parcela simulada:</b> 15x de R$ ${(Number(item.price)/15).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} sem juros<br><small>Também: 12x de R$ ${(Number(item.price)/12).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} • 10x de R$ ${(Number(item.price)/10).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}. Confirme parcelas e juros com o fornecedor.</small>`:'<b>Valor:</b> não disponível nesta consulta.<br>Nenhum voo com preço foi retornado.';const points=item.points?`<br><b>Referência Azul:</b> ${Number(item.points).toLocaleString('pt-BR')} pontos por pessoa.`:'';return `<div style=\"padding:14px 16px;margin:10px 0;border:1px solid #d7e6f5;border-radius:12px\"><b>${item.origin} ⇄ ${item.destination}</b><br><b>Tipo da viagem:</b> ${tripType}<br><b>Ida:</b> ${item.departure}${item.return?`<br><b>Volta:</b> ${item.return}`:''}<br><b>Passageiros:</b> ${item.passengers}<br><b>Preferência:</b> ${item.preference} • <b>Programa:</b> ${item.program}<br><br>${status}${points}<br><a href=\"${summarySearchUrl(item)}\" style=\"display:inline-block;margin-top:12px;padding:11px 15px;background:#0057b8;color:white;text-decoration:none;border-radius:8px;font-weight:bold\">Abrir busca desta rota</a></div>`}).join(''):'<p>Nenhuma preferência de viagem ativa foi encontrada. Abra o aplicativo e ative ao menos um monitoramento.</p>';";

if (!code.includes(oldRows)) throw new Error('Trecho do relatório de e-mail não encontrado.');
code = code.replace(oldRows, newRows);

const azulPriority = ".sort((a, b) => trip?.program === 'azul'\n      ? Number(isAzulFlight(b)) - Number(isAzulFlight(a)) || Number(a.price) - Number(b.price)\n      : Number(a.price) - Number(b.price));";
if (code.includes(azulPriority)) {
  code = code.replace(azulPriority, ".sort((a, b) => Number(a.price) - Number(b.price));");
}

const mainPrice = "${item.airline} • R$ ${item.price.toLocaleString('pt-BR')}<br>";
const mainPriceWithInstallments = "${item.airline} • <b>R$ ${item.price.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</b><br><b>Menor parcela simulada:</b> 15x de R$ ${(item.price/15).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} sem juros<br><small>Confirme parcelas e juros com o fornecedor.</small><br>";
code = code.replaceAll(mainPrice, mainPriceWithInstallments);

fs.writeFileSync(path, code, 'utf8');
console.log('Monitor auditado: menor preço primeiro, valores detalhados e parcelas simuladas.');