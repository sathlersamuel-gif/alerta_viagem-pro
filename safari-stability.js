(() => {
  // Compatibilidade para versões do Safari que não possuem structuredClone.
  if (typeof window.structuredClone !== 'function') {
    window.structuredClone = value => JSON.parse(JSON.stringify(value));
  }

  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  if (!isSafari) return;

  // O Safari estava mantendo versões diferentes dos arquivos do aplicativo.
  // No Safari usamos sempre a versão online, sem Service Worker.
  window.addEventListener('load', async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      const marker = 'safariAtualizado';
      const url = new URL(window.location.href);
      if (!sessionStorage.getItem(marker)) {
        sessionStorage.setItem(marker, '1');
        url.searchParams.set('_safari', Date.now().toString());
        window.location.replace(url.toString());
      }
    } catch (error) {
      console.warn('Falha ao limpar a versão antiga do Safari:', error);
    }
  }, { once: true });
})();