const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'api', 'monitor-trips.js');
let source = fs.readFileSync(target, 'utf8');

// Regra principal: nenhum alerta de preço em dinheiro, relatório ou outra companhia.
// O envio só pode continuar quando existir oferta pública confirmada da Azul em pontos.
source = source.replace(
  "const pointsOffer=await findPublicAzulPoints(trip);",
  "const pointsOffer=await findPublicAzulPoints(trip);\n          if(!pointsOffer)continue;"
);
source = source.replace(
  "const pointsOffer = await findPublicAzulPoints(trip);",
  "const pointsOffer = await findPublicAzulPoints(trip);\n          if (!pointsOffer) continue;"
);

// Desativa completamente alertas alternativos baseados em valores em dinheiro.
source = source.replace(/if\s*\(shouldSendFallback\(/g, 'if(false && shouldSendFallback(');
source = source.replace(/await\s+sendFallbackAlert\(/g, 'await Promise.resolve(/* alerta alternativo em dinheiro desativado */ null) && sendFallbackAlert(');

// Desativa o relatório periódico, inclusive quando não há promoção.
source = source.replace(
  "if(resend){await sendRunSummary(resend,summaries,now);summarySent=true}",
  "summarySent=false"
);
source = source.replace(
  "if (resend) { await sendRunSummary(resend, summaries, now); summarySent = true; }",
  "summarySent = false;"
);

// Garante que o alerta enviado seja identificado claramente como promoção Azul em pontos.
source = source.replace(
  "const subject=`✈️ Atualização de viagem: ${trip.origin} → ${trip.destination}`;",
  "const subject=`🔵 Promoção Azul em pontos: ${trip.origin} → ${trip.destination}`;"
);
source = source.replace(
  "<h2>Alerta Viagem PRO</h2><p><b>Atualização automática das últimas 3 horas.</b></p>",
  "<h2>Promoção Azul em pontos</h2><p><b>Oferta encontrada para emissão com pontos Azul Fidelidade.</b></p>"
);

fs.writeFileSync(target, source, 'utf8');
console.log('Alertas configurados: enviar somente quando houver promoção pública confirmada da Azul em pontos.');
