(() => {
  if (typeof window.structuredClone !== 'function') {
    window.structuredClone = value => JSON.parse(JSON.stringify(value));
  }

  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  const isMobile = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || window.innerWidth <= 820;

  if (isSafari || isMobile) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'mobile-performance.css?v=1';
    document.head.appendChild(link);
    document.documentElement.classList.add('mobile-performance');
  }

  if (!isSafari) return;

  window.addEventListener('load', () => {
    const marker = 'safariEstabilidadeV3';
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
    }, 3000);
  }, { once: true });
})();