(() => {
  // Remove a versão antiga do perfil fixo que era inserida automaticamente.
  localStorage.removeItem('avpro_traveler_profile');
  localStorage.removeItem('avpro_travelers');

  const removeLegacyTravelerUi = () => {
    document.querySelector('#travelerSummary')?.remove();
    document.querySelector('#travelerDashboardCard')?.remove();
    document.querySelector('#travelerDialog')?.remove();

    const adults = document.querySelector('#adults');
    const children = document.querySelector('#children');
    if (adults && !adults.dataset.userChanged) adults.value = '1';
    if (children && !children.dataset.userChanged) children.value = '0';
    document.querySelector('#childAges')?.classList.add('hidden');
  };

  removeLegacyTravelerUi();
  document.addEventListener('DOMContentLoaded', removeLegacyTravelerUi);
  window.addEventListener('load', removeLegacyTravelerUi);

  // Mantém compatibilidade com outras partes do app sem aplicar viajantes fixos.
  window.getDefaultTravelerProfile = () => null;
})();