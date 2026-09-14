import * as db from '../db.js';
import * as modal from '../components/modal.js';
import { on, emit } from '../store.js';

let unsub = null;
let activeTab = 'panoramica';

const CATEGORIE = ['Alimentazione', 'Casa', 'Trasporti', 'Svago', 'Salute', 'Abbonamenti', 'Altro'];
const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export async function render(container) {
  container.innerHTML = `
    <div class="view-container">
      <div class="view-header">
        <h1>Finanze</h1>
        <p id="finanze-periodo"></p>
      </div>
      <div id="finanze-tabs" style="display:flex;gap:var(--space-xs);margin-bottom:var(--space-md)">
        <button class="fin-tab active" data-tab="panoramica" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--accent);color:#fff;border:none">Panoramica</button>
        <button class="fin-tab" data-tab="buoni" style="flex:1;padding:10px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--bg-card);color:var(--text-secondary);border:1px solid var(--border-light)">Buoni Pasto</button>
      </div>
      <div id="finanze-content">
        <div id="finanze-summary"></div>
        <div id="finanze-chart"></div>
        <div id="finanze-list"></div>
      </div>
      <div id="buoni-content" style="display:none"></div>
    </div>
    <button class="fab" id="finanze-add">+</button>
  `;

  container.querySelectorAll('.fin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      updateFinTabs(container);
      if (activeTab === 'panoramica') {
        document.getElementById('finanze-content').style.display = '';
        document.getElementById('buoni-content').style.display = 'none';
        loadData();
      } else {
        document.getElementById('finanze-content').style.display = 'none';
        document.getElementById('buoni-content').style.display = '';
        loadBuoniPasto();
      }
    });
  });

  const fab = document.getElementById('finanze-add');
  fab.addEventListener('click', () => {
    if (activeTab === 'buoni') openAddBuono();
    else openAddModal();
  });
  unsub = on('data-changed', () => {
    if (activeTab === 'panoramica') loadData();
    else loadBuoniPasto();
  });

  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const st = window.scrollY || document.documentElement.scrollTop;
    fab.classList.toggle('fab-hidden', st > lastScroll && st > 100);
    lastScroll = st;
  }, { passive: true });

  await loadData();
}

export function destroy() {
  if (unsub) unsub();
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

  const summaryEl = document.getElementById('finanze-summary');
  if (!summaryEl) return;

  summaryEl.innerHTML = `
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

  renderChart(all, now);

  const listEl = document.getElementById('finanze-list');
  if (!listEl) return;
  const recenti = all.sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 20);

  if (recenti.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">💰</div>
        <p>Nessuna transazione registrata.<br>Aggiungi una spesa o raccontala in chat!</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = `
    <div class="section-title">Ultime transazioni</div>
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
