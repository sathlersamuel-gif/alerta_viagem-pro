const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'api', 'monitor-trips.js');
let source = fs.readFileSync(target, 'utf8');

const oldBlock = "const BLOCKED_EMAIL_DESTINATIONS = new Set(['BSB']);\nconst isAllowedExactAlert = trip => !BLOCKED_EMAIL_DESTINATIONS.has(String(trip?.destination || '').toUpperCase());";
const newBlock = "const normalizeAlertDestination = value => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim().toUpperCase();\nconst BLOCKED_EMAIL_DESTINATIONS = new Set(['BSB', 'BRASILIA']);\nconst isAllowedExactAlert = trip => !BLOCKED_EMAIL_DESTINATIONS.has(normalizeAlertDestination(trip?.destination));";

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
} else if (!source.includes('const normalizeAlertDestination')) {
  source = source.replace(
    "const FALLBACK_DESTINATIONS = ['BSB', 'GRU', 'GIG', 'CNF', 'SSA', 'REC', 'FOR', 'MCZ', 'NAT', 'FLN'];",
    "const FALLBACK_DESTINATIONS = ['GRU', 'GIG', 'CNF', 'SSA', 'REC', 'FOR', 'MCZ', 'NAT', 'FLN'];\n" + newBlock
  );
}

source = source.replace(
  "const FALLBACK_DESTINATIONS = ['BSB', 'GRU', 'GIG', 'CNF', 'SSA', 'REC', 'FOR', 'MCZ', 'NAT', 'FLN'];",
  "const FALLBACK_DESTINATIONS = ['GRU', 'GIG', 'CNF', 'SSA', 'REC', 'FOR', 'MCZ', 'NAT', 'FLN'];"
);

source = source.replace(
  ".map(item => ({ destination:item.value.destination, ...item.value.suggestions[0] }))",
  ".map(item => ({ destination:item.value.destination, ...item.value.suggestions.find(option => option.azul) }))\n    .filter(item => item.price && item.azul)"
);

source = source.replace(
  "if(!trip.active)continue; activeTrips++; checked++;",
  "if(!trip.active)continue;\n          if(!isAllowedExactAlert(trip))continue;\n          activeTrips++; checked++;"
);

source = source.replace(
  "if(resend){await sendRunSummary(resend,summaries,now);summarySent=true}",
  "// Relatório obrigatório desativado: enviar somente alertas das rotas permitidas e promoções Azul.\n    summarySent=false"
);

fs.writeFileSync(target, source, 'utf8');
console.log('Filtros de e-mail aplicados: Brasília bloqueada por código ou nome; promoções alternativas somente Azul; relatório obrigatório desativado.');
