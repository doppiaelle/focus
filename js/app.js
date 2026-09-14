import { open } from './db.js';
import { isLoggedIn } from './api.js';
import { register, init as initRouter } from './router.js';
import { render as renderNavbar } from './components/navbar.js';

const V = '?v=23';

function initTheme() {
  try {
    const saved = localStorage.getItem('focus_theme');
    if (saved && saved !== 'auto') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch {}
}

function needsLogin() {
  return !isLoggedIn() && !localStorage.getItem('focus_offline_mode');
}

async function boot() {
  initTheme();
  await open();

  const { render: loginView } = await import('./views/login.js' + V);
  const { render: homeView } = await import('./views/home.js' + V);
  const { render: chatView, destroy: chatDestroy } = await import('./views/chat.js' + V);
  const { render: agendaView, destroy: agendaDestroy } = await import('./views/agenda.js' + V);
  const { render: spesaView, destroy: spesaDestroy } = await import('./views/spesa.js' + V);
  const { render: finanzeView, destroy: finanzeDestroy } = await import('./views/finanze.js' + V);
  const { render: settingsView } = await import('./views/settings.js' + V);

  register('/login', (c) => { loginView(c); });

  register('/', (c) => {
    if (needsLogin()) { window.location.hash = '/login'; return; }
    homeView(c);
  });
  register('/chat', (c) => {
    if (needsLogin()) { window.location.hash = '/login'; return; }
    chatView(c); return { destroy: chatDestroy };
  });
  register('/agenda', (c) => {
    if (needsLogin()) { window.location.hash = '/login'; return; }
    agendaView(c); return { destroy: agendaDestroy };
  });
  register('/spesa', (c) => {
    if (needsLogin()) { window.location.hash = '/login'; return; }
    spesaView(c); return { destroy: spesaDestroy };
  });
  register('/dispensa', (c) => {
    if (needsLogin()) { window.location.hash = '/login'; return; }
    spesaView(c); return { destroy: spesaDestroy };
  });
  register('/finanze', (c) => {
    if (needsLogin()) { window.location.hash = '/login'; return; }
    finanzeView(c); return { destroy: finanzeDestroy };
  });
  register('/settings', (c) => {
    if (needsLogin()) { window.location.hash = '/login'; return; }
    settingsView(c);
  });

  register('/altro', () => { window.location.hash = '/spesa'; });

  const navbar = document.getElementById('navbar');
  renderNavbar(navbar);
  window.addEventListener('hashchange', () => {
    renderNavbar(navbar);
    if (window.location.hash === '#/login') {
      navbar.style.display = 'none';
    } else {
      navbar.style.display = '';
    }
  });

  initRouter();

  if (!needsLogin()) {
    const { startPeriodicCheck, checkOnDataChange } = await import('./notifications.js' + V);
    startPeriodicCheck();

    const { on } = await import('./store.js' + V);
    on('data-changed', (detail) => {
      checkOnDataChange(detail?.source || 'unknown');
    });
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

boot();
