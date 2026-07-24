(() => {
  const TRIPS_KEY = 'avpro_managed_trips';
  const CLIENT_KEY = 'avpro_monitor_client';
  const API = '/api/managed-trips';
  let syncing = false;
  let lastPayload = '';
  let onlineStorageAvailable = true;

  function clientId() {
    let value = localStorage.getItem(CLIENT_KEY);
    if (/^[a-f0-9]{32}$/.test(value || '')) return value;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    value = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(CLIENT_KEY, value);
    return value;
  }

  function trips() { try { return JSON.parse(localStorage.getItem(TRIPS_KEY) || '[]'); } catch { return []; } }

  function setStatus(text, state = 'working') {
    const view = document.querySelector('#view-travel-management .panel');
    if (!view) return;
    let box = document.getElementById('monitorOnlineStatus');
    if (!box) {
      box = document.createElement('div');
      box.id = 'monitorOnlineStatus';
      box.style.cssText = 'margin:12px 0;padding:12px 14px;border-radius:14px;font-size:13px;border:1px solid rgba(115,196,255,.22);background:rgba(255,255,255,.035)';
      view.querySelector('.info-note')?.insertAdjacentElement('afterend', box);
    }
    const icon = state === 'ok' ? '●' : state === 'local' ? '✓' : state === 'error' ? '⚠' : '◷';
    box.textContent = `${icon} ${text}`;
  }

  function handleUnavailable(response, data) {
    if (response.status !== 503) return false;
    onlineStorageAvailable = false;
    lastPayload = JSON.stringify(trips());
    setStatus('Modo local ativo: sua viagem está salva neste aparelho. O monitoramento automático com o aplicativo fechado será ativado quando o banco online for conectado.', 'local');
    decorate();
    return true;
  }

  async function pull() {
    try {
      setStatus('Verificando o monitoramento automático...');
      const response = await fetch(`${API}?clientId=${clientId()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (handleUnavailable(response, data)) return;
      if (!response.ok) throw new Error(data.error || 'Falha na conexão');
      onlineStorageAvailable = true;
      if (Array.isArray(data.trips) && data.trips.length) {
        const local = JSON.stringify(trips()), remote = JSON.stringify(data.trips);
        if (local !== remote) { localStorage.setItem(TRIPS_KEY, remote); location.reload(); return; }
      }
      lastPayload = JSON.stringify(trips());
      setStatus('IA online: viagens sincronizadas e aguardando a próxima consulta.', 'ok');
      decorate();
    } catch (error) {
      setStatus('Modo local ativo: sua viagem continua salva neste aparelho. A conexão online será tentada novamente automaticamente.', 'local');
    }
  }

  async function push(force = false) {
    if (syncing) return;
    const currentTrips = trips(), payload = JSON.stringify(currentTrips);
    if (!force && payload === lastPayload) return;
    if (!onlineStorageAvailable && !force) return;
    syncing = true;
    try {
      setStatus('Salvando viagens no monitoramento online...');
      const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: clientId(), trips: currentTrips }) });
      const data = await response.json().catch(() => ({}));
      if (handleUnavailable(response, data)) return;
      if (!response.ok) throw new Error(data.error || 'Falha ao salvar online');
      onlineStorageAvailable = true;
      localStorage.setItem(TRIPS_KEY, JSON.stringify(data.trips || currentTrips));
      lastPayload = JSON.stringify(data.trips || currentTrips);
      setStatus('IA online: monitoramento automático ativado.', 'ok');
      decorate();
    } catch (error) {
      setStatus('Modo local ativo: alterações salvas neste aparelho. A sincronização online será tentada novamente.', 'local');
    } finally { syncing = false; }
  }

  function decorate() {
    const data = trips();
    document.querySelectorAll('.managed-trip-card').forEach(card => {
      const item = data.find(trip => Number(trip.id) === Number(card.dataset.id));
      if (!item) return;
      const meta = card.querySelector('.managed-meta');
      if (!meta) return;
      meta.querySelector('.online-monitor-details')?.remove();
      const line = document.createElement('span');
      line.className = 'online-monitor-details';
      if (!onlineStorageAvailable) {
        line.textContent = 'Salva neste aparelho • monitoramento online aguardando conexão';
      } else {
        const checked = item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleString('pt-BR') : 'aguardando primeira consulta';
        const price = item.bestPrice ? ` • Melhor preço: R$ ${Number(item.bestPrice).toLocaleString('pt-BR')}` : '';
        const error = item.lastError ? ` • Atenção: ${item.lastError}` : '';
        line.textContent = `Última verificação: ${checked}${price}${error}`;
      }
      meta.appendChild(line);
    });
  }

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('submit', event => { if (event.target?.id === 'managedTripForm') setTimeout(() => push(true), 100); });
  document.addEventListener('click', event => { if (event.target?.matches('[data-toggle], [data-delete]')) setTimeout(() => push(true), 100); });
  window.addEventListener('load', () => { pull(); setInterval(() => push(false), 3000); setInterval(pull, 5 * 60 * 1000); });
})();