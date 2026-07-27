const CACHE = 'alerta-viagem-pro-v16';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js?v=2',
  './international-airports.js?v=2',
  './fixes.js?v=5',
  './ui-fixes.js?v=2',
  './travelers.js?v=5',
  './points-balance.js?v=2',
  './featured-offers.js?v=8',
  './ai-monitor.js?v=2',
  './guardian-mode.js?v=3',
  './trip-type-fix.js?v=3',
  './smart-search.js?v=3',
  './final-results-fix.js?v=1',
  './booking-links-fix.js?v=2',
  './travel-management.js?v=7',
  './world-airport-search.js?v=3',
  './travel-monitor-sync.js?v=4',
  './mobile-navigation-fix.js?v=2',
  './manifest.webmanifest',
  './assets/icon.svg'
];

const IOS_AUTOCOMPLETE_FIX = `<script id="ios-autocomplete-touch-fix">
(()=>{
  if(window.__iosAutocompleteTouchFix)return;
  window.__iosAutocompleteTouchFix=true;
  let selecting=false;
  const stop=e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();};
  const pick=(button,e)=>{
    const box=button.closest('.avp-autocomplete');
    if(!box)return;
    stop(e);selecting=true;
    const input=box.parentElement?.querySelector('input');
    const code=button.querySelector('.avp-ac-code')?.textContent?.trim()||'';
    const city=button.querySelector('.avp-ac-main')?.textContent?.trim()||'';
    const sub=button.querySelector('.avp-ac-sub')?.textContent?.split('•')[0]?.trim()||'';
    if(input&&code){input.value=city+(sub?', '+sub:'')+' ('+code+')';input.dataset.iata=code;input.dispatchEvent(new Event('change',{bubbles:true}));}
    box.classList.remove('open');
    requestAnimationFrame(()=>{selecting=false;input?.blur();});
  };
  document.addEventListener('touchstart',e=>{const b=e.target.closest?.('.avp-ac-item');if(b)pick(b,e);},true);
  document.addEventListener('pointerdown',e=>{const b=e.target.closest?.('.avp-ac-item');if(b)pick(b,e);},true);
  document.addEventListener('click',e=>{const b=e.target.closest?.('.avp-ac-item');if(b)stop(e);},true);
  const any=document.getElementById('anyDestination');
  if(any){const guard=e=>{if(selecting||document.querySelector('.avp-autocomplete.open'))stop(e);};['touchstart','pointerdown','click'].forEach(t=>any.closest('label')?.addEventListener(t,guard,true));}
})();
</script>`;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(APP_SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function injectFix(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const html = await response.text();
  const body = html.includes('</body>') ? html.replace('</body>', IOS_AUTOCOMPLETE_FIX + '</body>') : html + IOS_AUTOCOMPLETE_FIX;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.delete('content-length');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(async response => {
          if (response.ok) caches.open(CACHE).then(cache => cache.put('./index.html', response.clone()));
          return injectFix(response);
        })
        .catch(async () => {
          const cached = await caches.match('./index.html');
          return cached ? injectFix(cached) : Response.error();
        })
    );
    return;
  }

  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then(response => {
        if (response.ok && url.origin === self.location.origin) {
          caches.open(CACHE).then(cache => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});