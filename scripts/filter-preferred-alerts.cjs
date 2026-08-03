const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'api', 'monitor-trips.js');
let source = fs.readFileSync(target, 'utf8');

// Remove Brasília das buscas de oportunidades alternativas.
source = source.replace(
  "const FALLBACK_DESTINATIONS = ['BSB', 'GRU', 'GIG', 'CNF', 'SSA', 'REC', 'FOR', 'MCZ', 'NAT', 'FLN'];",
  "const FALLBACK_DESTINATIONS = ['GRU', 'GIG', 'CNF', 'SSA', 'REC', 'FOR', 'MCZ', 'NAT', 'FLN'];"
);

// Bloqueia qualquer alerta cujo destino seja Brasília, por código ou nome.
if (!source.includes('const isBlockedAlertDestination')) {
  source = source.replace(
    "const isAzulFlight = item =>",
    "const normalizeAlertDestination = value => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().toUpperCase();\nconst isBlockedAlertDestination = trip => ['BSB', 'BRASILIA'].includes(normalizeAlertDestination(trip?.destination));\nconst isAzulFlight = item =>"
  );
}

// Só permite continuar quando houver oferta pública da Azul em pontos.
source = source.replace(
  "const pointsOffer=await findPublicAzulPoints(trip);",
  "const pointsOffer=await findPublicAzulPoints(trip);\n          if(isBlockedAlertDestination(trip)||!pointsOffer)continue;"
);
source = source.replace(
  "const pointsOffer = await findPublicAzulPoints(trip);",
  "const pointsOffer = await findPublicAzulPoints(trip);\n          if (isBlockedAlertDestination(trip) || !pointsOffer) continue;"
);

// Desativa alertas alternativos baseados em preço em dinheiro.
source = source.replace(
  "if(shouldSendFallback(trip,now))",
  "if(false && shouldSendFallback(trip,now))"
);
source = source.replace(
  "if (shouldSendFallback(trip, now))",
  "if (false && shouldSendFallback(trip, now))"
);

// Desativa relatórios periódicos quando não há promoção.
source = source.replace(
  "if(resend){await sendRunSummary(resend,summaries,now);summarySent=true}",
  "summarySent=false"
);
source = source.replace(
  "if (resend) { await sendRunSummary(resend, summaries, now); summarySent = true; }",
  "summarySent = false;"
);

// Identifica claramente o único tipo de alerta permitido.
source = source.replace(
  "const subject=`✈️ Atualização de viagem: ${trip.origin} → ${trip.destination}`;",
  "const subject=`🔵 Promoção Azul em pontos: ${trip.origin} → ${trip.destination}`;"
);
source = source.replace(
  "<h2>Alerta Viagem PRO</h2><p><b>Atualização automática das últimas 3 horas.</b></p>",
  "<h2>Promoção Azul em pontos</h2><p><b>Oferta encontrada para emissão com pontos Azul Fidelidade.</b></p>"
);

fs.writeFileSync(target, source, 'utf8');
console.log('Filtro aplicado: Brasília bloqueada e somente promoções Azul em pontos.');
