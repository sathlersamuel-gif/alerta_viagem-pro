const fs = require('fs');

function patchFile(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) console.log(`${path}: nenhuma alteração necessária.`);
  else {
    fs.writeFileSync(path, after, 'utf8');
    console.log(`${path}: corrigido.`);
  }
}

patchFile('api/managed-trips.js', source => {
  source = source.replace(
    `.sort((a, b) => trip.program === 'azul'\n        ? Number(isAzulFlight(b)) - Number(isAzulFlight(a)) || Number(a.price) - Number(b.price)\n        : Number(a.price) - Number(b.price));`,
    `.sort((a, b) => Number(a.price) - Number(b.price));`
  );

  source = source.replace(
    `    lastSuggestion: trip.lastSuggestion || null,\n    azulOptionsFound: Number(trip.azulOptionsFound) || 0,`,
    `    lastSuggestion: trip.lastSuggestion || null,\n    lastSuggestions: Array.isArray(trip.lastSuggestions) ? trip.lastSuggestions.slice(0, 12) : [],\n    lastFallbackDeals: Array.isArray(trip.lastFallbackDeals) ? trip.lastFallbackDeals.slice(0, 12) : [],\n    lastFallbackAlertAt: trip.lastFallbackAlertAt || null,\n    lastDecision: trip.lastDecision || null,\n    lastPointsReference: trip.lastPointsReference || null,\n    azulOptionsFound: Number(trip.azulOptionsFound) || 0,`
  );

  source = source.replace(
    `    trip.lastSuggestion = flights[0] ? summarizeFlight(flights[0]) : null;\n    trip.azulOptionsFound = flights.filter(isAzulFlight).length;`,
    `    trip.lastSuggestion = flights[0] ? summarizeFlight(flights[0]) : null;\n    trip.lastSuggestions = flights.slice(0, 12).map(summarizeFlight);\n    trip.azulOptionsFound = flights.filter(isAzulFlight).length;`
  );

  return source;
});

patchFile('index.html', source => {
  source = source.replace(
    `out.sort((a,b)=>s.preferAzul?(Number(b.azul)-Number(a.azul)||a.price-b.price):a.price-b.price);`,
    `out.sort((a,b)=>a.price-b.price);`
  );

  source = source.replace(
    `const list=['VCP','CNF','GRU','BSB','REC','SSA','MCZ','FOR'].filter(x=>x!==code(s.origin));`,
    `const list=['VCP','CNF','GRU','CGH','BSB','GIG','SDU','SSA','REC','MCZ','FOR','NAT','JPA','CWB','FLN','IGU','POA','BEL','MAO','CGB','PVH','JPR','OAL','BVH','EZE','AEP','SCL','LIM','MVD','ASU','CUN','MIA','MCO','FLL','LIS','OPO','MAD','BCN'].filter(x=>x!==code(s.origin));`
  );

  source = source.replace(
    `return found.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value).sort((a,b)=>s.preferAzul?(Number(b.azul)-Number(a.azul)||a.price-b.price):a.price-b.price).slice(0,8)`,
    `return found.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value).sort((a,b)=>a.price-b.price).slice(0,12)`
  );

  source = source.replace(
    `Mostra os voos da Azul primeiro e destaca opções para usar seus pontos.`,
    `Destaca opções da Azul, mas mantém sempre o menor preço total em primeiro lugar.`
  );

  source = source.replace(
    `Agora com prioridade para voos da Azul e monitoramento online.`,
    `Agora com comparação por menor preço total e monitoramento online.`
  );

  source = source.replace(
    `Pesquisando Azul e outras companhias...`,
    `Pesquisando os menores preços...`
  );

  source = source.replace(
    `IA consultando preços reais e priorizando a Azul...`,
    `IA consultando preços reais e ordenando pelo menor total...`
  );

  source = source.replace(
    `<option value="both">WhatsApp e e-mail</option><option value="whatsapp">WhatsApp</option>`,
    `<option value="both" disabled>WhatsApp e e-mail — em configuração</option><option value="whatsapp" disabled>WhatsApp — em configuração</option>`
  );

  return source;
});

console.log('Auditoria concluída: menor preço total em primeiro lugar, busca ampliada e dados de promoções preservados.');
