const CACHE = 'alerta-viagem-pro-v7';
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
  './smart-search.js?v=2',
  './travel-management.js?v=7',
  './world-airport-search.js?v=3',
  './travel-monitor-sync.js?v=4',
  './mobile-navigation-fix.js?v=2',
  './manifest.webmanifest',
  './assets/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
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

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response.ok) caches.open(CACHE).then(cache => cache.put('./index.html', response.clone()));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && url.origin === self.location.origin) {
          caches.open(CACHE).then(cache => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});