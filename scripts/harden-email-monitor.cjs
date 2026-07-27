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

fs.writeFileSync(path, code, 'utf8');
console.log('Monitor de e-mail endurecido e validado.');
