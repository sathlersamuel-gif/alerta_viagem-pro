(() => {
  const PROFILE_KEY = 'avpro_traveler_profile';
  const defaultProfile = {
    enabled: true,
    origin: 'OAL',
    adults: 2,
    children: 1,
    childAges: [8]
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
        <div>
          <span class="eyebrow">PERSONALIZAÇÃO</span>
          <h3>Promoções adaptadas para minha família</h3>
        </div>
        <label class="switch-line" style="padding:0;border:0;background:none">
          <input type="checkbox" id="personalOffersEnabled" ${profile.enabled ? 'checked' : ''}>
          <span class="switch"></span>
        </label>
      </div>
      <p class="info-note" id="travelerSummary"></p>
      <button type="button" class="secondary" id="editTravelerProfile">Editar passageiros e origem</button>`;
    dashboard.insertBefore(card, twoCol);

    const dialog = document.createElement('dialog');
    dialog.id = 'travelerDialog';
    dialog.innerHTML = `
      <form method="dialog" class="modal glass" id="travelerProfileForm">
        <div class="panel-head"><div><span class="eyebrow">MEU PERFIL</span><h3>Quem normalmente viaja?</h3></div><button class="icon-btn" value="cancel">×</button></div>
        <div class="form-grid">
          <div class="field span-4"><label>Aeroporto de origem preferido</label><input id="profileOrigin" maxlength="3" placeholder="Ex.: OAL" required></div>
          <div class="field span-2"><label>Adultos</label><input id="profileAdults" type="number" min="1" max="9" required></div>
          <div class="field span-2"><label>Crianças</label><input id="profileChildren" type="number" min="0" max="8" required></div>
          <div id="profileChildAges" class="child-ages span-4"></div>
        </div>
        <button class="primary" id="saveTravelerProfile" value="default">Salvar perfil</button>
      </form>`;
    document.body.appendChild(dialog);

    function refreshSummary() {
      const current = readProfile();
      const total = Number(current.adults) + Number(current.children);
      const childrenText = current.children ? ` • ${current.children} criança(s), idade(s): ${(current.childAges || []).join(', ')}` : '';
      document.querySelector('#travelerSummary').textContent = current.enabled
        ? `${total} passageiro(s) • ${current.adults} adulto(s)${childrenText} • origem ${current.origin}`
        : 'Promoções personalizadas desativadas. Você pode ativar novamente quando quiser.';
    }

    document.querySelector('#personalOffersEnabled').addEventListener('change', event => {
      const current = readProfile();
      current.enabled = event.target.checked;
      saveProfile(current);
      refreshSummary();
    });

    document.querySelector('#editTravelerProfile').addEventListener('click', () => {
      const current = readProfile();
      document.querySelector('#profileOrigin').value = current.origin || '';
      document.querySelector('#profileAdults').value = current.adults || 1;
      document.querySelector('#profileChildren').value = current.children || 0;
      renderChildAges(Number(current.children || 0), current.childAges || []);
      dialog.showModal();
    });

    document.querySelector('#profileOrigin').addEventListener('input', event => {
      event.target.value = event.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 3);
    });

    document.querySelector('#profileChildren').addEventListener('input', event => {
      renderChildAges(Math.max(0, Number(event.target.value || 0)));
    });

    document.querySelector('#travelerProfileForm').addEventListener('submit', event => {
      if (event.submitter?.value === 'cancel') return;
      event.preventDefault();
      const profile = {
        enabled: document.querySelector('#personalOffersEnabled').checked,
        origin: document.querySelector('#profileOrigin').value.toUpperCase(),
        adults: Math.max(1, Number(document.querySelector('#profileAdults').value || 1)),
        children: Math.max(0, Number(document.querySelector('#profileChildren').value || 0)),
        childAges: [...document.querySelectorAll('.profile-child-age')].map(input => Number(input.value))
      };
      saveProfile(profile);
      refreshSummary();
      dialog.close();
      window.toast?.('Perfil de passageiros salvo');
    });

    refreshSummary();
  }

  window.getDefaultTravelerProfile = readProfile;
  document.addEventListener('DOMContentLoaded', mountProfileCard, { once: true });
  if (document.readyState !== 'loading') mountProfileCard();
})();