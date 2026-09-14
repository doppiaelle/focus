import * as api from '../api.js';
import { show as toast } from '../components/toast.js';

function detectServer() {
  const loc = window.location;
  if (loc.hostname !== 'localhost' && loc.hostname !== '127.0.0.1' && loc.protocol !== 'file:') {
    return loc.origin;
  }
  return '';
}

export async function render(container) {
  container.innerHTML = `
    <div class="view-container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;text-align:center">
      <div style="width:100%;max-width:360px">
        <div style="margin-bottom:var(--space-xl)">
          <div style="font-size:48px;font-weight:900;background:var(--gradient-primary);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Focus</div>
          <p style="color:var(--text-secondary);margin-top:8px;font-size:var(--font-md)">by DoubleL</p>
        </div>

        <div id="login-form">
          <div class="card" style="text-align:left;padding:var(--space-lg)">
            <div class="form-group">
              <label class="form-label">Server</label>
              <input type="url" id="login-server" class="input-field" placeholder="http://100.x.x.x:3001" value="${localStorage.getItem('focus_api_url') || detectServer()}">
              <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:4px">IP Tailscale del PC + porta (es. http://100.64.0.1:3001)</div>
            </div>
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" id="login-user" class="input-field" placeholder="username" autocomplete="username">
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="login-pass" class="input-field" placeholder="password" autocomplete="current-password">
            </div>
            <div id="login-error" style="display:none;color:var(--danger);font-size:var(--font-sm);margin-bottom:var(--space-sm);text-align:center"></div>
            <button id="btn-login" class="btn btn-primary" style="width:100%;padding:14px;border-radius:var(--radius-md);font-weight:700;font-size:var(--font-md)">Accedi</button>
            <div style="text-align:center;margin-top:var(--space-md)">
              <button id="btn-show-register" class="btn btn-ghost" style="font-size:var(--font-sm);color:var(--accent)">Non hai un account? Registrati</button>
            </div>
          </div>
        </div>

        <div id="register-form" style="display:none">
          <div class="card" style="text-align:left;padding:var(--space-lg)">
            <div class="form-group">
              <label class="form-label">Server</label>
              <input type="url" id="reg-server" class="input-field" placeholder="http://100.x.x.x:3001" value="${localStorage.getItem('focus_api_url') || detectServer()}">
            </div>
            <div class="form-group">
              <label class="form-label">Nome</label>
              <input type="text" id="reg-nome" class="input-field" placeholder="Il tuo nome" autocomplete="name">
            </div>
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" id="reg-user" class="input-field" placeholder="username" autocomplete="username">
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="reg-pass" class="input-field" placeholder="minimo 8 caratteri" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label class="form-label">Codice invito</label>
              <input type="text" id="reg-invite" class="input-field" placeholder="Chiedi al proprietario del server" autocomplete="off">
            </div>
            <div id="reg-error" style="display:none;color:var(--danger);font-size:var(--font-sm);margin-bottom:var(--space-sm);text-align:center"></div>
            <button id="btn-register" class="btn btn-primary" style="width:100%;padding:14px;border-radius:var(--radius-md);font-weight:700;font-size:var(--font-md)">Registrati</button>
            <div style="text-align:center;margin-top:var(--space-md)">
              <button id="btn-show-login" class="btn btn-ghost" style="font-size:var(--font-sm);color:var(--accent)">Hai già un account? Accedi</button>
            </div>
          </div>
        </div>

        <div style="margin-top:var(--space-lg)">
          <button id="btn-offline" class="btn btn-ghost" style="font-size:var(--font-sm);color:var(--text-muted)">Usa senza account (solo locale)</button>
        </div>
      </div>
    </div>
  `;

  const navbar = document.getElementById('navbar');
  if (navbar) navbar.style.display = 'none';

  document.getElementById('btn-show-register').addEventListener('click', () => {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = '';
    const srv = document.getElementById('login-server').value;
    if (srv) document.getElementById('reg-server').value = srv;
  });

  document.getElementById('btn-show-login').addEventListener('click', () => {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = '';
    const srv = document.getElementById('reg-server').value;
    if (srv) document.getElementById('login-server').value = srv;
  });

  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

  document.getElementById('btn-register').addEventListener('click', doRegister);
  document.getElementById('reg-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doRegister(); });

  document.getElementById('btn-offline').addEventListener('click', () => {
    localStorage.setItem('focus_offline_mode', '1');
    window.location.hash = '/';
    window.location.reload();
  });
}

async function doLogin() {
  const server = document.getElementById('login-server').value.trim().replace(/\/+$/, '');
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  errorEl.style.display = 'none';
  if (!server) { showError(errorEl, 'Inserisci l\'URL del server'); return; }
  if (!username || !password) { showError(errorEl, 'Inserisci username e password'); return; }

  btn.disabled = true;
  btn.textContent = 'Connessione...';

  try {
    const ok = await api.checkHealth(server);
    if (!ok) { showError(errorEl, 'Server non raggiungibile'); return; }

    await api.login(server, username, password);
    toast(`Benvenuto, ${username}!`);
    localStorage.removeItem('focus_offline_mode');
    window.location.hash = '/';
    window.location.reload();
  } catch (err) {
    showError(errorEl, err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Accedi';
  }
}

async function doRegister() {
  const server = document.getElementById('reg-server').value.trim().replace(/\/+$/, '');
  const nome = document.getElementById('reg-nome').value.trim();
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value;
  const invite = document.getElementById('reg-invite').value.trim();
  const errorEl = document.getElementById('reg-error');
  const btn = document.getElementById('btn-register');

  errorEl.style.display = 'none';
  if (!server) { showError(errorEl, 'Inserisci l\'URL del server'); return; }
  if (!username || !password) { showError(errorEl, 'Inserisci username e password'); return; }
  if (password.length < 8) { showError(errorEl, 'Password minimo 8 caratteri'); return; }

  btn.disabled = true;
  btn.textContent = 'Registrazione...';

  try {
    const ok = await api.checkHealth(server);
    if (!ok) { showError(errorEl, 'Server non raggiungibile'); return; }

    const data = await api.register(server, username, password, nome, invite);
    toast(`Account creato! Benvenuto, ${data.user.nome || username}!`);
    localStorage.removeItem('focus_offline_mode');
    window.location.hash = '/';
    window.location.reload();
  } catch (err) {
    showError(errorEl, err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Registrati';
  }
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = '';
}
