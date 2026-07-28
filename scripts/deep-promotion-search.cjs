const fs = require('fs');

const path = 'api/monitor-trips.js';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes('const NEARBY_ORIGINS')) {
  source = source.replace(
    "const isAzulFlight = item =>",
    `const NEARBY_ORIGINS = {
  OAL:['JPR','CGB','PVH'], JPR:['OAL','CGB','PVH'], PVH:['JPR','OAL','CGB'], CGB:['OAL','JPR','PVH'],
  GRU:['CGH','VCP'], CGH:['GRU','VCP'], VCP:['GRU','CGH'], GIG:['SDU'], SDU:['GIG']
};
const DATE_OFFSETS = [0,-1,1,-2,2];
const isAzulFlight = item =>`
  );
}

if (!source.includes('function shiftDate(')) {
  source = source.replace(
    'async function searchTrip(trip, destination = trip.destination) {',
    `function shiftDate(value, offset) {
  if (!value || !offset) return value;
  const date = new Date(value + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0,10);
}
function searchVariant(trip, origin, destination, offset = 0) {
  const departure = shiftDate(trip.departure, offset);
  const returnDate = trip.return ? shiftDate(trip.return, offset) : '';
  return {...trip, origin, destination, departure, return:returnDate};
}
async function searchTrip(trip, destination = trip.destination) {`
  );
}

source = source.replace(
  "return { destination, price:suggestions[0]?.price||null, suggestions, data };",
  "return { destination, origin:trip.origin, departure:trip.departure, returnDate:trip.return||'', price:suggestions[0]?.price||null, suggestions:suggestions.map(item=>({...item,searchOrigin:trip.origin,departureDate:trip.departure,returnDate:trip.return||''})), data };"
);

if (!source.includes('async function deepSearchTrip(')) {
  source = source.replace(
    /function fallbackTargets\(trip\) \{/,
    `async function deepSearchTrip(trip, force = false) {
  const origins = [trip.origin, ...(NEARBY_ORIGINS[trip.origin] || [])].slice(0, force ? 4 : 2);
  const offsets = force ? DATE_OFFSETS : [0,-1,1];
  const variants = [];
  for (const origin of origins) {
    for (const offset of offsets) {
      variants.push(searchVariant(trip, origin, trip.destination, offset));
      if (variants.length >= (force ? 12 : 6)) break;
    }
    if (variants.length >= (force ? 12 : 6)) break;
  }
  const settled = await Promise.allSettled(variants.map(item => searchTrip(item, item.destination)));
  const found = settled.filter(item => item.status === 'fulfilled' && item.value.price).map(item => item.value);
  if (!found.length) return searchTrip(trip);
  const suggestions = found.flatMap(item => item.suggestions).sort((a,b)=>a.price-b.price);
  const unique = new Map();
  for (const item of suggestions) {
    const key = [item.searchOrigin,item.departureDate,item.returnDate,item.airline,item.price,item.stops].join('|');
    if (!unique.has(key)) unique.set(key,item);
  }
  const ranked = [...unique.values()].slice(0,12);
  return {destination:trip.destination,price:ranked[0]?.price||null,suggestions:ranked,data:found[0]?.data||{}};
}
function fallbackTargets(trip) {`
  );
}

source = source.replace(
  "const oldPrice=Number(trip.bestPrice)||null; const[result,pointsOffer]=await Promise.all([searchTrip(trip),findPublicAzulPoints(trip)]);",
  "const oldPrice=Number(trip.bestPrice)||null; const[result,pointsOffer]=await Promise.all([deepSearchTrip(trip,force),findPublicAzulPoints(trip)]);"
);

source = source.replace(
  "trip.lastCheckedAt=new Date().toISOString();trip.lastError=null;trip.lastSuggestion=result.suggestions[0]||null;trip.lastSuggestions=result.suggestions;trip.currentPrice=result.price||null;trip.lastDecision=decision;",
  "trip.lastCheckedAt=new Date().toISOString();trip.lastError=null;trip.lastSuggestion=result.suggestions[0]||null;trip.lastSuggestions=result.suggestions;trip.currentPrice=result.price||null;trip.searchDepth=force?'profunda':'automática';trip.lastDecision=decision;"
);

if (!source.includes('deepSearchTrip(trip,force)')) {
  throw new Error('Falha ao ativar a busca profunda no monitor.');
}

fs.writeFileSync(path, source, 'utf8');
console.log('Busca profunda ativada: datas flexíveis, aeroportos próximos e promoções renovadas.');
