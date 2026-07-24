self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { body: event.data?.text() || '' }; }
  const title = data.title || 'Alerta Viagem PRO';
  const options = {
    body: data.body || 'O Guardião encontrou uma atualização para sua viagem.',
    icon: '/assets/icon.svg',
    badge: '/assets/icon.svg',
    tag: data.tag || 'avpro-guardian-push',
    renotify: true,
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification?.data?.url || '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => 'focus' in client);
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) await existing.navigate(target);
      return;
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});