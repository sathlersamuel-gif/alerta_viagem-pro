// Filtro de ofertas pelo saldo real cadastrado na carteira
(() => {
  const STORAGE_KEY = 'avpro_points_balance_filter';
  const defaults = { enabled: true };
  const settings = {...defaults, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {})};

  const preference = document.querySelector('#preference');
  const loyaltyField = document.querySelector('#loyaltyProgramField');
  const loyaltyProgram = document.querySelector('#loyaltyProgram');
  const formGrid = document.querySelector('#searchForm .form-grid');
  if (!preference || !loyaltyField || !loyaltyProgram || !formGrid) return;

  const box = document.createElement('div');
  box.id = 'pointsBalanceBox';
  box.className = 'points-balance-box hidden';
  box.innerHTML = `
    <label class="switch-line" aria-label="Filtrar pelo saldo de pontos">
      <input type="checkbox" id="onlyWithinPointsBalance" ${settings.enabled ? 'checked' : ''}>
      <span class="switch"></span>
    </label>
    <div class="points-balance-copy">
      <b>Mostrar e avisar somente ofertas que caibam no meu saldo</b>
      <small>O sistema usará o saldo real salvo na Carteira de fidelidade e não enviará ofertas acima dele.</small>
      <small class="points-balance-summary" id="pointsBalanceSummary"></small>
    </div>`;
  loyaltyField.insertAdjacentElement('afterend', box);

  const checkbox = box.querySelector('#onlyWithinPointsBalance');
  const summary = box.querySelector('#pointsBalanceSummary');
  const programMap = {
    azul: 'Azul Fidelidade',
    latam: 'LATAM Pass',
    smiles: 'Smiles'
  };

  function getWalletState() {
    try {
      return JSON.parse(localStorage.getItem('avpro_state') || 'null')?.wallet || {};
    } catch {
      return {};
    }
  }

  function selectedBalance() {
    const wallet = getWalletState();
    if (loyaltyProgram.value === 'all') {
      return Object.entries(wallet).reduce((sum, [, value]) => sum + Number(value || 0), 0);
    }
    return Number(wallet[programMap[loyaltyProgram.value]] || 0);
  }

  function updateVisibility() {
    const usesPoints = ['points', 'mixed', 'best'].includes(preference.value);
    box.classList.toggle('hidden', !usesPoints);
    if (!usesPoints) return;
    const balance = selectedBalance();
    const label = loyaltyProgram.value === 'all' ? 'Saldo total cadastrado' : `Saldo ${programMap[loyaltyProgram.value] || ''}`;
    summary.textContent = `${label}: ${balance.toLocaleString('pt-BR')} pontos`;
  }

  checkbox.addEventListener('change', () => {
    settings.enabled = checkbox.checked;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    if (typeof toast === 'function') {
      toast(settings.enabled ? 'Filtro pelo saldo ativado' : 'Filtro pelo saldo desativado');
    }
  });
  preference.addEventListener('change', updateVisibility);
  loyaltyProgram.addEventListener('change', updateVisibility);
  document.querySelector('#saveWallet')?.addEventListener('click', () => setTimeout(updateVisibility, 0));

  function readRealPoints(result) {
    const direct = Number(result?.pointsTotal ?? result?.totalPoints ?? result?.points);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const text = String(result?.price || '');
    if (!/pontos|pts|milhas/i.test(text)) return null;
    const digits = text.match(/[\d.]+/g)?.join('') || '';
    const parsed = Number(digits);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  if (typeof renderResults === 'function') {
    const originalRenderResults = renderResults;
    renderResults = function patchedRenderResults() {
      if (checkbox.checked && ['points', 'mixed', 'best'].includes(preference.value) && Array.isArray(currentResults)) {
        const balance = selectedBalance();
        const realPointResults = currentResults.filter(item => readRealPoints(item) !== null);
        if (realPointResults.length) {
          currentResults = currentResults.filter(item => {
            const points = readRealPoints(item);
            return points === null || points <= balance;
          });
        }
      }
      return originalRenderResults.apply(this, arguments);
    };
  }

  const searchForm = document.querySelector('#searchForm');
  searchForm?.addEventListener('submit', () => {
    setTimeout(() => {
      try {
        if (typeof currentSearch === 'object' && currentSearch) {
          currentSearch.onlyWithinPointsBalance = checkbox.checked;
          currentSearch.pointsBalance = selectedBalance();
          currentSearch.loyaltyProgram = loyaltyProgram.value;
        }
      } catch {}
    }, 0);
  }, true);

  const saveButton = document.querySelector('#saveSearch');
  if (saveButton?.onclick) {
    const originalSave = saveButton.onclick;
    saveButton.onclick = function saveWithBalanceFilter(event) {
      try {
        if (typeof currentSearch === 'object' && currentSearch) {
          currentSearch.onlyWithinPointsBalance = checkbox.checked;
          currentSearch.pointsBalance = selectedBalance();
          currentSearch.loyaltyProgram = loyaltyProgram.value;
        }
      } catch {}
      return originalSave.call(this, event);
    };
  }

  updateVisibility();
})();