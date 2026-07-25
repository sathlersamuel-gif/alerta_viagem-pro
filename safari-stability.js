(() => {
  if (typeof window.structuredClone !== 'function') {
    window.structuredClone = value => JSON.parse(JSON.stringify(value));
  }

  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  if (!isSafari) return;

  // A limpeza completa de todos os caches a cada abertura deixava o Safari pesado
  // e ainda provocava um segundo carregamento da página. Agora fazemos isso uma única vez.
  window.addEventListener('load', () => {
    const marker = 'safariEstabilidadeV2';
    if (localStorage.getItem(marker)) return;
    localStorage.setItem(marker, '1');

    setTimeout(async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(registration => registration.unregister()));
        }

        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys
            .filter(key => /alerta|viagem|travel|static|cache/i.test(key))
            .map(key => caches.delete(key)));
        }
      } catch (error) {
        console.warn('Não foi possível limpar o cache antigo do Safari:', error);
      }
    }, 1500);
  }, { once: true });
})();