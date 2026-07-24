// Correções complementares do Alerta Viagem PRO
(() => {
  const popularDestinations = ['GRU','GIG','BSB','REC','MCZ','FOR','SSA','CNF','CWB','FLN'];

  function showSearchError(message) {
    const panel = document.querySelector('#resultsPanel');
    const recommendation = document.querySelector('#aiRecommendation');
    const cards = document.querySelector('#resultCards');
    if (recommendation) recommendation.innerHTML = `<b>Não foi possível concluir a busca:</b> ${message}`;
    if (cards) cards.innerHTML = '<div class="ai-note"><span>!</span><p>O sistema não exibirá valores estimados como se fossem pontos reais.</p></div>';
    if (panel) {
      panel.classList.remove('hidden');
      panel.scrollIntoView({behavior:'smooth', block:'start'});
    }
    if (typeof toast === 'function') toast(message);
  }

  async function searchAnyDestination(search) {
    const departureId = extractIata(search.origin);
    if (!departureId) throw new Error('Selecione um aeroporto de origem na lista de sugestões.');

    const destinations = popularDestinations.filter(code => code !== departureId).slice(0, 6);
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
      const cheapest = options.filter(item => Number(item.price) > 0).sort((a,b) => Number(a.price) - Number(b.price))[0];
      return cheapest ? mapFlightOption(cheapest, 0) : null;
    });

    const settled = await Promise.allSettled(searches);
    const options = settled.filter(item => item.status === 'fulfilled' && item.value).map(item => item.value).sort((a,b) => a.cash - b.cash);
    if (!options.length) {
      const firstError = settled.find(item => item.status === 'rejected');
      throw new Error(firstError?.reason?.message || 'Nenhum destino com voo disponível foi encontrado para essa data.');
    }
    return options;
  }

  const anyBox = document.querySelector('#anyDestination');
  const destination = document.querySelector('#destination');
  const tripType = document.querySelector('#tripType');
  const preference = document.querySelector('#preference');
  const loyaltyField = document.querySelector('#loyaltyProgramField');
  const loyaltyProgram = document.querySelector('#loyaltyProgram');

  function updateLoyaltyVisibility() {
    const usesPoints = preference && ['points','mixed','best'].includes(preference.value);
    loyaltyField?.classList.toggle('hidden', !usesPoints);
    if (usesPoints && loyaltyProgram && !loyaltyProgram.value) loyaltyProgram.value = 'azul';
  }

  preference?.addEventListener('change', updateLoyaltyVisibility);
  updateLoyaltyVisibility();

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
      preference: preference.value,
      loyaltyProgram: loyaltyProgram?.value || null,
      tripType: anyBox.checked ? 'flight' : tripType.value,
      createdAt: new Date().toISOString()
    };

    if (!currentSearch.origin) return showSearchError('Informe a origem.');
    if (!currentSearch.departure) return showSearchError('Informe a data de ida.');
    if (!currentSearch.any && !currentSearch.destination) return showSearchError('Informe o destino.');

    const usesPoints = ['points','mixed','best'].includes(currentSearch.preference);
    if (usesPoints) {
      const programNames = {azul:'Azul Fidelidade', latam:'LATAM Pass', smiles:'Smiles', all:'todos os programas selecionados'};
      const selectedName = programNames[currentSearch.loyaltyProgram] || 'programa selecionado';
      return showSearchError(`A busca de pontos reais do ${selectedName} ainda precisa da integração de emissões desse programa. Nenhuma estimativa será mostrada. Para pesquisar agora, selecione “Dinheiro”.`);
    }

    try {
      if (submit) {
        submit.disabled = true;
        submit.textContent = currentSearch.any ? 'Procurando destinos baratos...' : 'Buscando preços reais...';
      }

      let recommendation = '';
      if (currentSearch.any) {
        currentResults = await searchAnyDestination(currentSearch);
        recommendation = 'Destinos baratos encontrados automaticamente com preços reais em dinheiro.';
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

      currentResults = markBest(currentResults);
      renderResults();
      document.querySelector('#aiRecommendation').innerHTML = `<b>✦ Resultado real:</b> ${recommendation}`;
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