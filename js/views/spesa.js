import * as db from '../db.js';
import * as modal from '../components/modal.js';
import { on, emit } from '../store.js';
import { show as toast } from '../components/toast.js';
import { getSuggestions } from '../suggestions.js';

let unsub = null;
let activeTab = 'lista';
let shoppingMode = false;

const PRODUCT_EMOJIS = {
  banana: '🍌', banane: '🍌', mela: '🍎', mele: '🍎', arancia: '🍊', arance: '🍊',
  limone: '🍋', limoni: '🍋', fragola: '🍓', fragole: '🍓', pera: '🍐', pere: '🍐',
  uva: '🍇', anguria: '🍉', melone: '🍈', pesca: '🍑', pesche: '🍑',
  pomodoro: '🍅', pomodori: '🍅', patata: '🥔', patate: '🥔', cipolla: '🧅', cipolle: '🧅',
  aglio: '🧄', carota: '🥕', carote: '🥕', zucchina: '🥒', zucchine: '🥒',
  melanzana: '🍆', melanzane: '🍆', peperone: '🫑', peperoni: '🫑',
  insalata: '🥬', verdura: '🥦', frutta: '🍎', broccoli: '🥦',
  mais: '🌽', fungo: '🍄', funghi: '🍄', avocado: '🥑',
  latte: '🥛', formaggio: '🧀', mozzarella: '🧀', yogurt: '🥛', burro: '🧈',
  uova: '🥚', uovo: '🥚', panna: '🥛', ricotta: '🧀', parmigiano: '🧀', grana: '🧀',
  pollo: '🍗', carne: '🥩', pesce: '🐟', tonno: '🐟', salmone: '🐟',
  gamberi: '🦐', salsiccia: '🌭', salsicce: '🌭', hamburger: '🍔',
  bacon: '🥓', pancetta: '🥓', prosciutto: '🥩', salame: '🥩',
  wurstel: '🌭', vitello: '🥩', maiale: '🥩', manzo: '🥩', bresaola: '🥩',
  pane: '🍞', pasta: '🍝', riso: '🍚', farina: '🌾', biscotti: '🍪', biscotto: '🍪',
  cereali: '🥣', pizza: '🍕', grissini: '🥖', cracker: '🍘', piadina: '🫓',
  acqua: '💧', birra: '🍺', vino: '🍷', caffe: '☕', caffè: '☕',
  te: '🍵', tè: '🍵', succo: '🧃', coca: '🥤', cola: '🥤',
  bottiglia: '🍾', bottiglie: '🍾', lattina: '🥫', lattine: '🥫',
  aranciata: '🍹', limonata: '🍋',
  gelato: '🍦', cioccolato: '🍫', cioccolata: '🍫', nutella: '🍫',
  marmellata: '🍯', miele: '🍯', merendine: '🧁', patatine: '🍟', caramelle: '🍬',
  detersivo: '🧴', sapone: '🧼', shampoo: '🧴', carta: '🧻', scottex: '🧻',
  fazzoletti: '🤧', pannolini: '👶', tovaglioli: '🧻', spugna: '🧽', spugne: '🧽',
  candeggina: '🧪', ammorbidente: '🧴', dentifricio: '🪥', bagnoschiuma: '🛁',
  sacchetti: '🗑️', pellicola: '🎞️', alluminio: '🫙',
  olio: '🫒', aceto: '🫗', sale: '🧂', pepe: '🌶️', zucchero: '🍬',
  passata: '🥫', pelati: '🥫', dado: '🧊', maionese: '🥫', ketchup: '🥫',
  senape: '🥫', pesto: '🌿', sugo: '🍝', olive: '🫒', sottoli: '🫙',
  piselli: '🟢', bastoncini: '🐟', minestrone: '🥣', gnocchi: '🥟', tortellini: '🥟',
  kiwi: '🥝', spinaci: '🥬', broccoli: '🥦', avocado: '🥑',
  mascarpone: '🧀', stracchino: '🧀', philadelphia: '🧀',
  brioche: '🥐', croissant: '🥐', popcorn: '🍿',
  fette: '🍞', grissini: '🥖', piadina: '🫓',
};

const PRODUCT_CATEGORIES = {
  'Frutta e Verdura': ['banana','banane','mela','mele','arancia','arance','limone','limoni','fragola','fragole','pera','pere','uva','anguria','melone','pesca','pesche','pomodoro','pomodori','patata','patate','cipolla','cipolle','aglio','carota','carote','zucchina','zucchine','melanzana','melanzane','peperone','peperoni','insalata','verdura','frutta'],
  'Latticini e Uova': ['latte','formaggio','mozzarella','yogurt','burro','uova','uovo','panna','ricotta','parmigiano','grana'],
  'Carne e Pesce': ['pollo','carne','pesce','tonno','salmone','gamberi','salsiccia','salsicce','hamburger','bacon','pancetta','prosciutto','salame','wurstel','vitello','maiale','manzo','bresaola'],
  'Pane e Pasta': ['pane','pasta','riso','farina','biscotti','biscotto','cereali','pizza','grissini','cracker','piadina'],
  'Bevande': ['acqua','birra','vino','caffe','caffè','te','tè','succo','coca','cola','bottiglia','bottiglie','lattina','lattine','aranciata','limonata'],
  'Dolci e Snack': ['gelato','cioccolato','cioccolata','nutella','marmellata','miele','merendine','patatine','caramelle','brioche','croissant','popcorn'],
  'Condimenti e Conserve': ['olio','aceto','sale','pepe','zucchero','passata','pelati','dado','maionese','ketchup','senape','pesto','sugo','olive','sottoli'],
  'Surgelati': ['piselli surgelati','spinaci surgelati','bastoncini','minestrone','pizza surgelata','patatine fritte','verdure grigliate'],
  'Casa e Igiene': ['detersivo','sapone','shampoo','carta','scottex','fazzoletti','pannolini','tovaglioli','spugna','spugne','candeggina','ammorbidente','dentifricio','bagnoschiuma','sacchetti','pellicola','alluminio'],
};

function getProductEmoji(name) {
  const norm = name.toLowerCase().trim();
  if (PRODUCT_EMOJIS[norm]) return PRODUCT_EMOJIS[norm];
  for (const [key, emoji] of Object.entries(PRODUCT_EMOJIS)) {
    if (norm.includes(key) || key.includes(norm)) return emoji;
  }
  return '📦';
}

function categorizeProduct(name) {
  const norm = name.toLowerCase().trim();
  for (const [cat, words] of Object.entries(PRODUCT_CATEGORIES)) {
    for (const w of words) {
      if (norm === w || norm.includes(w)) return cat;
    }
  }
  return 'Altro';
}

export async function render(container) {
  container.innerHTML = `
    <div class="view-container" id="spesa-normal-view">
      <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1>Spesa</h1>
          <p id="spesa-subtitle"></p>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button id="shopping-mode-btn" class="btn-circle" style="background:var(--bg-card);border:1px solid var(--border)" title="Modalità spesa">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--text-secondary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          </button>
          <button id="share-spesa" class="btn-circle" style="background:var(--bg-card);border:1px solid var(--border)" title="Condividi lista">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--text-secondary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>
      </div>
      <div id="spesa-suggestions"></div>
      <div id="spesa-tabs" style="display:flex;gap:var(--space-xs);margin-bottom:var(--space-md)">
        <button class="spesa-tab active" data-tab="lista" style="flex:1;padding:10px 6px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--accent);color:#fff;border:none;text-align:center;line-height:1.3">🛒 Da comprare</button>
        <button class="spesa-tab" data-tab="catalogo" style="flex:1;padding:10px 6px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--bg-card);color:var(--text-secondary);border:1px solid var(--border-light);text-align:center;line-height:1.3">📋 Catalogo</button>
        <button class="spesa-tab" data-tab="dispensa" style="flex:1;padding:10px 6px;border-radius:var(--radius-md);font-weight:600;font-size:var(--font-sm);transition:all 0.2s;background:var(--bg-card);color:var(--text-secondary);border:1px solid var(--border-light);text-align:center;line-height:1.3">🏠 In casa</button>
      </div>
      <div id="spesa-content"></div>
    </div>
    <div id="shopping-mode-view" style="display:none"></div>
    <button class="fab" id="spesa-add">+</button>
  `;

  container.querySelectorAll('.spesa-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      updateTabs(container);
      loadContent();
    });
  });

  document.getElementById('spesa-add').addEventListener('click', () => {
    if (activeTab === 'lista') openAddSpesa();
    else openAddDispensa();
  });

  document.getElementById('share-spesa').addEventListener('click', shareList);
  document.getElementById('shopping-mode-btn').addEventListener('click', () => enterShoppingMode(container));

  unsub = on('data-changed', () => loadContent());
  await loadContent();
  await loadSuggestions();
}

export function destroy() {
  if (unsub) unsub();
  shoppingMode = false;
}

function updateTabs(container) {
  container.querySelectorAll('.spesa-tab').forEach(btn => {
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

async function loadSuggestions() {
  const el = document.getElementById('spesa-suggestions');
  if (!el) return;

  const suggestions = await getSuggestions(4);
  if (suggestions.length === 0) {
    el.innerHTML = '';
    return;
  }

  const urgencyColors = { terminato: 'var(--danger)', scorta_bassa: 'var(--warning)', pattern: 'var(--accent-secondary)', frequente: 'var(--accent)' };
  const urgencyBg = { terminato: 'var(--danger-soft)', scorta_bassa: 'var(--warning-soft)', pattern: 'var(--accent-secondary-soft)', frequente: 'var(--accent-soft)' };

  el.innerHTML = `
    <div class="section-title" style="display:flex;align-items:center;gap:6px">
      <span>💡</span> Suggeriti per te
    </div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:var(--space-sm);margin-bottom:var(--space-sm);-webkit-overflow-scrolling:touch">
      ${suggestions.map(s => `
        <button class="suggestion-chip" data-nome="${s.nome}" style="flex-shrink:0;display:flex;align-items:center;gap:8px;padding:10px 16px;background:${urgencyBg[s.tipo]};border:1px solid ${urgencyColors[s.tipo]}30;border-radius:var(--radius-full);cursor:pointer;transition:all 0.15s">
          <span style="font-size:18px">${getProductEmoji(s.nome)}</span>
          <div style="text-align:left">
            <div style="font-size:var(--font-sm);font-weight:600;color:var(--text-primary);white-space:nowrap">${s.nome}</div>
            <div style="font-size:10px;color:${urgencyColors[s.tipo]};white-space:nowrap">${s.motivo}</div>
          </div>
        </button>
      `).join('')}
    </div>
  `;

  el.querySelectorAll('.suggestion-chip').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nome = btn.dataset.nome;
      const existing = (await db.getAll('spesa')).find(i => !i.completato && i.nome.toLowerCase() === nome.toLowerCase());
      if (existing) { toast(`${nome} è già nella lista`); return; }
      await db.add('spesa', {
        nome, quantita: 1, unita: null,
        completato: false, dataAggiunta: new Date().toISOString(), dataCompletato: null
      });
      toast(`${nome} aggiunto alla spesa`);
      btn.style.opacity = '0.4';
      btn.style.pointerEvents = 'none';
      emit('data-changed', { source: 'spesa' });
    });
  });
}

async function loadContent() {
  if (shoppingMode) {
    await loadShoppingMode();
    return;
  }
  if (activeTab === 'lista') await loadLista();
  else if (activeTab === 'catalogo') await loadCatalogo();
  else await loadDispensa();
}

async function loadLista() {
  const items = await db.getAll('spesa');
  const contentEl = document.getElementById('spesa-content');
  const subtitleEl = document.getElementById('spesa-subtitle');
  if (!contentEl) return;

  const daComprare = items.filter(i => !i.completato);
  const completati = items.filter(i => i.completato)
    .sort((a, b) => new Date(b.dataCompletato || 0) - new Date(a.dataCompletato || 0));

  subtitleEl.textContent = daComprare.length > 0
    ? `${daComprare.length} prodott${daComprare.length === 1 ? 'o' : 'i'} da comprare`
    : 'Lista vuota';

  if (items.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">🛒</div>
        <p style="font-weight:600;font-size:var(--font-md);margin-bottom:8px">Nessun prodotto da comprare</p>
        <p style="color:var(--text-secondary);font-size:var(--font-sm);line-height:1.6">
          Aggiungi prodotti dal <strong>Catalogo</strong> con un tocco,<br>
          oppure usa il <strong>+</strong> in basso per aggiungere a mano.<br><br>
          Quando li compri, spuntali e finiscono<br>
          automaticamente nella sezione <strong>In casa</strong>.
        </p>
      </div>
    `;
    return;
  }

  contentEl.innerHTML = '';

  if (daComprare.length > 0) {
    const grouped = {};
    for (const item of daComprare) {
      const cat = categorizeProduct(item.nome);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }
    for (const cat of Object.keys(grouped)) {
      grouped[cat].sort((a, b) => (a.ordine ?? 9999) - (b.ordine ?? 9999));
    }

    const catOrder = [...Object.keys(PRODUCT_CATEGORIES), 'Altro'];
    const catIcons = {
      'Frutta e Verdura': '🥬', 'Latticini e Uova': '🥛', 'Carne e Pesce': '🥩',
      'Pane e Pasta': '🍞', 'Condimenti e Conserve': '🫒', 'Surgelati': '🧊',
      'Bevande': '🥤', 'Dolci e Snack': '🍫', 'Casa e Igiene': '🧴', 'Altro': '📦'
    };

    for (const cat of catOrder) {
      if (!grouped[cat]) continue;
      contentEl.innerHTML += `
        <div class="section-title" style="display:flex;align-items:center;gap:6px">
          <span>${catIcons[cat] || '📦'}</span> ${cat} (${grouped[cat].length})
        </div>
      `;
      contentEl.innerHTML += grouped[cat].map(i => spesaItemHTML(i)).join('');
    }
  }

  if (completati.length > 0) {
    contentEl.innerHTML += `
      <div style="margin-top:var(--space-md);display:flex;justify-content:space-between;align-items:center">
        <div class="section-title" style="margin:0">Completati (${completati.length})</div>
        <button id="clear-completati" class="btn btn-ghost" style="font-size:var(--font-xs);padding:4px 8px;color:var(--danger)">Svuota</button>
      </div>
    `;
    contentEl.innerHTML += completati.slice(0, 10).map(i => spesaItemHTML(i)).join('');
  }

  bindListaListeners(contentEl);
  initDragAndDrop(contentEl);
}

function spesaItemHTML(item) {
  const emoji = getProductEmoji(item.nome);
  const qty = item.quantita || 1;
  const qtyText = item.unita ? `${qty} ${item.unita}` : `x${qty}`;

  return `
    <div class="list-item ${item.completato ? 'checked' : ''}" data-id="${item.id}" style="padding:14px var(--space-md)">
      ${!item.completato ? `<div class="drag-handle" data-id="${item.id}" style="cursor:grab;touch-action:none;padding:4px;color:var(--text-muted);font-size:16px;flex-shrink:0;user-select:none">☰</div>` : ''}
      <div class="check" data-id="${item.id}"></div>
      <div style="font-size:22px;flex-shrink:0;width:32px;text-align:center">${emoji}</div>
      <div class="item-text">
        <div class="item-title" style="font-size:var(--font-md)">${item.nome}</div>
        <div class="item-subtitle">${qtyText}</div>
      </div>
      ${!item.completato ? `
        <div class="qty-controls" style="display:flex;align-items:center;gap:2px;flex-shrink:0">
          <button class="qty-btn qty-minus" data-id="${item.id}" style="width:30px;height:30px;border-radius:8px;background:var(--bg-hover);border:1px solid var(--border-light);color:var(--text-secondary);font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s">−</button>
          <span style="min-width:24px;text-align:center;font-size:var(--font-sm);font-weight:700;color:var(--text-primary)">${qty}</span>
          <button class="qty-btn qty-plus" data-id="${item.id}" style="width:30px;height:30px;border-radius:8px;background:var(--accent-soft);border:1px solid var(--accent)30;color:var(--accent);font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s">+</button>
        </div>
      ` : ''}
      <button class="btn btn-ghost btn-icon delete-btn" data-id="${item.id}" style="font-size:14px;color:var(--text-muted);width:28px;height:28px;flex-shrink:0">✕</button>
    </div>
  `;
}

function bindListaListeners(container) {
  container.querySelectorAll('.check').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(el.dataset.id);
      const item = await db.get('spesa', id);
      if (!item) return;

      item.completato = !item.completato;
      item.dataCompletato = item.completato ? new Date().toISOString() : null;
      await db.put('spesa', item);

      if (item.completato) {
        if (navigator.vibrate) navigator.vibrate(50);
        await autoAddToDispensa(item.nome, item.quantita);
        toast(`${item.nome} completato`);
      }

      emit('data-changed', { source: 'spesa' });
      loadContent();
    });
  });

  container.querySelectorAll('.qty-minus').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = await db.get('spesa', Number(el.dataset.id));
      if (!item) return;
      const current = item.quantita || 1;
      if (current <= 1) return;
      item.quantita = current - 1;
      await db.put('spesa', item);
      emit('data-changed', { source: 'spesa' });
      loadContent();
    });
  });

  container.querySelectorAll('.qty-plus').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = await db.get('spesa', Number(el.dataset.id));
      if (!item) return;
      item.quantita = (item.quantita || 1) + 1;
      await db.put('spesa', item);
      emit('data-changed', { source: 'spesa' });
      loadContent();
    });
  });

  container.querySelectorAll('.delete-btn').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = await db.get('spesa', Number(el.dataset.id));
      if (!item || !confirm(`Rimuovere "${item.nome}" dalla lista?`)) return;
      await db.del('spesa', item.id);
      toast(`${item.nome} rimosso`);
      emit('data-changed', { source: 'spesa' });
      loadContent();
    });
  });

  const clearBtn = container.querySelector('#clear-completati');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      const items = await db.getAll('spesa');
      for (const i of items.filter(x => x.completato)) {
        await db.del('spesa', i.id);
      }
      loadContent();
    });
  }
}

// ── Drag & Drop ──

function initDragAndDrop(container) {
  let dragItem = null;
  let dragClone = null;
  let startY = 0;
  let offsetY = 0;

  container.querySelectorAll('.drag-handle').forEach(handle => {
    handle.addEventListener('touchstart', onTouchStart, { passive: false });
    handle.addEventListener('mousedown', onMouseDown);
  });

  function onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    startDrag(handle2item(e.currentTarget), touch.clientY);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }

  function onMouseDown(e) {
    e.preventDefault();
    startDrag(handle2item(e.currentTarget), e.clientY);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function handle2item(handle) {
    return handle.closest('.list-item');
  }

  function startDrag(item, clientY) {
    dragItem = item;
    const rect = item.getBoundingClientRect();
    offsetY = clientY - rect.top;

    dragClone = item.cloneNode(true);
    dragClone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;z-index:9999;opacity:0.9;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,0.3);border-radius:var(--radius-md);background:var(--bg-card);transition:none;`;
    document.body.appendChild(dragClone);

    item.style.opacity = '0.3';
    startY = clientY;
    if (navigator.vibrate) navigator.vibrate(30);
  }

  function onTouchMove(e) {
    e.preventDefault();
    moveDrag(e.touches[0].clientY);
  }
  function onMouseMove(e) { moveDrag(e.clientY); }

  function moveDrag(clientY) {
    if (!dragClone) return;
    dragClone.style.top = (clientY - offsetY) + 'px';

    const siblings = [...container.querySelectorAll('.list-item:not(.checked)')];
    const dragIdx = siblings.indexOf(dragItem);

    for (let i = 0; i < siblings.length; i++) {
      if (i === dragIdx || siblings[i].classList.contains('checked')) continue;
      const rect = siblings[i].getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (clientY < mid && i < dragIdx) {
        siblings[i].before(dragItem);
        break;
      } else if (clientY > mid && i > dragIdx) {
        siblings[i].after(dragItem);
        break;
      }
    }
  }

  function onTouchEnd() {
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    endDrag();
  }
  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    endDrag();
  }

  async function endDrag() {
    if (dragClone) {
      dragClone.remove();
      dragClone = null;
    }
    if (dragItem) {
      dragItem.style.opacity = '';
      const allItems = [...container.querySelectorAll('.list-item:not(.checked)')];
      for (let i = 0; i < allItems.length; i++) {
        const id = Number(allItems[i].dataset.id);
        const item = await db.get('spesa', id);
        if (item) {
          item.ordine = i;
          await db.put('spesa', item);
        }
      }
      dragItem = null;
    }
  }
}

// ── Shopping Mode ──

async function enterShoppingMode(mainContainer) {
  shoppingMode = true;
  const normalView = document.getElementById('spesa-normal-view');
  const shoppingView = document.getElementById('shopping-mode-view');
  const fab = document.getElementById('spesa-add');
  const navbar = document.getElementById('navbar');

  if (normalView) normalView.style.display = 'none';
  if (fab) fab.style.display = 'none';
  if (navbar) navbar.style.display = 'none';
  if (shoppingView) shoppingView.style.display = '';

  await loadShoppingMode();
}

function exitShoppingMode() {
  shoppingMode = false;
  const normalView = document.getElementById('spesa-normal-view');
  const shoppingView = document.getElementById('shopping-mode-view');
  const fab = document.getElementById('spesa-add');
  const navbar = document.getElementById('navbar');

  if (normalView) normalView.style.display = '';
  if (shoppingView) shoppingView.style.display = 'none';
  if (fab) fab.style.display = '';
  if (navbar) navbar.style.display = '';

  loadContent();
  loadSuggestions();
}

async function loadShoppingMode() {
  const el = document.getElementById('shopping-mode-view');
  if (!el) return;

  const items = await db.getAll('spesa');
  const daComprare = items.filter(i => !i.completato);
  const completati = items.filter(i => i.completato);
  const total = daComprare.length + completati.length;
  const progress = total > 0 ? (completati.length / total * 100) : 0;

  el.innerHTML = `
    <div style="min-height:100vh;background:var(--bg-primary);padding:var(--safe-top) 0 var(--space-xl)">
      <div style="padding:var(--space-lg) var(--space-md) var(--space-sm);display:flex;justify-content:space-between;align-items:center">
        <button id="exit-shopping" style="width:40px;height:40px;border-radius:var(--radius-full);background:var(--bg-card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div style="text-align:center">
          <div style="font-size:var(--font-xl);font-weight:800;background:var(--gradient-primary);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Modalità Spesa</div>
          <div style="font-size:var(--font-sm);color:var(--text-secondary)">${daComprare.length} rimast${daComprare.length === 1 ? 'o' : 'i'}</div>
        </div>
        <div style="width:40px"></div>
      </div>

      <div style="padding:0 var(--space-md) var(--space-md)">
        <div style="height:6px;background:var(--bg-input);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${progress}%;background:var(--gradient-primary);border-radius:3px;transition:width 0.4s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px">
          <span style="font-size:var(--font-xs);color:var(--text-muted)">${completati.length}/${total}</span>
          <span style="font-size:var(--font-xs);color:var(--accent);font-weight:700">${progress.toFixed(0)}%</span>
        </div>
      </div>

      <div id="shopping-list" style="padding:0 var(--space-md)">
        ${daComprare.length === 0 ? `
          <div style="text-align:center;padding:var(--space-xl)">
            <div style="font-size:64px;margin-bottom:var(--space-md)">🎉</div>
            <div style="font-size:var(--font-xl);font-weight:700;margin-bottom:8px">Tutto preso!</div>
            <div style="color:var(--text-secondary)">Hai completato la spesa</div>
          </div>
        ` : daComprare.map(item => {
          const emoji = getProductEmoji(item.nome);
          const qty = item.quantita || 1;
          return `
            <div class="shopping-item" data-id="${item.id}" style="display:flex;align-items:center;gap:var(--space-md);padding:20px var(--space-md);background:var(--bg-card);border-radius:var(--radius-md);margin-bottom:8px;border:1px solid var(--border);cursor:pointer;transition:all 0.2s;user-select:none;-webkit-user-select:none">
              <div style="font-size:32px;flex-shrink:0">${emoji}</div>
              <div style="flex:1">
                <div style="font-size:var(--font-lg);font-weight:600">${item.nome}</div>
                <div style="font-size:var(--font-sm);color:var(--text-secondary)">${item.unita ? qty + ' ' + item.unita : 'x' + qty}</div>
              </div>
              <div style="width:44px;height:44px;border-radius:var(--radius-full);border:2.5px solid var(--text-muted);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s"></div>
            </div>
          `;
        }).join('')}
      </div>

      ${completati.length > 0 ? `
        <div style="padding:var(--space-md)">
          <div class="section-title" style="color:var(--success)">Presi (${completati.length})</div>
          ${completati.slice(0, 10).map(item => `
            <div style="display:flex;align-items:center;gap:var(--space-sm);padding:10px var(--space-md);opacity:0.5">
              <span style="font-size:18px">${getProductEmoji(item.nome)}</span>
              <span style="text-decoration:line-through;color:var(--text-muted);font-size:var(--font-sm)">${item.nome}</span>
              <span style="margin-left:auto;color:var(--success);font-size:14px">✓</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('exit-shopping').addEventListener('click', exitShoppingMode);

  el.querySelectorAll('.shopping-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = Number(item.dataset.id);
      const data = await db.get('spesa', id);
      if (!data) return;

      item.style.background = 'var(--success-soft)';
      item.style.borderColor = 'var(--success)';
      item.style.transform = 'scale(0.95)';
      const circle = item.querySelector('div:last-child');
      if (circle) {
        circle.style.background = 'var(--success)';
        circle.style.borderColor = 'var(--success)';
        circle.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      }

      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

      data.completato = true;
      data.dataCompletato = new Date().toISOString();
      await db.put('spesa', data);
      await autoAddToDispensa(data.nome, data.quantita);

      emit('data-changed', { source: 'spesa' });

      setTimeout(() => loadShoppingMode(), 400);
    });
  });
}

// ── Dispensa ──

async function autoAddToDispensa(nome, quantita) {
  const items = await db.getAll('dispensa');
  const norm = nome.toLowerCase();
  const found = items.find(i => {
    const a = i.nome.toLowerCase();
    if (a === norm) return true;
    const rootA = a.replace(/[ei]$/, '').replace(/he$/, '');
    const rootB = norm.replace(/[ei]$/, '').replace(/he$/, '');
    return rootA.length >= 3 && rootA === rootB;
  });

  if (found) {
    found.ultimoAcquisto = new Date().toISOString();
    if (quantita) found.quantita = (found.quantita || 0) + parseFloat(quantita);
    else if (found.quantita === 0) found.quantita = 1;
    await db.put('dispensa', found);
  } else {
    await db.add('dispensa', {
      nome,
      quantita: quantita ? parseFloat(quantita) : 1,
      unita: null,
      ultimoAcquisto: new Date().toISOString(),
      consumoMedio: null,
      stimaEsaurimento: null
    });
  }
}

async function loadDispensa() {
  const items = await db.getAll('dispensa');
  const contentEl = document.getElementById('spesa-content');
  const subtitleEl = document.getElementById('spesa-subtitle');
  if (!contentEl) return;

  subtitleEl.textContent = `${items.length} prodott${items.length === 1 ? 'o' : 'i'} in casa`;

  if (items.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="icon">🏠</div>
        <p style="font-weight:600;font-size:var(--font-md);margin-bottom:8px">Niente in casa (per ora)</p>
        <p style="color:var(--text-secondary);font-size:var(--font-sm);line-height:1.6">
          Qui vedi cosa hai in casa e quanto ne resta.<br><br>
          Si riempie da sola: quando spunti un prodotto<br>
          dalla lista <strong>Da comprare</strong>, arriva qui.<br>
          Quando finisce, ti suggerisce di ricomprarlo.
        </p>
      </div>
    `;
    return;
  }

  const terminati = items.filter(i => i.quantita !== null && i.quantita <= 0);
  const quasiFiniti = items.filter(i => i.quantita !== null && i.quantita > 0 && i.quantita <= 1);
  const disponibili = items.filter(i => i.quantita === null || i.quantita > 1);

  contentEl.innerHTML = '';

  if (terminati.length > 0) {
    contentEl.innerHTML += `<div class="section-title" style="color:var(--danger)">Terminati (${terminati.length})</div>`;
    contentEl.innerHTML += terminati.map(i => dispensaItemHTML(i, 'danger')).join('');
  }

  if (quasiFiniti.length > 0) {
    contentEl.innerHTML += `<div class="section-title" style="color:var(--warning)">Quasi finiti (${quasiFiniti.length})</div>`;
    contentEl.innerHTML += quasiFiniti.map(i => dispensaItemHTML(i, 'warning')).join('');
  }

  if (disponibili.length > 0) {
    contentEl.innerHTML += `<div class="section-title">Disponibili (${disponibili.length})</div>`;
    contentEl.innerHTML += disponibili.map(i => dispensaItemHTML(i, 'ok')).join('');
  }

  bindDispensaListeners(contentEl);
}

function dispensaItemHTML(item, status) {
  const emoji = getProductEmoji(item.nome);
  const statusColors = { danger: 'var(--danger)', warning: 'var(--warning)', ok: 'var(--success)' };
  const statusBg = { danger: 'var(--danger-soft)', warning: 'var(--warning-soft)', ok: 'var(--success-soft)' };
  const qtyText = item.quantita !== null && item.quantita !== undefined
    ? `${item.quantita}${item.unita ? ' ' + item.unita : ''}`
    : '—';
  const lastBuy = item.ultimoAcquisto
    ? new Date(item.ultimoAcquisto).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : '';

  return `
    <div class="list-item" data-id="${item.id}" style="padding:14px var(--space-md)">
      <div style="width:40px;height:40px;border-radius:12px;background:${statusBg[status]};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${emoji}</div>
      <div class="item-text">
        <div class="item-title">${item.nome}</div>
        <div class="item-subtitle">${qtyText}${lastBuy ? ' · comprato ' + lastBuy : ''}</div>
      </div>
      <div style="display:flex;gap:4px">
        ${status === 'danger' ? `<button class="btn-tag btn-tag-add" data-id="${item.id}" title="Aggiungi alla spesa">🛒</button>` : ''}
        ${status !== 'danger' ? `<button class="btn-tag btn-tag-finish" data-id="${item.id}" title="Segna come finito">✕</button>` : ''}
        <button class="btn-tag btn-tag-edit" data-id="${item.id}" title="Modifica">✎</button>
      </div>
    </div>
  `;
}

function bindDispensaListeners(container) {
  container.querySelectorAll('.btn-tag-add').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = await db.get('dispensa', Number(el.dataset.id));
      if (!item) return;
      await db.add('spesa', {
        nome: item.nome, quantita: 1, unita: null,
        completato: false, dataAggiunta: new Date().toISOString(), dataCompletato: null
      });
      toast(`${item.nome} aggiunto alla spesa`);
      emit('data-changed', { source: 'dispensa' });
      loadContent();
    });
  });

  container.querySelectorAll('.btn-tag-finish').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const item = await db.get('dispensa', Number(el.dataset.id));
      if (!item) return;
      item.quantita = 0;
      await db.put('dispensa', item);
      await db.add('spesa', {
        nome: item.nome, quantita: 1, unita: null,
        completato: false, dataAggiunta: new Date().toISOString(), dataCompletato: null
      });
      emit('data-changed', { source: 'dispensa' });
      loadContent();
    });
  });

  container.querySelectorAll('.btn-tag-edit').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      editDispensaItem(Number(el.dataset.id));
    });
  });
}

async function editDispensaItem(id) {
  const item = await db.get('dispensa', id);
  if (!item) return;

  modal.open('Modifica prodotto', `
    <form>
      <div class="form-group">
        <label class="form-label">Prodotto</label>
        <input type="text" name="nome" class="input-field" value="${item.nome}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Quantita</label>
        <input type="text" name="quantita" class="input-field" value="${item.quantita || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Unita (es. kg, litri, pezzi)</label>
        <input type="text" name="unita" class="input-field" value="${item.unita || ''}">
      </div>
      <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-md)">
        <button type="submit" class="btn btn-primary" style="flex:1">Salva</button>
        <button type="button" id="del-dispensa" class="btn btn-ghost" style="color:var(--danger)">Elimina</button>
      </div>
    </form>
  `, async (data) => {
    item.nome = data.nome;
    item.quantita = data.quantita ? parseFloat(data.quantita) : null;
    item.unita = data.unita || null;
    await db.put('dispensa', item);
    emit('data-changed', { source: 'dispensa' });
    loadContent();
  });

  setTimeout(() => {
    const delBtn = document.getElementById('del-dispensa');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        await db.del('dispensa', id);
        modal.close();
        emit('data-changed', { source: 'dispensa' });
        loadContent();
      });
    }
  }, 100);
}

// ── Catalogo ──

const CATALOG = {
  'Frutta e Verdura': ['Banane','Mele','Arance','Limoni','Fragole','Pere','Uva','Anguria','Melone','Pesche','Kiwi','Pomodori','Patate','Cipolle','Carote','Zucchine','Insalata','Peperoni','Melanzane','Aglio','Broccoli','Spinaci','Funghi','Avocado','Mais'],
  'Latticini e Uova': ['Latte','Yogurt','Mozzarella','Formaggio','Burro','Uova','Panna','Ricotta','Parmigiano','Grana','Mascarpone','Stracchino','Philadelphia'],
  'Carne e Pesce': ['Pollo','Carne macinata','Tonno','Salmone','Prosciutto','Pancetta','Salsicce','Bresaola','Vitello','Maiale','Gamberi','Wurstel','Salame','Hamburger'],
  'Pane e Pasta': ['Pane','Pasta','Riso','Farina','Biscotti','Cereali','Cracker','Pizza','Grissini','Piadina','Fette biscottate','Tortellini','Gnocchi'],
  'Condimenti e Conserve': ['Olio','Aceto','Sale','Pepe','Zucchero','Passata','Pelati','Dado','Maionese','Ketchup','Senape','Pesto','Sugo pronto','Olive','Sottoli'],
  'Surgelati': ['Piselli surgelati','Spinaci surgelati','Bastoncini pesce','Minestrone','Pizza surgelata','Gelato','Patatine fritte','Verdure grigliate'],
  'Bevande': ['Acqua','Succo','Birra','Vino','Caffe','Te','Coca Cola','Aranciata','Limonata','Latte vegetale'],
  'Dolci e Snack': ['Cioccolato','Nutella','Marmellata','Miele','Patatine','Merendine','Caramelle','Brioche','Croissant','Popcorn'],
  'Casa e Igiene': ['Detersivo piatti','Detersivo lavatrice','Sapone mani','Shampoo','Carta igienica','Scottex','Dentifricio','Bagnoschiuma','Fazzoletti','Spugne','Candeggina','Ammorbidente','Sacchetti spazzatura','Pellicola','Alluminio'],
};

const catIcons = {
  'Frutta e Verdura': '🥬', 'Latticini e Uova': '🥛', 'Carne e Pesce': '🥩',
  'Pane e Pasta': '🍞', 'Condimenti e Conserve': '🫒', 'Surgelati': '🧊',
  'Bevande': '🥤', 'Dolci e Snack': '🍫', 'Casa e Igiene': '🧴',
};

async function loadCatalogo() {
  const contentEl = document.getElementById('spesa-content');
  const subtitleEl = document.getElementById('spesa-subtitle');
  if (!contentEl) return;

  const spesaItems = await db.getAll('spesa');
  const dispensaItems = await db.getAll('dispensa');

  const inLista = new Set(spesaItems.filter(i => !i.completato).map(i => i.nome.toLowerCase()));
  const inDispensa = new Map();
  for (const d of dispensaItems) {
    inDispensa.set(d.nome.toLowerCase(), d);
  }

  subtitleEl.textContent = 'Tocca per aggiungere alla lista';
  contentEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:12px var(--space-md);background:var(--gradient-card-indigo);border-radius:var(--radius-md);border:1px solid var(--border);margin-bottom:var(--space-md)">
      <span style="font-size:20px">👆</span>
      <div style="font-size:var(--font-xs);color:var(--text-secondary);line-height:1.5">
        Tocca un prodotto per aggiungerlo alla lista <strong style="color:var(--text-primary)">Da comprare</strong>.
        I prodotti <span style="color:var(--danger)">rossi</span> sono finiti, quelli <span style="color:var(--warning)">gialli</span> stanno per finire.
      </div>
    </div>
  `;

  for (const [cat, products] of Object.entries(CATALOG)) {
    const icon = catIcons[cat] || '📦';
    contentEl.innerHTML += `<div class="section-title" style="display:flex;align-items:center;gap:6px"><span>${icon}</span> ${cat}</div>`;

    contentEl.innerHTML += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:var(--space-sm)">
      ${products.map(p => {
        const norm = p.toLowerCase();
        const emoji = getProductEmoji(p);
        const alreadyInList = inLista.has(norm);
        const dispItem = [...inDispensa.entries()].find(([k]) => k === norm || norm.includes(k) || k.includes(norm));
        const inDisp = dispItem ? dispItem[1] : null;
        const terminated = inDisp && inDisp.quantita !== null && inDisp.quantita <= 0;
        const low = inDisp && inDisp.quantita !== null && inDisp.quantita > 0 && inDisp.quantita <= 1;

        let style = 'background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border-light)';
        let badge = '';
        if (alreadyInList) {
          style = 'background:var(--accent-soft);color:var(--accent);border:1px solid var(--accent)';
          badge = ' ✓';
        } else if (terminated) {
          style = 'background:var(--danger-soft);color:var(--danger);border:1px solid var(--danger)';
          badge = ' !';
        } else if (low) {
          style = 'background:var(--warning-soft);color:var(--warning);border:1px solid var(--warning)';
          badge = ' ~';
        }

        return `<button class="catalog-item" data-nome="${p}" style="padding:8px 14px;border-radius:var(--radius-full);font-size:var(--font-sm);font-weight:500;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:6px;${style}"><span>${emoji}</span>${p}${badge}</button>`;
      }).join('')}
    </div>`;
  }

  contentEl.querySelectorAll('.catalog-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nome = btn.dataset.nome;
      const existing = (await db.getAll('spesa')).find(i => !i.completato && i.nome.toLowerCase() === nome.toLowerCase());
      if (existing) {
        toast(`${nome} è già nella lista`);
        return;
      }
      await db.add('spesa', {
        nome, quantita: 1, unita: null,
        completato: false, dataAggiunta: new Date().toISOString(), dataCompletato: null
      });
      toast(`${nome} aggiunto alla spesa`);
      btn.style.background = 'var(--accent-soft)';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
      emit('data-changed', { source: 'spesa' });
    });
  });
}

// ── Share & Add ──

async function shareList() {
  const items = await db.getAll('spesa');
  const daComprare = items.filter(i => !i.completato);
  if (daComprare.length === 0) {
    toast('Lista vuota, niente da condividere');
    return;
  }
  const text = 'Lista della spesa:\n' + daComprare.map(i => {
    const emoji = getProductEmoji(i.nome);
    const qty = i.quantita ? ` (x${i.quantita}${i.unita ? ' ' + i.unita : ''})` : '';
    return `${emoji} ${i.nome}${qty}`;
  }).join('\n');

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Lista della spesa', text });
      toast('Lista condivisa!');
    } catch {}
  } else {
    await navigator.clipboard.writeText(text);
    toast('Lista copiata negli appunti!');
  }
}

function openAddSpesa() {
  modal.open('Aggiungi alla spesa', `
    <form>
      <div class="form-group">
        <label class="form-label">Prodotto</label>
        <input type="text" name="nome" class="input-field" placeholder="Es. Latte" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Quantità</label>
        <input type="number" name="quantita" class="input-field" placeholder="1" value="1" min="1">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Aggiungi</button>
    </form>
  `, async (data) => {
    const items = data.nome.split(/\s*,\s*|\s+e\s+/).map(s => s.trim()).filter(s => s.length > 0);
    for (const nome of items) {
      await db.add('spesa', {
        nome,
        quantita: items.length === 1 && data.quantita ? parseInt(data.quantita) : 1,
        unita: null,
        completato: false,
        dataAggiunta: new Date().toISOString(),
        dataCompletato: null
      });
    }
    toast(items.length === 1 ? `${items[0]} aggiunto alla spesa` : `${items.length} prodotti aggiunti`);
    emit('data-changed', { source: 'spesa' });
    loadContent();
    loadSuggestions();
  });
}

function openAddDispensa() {
  modal.open('Aggiungi alla dispensa', `
    <form>
      <div class="form-group">
        <label class="form-label">Prodotto</label>
        <input type="text" name="nome" class="input-field" placeholder="Es. Riso" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Quantità</label>
        <input type="number" name="quantita" class="input-field" placeholder="1" value="1" min="1">
      </div>
      <div class="form-group">
        <label class="form-label">Unità (es. kg, litri, pezzi)</label>
        <input type="text" name="unita" class="input-field" placeholder="Es. kg">
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:var(--space-sm)">Aggiungi</button>
    </form>
  `, async (data) => {
    await db.add('dispensa', {
      nome: data.nome,
      quantita: data.quantita ? parseFloat(data.quantita) : 1,
      unita: data.unita || null,
      ultimoAcquisto: new Date().toISOString(),
      consumoMedio: null,
      stimaEsaurimento: null
    });
    emit('data-changed', { source: 'dispensa' });
    loadContent();
  });
}
