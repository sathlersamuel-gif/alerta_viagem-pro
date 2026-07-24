// Correções complementares do Alerta Viagem PRO
(() => {
  const popularDestinations = ['GRU','GIG','BSB','REC','MCZ','FOR','SSA','CNF','CWB','FLN'];
  const POINT_VALUE_BRL = 0.025;

  function showSearchError(message) {
    const panel = document.querySelector('#resultsPanel');
    const recommendation = document.querySelector('#aiRecommendation');
    const cards = document.querySelector('#resultCards');
    if (recommendation) recommendation.innerHTML = `<b>Não foi possível concluir a busca:</b> ${message}`;
    if (cards) cards.innerHTML = '<div class="ai-note"><span>!</span><p>Revise os dados e tente novamente. Caso o aviso mencione a chave SERPAPI_API_KEY, ela precisa ser configurada na Vercel.</p></div>';
    if (panel) {
      panel.classList.remove('hidden');
      panel.scrollIntoView({behavior:'smooth', block:'start'});
    }
    if (typeof toast === 'function') toast(message);
  }

  function estimatePoints(cash) {
    return Math.max(1000, Math.round((Number(cash || 0) / POINT_VALUE_BRL) / 1000) * 1000);
  }

  function applyPaymentPreference(results, preference) {
    return results.map(result => {
      const item = {...result, meta:[...(result.meta || [])]};
      const cash = Number(item.cash || 0);
      if (!cash) return item;
      const points = estimatePoints(cash);
      const cashLabel = cash.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

      if (preference === 'points') {
        item.originalCashPrice = cashLabel;
        item.price = `≈ ${points.toLocaleString('pt-BR')} pontos`;
        item.sub = `Equivalência estimada do preço real de ${cashLabel}`;
        item.meta.unshift('Estimativa, não emissão confirmada');
      } else if (preference === 'mixed') {
        const pointsPart = Math.round((points * 0.7) / 1000) * 1000;
        const cashPart = cash * 0.3;
        item.originalCashPrice = cashLabel;
        item.price = `≈ ${pointsPart.toLocaleString('pt-BR')} pts + ${cashPart.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`;
        item.sub = `Combinação estimada sobre o preço real de ${cashLabel}`;
        item.meta.unshift('Combinação estimada');
      } else if (preference === 'best') {
        item.meta.push(`Equivale a cerca de ${points.toLocaleString('pt-BR')} pontos`);
      }
      return item;
    });
  }

  async function searchAnyDestination(search) {
    const departureId = extractIata(search.origin);
    if (!departureId) throw new Error('Selecione um aeroporto de origem na lista de sugestões.');

    const destinations = popularDestinations
      .filter(code => code !== departureId)
      .slice(0, 6);

    const searches = destinations.map(async arrivalId => {
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
      if (!options.length) return null;
      const cheapest = options
        .filter(item => Number(item.price) > 0)
        .sort((a,b) => Number(a.price) - Number(b.price))[0];
      return cheapest ? mapFlightOption(cheapest, 0) : null;
    });

    const settled = await Promise.allSettled(searches);
    const options = settled
      .filter(item => item.status === 'fulfilled' && item.value)
      .map(item => item.value)
      .sort((a,b) => a.cash - b.cash);

    if (!options.length) {
      const firstError = settled.find(item => item.status === 'rejected');
      throw new Error(firstError?.reason?.message || 'Nenhum destino com voo disponível foi encontrado para essa data.');
    }
    return options;
  }

  const anyBox = document.querySelector('#anyDestination');
  const destination = document.querySelector('#destination');
  const tripType = document.querySelector('#tripType');

  if (anyBox) {
    anyBox.onchange = event => {
      const enabled = event.target.checked;
      destination.disabled = enabled;
      destination.value = enabled ? 'Qualquer destino barato' : '';
      if (enabled && tripType) {
        tripType.value = 'flight';
        tripType.disabled = true;
      } else if (tripType) {
        tripType.disabled = false;
      }
    };
  }

  const form = document.querySelector('#searchForm');
  if (!form) return;

  form.onsubmit = async event => {
    event.preventDefault();
    const submit = event.submitter || form.querySelector('button[type="submit"]');
    const original = submit?.innerHTML;
    const ages = [...document.querySelectorAll('.child-age')].map(select => Number(select.value));

    currentSearch = {
      origin: document.querySelector('#origin').value,
      destination: destination.value,
      any: anyBox.checked,
      departure: document.querySelector('#departure').value,
      return: document.querySelector('#return').value,
      adults: Number(document.querySelector('#adults').value),
      children: Number(document.querySelector('#children').value),
      ages,
      preference: document.querySelector('#preference').value,
      tripType: anyBox.checked ? 'flight' : tripType.value,
      createdAt: new Date().toISOString()
    };

    if (!currentSearch.origin) return showSearchError('Informe a origem.');
    if (!currentSearch.departure) return showSearchError('Informe a data de ida.');
    if (!currentSearch.any && !currentSearch.destination) return showSearchError('Informe o destino.');

    try {
      if (submit) {
        submit.disabled = true;
        submit.textContent = currentSearch.any ? 'Procurando destinos baratos...' : 'Buscando preços reais...';
      }

      let recommendation = '';
      if (currentSearch.any) {
        currentResults = await searchAnyDestination(currentSearch);
        recommendation = 'Destinos baratos encontrados automaticamente com preços reais de passagem.';
      } else if (currentSearch.tripType === 'flight') {
        currentResults = await searchRealFlights(currentSearch);
        recommendation = 'Voos reais encontrados no Google Flights via SerpApi.';
      } else if (currentSearch.tripType === 'hotel') {
        currentResults = await searchRealHotels(currentSearch);
        recommendation = 'Hotéis reais encontrados no Google Hotels via SerpApi.';
      } else {
        if (!currentSearch.return) throw new Error('Para buscar voo + hotel, informe também a data de volta.');
        const [flights, hotels] = await Promise.all([searchRealFlights(currentSearch), searchRealHotels(currentSearch)]);
        currentResults = buildPackages(flights, hotels);
        if (!currentResults.length) throw new Error('Não foi possível montar um pacote com voo e hotel para essas datas.');
        recommendation = 'Pacotes completos calculados com preços reais de voo e hotel.';
      }

      currentResults = markBest(applyPaymentPreference(currentResults, currentSearch.preference));
      renderResults();
      const paymentNote = currentSearch.preference === 'points' || currentSearch.preference === 'mixed'
        ? ' Os valores em pontos são estimativas de equivalência; a emissão real depende do programa de fidelidade.'
        : '';
      document.querySelector('#aiRecommendation').innerHTML = `<b>✦ Resultado:</b> ${recommendation}${paymentNote}`;
      document.querySelector('#resultsPanel').classList.remove('hidden');
      document.querySelector('#resultsPanel').scrollIntoView({behavior:'smooth', block:'start'});
    } catch (error) {
      console.error(error);
      showSearchError(error.message || 'Erro ao buscar opções.');
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = original;
      }
    }
  };
})();