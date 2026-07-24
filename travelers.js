(() => {
  const STORAGE_KEY = 'avpro_traveler_profile';
  const defaultProfile = { name:'Família Samuel', adults:2, children:1, ages:[0], isDefault:true };
  let profile;
  try { profile = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultProfile; }
  catch { profile = defaultProfile; }

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const ageLabel = age => Number(age) === 0 ? 'bebê' : `${Number(age)} ${Number(age) === 1 ? 'ano' : 'anos'}`;

  function normalize(data) {
    const adults = Math.max(1, Math.min(9, Number(data.adults) || 1));
    const children = Math.max(0, Math.min(8, Number(data.children) || 0));
    const ages = Array.from({length: children}, (_, i) => Math.max(0, Math.min(17, Number(data.ages?.[i]) || 0)));
    return {name:String(data.name || 'Meu grupo').trim() || 'Meu grupo', adults, children, ages, isDefault:true};
  }

  function membersText() {
    const parts = [`${profile.adults} ${profile.adults === 1 ? 'adulto' : 'adultos'}`];
    if (profile.children) parts.push(`${profile.children} ${profile.children === 1 ? 'criança' : 'crianças'}`);
    return parts.join(' + ');
  }

  function chips() {
    const list = [];
    for (let i=0;i<profile.adults;i++) list.push(`<span class="traveler-chip">👤 Adulto ${i+1}</span>`);
    profile.ages.forEach((age,i) => list.push(`<span class="traveler-chip">🧒 Criança ${i+1} • ${ageLabel(age)}</span>`));
    return list.join('');
  }

  function injectUI() {
    const formGrid = document.querySelector('#searchForm .form-grid');
    if (formGrid && !document.querySelector('#travelerSummary')) {
      const box = document.createElement('div');
      box.id = 'travelerSummary';
      box.className = 'traveler-summary';
      box.innerHTML = `<div><b>👨‍👩‍👧 Grupo padrão: <span id="travelerSummaryName"></span></b><small id="travelerSummaryMeta"></small></div><button type="button" class="secondary" data-open-travelers>Editar viajantes</button>`;
      const firstDate = formGrid.querySelector('input[type="date"]')?.closest('.field');
      formGrid.insertBefore(box, firstDate || formGrid.firstChild);
    }

    const stats = document.querySelector('#view-dashboard .stats-grid');
    if (stats && !document.querySelector('#travelerDashboardCard')) {
      const card = document.createElement('section');
      card.id = 'travelerDashboardCard';
      card.className = 'traveler-card glass';
      card.innerHTML = `<div class="traveler-card-head"><div><span class="eyebrow">PERFIL PADRÃO</span><h3 id="travelerCardName"></h3><small id="travelerCardMeta"></small></div><button type="button" class="secondary" data-open-travelers>Gerenciar viajantes</button></div><div class="traveler-members" id="travelerMembers"></div>`;
      stats.insertAdjacentElement('afterend', card);
    }

    if (!document.querySelector('#travelerDialog')) {
      document.body.insertAdjacentHTML('beforeend', `<dialog id="travelerDialog"><form class="modal glass traveler-modal" id="travelerForm"><div class="panel-head"><div><span class="eyebrow">VIAJANTES</span><h3>Perfil padrão de viagem</h3></div><button type="button" class="icon-btn" data-close-travelers>×</button></div><div class="traveler-grid"><div class="field span-2"><label>Nome do grupo</label><input id="travelerGroupName" maxlength="40" placeholder="Ex.: Família Samuel"></div><div class="field"><label>Adultos</label><input id="travelerAdults" type="number" min="1" max="9"></div><div class="field"><label>Crianças</label><input id="travelerChildren" type="number" min="0" max="8"></div></div><div class="traveler-ages" id="travelerAges"></div><label class="switch-line" style="margin-top:14px"><input type="checkbox" checked disabled><span class="switch"></span><span><b>Usar este grupo como padrão</b><small>Será aplicado automaticamente às buscas salvas e aos alertas.</small></span></label><div class="traveler-actions"><button type="button" class="secondary" data-close-travelers>Cancelar</button><button type="submit" class="primary">Salvar viajantes</button></div></form></dialog>`);
    }

    document.querySelectorAll('[data-open-travelers]').forEach(btn => btn.onclick = openDialog);
    document.querySelectorAll('[data-close-travelers]').forEach(btn => btn.onclick = closeDialog);
    document.querySelector('#travelerChildren')?.addEventListener('input', renderAgeInputs);
    document.querySelector('#travelerForm')?.addEventListener('submit', saveProfile);
  }

  function renderAgeInputs() {
    const count = Math.max(0, Math.min(8, Number(document.querySelector('#travelerChildren')?.value) || 0));
    const box = document.querySelector('#travelerAges');
    if (!box) return;
    const current = [...box.querySelectorAll('select')].map(s => Number(s.value));
    box.innerHTML = count ? `<b>Idade das crianças</b>` : '';
    for (let i=0;i<count;i++) {
      const selected = current[i] ?? profile.ages[i] ?? 0;
      box.insertAdjacentHTML('beforeend', `<div class="traveler-age-row"><div class="field"><label>Criança ${i+1}</label><input value="Criança ${i+1}" disabled></div><div class="field"><label>Idade</label><select class="traveler-age">${Array.from({length:18},(_,age)=>`<option value="${age}" ${age===selected?'selected':''}>${age===0?'Menos de 1 ano':`${age} ${age===1?'ano':'anos'}`}</option>`).join('')}</select></div></div>`);
    }
  }

  function openDialog() {
    document.querySelector('#travelerGroupName').value = profile.name;
    document.querySelector('#travelerAdults').value = profile.adults;
    document.querySelector('#travelerChildren').value = profile.children;
    renderAgeInputs();
    document.querySelector('#travelerDialog').showModal();
  }

  function closeDialog() { document.querySelector('#travelerDialog')?.close(); }

  function saveProfile(event) {
    event.preventDefault();
    profile = normalize({
      name:document.querySelector('#travelerGroupName').value,
      adults:document.querySelector('#travelerAdults').value,
      children:document.querySelector('#travelerChildren').value,
      ages:[...document.querySelectorAll('.traveler-age')].map(s=>Number(s.value))
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    applyProfileToSearch();
    render();
    closeDialog();
    if (typeof toast === 'function') toast('Perfil de viajantes salvo');
  }

  function applyProfileToSearch() {
    const adults = document.querySelector('#adults');
    const children = document.querySelector('#children');
    if (!adults || !children) return;
    adults.value = profile.adults;
    children.value = profile.children;
    if (typeof renderChildAges === 'function') renderChildAges();
    requestAnimationFrame(() => {
      document.querySelectorAll('.child-age').forEach((select, i) => select.value = String(profile.ages[i] ?? 0));
    });
  }

  function render() {
    const name = esc(profile.name);
    const meta = `${membersText()} • aplicado automaticamente`;
    const summaryName = document.querySelector('#travelerSummaryName');
    const summaryMeta = document.querySelector('#travelerSummaryMeta');
    const cardName = document.querySelector('#travelerCardName');
    const cardMeta = document.querySelector('#travelerCardMeta');
    const members = document.querySelector('#travelerMembers');
    if (summaryName) summaryName.textContent = profile.name;
    if (summaryMeta) summaryMeta.textContent = meta;
    if (cardName) cardName.textContent = profile.name;
    if (cardMeta) cardMeta.textContent = meta;
    if (members) members.innerHTML = chips();
  }

  function attachSavedSearchProfile() {
    const save = document.querySelector('#saveSearch');
    if (!save || save.dataset.travelerBound) return;
    save.dataset.travelerBound = '1';
    save.addEventListener('click', () => {
      if (window.currentSearch) window.currentSearch.travelerProfile = structuredClone(profile);
    }, true);
  }

  injectUI();
  applyProfileToSearch();
  render();
  attachSavedSearchProfile();
  window.getDefaultTravelerProfile = () => structuredClone(profile);
})();