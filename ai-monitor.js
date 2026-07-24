// Mantém o motor inteligente ativo enquanto o aplicativo estiver disponível.
(() => {
  const CHECK_INTERVAL_MS = 10 * 60 * 1000;
  const LAST_RUN_KEY = 'avpro_ai_last_run';
  const LAST_PRICES_KEY = 'avpro_ai_last_prices';
  let timer = null;
  let running = false;

  function profile() {
    return window.getDefaultTravelerProfile?.() || { enabled: true };
  }

  function setEngineStatus(title, detail) {
    const status = document.querySelector('.side-status');
    if (!status) return;
    const strong = status.querySelector('b');
    const small = status.querySelector('small');
    if (strong) strong.textContent = title;
    if (small) small.textContent = detail;
  }

  function timeLabel(date = new Date()) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function readVisiblePrices() {
    return [...document.querySelectorAll('#dealList .featured-offer')].map(card => {
      const route = card.querySelector('.deal-copy b')?.textContent?.trim() || '';
      const priceText = card.querySelector('.deal-price strong')?.textContent || '';
      const price = Number(priceText.replace(/[^0-9]/g, ''));
      return route && price ? { route, price } : null;
    }).filter(Boolean);
  }

  function detectBetterOffers() {
    const current = readVisiblePrices();
    if (!current.length) return;

    let previous = {};
    try { previous = JSON.parse(localStorage.getItem(LAST_PRICES_KEY) || '{}'); } catch {}

    const better = current.filter(item => previous[item.route] && item.price < previous[item.route]);
    localStorage.setItem(LAST_PRICES_KEY, JSON.stringify(Object.fromEntries(current.map(item => [item.route, item.price]))));

    if (better.length) {
      const best = better.sort((a, b) => a.price - b.price)[0];
      window.toast?.(`✦ Nova oportunidade: ${best.route} por R$ ${best.price.toLocaleString('pt-BR')} para todos`);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Alerta Viagem PRO', { body: `Preço melhor encontrado: ${best.route} por R$ ${best.price.toLocaleString('pt-BR')}` });
      }
    }
  }

  async function runMonitor(reason = 'automático') {
    if (running || !profile().enabled) {
      if (!profile().enabled) setEngineStatus('Motor pausado', 'Promoções personalizadas desativadas');
      return;
    }

    if (!navigator.onLine) {
      setEngineStatus('Aguardando internet', 'Retoma automaticamente quando conectar');
      return;
    }

    running = true;
    setEngineStatus('Motor pesquisando', `Verificando oportunidades • ${reason}`);

    window.dispatchEvent(new CustomEvent('avpro-profile-updated', { detail: profile() }));

    // Aguarda as consultas da tela e compara os valores encontrados.
    window.setTimeout(() => {
      detectBetterOffers();
      const now = new Date();
      localStorage.setItem(LAST_RUN_KEY, now.toISOString());
      setEngineStatus('Motor inteligente ativo', `Última análise às ${timeLabel(now)} • repete a cada 10 min`);
      running = false;
    }, 12000);
  }

  function start() {
    if (timer) clearInterval(timer);
    runMonitor('abertura do aplicativo');
    timer = setInterval(() => runMonitor('monitoramento contínuo'), CHECK_INTERVAL_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) runMonitor('retorno ao aplicativo');
  });
  window.addEventListener('online', () => runMonitor('internet restabelecida'));
  window.addEventListener('avpro-profile-updated', () => {
    if (!running) window.setTimeout(() => runMonitor('perfil atualizado'), 800);
  });
  document.addEventListener('DOMContentLoaded', start, { once: true });
  if (document.readyState !== 'loading') start();
})();
