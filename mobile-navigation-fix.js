// Correção global da navegação mobile, inclusive telas adicionadas dinamicamente.
(() => {
  const MOBILE_BREAKPOINT = 900;
  const sidebar = document.querySelector('#sidebar');
  const menuButton = document.querySelector('#menuBtn');
  if (!sidebar) return;

  const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT;

  function ensureBackdrop() {
    let backdrop = document.querySelector('#mobileNavBackdrop');
    if (backdrop) return backdrop;
    backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.id = 'mobileNavBackdrop';
    backdrop.setAttribute('aria-label', 'Fechar menu');
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', closeMenu);
    return backdrop;
  }

  function syncMenuState() {
    const open = sidebar.classList.contains('open') && isMobile();
    document.body.classList.toggle('mobile-menu-open', open);
    ensureBackdrop().classList.toggle('show', open);
    menuButton?.setAttribute('aria-expanded', String(open));
  }

  function closeMenu() {
    sidebar.classList.remove('open');
    syncMenuState();
  }

  function openMenu() {
    if (!isMobile()) return;
    sidebar.classList.add('open');
    syncMenuState();
  }

  // Corrige o botão já existente sem depender da ordem de carregamento dos scripts.
  menuButton?.addEventListener('click', () => {
    requestAnimationFrame(() => {
      if (sidebar.classList.contains('open')) syncMenuState();
      else openMenu();
    });
  });

  // Funciona também para itens criados depois, como Gerenciamento de viagens.
  document.addEventListener('click', event => {
    const navItem = event.target.closest('.sidebar .nav-item');
    if (!navItem) return;
    if (isMobile()) {
      closeMenu();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) closeMenu();
    else syncMenuState();
  });

  window.addEventListener('pageshow', closeMenu);

  const style = document.createElement('style');
  style.textContent = `
    #mobileNavBackdrop{display:none;position:fixed;inset:0;border:0;padding:0;background:rgba(0,8,18,.62);backdrop-filter:blur(2px);z-index:19}
    #mobileNavBackdrop.show{display:block}
    @media(max-width:900px){
      body.mobile-menu-open{overflow:hidden;touch-action:none}
      .sidebar{position:fixed!important;left:0;top:0;bottom:0;width:min(86vw,360px)!important;height:100dvh!important;z-index:50!important;overflow-y:auto;overscroll-behavior:contain;transform:translateX(-105%);transition:transform .24s ease;box-shadow:22px 0 60px rgba(0,0,0,.45)}
      .sidebar.open{transform:translateX(0)!important}
      #mobileNavBackdrop{z-index:49}
      .main{width:100%!important;min-width:0!important}
      #view-travel-management{width:100%;min-width:0;overflow-x:hidden}
      #view-travel-management>.panel{width:100%;min-width:0}
      #view-travel-management .panel-head{align-items:flex-start;flex-wrap:wrap}
      #view-travel-management #newManagedTrip{width:100%}
      #view-travel-management .form-grid{grid-template-columns:1fr!important}
      #view-travel-management .span-2,#view-travel-management .span-4{grid-column:1!important}
      #view-travel-management .managed-card-actions,#view-travel-management .managed-actions{display:grid!important;grid-template-columns:1fr!important}
    }
  `;
  document.head.appendChild(style);

  ensureBackdrop();
  closeMenu();
})();