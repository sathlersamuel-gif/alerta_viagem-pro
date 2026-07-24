// Modo Guardião 24h sem conflito de Service Worker.
(() => {
  const ENABLED_KEY = 'avpro_guardian_enabled';
  const LAST_HEARTBEAT_KEY = 'avpro_guardian_last_heartbeat';
  const CHECK_INTERVAL_MS = 10 * 60 * 1000;
  let timer = null;

  const isEnabled = () => localStorage.getItem(ENABLED_KEY) === 'true';
  const saveEnabled = value => localStorage.setItem(ENABLED_KEY, String(Boolean(value)));
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function formatTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return 'ainda não realizada';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  async function removeConflictingWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const worker = registration.active || registration.waiting || registration.installing;
        if (worker?.scriptURL?.includes('guardian-sw.js')) await registration.unregister();
      }
      const main = await navigator.serviceWorker.getRegistration('/');
      const worker = main?.active || main?.waiting || main?.installing;
      if (!worker || !worker.scriptURL.includes('/sw.js')) {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
    } catch (error) {
      console.warn('Falha ao limpar Service Worker antigo:', error);
    }
  }

  async function requestNotifications() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    try { return await Notification.requestPermission(); } catch { return 'unsupported'; }
  }

  function showLocalNotification(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    navigator.serviceWorker?.ready
      .then(registration => registration.showNotification(title, {
        body,
        icon: '/assets/icon.svg',
        badge: '/assets/icon.svg',
        tag: 'avpro-guardian-status',
        data: { url: '/' }
      }))
      .catch(() => {});
  }

  function statusText() {
    if (!isEnabled()) return 'Guardião desativado';
    if ('Notification' in window && Notification.permission === 'granted') return 'Guardião ativo com notificações';
    if (isIOS() && !isStandalone()) return 'Guardião ativo dentro do aplicativo';
    return 'Guardião ativo dentro do aplicativo';
  }

  function updateCard() {
    const enabled = isEnabled();
    const button = document.querySelector('#guardianToggle');
    const status = document.querySelector('#guardianStatus');
    const last = document.querySelector('#guardianLastRun');
    const dot = document.querySelector('#guardianDot');
    if (button) {
      button.textContent = enabled ? 'Desativar Guardião 24h' : 'Ativar Guardião 24h';
      button.classList.toggle('guardian-active', enabled);
    }
    if (status) status.textContent = statusText();
    if (last) last.textContent = `Última verificação: ${formatTime(localStorage.getItem(LAST_HEARTBEAT_KEY))}`;
    if (dot) dot.classList.toggle('on', enabled);
  }

  function heartbeat(reason = 'monitoramento automático') {
    if (!isEnabled() || !navigator.onLine) return;
    localStorage.setItem(LAST_HEARTBEAT_KEY, new Date().toISOString());
    window.dispatchEvent(new CustomEvent('avpro-profile-updated', { detail: { reason } }));
    updateCard();
  }

  function startGuardian() {
    if (timer) clearInterval(timer);
    timer = null;
    if (!isEnabled()) return;
    heartbeat('Guardião ativado');
    timer = setInterval(() => heartbeat('ciclo do Guardião'), CHECK_INTERVAL_MS);
  }

  function mountCard() {
    if (document.querySelector('#guardianCard')) return;
    const dashboard = document.querySelector('#view-dashboard');
    const twoCol = dashboard?.querySelector('.two-col');
    if (!dashboard || !twoCol) return;

    const card = document.createElement('section');
    card.id = 'guardianCard';
    card.className = 'panel glass';
    card.style.marginBottom = '18px';
    card.innerHTML = `
      <style>
        #guardianCard{border:1px solid rgba(72,255,163,.28);box-shadow:0 0 28px rgba(33,220,135,.08)}
        .guardian-row{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        .guardian-copy{display:flex;gap:12px;align-items:flex-start;min-width:240px;flex:1}
        .guardian-dot{width:13px;height:13px;border-radius:50%;margin-top:7px;background:#687482;flex:0 0 auto}
        .guardian-dot.on{background:#2be38c;box-shadow:0 0 14px #2be38c}
        .guardian-copy h3{margin:0 0 5px}.guardian-copy p{margin:0;opacity:.78}
        #guardianLastRun{display:block;margin-top:7px;font-size:.86rem;opacity:.68}
        #guardianToggle.guardian-active{background:linear-gradient(135deg,#1cc978,#0ea765)}
      </style>
      <div class="guardian-row">
        <div class="guardian-copy"><span id="guardianDot" class="guardian-dot"></span><div><span class="eyebrow">MONITORAMENTO</span><h3>Modo Guardião 24h</h3><p id="guardianStatus"></p><small id="guardianLastRun"></small></div></div>
        <button type="button" class="primary" id="guardianToggle">Ativar Guardião 24h</button>
      </div>`;
    dashboard.insertBefore(card, twoCol);

    document.querySelector('#guardianToggle')?.addEventListener('click', async () => {
      if (isEnabled()) {
        saveEnabled(false);
        startGuardian();
        updateCard();
        window.toast?.('Modo Guardião desativado');
        return;
      }
      saveEnabled(true);
      startGuardian();
      updateCard();
      const permission = await requestNotifications();
      if (permission === 'granted') {
        showLocalNotification('Alerta Viagem PRO', 'Modo Guardião ativado.');
        window.toast?.('Guardião 24h ativado com notificações');
      } else {
        window.toast?.('Guardião ativado dentro do aplicativo');
      }
    });
    updateCard();
  }

  async function initialize() {
    await removeConflictingWorker();
    mountCard();
    startGuardian();
  }

  document.addEventListener('DOMContentLoaded', initialize, { once: true });
  if (document.readyState !== 'loading') initialize();
  window.addEventListener('online', () => heartbeat('internet restabelecida'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) heartbeat('retorno ao aplicativo'); });
})();