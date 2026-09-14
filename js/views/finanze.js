import * as db from '../db.js';
import * as modal from '../components/modal.js';
import { on, emit } from '../store.js';

let unsub = null;
let activeTab = 'panoramica';
let searchQuery = '';

const CATEGORIE = ['Alimentazione', 'Casa', 'Trasporti', 'Svago', 'Salute', 'Abbonamenti', 'Altro'];
const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export async function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1>Finanze</h1>
        <p id="finanze-periodo"></p>
      </div>
      <div class="search-bar" style="margin-bottom:var(--space-sm)">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="finanze-search" placeholder="Cerca transazioni..." autocomplete="off">
      </div>
      <div id="finanze-tabs" style="display:flex;gap:var(--space-xs);margin-bottom:var(--space-md)">
        <button class="fin-tab active" data-tab="panoramica" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--accent);color:#fff;border:none">Panoramica</button>
        <button class="fin-tab" data-tab="statistiche" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--bg-card);color:var(--text-secondary);border:1px solid var(--border-light)">Statistiche</button>
        <button class="fin-tab" data-tab="ricorrenti" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--bg-card);color:var(--text-secondary);border:1px solid var(--border-light)">Ricorrenti</button>
        <button class="fin-tab" data-tab="buoni" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--bg-card);color:var(--text-secondary);border:1px solid var(--border-light)">Buoni</button>
      </div>
      <div id="finanze-content">
        <div id="finanze-summary"></div>
        <div id="finanze-chart"></div>
        <div id="finanze-list"></div>
      </div>
      <div id="stats-content" style="display:none"></div>
      <div id="ricorrenti-content" style="display:none"></div>
      <div id="buoni-content" style="display:none"></div>
    </div>
    <button class="fab" id="finanze-add">+</button>
  `;

  container.querySelectorAll('.fin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      updateFinTabs(container);
      switchTab();
    });
  });

  const searchInput = document.getElementById('finanze-search');
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchInput.value.trim().toLowerCase();
      if (activeTab === 'panoramica') loadData();
    }, 200);
  });

  const fab = document.getElementById('finanze-add');
  fab.addEventListener('click', () => {
    if (activeTab === 'buoni') openAddBuono();
    else if (activeTab === 'ricorrenti') openAddRicorrente();
    else openAddModal();
  });
  unsub = on('data-changed', () => switchTab());

  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const st = window.scrollY || document.documentElement.scrollTop;
    fab.classList.toggle('fab-hidden', st > lastScroll && st > 100);
    lastScroll = st;
  }, { passive: true });

  await switchTab();
}

export function destroy() {
  if (unsub) unsub();
}

function switchTab() {
  document.getElementById('finanze-content').style.display = activeTab === 'panoramica' ? '' : 'none';
  document.getElementById('stats-content').style.display = activeTab === 'statistiche' ? '' : 'none';
  document.getElementById('ricorrenti-content').style.display = activeTab === 'ricorrenti' ? '' : 'none';
  document.getElementById('buoni-content').style.display = activeTab === 'buoni' ? '' : 'none';

  if (activeTab === 'panoramica') loadData();
  else if (activeTab === 'statistiche') loadStatistiche();
  else if (activeTab === 'ricorrenti') loadRicorrenti();
  else loadBuoniPasto();
}

function updateFinTabs(container) {
  container.querySelectorAll('.fin-tab').forEach(btn => {
    if (btn.dataset.tab === activeTab) {
      btn.style.background = 'var(--accent)';
      btn.style.color = '#fff';
      btn.style.border = 'none';
    } else {
      btn.style.background = 'var(--bg-card)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.border = '1px solid var(--border-light)';
    }
  });
}

// ── Statistiche ──

async function loadStatistiche() {
  const el = document.getElementById('stats-content');
  if (!el) return;

  const all = await db.getAll('transazioni');
  const now = new Date();

  if (all.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📊</div><p>Nessun dato disponibile.<br>Aggiungi transazioni per vedere le statistiche!</p></div>`;
    return;
  }

  const uscite = all.filter(t => t.tipo === 'uscita');

  // Per categoria (tutto il periodo)
  const perCategoria = {};
  for (const t of uscite) {
    const cat = t.categoria || 'Altro';
    perCategoria[cat] = (perCategoria[cat] || 0) + t.importo;
  }
  const totaleUscite = uscite.reduce((s, t) => s + t.importo, 0);
  const catEntries = Object.entries(perCategoria).sort((a, b) => b[1] - a[1]);

  const catColors = {
    'Alimentazione': '#f87171', 'Casa': '#fbbf24', 'Trasporti': '#60a5fa',
    'Svago': '#a78bfa', 'Salute': '#34d399', 'Abbonamenti': '#f472b6', 'Altro': '#94a3b8'
  };

  // Spesa media per giorno della settimana
  const GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const perGiorno = Array(7).fill(0);
  const countGiorno = Array(7).fill(0);
  for (const t of uscite) {
    const d = new Date(t.data).getDay();
    perGiorno[d] += t.importo;
    countGiorno[d]++;
  }
  const mediaGiorno = perGiorno.map((v, i) => countGiorno[i] > 0 ? v / countGiorno[i] : 0);
  const maxMediaGiorno = Math.max(1, ...mediaGiorno);

  // Trend ultimi 12 mesi
  const months12 = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months12.push({ month: d.getMonth(), year: d.getFullYear(), label: MESI[d.getMonth()] });
  }
  const trend12 = months12.map(m => {
    const mTx = uscite.filter(t => {
      const d = new Date(t.data);
      return d.getMonth() === m.month && d.getFullYear() === m.year;
    });
    return { label: m.label, total: mTx.reduce((s, t) => s + t.importo, 0) };
  });
  const maxTrend = Math.max(1, ...trend12.map(d => d.total));

  // Top spese singole
  const topSpese = [...uscite].sort((a, b) => b.importo - a.importo).slice(0, 5);

  // Media mensile
  const mesiUnici = new Set(uscite.map(t => {
    const d = new Date(t.data);
    return `${d.getFullYear()}-${d.getMonth()}`;
  }));
  const mediaMensile = mesiUnici.size > 0 ? totaleUscite / mesiUnici.size : 0;

  // Donut chart via conic-gradient
  let conicStops = '';
  let accumulated = 0;
  const donutLegend = [];
  for (const [cat, tot] of catEntries) {
    const pct = totaleUscite > 0 ? (tot / totaleUscite * 100) : 0;
    const color = catColors[cat] || '#94a3b8';
    conicStops += `${color} ${accumulated}% ${accumulated + pct}%, `;
    accumulated += pct;
    donutLegend.push({ cat, tot, pct, color });
  }
  conicStops = conicStops.slice(0, -2);

  el.innerHTML = `
    <div class="card" style="text-align:center;padding:var(--space-xl)">
      <div style="font-size:var(--font-xs);font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:var(--space-md)">Spese per categoria</div>
      <div style="width:180px;height:180px;border-radius:50%;background:conic-gradient(${conicStops});margin:0 auto;position:relative">
        <div style="position:absolute;inset:35px;border-radius:50%;background:var(--bg-card);display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="font-size:var(--font-xl);font-weight:800;color:var(--text-primary)">€${totaleUscite.toFixed(0)}</div>
          <div style="font-size:var(--font-xs);color:var(--text-muted)">totale</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:var(--space-md)">
        ${donutLegend.map(d => `
          <div style="display:flex;align-items:center;gap:4px;font-size:var(--font-xs)">
            <span style="width:8px;height:8px;border-radius:2px;background:${d.color};display:inline-block"></span>
            <span style="color:var(--text-secondary)">${d.cat} ${d.pct.toFixed(0)}%</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm);margin-top:var(--space-sm)">
      <div class="card" style="text-align:center">
        <div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:4px">Media mensile</div>
        <div style="font-size:var(--font-xl);font-weight:700;color:var(--danger)">€${mediaMensile.toFixed(0)}</div>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:4px">Transazioni totali</div>
        <div style="font-size:var(--font-xl);font-weight:700">${uscite.length}</div>
      </div>
    </div>

    <div class="card" style="margin-top:var(--space-sm)">
      <div style="font-size:var(--font-xs);font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:var(--space-md)">Trend 12 mesi</div>
      <div style="display:flex;align-items:flex-end;gap:4px;height:100px">
        ${trend12.map(d => {
          const h = d.total > 0 ? Math.max(4, (d.total / maxTrend) * 90) : 0;
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
              <div style="width:100%;height:${h}px;background:var(--gradient-accent);border-radius:3px 3px 0 0;transition:height 0.4s" title="€${d.total.toFixed(2)}"></div>
              <span style="font-size:8px;color:var(--text-muted)">${d.label}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="card" style="margin-top:var(--space-sm)">
      <div style="font-size:var(--font-xs);font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:var(--space-md)">Spesa media per giorno</div>
      <div style="display:flex;align-items:flex-end;gap:8px;height:80px">
        ${[1,2,3,4,5,6,0].map(i => {
          const h = mediaGiorno[i] > 0 ? Math.max(4, (mediaGiorno[i] / maxMediaGiorno) * 70) : 0;
          const isWeekend = i === 0 || i === 6;
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
              <div style="font-size:9px;color:var(--text-muted);font-weight:600">€${mediaGiorno[i].toFixed(0)}</div>
              <div style="width:100%;height:${h}px;background:${isWeekend ? 'var(--accent-secondary)' : 'var(--accent)'};border-radius:3px 3px 0 0;transition:height 0.4s"></div>
              <span style="font-size:10px;color:var(--text-muted);font-weight:${isWeekend ? '700' : '400'}">${GIORNI[i]}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    ${topSpese.length > 0 ? `
      <div class="card" style="margin-top:var(--space-sm)">
        <div style="font-size:var(--font-xs);font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:var(--space-sm)">Top 5 spese</div>
        ${topSpese.map((t, i) => `
          <div style="display:flex;align-items:center;gap:var(--space-sm);padding:8px 0;${i < topSpese.length - 1 ? 'border-bottom:1px solid var(--border-light)' : ''}">
            <div style="width:24px;height:24px;border-radius:var(--radius-full);background:var(--danger-soft);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--danger);flex-shrink:0">${i + 1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:var(--font-sm);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.descrizione || t.categoria}</div>
              <div style="font-size:var(--font-xs);color:var(--text-muted)">${new Date(t.data).toLocaleDateString('it-IT')} · ${t.categoria}</div>
            </div>
            <div style="font-weight:700;color:var(--danger);font-size:var(--font-sm);flex-shrink:0">€${t.importo.toFixed(2)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  `;
}

// ── Buoni Pasto ──

async function loadBuoniPasto() {
  const el = document.getElementById('buoni-content');
  if (!el) return;

  const buoni = await db.getAll('buoni_pasto');
  const valoreBuono = (await db.getSetting('valore_buono_pasto')) || 8;
  const totaleBuoni = (await db.getSetting('totale_buoni_pasto')) || 0;

  const utilizzati = buoni.filter(b => b.tipo === 'utilizzo');
  const aggiunti = buoni.filter(b => b.tipo === 'ricarica');

  const totaleAggiunti = aggiunti.reduce((s, b) => s + (b.quantita || 0), 0) + totaleBuoni;
  const totaleUsati = utilizzati.reduce((s, b) => s + (b.quantita || 0), 0);
  const rimanenti = totaleAggiunti - totaleUsati;
  const valoreRimanente = rimanenti * valoreBuono;

  const now = new Date();
  const meseUtilizzi = utilizzati.filter(b => {
    const d = new Date(b.data);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const usatiMese = meseUtilizzi.reduce((s, b) => s + (b.quantita || 0), 0);

  const giorniLavorativi = contaGiorniLavorativiRimanenti(now);
  const stimaCopertura = giorniLavorativi > 0 ? Math.min(rimanenti, giorniLavorativi) : rimanenti;

  el.innerHTML = `
    <div style="background:var(--gradient-card-green);border-radius:var(--radius-md);padding:var(--space-xl);text-align:center;margin-bottom:var(--space-md);border:1px solid var(--border)">
      <div style="font-size:48px;margin-bottom:var(--space-sm)">🎫</div>
      <div style="font-size:var(--font-hero);font-weight:800;color:var(--text-primary)">${rimanenti}</div>
      <div style="font-size:var(--font-sm);color:var(--text-secondary);margin-top:4px">buoni disponibili</div>
      <div style="font-size:var(--font-lg);font-weight:700;color:var(--success);margin-top:8px">€${valoreRimanente.toFixed(2)}</div>
      <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:2px">valore totale (€${valoreBuono}/buono)</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-sm);margin-bottom:var(--space-md)">
      <div class="card" style="text-align:center">
        <div style="font-size:var(--font-xl);font-weight:700;color:var(--accent)">${usatiMese}</div>
        <div style="font-size:var(--font-xs);color:var(--text-secondary)">usati questo mese</div>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:var(--font-xl);font-weight:700;color:var(--accent-secondary)">${stimaCopertura}</div>
        <div style="font-size:var(--font-xs);color:var(--text-secondary)">giorni coperti</div>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:var(--font-xl);font-weight:700">${totaleUsati}</div>
        <div style="font-size:var(--font-xs);color:var(--text-secondary)">usati totale</div>
      </div>
    </div>

    <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-md)">
      <button id="buono-use" class="btn btn-primary" style="flex:1;border-radius:var(--radius-md)">
        <span style="margin-right:6px">🎫</span> Usa buono
      </button>
      <button id="buono-settings" class="btn btn-ghost" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px">
        ⚙️
      </button>
    </div>

    <div id="buoni-history">
      ${buoni.length > 0 ? `
        <div class="section-title">Storico</div>
        ${buoni.sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 15).map(b => `
          <div class="list-item" data-id="${b.id}">
            <div style="width:36px;height:36px;border-radius:10px;background:${b.tipo === 'utilizzo' ? 'var(--danger-soft)' : 'var(--success-soft)'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">
              ${b.tipo === 'utilizzo' ? '🍽️' : '➕'}
            </div>
            <div class="item-text">
              <div class="item-title" style="font-size:var(--font-sm)">${b.descrizione || (b.tipo === 'utilizzo' ? 'Buono utilizzato' : 'Ricarica buoni')}</div>
              <div class="item-subtitle">${new Date(b.data).toLocaleDateString('it-IT')} · ${b.quantita} buon${b.quantita === 1 ? 'o' : 'i'}</div>
            </div>
            <div style="font-weight:600;font-size:var(--font-sm);color:${b.tipo === 'utilizzo' ? 'var(--danger)' : 'var(--success)'}">
              ${b.tipo === 'utilizzo' ? '-' : '+'}${b.quantita}
            </div>
          </div>
        `).join('')}
      ` : `
        <div class="empty-state">
          <div class="icon">🎫</div>
          <p>Nessun movimento registrato.<br>Usa il pulsante + per aggiungere buoni o registra un utilizzo.</p>
        </div>
      `}
    </div>
  `;

  document.getElementById('buono-use').addEventListener('click', () => quickUseBuono(rimanenti));
  document.getElementById('buono-settings').addEventListener('click', () => openBuonoSettings(valoreBuono, totaleBuoni));

  el.querySelectorAll('.list-item[data-id]').forEach(item => {
    item.addEventListener('click', () => deleteBuono(Number(item.dataset.id)));
  });
}

async function quickUseBuono(rimanenti) {
  if (rimanenti <= 0) {
    const { show: toast } = await import('../components/toast.js');
    toast('Nessun buono disponibile!');
    return;
  }

  modal.open('Usa buono pasto', `
    <form>
      <div class="form-group">
        <label class="form-label">Quanti buoni?</label>
        <input type="number" name="quantita" class="input-field" value="1" min="1" max="${rimanenti}" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Dove? (opzionale)</label>
        <input type="text" name="descrizione" class="input-field" placeholder="Es. Ristorante, mensa...">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Conferma</button>
    </form>
  `, async (data) => {
    await db.add('buoni_pasto', {
      tipo: 'utilizzo',
      quantita: parseInt(data.quantita) || 1,
      descrizione: data.descrizione || null,
      data: new Date().toISOString()
    });
    emit('data-changed', { source: 'buoni' });
    loadBuoniPasto();
  });
}

function openAddBuono() {
  modal.open('Aggiungi buoni pasto', `
    <form>
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select name="tipo" class="input-field">
          <option value="ricarica">Ricarica / Aggiunta</option>
          <option value="utilizzo">Utilizzo</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Quantità buoni</label>
        <input type="number" name="quantita" class="input-field" value="1" min="1" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Descrizione (opzionale)</label>
        <input type="text" name="descrizione" class="input-field" placeholder="Es. Ricarica mensile">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Salva</button>
    </form>
  `, async (data) => {
    await db.add('buoni_pasto', {
      tipo: data.tipo,
      quantita: parseInt(data.quantita) || 1,
      descrizione: data.descrizione || null,
      data: new Date().toISOString()
    });
    emit('data-changed', { source: 'buoni' });
    loadBuoniPasto();
  });
}

function openBuonoSettings(currentValore, currentTotale) {
  modal.open('Impostazioni Buoni Pasto', `
    <form>
      <div class="form-group">
        <label class="form-label">Valore singolo buono (€)</label>
        <input type="number" step="0.50" name="valore" class="input-field" value="${currentValore}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Buoni iniziali (saldo di partenza)</label>
        <input type="number" name="totale" class="input-field" value="${currentTotale}" min="0">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Salva</button>
    </form>
  `, async (data) => {
    await db.setSetting('valore_buono_pasto', parseFloat(data.valore) || 8);
    await db.setSetting('totale_buoni_pasto', parseInt(data.totale) || 0);
    loadBuoniPasto();
  });
}

async function deleteBuono(id) {
  if (confirm('Eliminare questo movimento?')) {
    await db.del('buoni_pasto', id);
    emit('data-changed', { source: 'buoni' });
    loadBuoniPasto();
  }
}

function contaGiorniLavorativiRimanenti(fromDate) {
  const now = new Date(fromDate);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let count = 0;
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  while (d <= endOfMonth) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// ── Panoramica (finanze originali) ──

async function loadData() {
  const all = await db.getAll('transazioni');
  const now = new Date();
  const mese = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  const periodoEl = document.getElementById('finanze-periodo');
  if (periodoEl) periodoEl.textContent = mese.charAt(0).toUpperCase() + mese.slice(1);

  const meseCorrente = all.filter(t => {
    const d = new Date(t.data);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const uscite = meseCorrente.filter(t => t.tipo === 'uscita');
  const entrate = meseCorrente.filter(t => t.tipo === 'entrata');
  const totaleUscite = uscite.reduce((s, t) => s + t.importo, 0);
  const totaleEntrate = entrate.reduce((s, t) => s + t.importo, 0);

  const perCategoria = {};
  for (const t of uscite) {
    const cat = t.categoria || 'Altro';
    perCategoria[cat] = (perCategoria[cat] || 0) + t.importo;
  }

  const giorniPassati = now.getDate();
  const mediaGiorno = giorniPassati > 0 ? totaleUscite / giorniPassati : 0;

  const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const mesePrecedente = all.filter(t => {
    const d = new Date(t.data);
    return t.tipo === 'uscita' && d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });
  const totalePrev = mesePrecedente.reduce((s, t) => s + t.importo, 0);
  const diffPct = totalePrev > 0 ? ((totaleUscite / totalePrev - 1) * 100) : 0;

  const catColors = {
    'Alimentazione': '#f87171', 'Casa': '#fbbf24', 'Trasporti': '#60a5fa',
    'Svago': '#a78bfa', 'Salute': '#34d399', 'Abbonamenti': '#f472b6', 'Altro': '#94a3b8'
  };

  await processRicorrenti();

  const summaryEl = document.getElementById('finanze-summary');
  if (!summaryEl) return;

  summaryEl.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:var(--space-sm)">
      <button id="export-report" class="btn btn-ghost" style="font-size:var(--font-xs);padding:6px 12px;border:1px solid var(--border);border-radius:var(--radius-full)">📄 Report mensile</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm);margin-bottom:var(--space-sm)">
      <div class="card">
        <div class="item-subtitle">Uscite</div>
        <div class="item-title" style="font-size:var(--font-xl);color:var(--danger)">-€${totaleUscite.toFixed(2)}</div>
      </div>
      <div class="card">
        <div class="item-subtitle">Entrate</div>
        <div class="item-title" style="font-size:var(--font-xl);color:var(--success)">+€${totaleEntrate.toFixed(2)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm);margin-bottom:var(--space-md)">
      <div class="card">
        <div class="item-subtitle">Media/giorno</div>
        <div class="item-title" style="font-size:var(--font-lg)">€${mediaGiorno.toFixed(2)}</div>
      </div>
      <div class="card">
        <div class="item-subtitle">vs mese scorso</div>
        <div class="item-title" style="font-size:var(--font-lg);color:${diffPct > 0 ? 'var(--danger)' : diffPct < 0 ? 'var(--success)' : 'var(--text-primary)'}">
          ${totalePrev > 0 ? (diffPct > 0 ? '+' : '') + diffPct.toFixed(0) + '%' : '—'}
        </div>
      </div>
    </div>
    ${Object.keys(perCategoria).length > 0 ? `
      <div class="card">
        <div class="card-header"><span class="card-title">Per categoria</span></div>
        ${Object.entries(perCategoria)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, tot]) => {
            const pct = totaleUscite > 0 ? (tot / totaleUscite * 100) : 0;
            const color = catColors[cat] || 'var(--accent)';
            return `
              <div style="margin-bottom:var(--space-sm)">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <span class="item-subtitle">${cat}</span>
                  <span class="item-subtitle">€${tot.toFixed(2)} · ${pct.toFixed(0)}%</span>
                </div>
                <div style="height:6px;background:var(--bg-input);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.3s"></div>
                </div>
              </div>
            `;
          }).join('')}
      </div>
    ` : ''}
  `;

  const exportBtn = document.getElementById('export-report');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportMonthlyReport(meseCorrente, mese, totaleUscite, totaleEntrate, perCategoria, catColors));
  }

  renderChart(all, now);

  const listEl = document.getElementById('finanze-list');
  if (!listEl) return;

  let recenti = all.sort((a, b) => new Date(b.data) - new Date(a.data));

  if (searchQuery) {
    recenti = recenti.filter(t =>
      (t.descrizione || '').toLowerCase().includes(searchQuery) ||
      (t.categoria || '').toLowerCase().includes(searchQuery) ||
      t.importo.toFixed(2).includes(searchQuery)
    );
  }

  recenti = recenti.slice(0, 30);

  if (recenti.length === 0) {
    listEl.innerHTML = searchQuery
      ? `<div class="empty-state"><p>Nessun risultato per "${searchQuery}"</p></div>`
      : `<div class="empty-state"><div class="icon">💰</div><p>Nessuna transazione registrata.<br>Aggiungi una spesa o raccontala in chat!</p></div>`;
    return;
  }

  listEl.innerHTML = `
    <div class="section-title">${searchQuery ? `Risultati (${recenti.length})` : 'Ultime transazioni'}</div>
    ${recenti.map(t => `
      <div class="list-item" data-id="${t.id}">
        <div style="width:36px;height:36px;border-radius:var(--radius-sm);background:${t.tipo === 'uscita' ? 'var(--danger-soft)' : 'var(--success-soft)'};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
          ${t.tipo === 'uscita' ? '↑' : '↓'}
        </div>
        <div class="item-text">
          <div class="item-title">${t.descrizione || t.categoria || 'Transazione'}</div>
          <div class="item-subtitle">${new Date(t.data).toLocaleDateString('it-IT')} · ${t.categoria || ''}</div>
        </div>
        <div style="font-weight:600;color:${t.tipo === 'uscita' ? 'var(--danger)' : 'var(--success)'}">
          ${t.tipo === 'uscita' ? '-' : '+'}€${t.importo.toFixed(2)}
        </div>
      </div>
    `).join('')}
  `;

  listEl.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => deleteTransaction(Number(el.dataset.id)));
  });
}

function renderChart(transactions, now) {
  const chartEl = document.getElementById('finanze-chart');
  if (!chartEl) return;

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth(), year: d.getFullYear(), label: MESI[d.getMonth()] });
  }

  const data = months.map(m => {
    const mTx = transactions.filter(t => {
      const d = new Date(t.data);
      return d.getMonth() === m.month && d.getFullYear() === m.year;
    });
    return {
      label: m.label,
      uscite: mTx.filter(t => t.tipo === 'uscita').reduce((s, t) => s + t.importo, 0),
      entrate: mTx.filter(t => t.tipo === 'entrata').reduce((s, t) => s + t.importo, 0),
    };
  });

  const maxVal = Math.max(1, ...data.map(d => Math.max(d.uscite, d.entrate)));
  const hasData = data.some(d => d.uscite > 0 || d.entrate > 0);

  if (!hasData) {
    chartEl.innerHTML = '';
    return;
  }

  const barH = 120;

  chartEl.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-md)">
      <div class="card-header"><span class="card-title">Ultimi 6 mesi</span></div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:${barH + 30}px;padding-top:var(--space-sm)">
        ${data.map(d => {
          const hU = d.uscite > 0 ? Math.max(4, (d.uscite / maxVal) * barH) : 0;
          const hE = d.entrate > 0 ? Math.max(4, (d.entrate / maxVal) * barH) : 0;
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
              <div style="display:flex;gap:2px;align-items:flex-end;height:${barH}px">
                <div style="width:12px;height:${hU}px;background:var(--danger);border-radius:3px 3px 0 0;transition:height 0.4s" title="Uscite: €${d.uscite.toFixed(2)}"></div>
                <div style="width:12px;height:${hE}px;background:var(--success);border-radius:3px 3px 0 0;transition:height 0.4s" title="Entrate: €${d.entrate.toFixed(2)}"></div>
              </div>
              <span style="font-size:10px;color:var(--text-muted)">${d.label}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:var(--space-md);justify-content:center;margin-top:var(--space-sm)">
        <span style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--danger);display:inline-block"></span>Uscite</span>
        <span style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--success);display:inline-block"></span>Entrate</span>
      </div>
    </div>
  `;
}

async function deleteTransaction(id) {
  if (confirm('Eliminare questa transazione?')) {
    await db.del('transazioni', id);
    emit('data-changed', { source: 'transazione' });
    loadData();
  }
}

function openAddModal() {
  modal.open('Nuova transazione', `
    <form>
      <div class="form-group">
        <label class="form-label">Importo (€)</label>
        <input type="number" step="0.01" name="importo" class="input-field" placeholder="0.00" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select name="tipo" class="input-field">
          <option value="uscita">Uscita</option>
          <option value="entrata">Entrata</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select name="categoria" class="input-field">
          ${CATEGORIE.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Descrizione (opzionale)</label>
        <input type="text" name="descrizione" class="input-field" placeholder="Es. Pranzo al bar">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Salva</button>
    </form>
  `, async (data) => {
    await db.add('transazioni', {
      importo: parseFloat(data.importo),
      tipo: data.tipo,
      categoria: data.categoria,
      descrizione: data.descrizione || null,
      data: new Date().toISOString()
    });
    emit('data-changed', { source: 'transazione' });
    loadData();
  });
}

// ── Transazioni Ricorrenti ──

const FREQ_LABELS = { mensile: 'Mensile', settimanale: 'Settimanale', annuale: 'Annuale', bimestrale: 'Ogni 2 mesi', trimestrale: 'Trimestrale' };

async function processRicorrenti() {
  const ricorrenti = await db.getAll('ricorrenti');
  const today = new Date().toISOString().slice(0, 10);

  for (const r of ricorrenti) {
    if (!r.attiva || !r.prossima) continue;
    while (r.prossima <= today) {
      await db.add('transazioni', {
        importo: r.importo,
        tipo: r.tipo,
        categoria: r.categoria,
        descrizione: `${r.descrizione} (auto)`,
        data: new Date(r.prossima).toISOString()
      });
      r.prossima = calcNextDate(r.prossima, r.frequenza);
      r.ultimaGenerazione = today;
    }
    await db.put('ricorrenti', r);
  }
}

function calcNextDate(dateStr, freq) {
  const d = new Date(dateStr);
  switch (freq) {
    case 'settimanale': d.setDate(d.getDate() + 7); break;
    case 'mensile': d.setMonth(d.getMonth() + 1); break;
    case 'bimestrale': d.setMonth(d.getMonth() + 2); break;
    case 'trimestrale': d.setMonth(d.getMonth() + 3); break;
    case 'annuale': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

async function loadRicorrenti() {
  const el = document.getElementById('ricorrenti-content');
  if (!el) return;

  const ricorrenti = await db.getAll('ricorrenti');

  if (ricorrenti.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔄</div>
        <p>Nessuna spesa ricorrente.<br>Aggiungi affitto, abbonamenti, bollette...</p>
      </div>
    `;
    return;
  }

  const attive = ricorrenti.filter(r => r.attiva);
  const inattive = ricorrenti.filter(r => !r.attiva);
  const totMensile = attive.reduce((s, r) => {
    let monthly = r.importo;
    if (r.frequenza === 'settimanale') monthly = r.importo * 4.33;
    else if (r.frequenza === 'bimestrale') monthly = r.importo / 2;
    else if (r.frequenza === 'trimestrale') monthly = r.importo / 3;
    else if (r.frequenza === 'annuale') monthly = r.importo / 12;
    return s + monthly;
  }, 0);

  el.innerHTML = `
    <div class="card" style="text-align:center;margin-bottom:var(--space-md)">
      <div style="font-size:var(--font-xs);color:var(--text-muted);margin-bottom:4px">Costo fisso mensile stimato</div>
      <div style="font-size:var(--font-hero);font-weight:800;color:var(--danger)">€${totMensile.toFixed(0)}</div>
      <div style="font-size:var(--font-xs);color:var(--text-muted);margin-top:4px">${attive.length} voc${attive.length === 1 ? 'e' : 'i'} attiv${attive.length === 1 ? 'a' : 'e'}</div>
    </div>

    ${attive.length > 0 ? `
      <div class="section-title">Attive</div>
      ${attive.map(r => ricorrenteHTML(r)).join('')}
    ` : ''}

    ${inattive.length > 0 ? `
      <div class="section-title">In pausa</div>
      ${inattive.map(r => ricorrenteHTML(r)).join('')}
    ` : ''}
  `;

  el.querySelectorAll('.ricorrente-item').forEach(item => {
    item.addEventListener('click', () => editRicorrente(Number(item.dataset.id)));
  });

  el.querySelectorAll('.toggle-ricorrente').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await db.get('ricorrenti', Number(btn.dataset.id));
      if (!r) return;
      r.attiva = !r.attiva;
      await db.put('ricorrenti', r);
      emit('data-changed', { source: 'ricorrenti' });
      loadRicorrenti();
    });
  });
}

function ricorrenteHTML(r) {
  const catEmojis = {
    'Alimentazione': '🛒', 'Casa': '🏠', 'Trasporti': '🚗', 'Svago': '🎮',
    'Salute': '🏥', 'Abbonamenti': '📱', 'Altro': '📋'
  };
  const emoji = catEmojis[r.categoria] || '📋';

  return `
    <div class="list-item ricorrente-item" data-id="${r.id}" style="cursor:pointer;${!r.attiva ? 'opacity:0.5' : ''}">
      <div style="width:40px;height:40px;border-radius:12px;background:${r.tipo === 'uscita' ? 'var(--danger-soft)' : 'var(--success-soft)'};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${emoji}</div>
      <div class="item-text">
        <div class="item-title">${r.descrizione}</div>
        <div class="item-subtitle">${FREQ_LABELS[r.frequenza] || r.frequenza} · ${r.categoria}${r.prossima ? ' · Prossima: ' + new Date(r.prossima).toLocaleDateString('it-IT') : ''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div style="font-weight:700;color:${r.tipo === 'uscita' ? 'var(--danger)' : 'var(--success)'};font-size:var(--font-sm)">
          ${r.tipo === 'uscita' ? '-' : '+'}€${r.importo.toFixed(2)}
        </div>
        <button class="toggle-ricorrente" data-id="${r.id}" style="font-size:10px;padding:2px 8px;border-radius:var(--radius-full);border:1px solid var(--border);background:${r.attiva ? 'var(--success-soft)' : 'var(--bg-input)'};color:${r.attiva ? 'var(--success)' : 'var(--text-muted)'};cursor:pointer">
          ${r.attiva ? 'Attiva' : 'Pausa'}
        </button>
      </div>
    </div>
  `;
}

function openAddRicorrente() {
  modal.open('Nuova spesa ricorrente', `
    <form>
      <div class="form-group">
        <label class="form-label">Descrizione</label>
        <input type="text" name="descrizione" class="input-field" placeholder="Es. Affitto, Netflix..." required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Importo (€)</label>
        <input type="number" step="0.01" name="importo" class="input-field" placeholder="0.00" required>
      </div>
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <select name="tipo" class="input-field">
          <option value="uscita">Uscita</option>
          <option value="entrata">Entrata</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Frequenza</label>
        <select name="frequenza" class="input-field">
          <option value="mensile">Mensile</option>
          <option value="settimanale">Settimanale</option>
          <option value="bimestrale">Ogni 2 mesi</option>
          <option value="trimestrale">Trimestrale</option>
          <option value="annuale">Annuale</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select name="categoria" class="input-field">
          ${CATEGORIE.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Prossima data</label>
        <input type="date" name="prossima" class="input-field" value="${new Date().toISOString().slice(0, 10)}" required>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Salva</button>
    </form>
  `, async (data) => {
    await db.add('ricorrenti', {
      descrizione: data.descrizione,
      importo: parseFloat(data.importo),
      tipo: data.tipo,
      frequenza: data.frequenza,
      categoria: data.categoria,
      prossima: data.prossima,
      attiva: true,
      ultimaGenerazione: null
    });
    emit('data-changed', { source: 'ricorrenti' });
    loadRicorrenti();
  });
}

async function editRicorrente(id) {
  const r = await db.get('ricorrenti', id);
  if (!r) return;

  modal.open('Modifica ricorrente', `
    <form>
      <div class="form-group">
        <label class="form-label">Descrizione</label>
        <input type="text" name="descrizione" class="input-field" value="${r.descrizione}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Importo (€)</label>
        <input type="number" step="0.01" name="importo" class="input-field" value="${r.importo}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Frequenza</label>
        <select name="frequenza" class="input-field">
          ${Object.entries(FREQ_LABELS).map(([v, l]) => `<option value="${v}"${r.frequenza === v ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select name="categoria" class="input-field">
          ${CATEGORIE.map(c => `<option value="${c}"${r.categoria === c ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Prossima data</label>
        <input type="date" name="prossima" class="input-field" value="${r.prossima || ''}" required>
      </div>
      <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-md)">
        <button type="submit" class="btn btn-primary" style="flex:1">Salva</button>
        <button type="button" id="del-ricorrente" class="btn btn-ghost" style="color:var(--danger)">Elimina</button>
      </div>
    </form>
  `, async (data) => {
    r.descrizione = data.descrizione;
    r.importo = parseFloat(data.importo);
    r.frequenza = data.frequenza;
    r.categoria = data.categoria;
    r.prossima = data.prossima;
    await db.put('ricorrenti', r);
    emit('data-changed', { source: 'ricorrenti' });
    loadRicorrenti();
  });

  setTimeout(() => {
    const delBtn = document.getElementById('del-ricorrente');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        await db.del('ricorrenti', id);
        modal.close();
        emit('data-changed', { source: 'ricorrenti' });
        loadRicorrenti();
      });
    }
  }, 100);
}

// ── Export Report ──

function exportMonthlyReport(transazioni, meseLabel, totUscite, totEntrate, perCat, catColors) {
  const uscite = transazioni.filter(t => t.tipo === 'uscita').sort((a, b) => new Date(a.data) - new Date(b.data));
  const entrate = transazioni.filter(t => t.tipo === 'entrata').sort((a, b) => new Date(a.data) - new Date(b.data));

  const catRows = Object.entries(perCat).sort((a, b) => b[1] - a[1]).map(([cat, tot]) => {
    const pct = totUscite > 0 ? (tot / totUscite * 100).toFixed(1) : '0';
    return `<tr><td style="padding:6px 12px">${cat}</td><td style="padding:6px 12px;text-align:right;font-weight:600">€${tot.toFixed(2)}</td><td style="padding:6px 12px;text-align:right;color:#888">${pct}%</td></tr>`;
  }).join('');

  const txRows = uscite.map(t => `
    <tr><td style="padding:4px 12px;font-size:13px">${new Date(t.data).toLocaleDateString('it-IT')}</td>
    <td style="padding:4px 12px;font-size:13px">${t.descrizione || t.categoria}</td>
    <td style="padding:4px 12px;font-size:13px">${t.categoria}</td>
    <td style="padding:4px 12px;font-size:13px;text-align:right;font-weight:600;color:#dc3545">-€${t.importo.toFixed(2)}</td></tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Report ${meseLabel} — Focus</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif; max-width:700px; margin:40px auto; padding:20px; color:#333; }
    h1 { font-size:28px; margin-bottom:4px; }
    .subtitle { color:#888; font-size:14px; margin-bottom:32px; }
    .summary { display:flex; gap:16px; margin-bottom:32px; }
    .summary-card { flex:1; padding:20px; border-radius:12px; text-align:center; }
    .summary-card.uscite { background:#fff0f0; }
    .summary-card.entrate { background:#f0fff4; }
    .summary-card .value { font-size:24px; font-weight:800; }
    .summary-card .label { font-size:12px; color:#888; margin-top:4px; }
    h2 { font-size:18px; margin:24px 0 12px; border-bottom:2px solid #eee; padding-bottom:8px; }
    table { width:100%; border-collapse:collapse; }
    table thead th { text-align:left; padding:8px 12px; background:#f8f9fa; font-size:12px; text-transform:uppercase; color:#888; letter-spacing:0.5px; }
    table tbody tr:nth-child(even) { background:#f8f9fa; }
    .footer { margin-top:40px; text-align:center; font-size:12px; color:#aaa; border-top:1px solid #eee; padding-top:16px; }
    @media print { body { margin:0; } }
  </style>
</head>
<body>
  <h1>Report Finanziario</h1>
  <div class="subtitle">${meseLabel.charAt(0).toUpperCase() + meseLabel.slice(1)} — generato il ${new Date().toLocaleDateString('it-IT')}</div>

  <div class="summary">
    <div class="summary-card uscite">
      <div class="value" style="color:#dc3545">-€${totUscite.toFixed(2)}</div>
      <div class="label">Uscite</div>
    </div>
    <div class="summary-card entrate">
      <div class="value" style="color:#28a745">+€${totEntrate.toFixed(2)}</div>
      <div class="label">Entrate</div>
    </div>
  </div>

  <h2>Per Categoria</h2>
  <table>
    <thead><tr><th>Categoria</th><th style="text-align:right">Totale</th><th style="text-align:right">%</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>

  ${txRows ? `
    <h2>Dettaglio Uscite (${uscite.length})</h2>
    <table>
      <thead><tr><th>Data</th><th>Descrizione</th><th>Categoria</th><th style="text-align:right">Importo</th></tr></thead>
      <tbody>${txRows}</tbody>
    </table>
  ` : ''}

  <div class="footer">Focus by DoubleL — Il tuo hub personale intelligente</div>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }
}
