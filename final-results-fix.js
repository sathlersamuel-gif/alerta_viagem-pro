(() => {
  const tripType = document.querySelector('#tripType');
  const resultsBox = document.querySelector('#resultCards');

  function restoreTripTypes() {
    if (!tripType) return;
    [...tripType.options].forEach(option => { option.disabled = false; });
  }
  document.querySelector('#preference')?.addEventListener('change', restoreTripTypes);
  window.addEventListener('pageshow', restoreTripTypes);
  restoreTripTypes();

  if (typeof buildPackages === 'function') {
    buildPackages = function buildExactPackages(flights, hotels) {
      const usableFlights = flights.filter(f => f.bookingToken || f.departureToken);
      const usableHotels = hotels.filter(h => h.link);
      const list = [];
      usableFlights.slice(0, 3).forEach((flight, fi) => usableHotels.slice(0, 3).forEach((hotel, hi) => {
        const total = Number(flight.cash || 0) + Number(hotel.cash || 0);
        list.push({kind:'package',type:'COMPARAÇÃO VOO + HOTEL',name:`${flight.name} + ${hotel.name}`,route:flight.route,price:money(total),sub:`Voo ${money(flight.cash)} + hotel ${money(hotel.cash)}`,score:Math.max(70,97-fi*3-hi*2),meta:[...(flight.meta||[]).slice(0,2),...(hotel.meta||[]).slice(0,2),'Reservas feitas separadamente'],best:false,cash:total,flight,hotel});
      }));
      return list.sort((a,b)=>a.cash-b.cash).slice(0,8);
    };
  }

  const iata = value => {
    if (typeof extractIata === 'function') {
      const code = String(extractIata(value) || '').toUpperCase();
      if (/^[A-Z]{3}$/.test(code)) return code;
    }
    return (String(value || '').toUpperCase().match(/\(([A-Z]{3})\)|\b([A-Z]{3})\b/) || []).slice(1).find(Boolean) || '';
  };

  function bookingUrl(flight, search) {
    if (!flight || (!flight.bookingToken && !flight.departureToken)) return '';
    const routeCodes = [...String(flight.route || '').matchAll(/\b([A-Z]{3})\b/g)].map(m=>m[1]);
    const departure = iata(search?.origin) || routeCodes[0] || '';
    const arrival = iata(search?.destination) || routeCodes[1] || '';
    if (!departure || !arrival || !search?.departure) return '';
    const params = new URLSearchParams({departure_id:departure,arrival_id:arrival,outbound_date:search.departure,adults:String(search.adults||1),children:String(search.children||0),airline:String(flight.name||''),price:String(flight.cash||'')});
    if (search.return) params.set('return_date', search.return);
    if (flight.bookingToken) params.set('booking_token', flight.bookingToken);
    if (flight.departureToken) params.set('departure_token', flight.departureToken);
    return `/api/flight-booking?${params}`;
  }

  function openLink(url) {
    if (!url) return;
    const absolute = new URL(url, location.origin).toString();
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) location.assign(absolute);
    else window.open(absolute,'_blank','noopener,noreferrer');
  }

  function makeButton(label, className, url) {
    const button = document.createElement('button');
    button.type='button'; button.className=className; button.textContent=label;
    button.onclick=()=>openLink(url);
    return button;
  }

  function apply() {
    let results=[], search=null;
    try { results=Array.isArray(currentResults)?currentResults:[]; search=currentSearch||null; } catch {}
    [...document.querySelectorAll('#resultCards .result-card')].forEach((card,index)=>{
      const result=results[index], old=card.querySelector('.result-action');
      if(!result||!old)return;
      if(result.kind==='package'&&result.flight&&result.hotel){
        const actions=document.createElement('div'); actions.className='package-exact-actions';
        const flightLink=bookingUrl(result.flight,search), hotelLink=result.hotel.link||'';
        if(flightLink)actions.appendChild(makeButton(`Abrir voo de ${result.flight.name}`,'primary',flightLink));
        if(hotelLink)actions.appendChild(makeButton(`Abrir hotel: ${result.hotel.name}`,'secondary',hotelLink));
        if(actions.children.length)old.replaceWith(actions);
      } else if(result.kind==='flight') {
        const url=bookingUrl(result,search);
        if(url){old.textContent=`Abrir tarifa de ${result.name}`;old.dataset.url=url;old.onclick=()=>openLink(url);}
      } else if(result.kind==='hotel'&&result.link){old.textContent='Abrir esta oferta do hotel';old.dataset.url=result.link;old.onclick=()=>openLink(result.link);}
    });
  }

  if(resultsBox){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply();});}).observe(resultsBox,{childList:true,subtree:true});requestAnimationFrame(apply);}
})();