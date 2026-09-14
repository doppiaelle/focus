import * as db from '../db.js';
import * as ai from '../ai.js';
import { show as toast } from '../components/toast.js';
import { getSuggestions } from '../suggestions.js';

export async function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1 style="font-size:var(--font-hero)">Focus</h1>
          <p id="home-greeting" style="font-size:var(--font-md);margin-top:6px;-webkit-text-fill-color:var(--text-secondary)">Il tuo hub personale</p>
        </div>
        <a href="#/settings" class="btn-circle" style="margin-top:8px;background:var(--bg-card);border:1px solid var(--border)">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--text-secondary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </a>
      </div>
      <div class="search-bar" id="search-bar">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="home-search" placeholder="Cerca prodotti, eventi, spese..." autocomplete="off">
      </div>
      <div id="search-results" style="display:none"></div>
      <div id="home-today"></div>
      <div id="home-ai-status"></div>
      <div id="home-alerts"></div>
      <div id="home-suggestions"></div>
      <div id="home-summary"></div>
      <div id="home-recent"></div>
    </div>
  `;

  setGreeting();
  checkAiStatus();

  const searchInput = document.getElementById('home-search');
  const searchResults = document.getElementById('search-results');
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) {
      searchResults.style.display = 'none';
      ['home-today','home-ai-status','home-alerts','home-suggestions','home-summary','home-recent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
      });
      return;
    }
    searchTimer = setTimeout(() => runSearch(q, searchResults), 200);
  });

  const isEmpty = await isFirstLaunch();
  if (isEmpty) {
    showWelcomeCard();
  } else {
    await loadTodayWidget();
    await loadDashboard();
    await loadSmartSuggestions();
    await checkSpendingAlerts();
  }
}

async function isFirstLaunch() {
  const spesa = await db.getAll('spesa');
  const dispensa = await db.getAll('dispensa');
  const transazioni = await db.getAll('transazioni');
  const messaggi = await db.getAll('messages');
  return spesa.length === 0 && dispensa.length === 0 && transazioni.length === 0 && messaggi.length === 0;
}

function showWelcomeCard() {
  const el = document.getElementById('home-alerts');
  el.innerHTML = `
    <div class="welcome-card" style="margin-top:var(--space-lg)">
      <div class="welcome-icon">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
      </div>
      <h2>Benvenuto in Focus</h2>
      <p>Il tuo hub personale by <strong>DoubleL</strong>. Gestisci spesa, appuntamenti e finanze — tutto in un posto. Inizia aggiungendo qualcosa!</p>
      <div style="display:flex;gap:var(--space-sm);justify-content:center;flex-wrap:wrap;margin-top:var(--space-md)">
        <a href="#/spesa" class="btn btn-primary" style="border-radius:var(--radius-full);padding:12px 24px">
          🛒 Lista spesa
        </a>
        <a href="#/agenda" class="btn btn-ghost" style="border:1px solid var(--border);border-radius:var(--radius-full);padding:12px 24px">
          📅 Agenda
        </a>
      </div>
    </div>
  `;
}

function setGreeting() {
  const el = document.getElementById('home-greeting');
  const hour = new Date().getHours();
  if (hour < 6) el.textContent = 'Buonanotte';
  else if (hour < 12) el.textContent = 'Buongiorno';
  else if (hour < 18) el.textContent = 'Buon pomeriggio';
  else el.textContent = 'Buonasera';
}

async function checkAiStatus() {
  const el = document.getElementById('home-ai-status');
  const available = await ai.isAvailable();
  if (available) {
    el.innerHTML = `
      <div class="card" style="display:flex;align-items:center;gap:var(--space-sm);padding:var(--space-sm) var(--space-md)">
        <span class="status-dot online"></span>
        <span class="item-subtitle">AI connessa</span>
      </div>
    `;
  }
}

// ── Widget "Oggi" ──

async function loadTodayWidget() {
  const el = document.getElementById('home-today');
  if (!el) return;

  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const eventi = await db.getAll('eventi');
  const spesa = await db.getAll('spesa');
  const transazioni = await db.getAll('transazioni');
  const scadenze = await db.getAll('scadenze');

  const eventiOggi = eventi.filter(e => {
    const d = new Date(e.data); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).sort((a, b) => (a.ora || '').localeCompare(b.ora || ''));

  const scadenzeOggi = scadenze.filter(s => {
    if (s.completata) return false;
    const d = new Date(s.data); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  const daComprare = spesa.filter(i => !i.completato).length;

  const speseOggi = transazioni.filter(t => {
    const d = new Date(t.data); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime() && t.tipo === 'uscita';
  });
  const totaleOggi = speseOggi.reduce((s, t) => s + t.importo, 0);

  const items = [];

  for (const e of eventiOggi) {
    const icons = { appuntamento: '🏥', lavoro: '💼', personale: '👤', sport: '🏃', altro: '📌' };
    items.push(`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0">
        <span style="font-size:18px">${icons[e.tipo] || '📌'}</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:var(--font-sm)">${e.titolo}</div>
          ${e.ora ? `<div style="font-size:var(--font-xs);color:var(--accent)">${e.ora}${e.luogo ? ' · ' + e.luogo : ''}</div>` : ''}
        </div>
      </div>
    `);
  }

  for (const s of scadenzeOggi) {
    items.push(`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0">
        <span style="font-size:18px">⚠️</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:var(--font-sm);color:var(--danger)">${s.titolo} — scade oggi</div>
        </div>
      </div>
    `);
  }

  const badges = [];
  if (daComprare > 0) {
    badges.push(`<a href="#/spesa" style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--accent-soft);border-radius:var(--radius-full);font-size:var(--font-xs);font-weight:600;color:var(--accent);text-decoration:none">🛒 ${daComprare} da comprare</a>`);
  }
  if (totaleOggi > 0) {
    badges.push(`<a href="#/finanze" style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--danger-soft);border-radius:var(--radius-full);font-size:var(--font-xs);font-weight:600;color:var(--danger);text-decoration:none">💸 €${totaleOggi.toFixed(2)} spesi oggi</a>`);
  }

  if (items.length === 0 && badges.length === 0) {
    el.innerHTML = '';
    return;
  }

  const dayName = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  el.innerHTML = `
    <div class="card" style="background:var(--gradient-card-indigo);margin-bottom:var(--space-md)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${items.length > 0 ? 'var(--space-sm)' : '0'}">
        <div>
          <div style="font-size:var(--font-xs);color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:1px">Oggi</div>
          <div style="font-size:var(--font-sm);color:var(--text-secondary);margin-top:2px">${dayName.charAt(0).toUpperCase() + dayName.slice(1)}</div>
        </div>
        ${eventiOggi.length > 0 ? `<div style="font-size:var(--font-xl);font-weight:800;color:var(--accent)">${eventiOggi.length}</div>` : ''}
      </div>
      ${items.length > 0 ? `<div style="border-top:1px solid var(--border-light);padding-top:var(--space-sm)">${items.join('')}</div>` : ''}
      ${badges.length > 0 ? `<div style="display:flex;gap:8px;flex-wrap:wrap;${items.length > 0 ? 'margin-top:var(--space-sm)' : ''}">${badges.join('')}</div>` : ''}
    </div>
  `;
}

// ── Smart Suggestions ──

async function loadSmartSuggestions() {
  const el = document.getElementById('home-suggestions');
  if (!el) return;

  const suggestions = await getSuggestions(3);
  if (suggestions.length === 0) { el.innerHTML = ''; return; }

  const EMOJIS = {
    banana: '🍌', banane: '🍌', mela: '🍎', mele: '🍎', latte: '🥛', pane: '🍞',
    pasta: '🍝', uova: '🥚', pollo: '🍗', riso: '🍚', acqua: '💧', birra: '🍺',
  };
  function getEmoji(name) {
    const n = name.toLowerCase();
    for (const [k, v] of Object.entries(EMOJIS)) { if (n.includes(k)) return v; }
    return '📦';
  }

  el.innerHTML = `
    <div style="display:flex;gap:8px;overflow-x:auto;margin-bottom:var(--space-md);-webkit-overflow-scrolling:touch">
      ${suggestions.map(s => `
        <button class="home-suggestion" data-nome="${s.nome}" style="flex-shrink:0;padding:12px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;text-align:center;min-width:90px;transition:all 0.15s">
          <div style="font-size:24px;margin-bottom:4px">${getEmoji(s.nome)}</div>
          <div style="font-size:var(--font-xs);font-weight:600;color:var(--text-primary)">${s.nome}</div>
          <div style="font-size:9px;color:var(--text-muted);margin-top:2px">${s.motivo.length > 20 ? s.motivo.slice(0, 18) + '...' : s.motivo}</div>
        </button>
      `).join('')}
    </div>
  `;

  el.querySelectorAll('.home-suggestion').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nome = btn.dataset.nome;
      await db.add('spesa', {
        nome, quantita: 1, unita: null,
        completato: false, dataAggiunta: new Date().toISOString(), dataCompletato: null
      });
      toast(`${nome} aggiunto alla spesa`);
      btn.style.borderColor = 'var(--accent)';
      btn.style.background = 'var(--accent-soft)';
      btn.style.pointerEvents = 'none';
    });
  });
}

// ── Dashboard ──

async function loadDashboard() {
  const alertsEl = document.getElementById('home-alerts');
  const summaryEl = document.getElementById('home-summary');
  const recentEl = document.getElementById('home-recent');

  const spesaItems = await db.getAll('spesa');
  const dispensaItems = await db.getAll('dispensa');
  const transazioni = await db.getAll('transazioni');
  const eventi = await db.getAll('eventi');
  const scadenze = await db.getAll('scadenze');
  const buoni = await db.getAll('buoni_pasto');

  const daComprare = spesaItems.filter(i => !i.completato);
  const terminati = dispensaItems.filter(i => i.quantita === 0);

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const prossimiEventi = eventi
    .filter(e => new Date(e.data) >= today)
    .sort((a, b) => new Date(a.data) - new Date(b.data))
    .slice(0, 3);

  const scadenzeUrgenti = scadenze
    .filter(s => !s.completata && Math.ceil((new Date(s.data) - today) / 86400000) <= 30)
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  const meseCorrente = transazioni.filter(t => {
    const d = new Date(t.data);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totaleUscite = meseCorrente.filter(t => t.tipo === 'uscita').reduce((s, t) => s + t.importo, 0);

  const mesePrecedente = transazioni.filter(t => {
    const d = new Date(t.data);
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return t.tipo === 'uscita' && d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });
  const totalePrecedente = mesePrecedente.reduce((s, t) => s + t.importo, 0);

  // Buoni pasto summary
  const valoreBuono = (await db.getSetting('valore_buono_pasto')) || 8;
  const totaleBuoniIniziali = (await db.getSetting('totale_buoni_pasto')) || 0;
  const buoniAggiunti = buoni.filter(b => b.tipo === 'ricarica').reduce((s, b) => s + (b.quantita || 0), 0);
  const buoniUsati = buoni.filter(b => b.tipo === 'utilizzo').reduce((s, b) => s + (b.quantita || 0), 0);
  const buoniRimanenti = totaleBuoniIniziali + buoniAggiunti - buoniUsati;

  const alerts = [];

  if (terminati.length > 0) {
    alerts.push({ icon: '!', text: `${terminati.map(i => i.nome).join(', ')} ${terminati.length === 1 ? 'terminato' : 'terminati'}`, type: 'danger' });
  }

  const scorteBasse = dispensaItems.filter(i => i.quantita !== null && i.quantita > 0 && i.quantita <= 1);
  if (scorteBasse.length > 0) {
    alerts.push({ icon: '~', text: `${scorteBasse.map(i => i.nome).join(', ')} quasi ${scorteBasse.length === 1 ? 'finito' : 'finiti'}`, type: 'warning' });
  }

  const scaduta = scadenzeUrgenti.filter(s => new Date(s.data) < today);
  const prossime = scadenzeUrgenti.filter(s => new Date(s.data) >= today);
  if (scaduta.length > 0) {
    alerts.push({ icon: '!', text: `${scaduta.map(s => s.titolo).join(', ')} — scaduto!`, type: 'danger' });
  }
  if (prossime.length > 0) {
    const first = prossime[0];
    const days = Math.ceil((new Date(first.data) - today) / 86400000);
    alerts.push({ icon: days, text: `${first.titolo} — tra ${days}gg`, type: 'warning' });
  }

  if (prossimiEventi.length > 0) {
    const next = prossimiEventi[0];
    const d = new Date(next.data);
    const diff = Math.ceil((d - today) / 86400000);
    const quando = diff === 0 ? 'oggi' : diff === 1 ? 'domani' : d.toLocaleDateString('it-IT', { weekday: 'short' });
    alerts.push({ icon: quando.slice(0, 3), text: `${next.titolo}${next.ora ? ' alle ' + next.ora : ''}`, type: 'accent' });
  }

  if (totalePrecedente > 0 && totaleUscite > totalePrecedente * 1.2) {
    const diff = ((totaleUscite / totalePrecedente - 1) * 100).toFixed(0);
    alerts.push({ icon: `+${diff}%`, text: `spese vs mese scorso`, type: 'warning' });
  }

  const alertColors = { danger: 'var(--danger)', warning: 'var(--warning)', accent: 'var(--accent)' };
  const alertBg = { danger: 'var(--danger-soft)', warning: 'var(--warning-soft)', accent: 'var(--accent-soft)' };

  if (alerts.length > 0) {
    alertsEl.innerHTML = `
      <div class="section-title">Avvisi</div>
      ${alerts.map(a => `
        <div class="card" style="display:flex;align-items:center;gap:14px;padding:14px var(--space-md)">
          <div style="width:36px;height:36px;border-radius:10px;background:${alertBg[a.type]};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:${alertColors[a.type]};flex-shrink:0">${a.icon}</div>
          <span style="font-size:var(--font-sm);font-weight:500">${a.text}</span>
        </div>
      `).join('')}
    `;
  } else {
    alertsEl.innerHTML = `
      <div style="background:var(--gradient-card-indigo);border-radius:var(--radius-md);padding:var(--space-xl);text-align:center;margin-bottom:var(--space-md);border:1px solid var(--border)">
        <div style="width:48px;height:48px;border-radius:var(--radius-full);background:var(--accent-soft);display:flex;align-items:center;justify-content:center;margin:0 auto var(--space-md)">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="item-title" style="font-size:var(--font-lg);margin-bottom:4px">Tutto in ordine</div>
        <div class="item-subtitle">Nessun avviso per ora</div>
      </div>
    `;
  }

  const mese = now.toLocaleDateString('it-IT', { month: 'long' });
  const meseCapitalized = mese.charAt(0).toUpperCase() + mese.slice(1);

  const hasBuoni = totaleBuoniIniziali > 0 || buoni.length > 0;

  summaryEl.innerHTML = `
    <div class="section-title">Riepilogo ${meseCapitalized}</div>
    <div class="stat-grid" style="grid-template-columns:${hasBuoni ? '1fr 1fr' : '1fr 1fr 1fr'}">
      <div class="stat-card" style="background:var(--gradient-card-purple)">
        <div class="stat-icon" style="font-size:20px">🛒</div>
        <div class="stat-value">${daComprare.length}</div>
        <div class="stat-label">da comprare</div>
      </div>
      <div class="stat-card" style="background:var(--gradient-card-indigo)">
        <div class="stat-icon" style="color:var(--danger)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
        </div>
        <div class="stat-value" style="color:var(--danger)">€${totaleUscite.toFixed(0)}</div>
        <div class="stat-label">spese</div>
      </div>
      ${hasBuoni ? `
        <div class="stat-card" style="background:var(--gradient-card-green)">
          <div class="stat-icon" style="font-size:20px">🎫</div>
          <div class="stat-value" style="color:var(--success)">${buoniRimanenti}</div>
          <div class="stat-label">buoni pasto</div>
        </div>
      ` : ''}
      <div class="stat-card" style="background:var(--gradient-card-cyan)">
        <div class="stat-icon" style="font-size:20px">🏠</div>
        <div class="stat-value">${dispensaItems.length}</div>
        <div class="stat-label">in dispensa</div>
      </div>
    </div>
  `;

  const recentTx = transazioni.sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
  if (recentTx.length > 0) {
    recentEl.innerHTML = `
      <div class="section-title">Ultime attività</div>
      ${recentTx.map(t => `
        <div class="list-item">
          <div style="width:36px;height:36px;border-radius:10px;background:${t.tipo === 'uscita' ? 'var(--danger-soft)' : 'var(--success-soft)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${t.tipo === 'uscita' ? 'var(--danger)' : 'var(--success)'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              ${t.tipo === 'uscita' ? '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>' : '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>'}
            </svg>
          </div>
          <div class="item-text">
            <div class="item-title" style="font-size:var(--font-sm)">${t.descrizione || t.categoria}</div>
            <div class="item-subtitle">${new Date(t.data).toLocaleDateString('it-IT')}</div>
          </div>
          <div style="font-size:var(--font-sm);font-weight:700;color:${t.tipo === 'uscita' ? 'var(--danger)' : 'var(--success)'}">
            ${t.tipo === 'uscita' ? '-' : '+'}€${t.importo.toFixed(2)}
          </div>
        </div>
      `).join('')}
    `;
  }
}

async function runSearch(query, container) {
  const q = query.toLowerCase();
  const results = [];

  const spesa = await db.getAll('spesa');
  const matched_spesa = spesa.filter(i => i.nome.toLowerCase().includes(q));
  if (matched_spesa.length > 0) {
    results.push({ group: 'Lista spesa', icon: '🛒', items: matched_spesa.map(i => ({
      title: i.nome, subtitle: i.completato ? 'Completato' : 'Da comprare', href: '#/spesa'
    }))});
  }

  const dispensa = await db.getAll('dispensa');
  const matched_disp = dispensa.filter(i => i.nome.toLowerCase().includes(q));
  if (matched_disp.length > 0) {
    results.push({ group: 'Dispensa', icon: '🏠', items: matched_disp.map(i => ({
      title: i.nome, subtitle: i.quantita !== null ? `Qtà: ${i.quantita}` : '', href: '#/spesa'
    }))});
  }

  const eventi = await db.getAll('eventi');
  const matched_ev = eventi.filter(i => i.titolo.toLowerCase().includes(q));
  if (matched_ev.length > 0) {
    results.push({ group: 'Eventi', icon: '📅', items: matched_ev.map(i => ({
      title: i.titolo, subtitle: new Date(i.data).toLocaleDateString('it-IT'), href: '#/agenda'
    }))});
  }

  const scadenze = await db.getAll('scadenze');
  const matched_sc = scadenze.filter(i => i.titolo.toLowerCase().includes(q));
  if (matched_sc.length > 0) {
    results.push({ group: 'Scadenze', icon: '⏰', items: matched_sc.map(i => ({
      title: i.titolo, subtitle: new Date(i.data).toLocaleDateString('it-IT'), href: '#/agenda'
    }))});
  }

  const transazioni = await db.getAll('transazioni');
  const matched_tx = transazioni.filter(i => (i.descrizione || i.categoria || '').toLowerCase().includes(q));
  if (matched_tx.length > 0) {
    results.push({ group: 'Transazioni', icon: '💰', items: matched_tx.slice(0, 5).map(i => ({
      title: i.descrizione || i.categoria, subtitle: `€${i.importo.toFixed(2)} · ${new Date(i.data).toLocaleDateString('it-IT')}`, href: '#/finanze'
    }))});
  }

  ['home-today','home-ai-status','home-alerts','home-suggestions','home-summary','home-recent'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  container.style.display = '';

  if (results.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>Nessun risultato per "${query}"</p></div>`;
    return;
  }

  container.innerHTML = results.map(g => `
    <div class="search-results">
      <div class="search-group-title">${g.icon} ${g.group} (${g.items.length})</div>
      ${g.items.map(i => `
        <a href="${i.href}" class="list-item" style="text-decoration:none;cursor:pointer">
          <div class="item-text">
            <div class="item-title">${i.title}</div>
            ${i.subtitle ? `<div class="item-subtitle">${i.subtitle}</div>` : ''}
          </div>
          <div style="color:var(--text-muted);font-size:16px">›</div>
        </a>
      `).join('')}
    </div>
  `).join('');
}

async function checkSpendingAlerts() {
  const transazioni = await db.getAll('transazioni');
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  if (weekStart > today) weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  let weekTotal = 0, monthTotal = 0;
  for (const t of transazioni) {
    if (t.tipo !== 'uscita') continue;
    const d = new Date(t.data); d.setHours(0, 0, 0, 0);
    if (d >= monthStart && d <= today) monthTotal += Math.abs(t.importo);
    if (d >= weekStart && d <= today) weekTotal += Math.abs(t.importo);
  }

  const sogliaW = await db.getSetting('soglia_settimanale');
  const sogliaM = await db.getSetting('soglia_mensile');

  const alertsEl = document.getElementById('home-alerts');
  if (!alertsEl) return;

  const banners = [];
  if (sogliaW && weekTotal > sogliaW) {
    const pct = ((weekTotal / sogliaW) * 100).toFixed(0);
    banners.push(`<div style="background:var(--danger-soft);border:1px solid var(--danger);border-radius:var(--radius-md);padding:14px var(--space-md);margin-bottom:var(--space-sm);display:flex;align-items:center;gap:12px">
      <div style="font-size:20px">⚠️</div>
      <div>
        <div style="font-weight:700;color:var(--danger);font-size:var(--font-sm)">Soglia settimanale superata!</div>
        <div style="font-size:var(--font-xs);color:var(--text-secondary);margin-top:2px">€${weekTotal.toFixed(2)} / €${sogliaW} (${pct}%)</div>
      </div>
    </div>`);
  }
  if (sogliaM && monthTotal > sogliaM) {
    const pct = ((monthTotal / sogliaM) * 100).toFixed(0);
    banners.push(`<div style="background:var(--danger-soft);border:1px solid var(--danger);border-radius:var(--radius-md);padding:14px var(--space-md);margin-bottom:var(--space-sm);display:flex;align-items:center;gap:12px">
      <div style="font-size:20px">⚠️</div>
      <div>
        <div style="font-weight:700;color:var(--danger);font-size:var(--font-sm)">Soglia mensile superata!</div>
        <div style="font-size:var(--font-xs);color:var(--text-secondary);margin-top:2px">€${monthTotal.toFixed(2)} / €${sogliaM} (${pct}%)</div>
      </div>
    </div>`);
  }

  if (banners.length > 0) {
    const existing = alertsEl.innerHTML;
    const hasNoAlerts = existing.includes('Tutto in ordine');
    if (hasNoAlerts) {
      alertsEl.innerHTML = banners.join('');
    } else {
      alertsEl.insertAdjacentHTML('afterbegin', banners.join(''));
    }
  }
}
