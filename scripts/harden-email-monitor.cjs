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

const newRows = "  const rows=summaries.length?summaries.map(item=>{const status=item.error?`⚠️ ${item.error}`:item.price?`Melhor valor encontrado: <b>R$ ${Number(item.price).toLocaleString('pt-BR')}</b> • ${item.airline||'companhia não informada'}${item.azul?' • Azul':''}`:'Nenhum preço disponível nesta verificação.';const points=item.points?`<br>Referência Azul: ${Number(item.points).toLocaleString('pt-BR')} pontos por pessoa.`:'';return `<div style=\"padding:12px 14px;margin:10px 0;border:1px solid #d7e6f5;border-radius:12px\"><b>${item.origin} ⇄ ${item.destination}</b><br>Ida: ${item.departure}${item.return?` • Volta: ${item.return}`:' • sem volta cadastrada'}<br>${item.passengers}<br>Preferência: ${item.preference} • Programa: ${item.program}<br>${status}${points}<br><a href=\"${summarySearchUrl(item)}\" style=\"display:inline-block;margin-top:12px;padding:11px 15px;background:#0057b8;color:white;text-decoration:none;border-radius:8px;font-weight:bold\">Abrir busca desta rota</a></div>`}).join(''):'<p>Nenhuma preferência de viagem ativa foi encontrada. Abra o aplicativo e ative ao menos um monitoramento.</p>';";

if (!code.includes(oldRows)) throw new Error('Trecho do relatório de e-mail não encontrado.');
code = code.replace(oldRows, newRows);

fs.writeFileSync(path, code, 'utf8');
console.log('Monitor de e-mail endurecido, validado e com links em todos os relatórios.');