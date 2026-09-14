const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'focus.db');

let db;
let saveTimer;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!db) return;
    const data = db._raw.export();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }, 500);
}

class Statement {
  constructor(db, sql) {
    this._db = db;
    this._sql = sql;
  }

  get(...params) {
    const stmt = this._db.prepare(this._sql);
    if (params.length) stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(...params) {
    const results = [];
    const stmt = this._db.prepare(this._sql);
    if (params.length) stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  run(...params) {
    this._db.run(this._sql, params);
    scheduleSave();
    const changes = this._db.getRowsModified();
    const info = this._db.exec("SELECT last_insert_rowid() as id");
    const lastInsertRowid = info.length > 0 ? info[0].values[0][0] : 0;
    return { changes, lastInsertRowid };
  }
}

class DbWrapper {
  constructor(raw) {
    this._raw = raw;
  }

  prepare(sql) {
    return new Statement(this._raw, sql);
  }

  exec(sql) {
    this._raw.run(sql);
    scheduleSave();
  }

  pragma(str) {
    try { this._raw.run(`PRAGMA ${str}`); } catch {}
  }
}

let initPromise;

function getDb() {
  if (db) return db;
  throw new Error('DB not initialized. Call initDb() first.');
}

async function initDb() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();
    let rawDb;
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      rawDb = new SQL.Database(buffer);
    } else {
      rawDb = new SQL.Database();
    }
    db = new DbWrapper(rawDb);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
    return db;
  })();

  return initPromise;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nome TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS spesa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      nome TEXT NOT NULL,
      quantita REAL DEFAULT 1,
      unita TEXT,
      completato INTEGER DEFAULT 0,
      ordine INTEGER DEFAULT 0,
      data_aggiunta TEXT DEFAULT (datetime('now')),
      data_completato TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dispensa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      nome TEXT NOT NULL,
      quantita REAL,
      unita TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transazioni (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      importo REAL NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrata','uscita')),
      categoria TEXT,
      descrizione TEXT,
      data TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ricorrenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      descrizione TEXT NOT NULL,
      importo REAL NOT NULL,
      categoria TEXT,
      frequenza TEXT NOT NULL,
      prossima TEXT NOT NULL,
      attiva INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS eventi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      titolo TEXT NOT NULL,
      data TEXT NOT NULL,
      ora TEXT,
      luogo TEXT,
      tipo TEXT DEFAULT 'altro',
      note TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scadenze (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      titolo TEXT NOT NULL,
      data TEXT NOT NULL,
      completata INTEGER DEFAULT 0,
      note TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS buoni_pasto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('ricarica','utilizzo')),
      quantita INTEGER DEFAULT 1,
      data TEXT NOT NULL,
      note TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS impostazioni (
      user_id INTEGER NOT NULL REFERENCES users(id),
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (user_id, key)
    );

    CREATE TABLE IF NOT EXISTS widget_config (
      user_id INTEGER NOT NULL REFERENCES users(id),
      key TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      PRIMARY KEY (user_id, key)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now'))
    );
  `);

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_spesa_user ON spesa(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_dispensa_user ON dispensa(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_transazioni_user_data ON transazioni(user_id, data)',
    'CREATE INDEX IF NOT EXISTS idx_ricorrenti_user ON ricorrenti(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_eventi_user_data ON eventi(user_id, data)',
    'CREATE INDEX IF NOT EXISTS idx_scadenze_user ON scadenze(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_buoni_user ON buoni_pasto(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id)',
  ];
  for (const idx of indexes) db.exec(idx);
}

module.exports = { getDb, initDb };
