(() => {
  function initialize() {
    const form = document.getElementById('managedTripForm');
    const wrap = document.getElementById('managedTripFormWrap');
    if (!form || !wrap || form.dataset.saveFixReady) return;
    form.dataset.saveFixReady = 'true';

    const actions = form.querySelector('.managed-actions');
    const submit = form.querySelector('button[type="submit"]');
    if (!actions || !submit) return;

    submit.id = 'saveManagedTripButton';
    submit.textContent = 'Salvar e ativar viagem';

    let message = document.getElementById('managedSaveMessage');
    if (!message) {
      message = document.createElement('div');
      message.id = 'managedSaveMessage';
      message.setAttribute('role', 'status');
      message.style.cssText = 'display:none;margin:4px 0 12px;padding:11px 13px;border-radius:12px;border:1px solid rgba(255,190,80,.35);background:rgba(255,170,30,.09);font-size:13px;line-height:1.4';
      actions.parentNode.insertBefore(message, actions);
    }

    const show = text => {
      message.textContent = text;
      message.style.display = 'block';
      message.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    form.addEventListener('input', () => { message.style.display = 'none'; }, true);

    form.addEventListener('submit', event => {
      const originCode = document.getElementById('managedOriginCode')?.value.trim();
      const destinationCode = document.getElementById('managedDestinationCode')?.value.trim();
      const departure = document.getElementById('managedDeparture')?.value;

      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        form.reportValidity();
        show('Preencha os campos obrigatórios antes de salvar a viagem.');
        return;
      }
      if (!originCode) {
        event.preventDefault();
        event.stopImmediatePropagation();
        show('Escolha a origem tocando em uma das opções que aparecem na lista.');
        document.getElementById('managedOrigin')?.focus();
        return;
      }
      if (!destinationCode) {
        event.preventDefault();
        event.stopImmediatePropagation();
        show('Escolha o destino tocando em uma das opções que aparecem na lista.');
        document.getElementById('managedDestination')?.focus();
        return;
      }
      if (!departure) {
        event.preventDefault();
        event.stopImmediatePropagation();
        show('Informe a data de ida para salvar a viagem.');
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Salvando viagem...';
      setTimeout(() => {
        submit.disabled = false;
        submit.textContent = 'Salvar e ativar viagem';
      }, 1800);
    }, true);

    const style = document.createElement('style');
    style.textContent = `
      #saveManagedTripButton{min-height:52px;font-size:16px;font-weight:800}
      @media(max-width:768px){
        #managedTripForm .managed-actions{position:sticky;bottom:0;z-index:80;padding:12px 0 calc(10px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(6,17,31,0),#06111f 28%)}
        #managedTripForm .managed-actions button{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  const observer = new MutationObserver(initialize);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  initialize();
})();