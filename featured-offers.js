// Promoções personalizadas em dinheiro, milhas e pacote completo com hotel.
(() => {
  const REGIONAL_ORIGINS = ['OAL', 'JPR', 'PVH', 'BVH', 'CGB'];
  const DISCOVERY_DESTINATIONS = ['REC', 'MCZ', 'SSA', 'FOR', 'GRU', 'GIG', 'BSB', 'CWB'];
  const addDays = days => { const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); };
  const departureDate = addDays(30);
  const returnDate = addDays(37);
  const hotelCache = new Map();

  function profile() {
    return window.getDefaultTravelerProfile?.() || {
      enabled:true, origin:'OAL', destination:'REC', adults:1, children:0, childAges:[],
      preference:'points', tripType:'complete', loyaltyProgram:'azul', randomDestinations:false, nearbyOrigins:true
    };
  }
  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money = v => Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const cityFor = code => ({REC:'Recife',MCZ:'Maceió',SSA:'Salvador',FOR:'Fortaleza',GRU:'São Paulo',GIG:'Rio de Janeiro',BSB:'Brasília',CWB:'Curitiba'})[code] || code;
  const validUrl = v => typeof v === 'string' && /^https?:\/\//i.test(v) ? v : null;

  function routesForProfile(current) {
    const preferred = /^[A-Z]{3}$/.test(current.origin || '') ? current.origin : 'OAL';
    const destination = /^[A-Z]{3}$/.test(current.destination || '') ? current.destination : 'REC';
    const origins = current.nearbyOrigins === false
      ? [preferred]
      : [...new Set([preferred, ...REGIONAL_ORIGINS])];
    const destinations = current.randomDestinations === true
      ? [...new Set([destination, ...DISCOVERY_DESTINATIONS])]
      : [destination];
    const routes = [];
    for (const origin of origins) {
      for (const dest of destinations) {
        if (origin !== dest) routes.push([origin, dest, origin === preferred, dest === destination]);
      }
    }
    return routes;
  }

  function fallbackFlightUrl(origin, destination, current) {
    const q = `Voos de ${origin} para ${destination}, ida ${departureDate}, volta ${returnDate}, ${current.adults} adulto(s), ${current.children || 0} criança(s)`;
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=pt-BR&curr=BRL`;
  }
  function hotelUrl(destination) {
    return `https://www.google.com/travel/hotels?q=${encodeURIComponent(`Hotéis em ${cityFor(destination)}`)}&hl=pt-BR&curr=BRL`;
  }
  async function postJson(url, payload) {
    const response = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'}, cache:'no-store', body:JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Consulta indisponível');
    return data;
  }

  async function fetchFlight(origin, destination, preferredOrigin, requestedDestination, current) {
    const data = await postJson('/api/flights', {
      departure_id:origin, arrival_id:destination, outbound_date:departureDate, return_date:returnDate,
      adults:Number(current.adults || 1), children:Number(current.children || 0),
      children_ages:current.children ? (current.childAges || []).map(a => Math.max(1,Number(a))).join(',') : undefined,
      sort_by:2, deep_search:false
    });
    const flights = [...(data.best_flights || []), ...(data.other_flights || [])].filter(f => Number(f.price) > 0).sort((a,b)=>Number(a.price)-Number(b.price));
    const f = flights[0]; if (!f) return null;
    const first = f.flights?.[0] || {};
    const direct = (f.booking_options || []).map(o => validUrl(o.link || o.url || o.booking_url)).find(Boolean);
    return { kind:'cash', origin, destination, preferredOrigin, requestedDestination, airline:first.airline || 'Comparador de voos', price:Number(f.price), url:direct || validUrl(f.booking_url) || validUrl(f.link) || fallbackFlightUrl(origin,destination,current) };
  }

  async function fetchPoints(origin, destination, requestedDestination, current) {
    if (!['points','mixed','best'].includes(current.preference) || !['azul','all'].includes(current.loyaltyProgram || 'azul')) return null;
    const data = await postJson('/api/azul-points', { origin, destination, departure_date:departureDate }).catch(() => ({ offers:[] }));
    const offer = (data.offers || []).filter(o => Number(o.points) > 0).sort((a,b)=>Number(a.points)-Number(b.points))[0];
    if (!offer) return null;
    const pax = Number(current.adults || 1) + Number(current.children || 0);
    return { kind:'points', origin, destination, requestedDestination, points:Number(offer.points) * pax, pointsEach:Number(offer.points), url:validUrl(offer.source_url) || fallbackFlightUrl(origin,destination,current) };
  }

  async function fetchHotel(destination, current) {
    const cacheKey = `${destination}|${departureDate}|${returnDate}|${current.adults}|${current.children}|${(current.childAges || []).join(',')}`;
    if (hotelCache.has(cacheKey)) return hotelCache.get(cacheKey);
    const promise = postJson('/api/hotels', {
      q:`Hotéis em ${cityFor(destination)}`, check_in_date:departureDate, check_out_date:returnDate,
      adults:Number(current.adults || 1), children:Number(current.children || 0),
      children_ages:current.children ? (current.childAges || []).map(a => Math.max(1,Number(a))).join(',') : undefined
    }).then(data => {
      const hotels = (data.properties || []).map(h => {
        const nightly = Number(h.rate_per_night?.extracted_lowest || h.extracted_price || 0);
        const total = Number(h.total_rate?.extracted_lowest || 0) || nightly * 7;
        return { ...h, total };
      }).filter(h => h.total > 0).sort((a,b)=>a.total-b.total);
      const h = hotels[0];
      return h ? { name:h.name || 'Hotel recomendado', price:h.total, rating:h.overall_rating || '', url:validUrl(h.link) || hotelUrl(destination) } : null;
    }).catch(() => null);
    hotelCache.set(cacheKey, promise);
    return promise;
  }

  function renderStatus(message) {
    const box = document.querySelector('#dealList');
    if (box) box.innerHTML = `<div class="ai-note"><span>✦</span><p>${esc(message)}</p></div>`;
  }

  function renderOffers(offers, current) {
    const box = document.querySelector('#dealList'); if (!box) return;
    box.innerHTML = offers.slice(0,8).map((o,i) => {
      const packageText = o.hotel ? `Hotel: ${esc(o.hotel.name)} • ${money(o.hotel.price)}${o.hotel.rating ? ` • nota ${esc(o.hotel.rating)}` : ''}` : '';
      const mainPrice = o.kind === 'points' ? `${Number(o.points).toLocaleString('pt-BR')} pontos` : money(o.price + (o.hotel?.price || 0));
      const sub = o.kind === 'points'
        ? `${Number(o.pointsEach).toLocaleString('pt-BR')} pontos por pessoa${o.hotel ? ` + hotel ${money(o.hotel.price)}` : ''}`
        : o.hotel ? `Voo ${money(o.price)} + hotel ${money(o.hotel.price)}` : 'Total para todos os passageiros';
      const routeNote = o.requestedDestination ? 'Destino escolhido' : 'Descoberta de destino barato';
      return `<button type="button" class="deal featured-offer" data-offer-index="${i}">
        <div class="logo">${o.kind === 'points' ? '★' : o.hotel ? '⌂' : '✈'}</div>
        <div class="deal-copy"><b>${esc(o.origin)} → ${esc(o.destination)}</b>
          <small>${o.kind === 'points' ? 'Azul Fidelidade' : esc(o.airline || 'Oferta real')} • ida e volta</small>
          <em>${packageText || `${routeNote} • ${o.preferredOrigin ? 'origem principal' : 'aeroporto próximo'}`}</em></div>
        <div class="deal-price"><strong>${mainPrice}</strong><small>${sub}</small></div><span class="featured-arrow">›</span>
      </button>`;
    }).join('');
    box.querySelectorAll('[data-offer-index]').forEach(btn => btn.onclick = () => {
      const o = offers[Number(btn.dataset.offerIndex)];
      if (o?.url) window.location.assign(o.url);
    });
    window.dispatchEvent(new CustomEvent('avpro-offers-ready', { detail:{ offers, profile:current } }));
  }

  async function loadOffers() {
    const current = profile();
    hotelCache.clear();
    if (!current.enabled) return renderStatus('Preferências automáticas desativadas. Ative acima para receber ofertas personalizadas.');
    const focusText = current.randomDestinations ? 'no destino escolhido e em oportunidades aleatórias autorizadas' : `somente para ${current.destination}`;
    renderStatus(`Buscando ${current.tripType === 'complete' ? 'ida, volta e hotel' : current.tripType === 'hotel' ? 'hotéis' : 'passagens'} ${focusText}, com preferência por ${current.preference === 'points' ? 'milhas' : current.preference === 'mixed' ? 'pontos + dinheiro' : current.preference === 'cash' ? 'dinheiro' : 'todas as opções'}...`);
    const offers = [];
    const routes = routesForProfile(current);
    for (const [origin,destination,preferredOrigin,requestedDestination] of routes) {
      try {
        const needsHotel = ['complete','hotel'].includes(current.tripType);
        const [flight, points, hotel] = await Promise.all([
          current.tripType === 'hotel' ? Promise.resolve(null) : fetchFlight(origin,destination,preferredOrigin,requestedDestination,current).catch(()=>null),
          current.tripType === 'hotel' ? Promise.resolve(null) : fetchPoints(origin,destination,requestedDestination,current),
          needsHotel ? fetchHotel(destination,current) : Promise.resolve(null)
        ]);
        if (points && current.tripType !== 'hotel') offers.push({ ...points, hotel:current.tripType === 'complete' ? hotel : null });
        if (flight && current.preference !== 'points') offers.push({ ...flight, hotel:current.tripType === 'complete' ? hotel : null });
        if (current.tripType === 'hotel' && hotel) offers.push({ kind:'cash', origin, destination, preferredOrigin, requestedDestination, airline:'Hospedagem', price:0, hotel, url:hotel.url });
        if (offers.length) renderOffers([...offers].sort((a,b)=>{
          if (a.requestedDestination !== b.requestedDestination) return a.requestedDestination ? -1 : 1;
          if (a.kind === 'points' && b.kind !== 'points') return -1;
          if (b.kind === 'points' && a.kind !== 'points') return 1;
          return (a.price + (a.hotel?.price || 0)) - (b.price + (b.hotel?.price || 0));
        }), current);
        if (!current.randomDestinations && offers.length >= 4) break;
        if (current.randomDestinations && offers.length >= 8) break;
      } catch (error) { console.warn('Oferta indisponível', error); }
    }
    if (!offers.length) renderStatus(`A IA pesquisou ${current.randomDestinations ? 'as rotas autorizadas' : `somente ${current.destination}`}, mas ainda não encontrou uma oferta confirmada.`);
  }

  window.addEventListener('avpro-profile-updated', loadOffers);
  document.addEventListener('DOMContentLoaded', loadOffers, { once:true });
  if (document.readyState !== 'loading') loadOffers();
})();