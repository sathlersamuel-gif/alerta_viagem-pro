// Mantém o motor inteligente ativo e sempre informa o resultado da análise.
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

  function sendNotice(body) {
    window.toast?.(body);
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Alerta Viagem PRO', {
          body,
          icon: 'assets/icon.svg',
          tag: 'avpro-monitor-status',
          renotify: true
        });
      } catch {}
    }
  }

  function readVisiblePrices() {
    return [...document.querySelectorAll('#dealList .featured-offer')].map(card => {
      const route = card.querySelector('.deal-copy b')?.textContent?.trim() || '';
      const priceText = card.querySelector('.deal-price strong')?.textContent || '';
      const price = Number(priceText.replace(/[^0-9]/g, ''));
      return route && price ? { route, price } : null;
    }).filter(Boolean);
  }

  function evaluateOffers() {
    const current = readVisiblePrices();
    let previous = {};
    try { previous = JSON.parse(localStorage.getItem(LAST_PRICES_KEY) || '{}'); } catch {}

    if (!current.length) {
      sendNotice('✓ A IA está funcionando. A pesquisa terminou, mas ainda não encontrou uma promoção com preço confirmado para o seu perfil.');
      return;
    }

    const better = current.filter(item => previous[item.route] && item.price < previous[item.route]);
    localStorage.setItem(LAST_PRICES_KEY, JSON.stringify(Object.fromEntries(current.map(item => [item.route, item.price]))));

    if (better.length) {
      const best = better.sort((a, b) => a.price - b.price)[0];
      sendNotice(`✦ Nova promoção: ${best.route} por R$ ${best.price.toLocaleString('pt-BR')} para todos os passageiros.`);
      return;
    }

    const bestCurrent = [...current].sort((a, b) => a.price - b.price)[0];
    sendNotice(`✓ A IA pesquisou agora. Ainda não apareceu preço melhor. Menor opção atual: ${bestCurrent.route} por R$ ${bestCurrent.price.toLocaleString('pt-BR')}.`);
  }

  async function requestNotifications() {
    if (!('Notification' in window)) {
      window.toast?.('Este navegador não oferece notificações locais. O monitoramento continuará aparecendo dentro do aplicativo.');
      return;
    }
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      window.toast?.(permission === 'granted' ? 'Notificações ativadas neste aparelho' : 'Notificações não foram permitidas');
    } else if (Notification.permission === 'granted') {
      window.toast?.('Notificações já estão ativadas neste aparelho');
    } else {
      window.toast?.('As notificações estão bloqueadas nos ajustes do navegador');
    }
  }

  function mountNotificationButton() {
    if (document.querySelector('#enableLocalNotifications')) return;
    const controls = document.querySelector('#alertControls');
    if (!controls) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'enableLocalNotifications';
    button.className = 'primary';
    button.textContent = 'Ativar avisos neste aparelho';
    button.addEventListener('click', requestNotifications);
    controls.prepend(button);
  }

  async function runMonitor(reason = 'automático') {
    if (running || !profile().enabled) {
      if (!profile().enabled) setEngineStatus('Motor pausado', 'Promoções personalizadas desativadas');
      return;
    }

    if (!navigator.onLine) {
      setEngineStatus('Aguardando internet', 'Retoma automaticamente quando conectar');
      window.toast?.('Sem internet agora. A IA retomará a pesquisa assim que a conexão voltar.');
      return;
    }

    running = true;
    setEngineStatus('Motor pesquisando', `Verificando oportunidades • ${reason}`);
    window.dispatchEvent(new CustomEvent('avpro-profile-updated', { detail: profile() }));

    window.setTimeout(() => {
      evaluateOffers();
      const now = new Date();
      localStorage.setItem(LAST_RUN_KEY, now.toISOString());
      setEngineStatus('Motor inteligente ativo', `Última análise às ${timeLabel(now)} • nova análise em 10 min`);
      running = false;
    }, 14000);
  }

  function start() {
    mountNotificationButton();
    if (timer) clearInterval(timer);
    runMonitor('abertura do aplicativo');
    timer = setInterval(() => runMonitor('monitoramento contínuo'), CHECK_INTERVAL_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) runMonitor('retorno ao aplicativo');
  });
  window.addEventListener('online', () => runMonitor('internet restabelecida'));
  window.addEventListener('offline', () => setEngineStatus('Sem conexão', 'A IA aguardará a internet voltar'));
  window.addEventListener('avpro-profile-updated', () => {
    if (!running) window.setTimeout(() => runMonitor('perfil atualizado'), 800);
  });
  document.addEventListener('DOMContentLoaded', start, { once: true });
  if (document.readyState !== 'loading') start();
})();