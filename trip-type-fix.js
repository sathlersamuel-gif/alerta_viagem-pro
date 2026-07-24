(() => {
  const select = document.querySelector('#tripType');
  const anyDestination = document.querySelector('#anyDestination');
  if (!select) return;

  const options = [
    { value: 'complete', label: 'Voo + hotel' },
    { value: 'flight', label: 'Somente voo' },
    { value: 'hotel', label: 'Somente hotel' }
  ];

  const group = document.createElement('div');
  group.className = 'trip-type-buttons';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', 'Tipo de busca');

  options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'trip-type-button';
    button.dataset.tripType = option.value;
    button.textContent = option.label;
    button.addEventListener('click', () => {
      if (button.disabled) return;
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    });
    group.appendChild(button);
  });

  select.insertAdjacentElement('afterend', group);

  function sync() {
    const locked = Boolean(anyDestination?.checked);
    if (!locked && select.disabled) select.disabled = false;
    if (locked) select.value = 'flight';

    group.querySelectorAll('.trip-type-button').forEach((button) => {
      const active = button.dataset.tripType === select.value;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
      button.disabled = locked && button.dataset.tripType !== 'flight';
    });
  }

  select.addEventListener('change', sync);
  anyDestination?.addEventListener('change', () => setTimeout(sync, 0));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  window.addEventListener('pageshow', sync);
  sync();
})();