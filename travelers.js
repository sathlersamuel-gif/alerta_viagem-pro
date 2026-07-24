(() => {
  const PROFILE_KEY = 'avpro_traveler_profile';
  const defaultProfile = {
    enabled: true,
    origin: 'OAL',
    destination: 'REC',
    adults: 2,
    children: 1,
    childAges: [8],
    preference: 'points',
    tripType: 'complete',
    loyaltyProgram: 'azul'
  };

  function readProfile() {
    try {
      return { ...defaultProfile, ...(JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')) };
    } catch {
      return { ...defaultProfile };
    }
  }

  function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('avpro-profile-updated', { detail: profile }));
  }

  function renderChildAges(count, values = []) {
    const box = document.querySelector('#profileChildAges');
    if (!box) return;
    box.innerHTML = Array.from({ length: count }, (_, index) => `
      <div class="field">
        <label>Idade da criança ${index + 1}</label>
        <select class="profile-child-age">
          ${Array.from({ length: 18 }, (_, age) => `<option value="${age}" ${Number(values[index]) === age ? 'selected' : ''}>${age === 0 ? 'Menos de 1 ano' : `${age} ${age === 1 ? 'ano' : 'anos'}`}</option>`).join('')}
        </select>
      </div>`).join('');
  }

  function preferenceLabel(value) {
    return ({ cash: 'dinheiro', points: 'milhas/pontos', mixed: 'pontos + dinheiro', best: 'todas as opções' })[value] || 'todas as opções';
  }

  function tripLabel(value) {
    return ({ flight: 'somente passagem', hotel: 'somente hotel', complete: 'ida, volta e hotel' })[value] || 'ida, volta e hotel';
  }

  function mountProfileCard() {
    if (document.querySelector('#travelerDashboardCard')) return;
    const dashboard = document.querySelector('#view-dashboard');
    const twoCol = dashboard?.querySelector('.two-col');
    if (!dashboard || !twoCol) return;

    const profile = readProfile();
    const card = document.createElement('section');
    card.id = 'travelerDashboardCard';
    card.className = 'panel glass';
    card.style.marginBottom = '18px';
    card.innerHTML = `
      <div class="panel-head">
        <div><span class="eyebrow">PREFERÊNCIAS AUTOMÁTICAS</span><h3>Promoções do jeito que eu quero viajar</h3></div>
        <label class="switch-line" style="padding:0;border:0;background:none">
          <input type="checkbox" id="personalOffersEnabled" ${profile.enabled ? 'checked' : ''}><span class="switch"></span>
        </label>
      </div>
      <p class="info-note" id="travelerSummary"></p>
      <button type="button" class="secondary" id="editTravelerProfile">Editar minhas preferências</button>`;
    dashboard.insertBefore(card, twoCol);

    const dialog = document.createElement('dialog');
    dialog.id = 'travelerDialog';
    dialog.innerHTML = `
      <form method="dialog" class="modal glass" id="travelerProfileForm">
        <div class="panel-head"><div><span class="eyebrow">MEU PERFIL</span><h3>Como quero receber as ofertas?</h3></div><button class="icon-btn" value="cancel">×</button></div>
        <div class="form-grid">
          <div class="field span-2"><label>Aeroporto de origem</label><input id="profileOrigin" maxlength="3" placeholder="OAL" required></div>
          <div class="field span-2"><label>Destino preferido</label><input id="profileDestination" maxlength="3" placeholder="REC" required></div>
          <div class="field span-2"><label>Adultos</label><input id="profileAdults" type="number" min="1" max="9" required></div>
          <div class="field span-2"><label>Crianças</label><input id="profileChildren" type="number" min="0" max="8" required></div>
          <div id="profileChildAges" class="child-ages span-4"></div>
          <div class="field span-2"><label>Forma preferida</label><select id="profilePreference"><option value="points">Milhas/pontos</option><option value="mixed">Pontos + dinheiro</option><option value="best">Comparar tudo</option><option value="cash">Dinheiro</option></select></div>
          <div class="field span-2"><label>O que deve vir no alerta?</label><select id="profileTripType"><option value="complete">Ida + volta + hotel</option><option value="flight">Somente passagem</option><option value="hotel">Somente hotel</option></select></div>
          <div class="field span-4"><label>Programa de fidelidade</label><select id="profileLoyaltyProgram"><option value="azul">Azul Fidelidade</option><option value="all">Todos disponíveis</option></select></div>
        </div>
        <button class="primary" id="saveTravelerProfile" value="default">Salvar e ativar preferências</button>
      </form>`;
    document.body.appendChild(dialog);

    function refreshSummary() {
      const current = readProfile();
      const total = Number(current.adults) + Number(current.children);
      document.querySelector('#travelerSummary').textContent = current.enabled
        ? `${total} passageiro(s) • ${current.origin} → ${current.destination} • ${tripLabel(current.tripType)} • preferência: ${preferenceLabel(current.preference)}`
        : 'Preferências automáticas desativadas. Ative para receber ofertas personalizadas.';
    }

    document.querySelector('#personalOffersEnabled').addEventListener('change', event => {
      const current = readProfile();
      current.enabled = event.target.checked;
      saveProfile(current);
      refreshSummary();
      window.toast?.(current.enabled ? 'Preferências automáticas ativadas' : 'Preferências automáticas pausadas');
    });

    document.querySelector('#editTravelerProfile').addEventListener('click', () => {
      const current = readProfile();
      document.querySelector('#profileOrigin').value = current.origin || '';
      document.querySelector('#profileDestination').value = current.destination || '';
      document.querySelector('#profileAdults').value = current.adults || 1;
      document.querySelector('#profileChildren').value = current.children || 0;
      document.querySelector('#profilePreference').value = current.preference || 'points';
      document.querySelector('#profileTripType').value = current.tripType || 'complete';
      document.querySelector('#profileLoyaltyProgram').value = current.loyaltyProgram || 'azul';
      renderChildAges(Number(current.children || 0), current.childAges || []);
      dialog.showModal();
    });

    ['#profileOrigin', '#profileDestination'].forEach(selector => {
      document.querySelector(selector).addEventListener('input', event => {
        event.target.value = event.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 3);
      });
    });

    document.querySelector('#profileChildren').addEventListener('input', event => renderChildAges(Math.max(0, Number(event.target.value || 0))));

    document.querySelector('#travelerProfileForm').addEventListener('submit', event => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const profile = {
        enabled: true,
        origin: document.querySelector('#profileOrigin').value.toUpperCase(),
        destination: document.querySelector('#profileDestination').value.toUpperCase(),
        adults: Math.max(1, Number(document.querySelector('#profileAdults').value || 1)),
        children: Math.max(0, Number(document.querySelector('#profileChildren').value || 0)),
        childAges: [...document.querySelectorAll('.profile-child-age')].map(input => Number(input.value)),
        preference: document.querySelector('#profilePreference').value,
        tripType: document.querySelector('#profileTripType').value,
        loyaltyProgram: document.querySelector('#profileLoyaltyProgram').value
      };
      document.querySelector('#personalOffersEnabled').checked = true;
      saveProfile(profile);
      refreshSummary();
      dialog.close();
      window.toast?.('Preferências salvas. A IA já está pesquisando.');
    });

    refreshSummary();
  }

  window.getDefaultTravelerProfile = readProfile;
  document.addEventListener('DOMContentLoaded', mountProfileCard, { once: true });
  if (document.readyState !== 'loading') mountProfileCard();
})();