const fs = require('fs');

const path = 'api/monitor-trips.js';
let source = fs.readFileSync(path, 'utf8');

const before = "trip.lastCheckedAt=new Date().toISOString();trip.lastError=null;trip.lastSuggestion=result.suggestions[0]||null;trip.lastDecision=decision;trip.lastPointsReference=pointsOffer;trip.azulOptionsFound=result.suggestions.filter(x=>x.azul).length;";
const after = "trip.lastCheckedAt=new Date().toISOString();trip.lastError=null;trip.lastSuggestion=result.suggestions[0]||null;trip.lastSuggestions=result.suggestions.slice(0,6);trip.lastDecision=decision;trip.lastPointsReference=pointsOffer;trip.azulOptionsFound=result.suggestions.filter(x=>x.azul).length;";

if (source.includes(after)) {
  console.log('Todas as sugestões já estão sendo salvas.');
  process.exit(0);
}
if (!source.includes(before)) throw new Error('Trecho de armazenamento das sugestões não encontrado.');

source = source.replace(before, after);
fs.writeFileSync(path, source, 'utf8');
console.log('Até 6 opções por viagem serão salvas para a tela inicial.');