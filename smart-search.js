(() => {
  const form = document.querySelector('#searchForm');
  if (!form) return;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const norm = (v='') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const popularDestinations = ['GRU','GIG','BSB','REC','MCZ','FOR','SSA','CNF','CWB','FLN'];

  function resolveAirport(value) {
    const raw = String(value || '').trim();
    const code = (raw.match(/\(([A-Z]{3})\)/) || raw.match(/^([A-Z]{3})$/i))?.[1]?.toUpperCase();
    if (code) return airports.find(a => a[0] === code) || null;
    const q = norm(raw);
    if (!q) return null;
    const exactCity = airports.filter(a => norm(a[1]) === q);
    if (exactCity.length) {
      const priority = ['GRU','GIG','BSB','VCP','CNF','CWB','REC','SSA','FOR','OAL','JPR','PVH'];
      return exactCity.sort((a,b) => priority.indexOf(a[0]) - priority.indexOf(b[0]))[0];
    }
    return airports.find(a => norm(a.join(' ')).includes(q)) || null;
  }

  function isoPlus(days) {
    const d = new Date();
    d.setHours(12,0,0,0);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  }

  function addDays(date, days) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  }

  function showPanel(message, cards='') {
    const panel = $('#resultsPanel');
    $('#aiRecommendation').innerHTML = message;
    $('#resultCards').innerHTML = cards;
    panel.classList.remove('hidden');
    panel.scrollIntoView({behavior:'smooth', block:'start'});
  }

  async function searchAnyDestination(search) {
    const departureId = extractIata(search.origin);
    if (!departureId) throw new Error('Não consegui identificar o aeroporto de origem.');

    const destinations = popularDestinations.filter(code => code !== departureId).slice(0, 6);
    const requests = destinations.map(async (arrivalId) => {
      const data = await postJson('/api/flights', {
        departure_id: departureId,
        arrival_id: arrivalId,
        outbound_date: search.departure,
        return_date: search.return || undefined,
        adults: search.adults,
        children: search.children,
        deep_search: false
      });
      const options = [...(data.best_flights || []), ...(data.other_flights || [])];
      const cheapest = options
        .filter(item => Number(item.price) > 0)
        .sort((a,b) => Number(a.price) - Number(b.price))[0];
      return cheapest ? mapFlightOption(cheapest, 0) : null;
    });

    const settled = await Promise.allSettled(requests);
    const results = settled
      .filter(item => item.status === 'fulfilled' && item.value)
      .map(item => item.value)
      .sort((a,b) => a.cash - b.cash);

    if (!results.length) {
      const failed = settled.find(item => item.status === 'rejected');
      throw new Error(failed?.reason?.message || 'Nenhum destino com preço disponível foi encontrado para essa data.');
    }
    return results;
  }

  function cardHtml(r, search) {
    const isHotel = r.kind === 'hotel';
    const isPackage = r.kind === 'package';
    const from = extractIata(search.origin);
    const to = extractIata(search.destination);
    const googleFlight = `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${from} to ${to} on ${search.departure}${search.return ? ` returning ${search.return}` : ''}`)}&hl=pt-BR&curr=BRL`;
    const hotelUrl = `https://www.google.com/travel/hotels?q=${encodeURIComponent(`Hotéis em ${extractCity(search.destination)}`)}&hl=pt-BR&curr=BRL`;
    const url = r.sourceUrl || r.link || (isHotel ? hotelUrl : isPackage ? googleFlight : googleFlight);
    const action = r.kind === 'points' ? 'Abrir Azul e confirmar' : isHotel ? 'Ver hotel' : isPackage ? 'Ver voo e hospedagem' : 'Ver voo';
    return `<article class="result-card ${r.best?'best':''}">
      <span class="tag">${r.type}</span><h4>${r.name}</h4><div class="route">${r.route || ''}</div>
      <div class="price-main">${r.price}</div><div class="price-sub">${r.sub || ''}</div>
      <div class="result-meta">${(r.meta||[]).map(m=>`<span>✓ ${m}</span>`).join('')}</div>
      <button type="button" class="primary result-action" data-url="${url}">${action}</button>
    </article>`;
  }

  async function officialAzulPoints(search) {
    const program = $('#loyaltyProgram')?.value || 'azul';
    if (!['azul','all'].includes(program)) return [];
    const origin = extractIata(search.origin), destination = extractIata(search.destination);
    const balance = Number(state.wallet?.['Azul Fidelidade'] || 0);
    const data = await postJson('/api/azul-points', {
      origin, destination, departure_date: search.departure,
      max_points: $('#onlyWithinPointsBalance')?.checked ? balance : undefined
    }).catch(() => ({offers:[]}));
    return (data.offers || []).slice(0,6).map((o,i) => ({
      kind:'points', type:'OFERTA OFICIAL EM PONTOS', name:'Azul Fidelidade',
      route:`${o.origin} → ${o.destination}`,
      price:`${(o.points * (search.adults + search.children)).toLocaleString('pt-BR')} pontos`,
      sub:`${o.points.toLocaleString('pt-BR')} pontos por pessoa • data ${o.departure_date.split('-').reverse().join('/')}`,
      meta:['Oferta publicada pela Azul','Valor sujeito à confirmação na reserva', balance ? `Seu saldo: ${balance.toLocaleString('pt-BR')} pontos` : 'Cadastre seu saldo para comparar'],
      best:i===0, sourceUrl:o.source_url
    }));
  }

  form.onsubmit = async (event) => {
    event.preventDefault();
    const submit = event.submitter || form.querySelector('button[type="submit"]');
    const original = submit?.innerHTML;

    const originAirport = resolveAirport($('#origin').value);
    const any = Boolean($('#anyDestination').checked);
    const destinationAirport = any ? null : resolveAirport($('#destination').value);
    if (!originAirport) return showPanel('<b>Não consegui identificar a origem.</b><br>Digite a cidade ou o código do aeroporto, por exemplo: Cacoal ou OAL.');
    if (!any && !destinationAirport) return showPanel('<b>Não consegui identificar o destino.</b><br>Digite somente a cidade ou o código do aeroporto. A IA completa o aeroporto automaticamente.');

    $('#origin').value = airportLabel(originAirport);
    if (destinationAirport) $('#destination').value = airportLabel(destinationAirport);
    if (!$('#departure').value) $('#departure').value = isoPlus(20);
    const tripType = $('#tripType').value;
    if (['complete','hotel'].includes(tripType) && !$('#return').value) $('#return').value = addDays($('#departure').value, 5);

    const search = currentSearch = {
      origin: $('#origin').value, destination: $('#destination').value, any,
      departure: $('#departure').value, return: $('#return').value,
      adults: Number($('#adults').value || 1), children: Number($('#children').value || 0),
      ages: $$('.child-age').map(s => Number(s.value)), preference: $('#preference').value,
      loyaltyProgram: $('#loyaltyProgram')?.value || 'azul', tripType: any ? 'flight' : tripType,
      createdAt: new Date().toISOString()
    };

    try {
      if (submit) { submit.disabled = true; submit.textContent = 'A IA está pesquisando tudo...'; }
      showPanel('<b>✦ A IA está trabalhando:</b><br>Identificando aeroportos, consultando preços reais e comparando as melhores opções...', '<div class="ai-note"><span>✦</span><p>Aguarde alguns segundos. Você não precisa preencher mais nada.</p></div>');

      let results = [];
      let explanation = '';
      if (search.any) {
        results = await searchAnyDestination(search);
        explanation = `Analisei vários destinos saindo de ${originAirport[1]} e ordenei pelos menores preços.`;
      } else if (search.tripType === 'flight') {
        results = await searchRealFlights(search);
        explanation = `Encontrei e comparei voos de ${originAirport[1]} para ${destinationAirport[1]}.`;
      } else if (search.tripType === 'hotel') {
        results = await searchRealHotels(search);
        explanation = `Comparei hotéis em ${destinationAirport[1]} para todos os passageiros e todas as noites.`;
      } else {
        const [flights, hotels] = await Promise.all([searchRealFlights(search), searchRealHotels(search)]);
        results = buildPackages(flights, hotels);
        explanation = `Cruzei voos e hotéis e montei os pacotes completos de menor valor para todos os passageiros.`;
      }

      if (['points','mixed','best'].includes(search.preference) && !search.any && search.tripType !== 'hotel') {
        const pointResults = await officialAzulPoints(search);
        results = [...pointResults, ...results];
        if (!pointResults.length) explanation += ' Não havia oferta pública da Azul em pontos para essa rota e data; por isso mostrei os preços reais em dinheiro como referência.';
        else explanation += ' Também encontrei oferta oficial publicada pela Azul em pontos.';
      }

      if (!results.length) throw new Error('A pesquisa terminou, mas nenhuma opção com preço disponível foi encontrada para essas datas.');
      const cashResults = results.filter(r => Number(r.cash) > 0).sort((a,b) => a.cash-b.cash);
      results.forEach(r => { if (r.kind !== 'points') r.best = false; });
      if (!results.some(r => r.best) && cashResults[0]) cashResults[0].best = true;
      currentResults = results.slice(0,10);

      const best = currentResults.find(r => r.best) || currentResults[0];
      showPanel(`<b>✦ Análise concluída:</b> ${explanation}<br><br><b>Minha indicação:</b> ${best.name}, por ${best.price}.`, currentResults.map(r => cardHtml(r, search)).join(''));
      $$('.result-action').forEach(btn => btn.onclick = () => window.open(btn.dataset.url, '_blank', 'noopener,noreferrer'));
    } catch (error) {
      console.error(error);
      showPanel(`<b>Não consegui concluir a consulta.</b><br>${error.message || 'O serviço de pesquisa não respondeu agora.'}<br><br>Confira apenas a internet e toque novamente. Os dados preenchidos foram mantidos.`);
    } finally {
      if (submit) { submit.disabled = false; submit.innerHTML = original; }
    }
  };
})();