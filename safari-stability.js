(() => {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const worker = registration.active || registration.waiting || registration.installing;
        if (worker?.scriptURL?.includes('guardian-sw.js')) {
          await registration.unregister();
        }
      }

      const current = await navigator.serviceWorker.getRegistration('/');
      const worker = current?.active || current?.waiting || current?.installing;
      if (!worker || !worker.scriptURL.includes('/sw.js')) {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
    } catch (error) {
      console.warn('Não foi possível estabilizar o modo offline:', error);
    }
  }, { once: true });
})();