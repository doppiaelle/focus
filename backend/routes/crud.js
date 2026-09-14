const { Router } = require('express');
const { getDb } = require('../db');
const { authenticate } = require('../middleware/auth');

const ALLOWED_TABLES = new Set([
  'spesa', 'dispensa', 'transazioni', 'ricorrenti',
  'eventi', 'scadenze', 'buoni_pasto', 'messages',
]);

function sanitize(value) {
  if (typeof value === 'string') return value.slice(0, 2000);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0;
    return value;
  }
  return value;
}

function crudRouter(table, { columns, validate } = {}) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table "${table}" non permessa in CRUD router`);
  }

  const router = Router();
  router.use(authenticate);

  router.get('/', (req, res) => {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM ${table} WHERE user_id = ? ORDER BY id DESC`).all(req.user.id);
    res.json(rows);
  });

  router.get('/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID non valido' });

    const db = getDb();
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Non trovato' });
    res.json(row);
  });

  router.post('/', (req, res) => {
    if (validate) {
      const err = validate(req.body);
      if (err) return res.status(400).json({ error: err });
    }

    const db = getDb();
    const fields = columns.filter(c => req.body[c] !== undefined);
    const values = fields.map(c => sanitize(req.body[c]));

    const sql = `INSERT INTO ${table} (user_id, ${fields.join(', ')}) VALUES (?, ${fields.map(() => '?').join(', ')})`;
    const result = db.prepare(sql).run(req.user.id, ...values);

    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(row);
  });

  router.put('/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID non valido' });

    if (validate) {
      const err = validate(req.body);
      if (err) return res.status(400).json({ error: err });
    }

    const db = getDb();
    const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ? AND user_id = ?`).get(id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Non trovato' });

    const fields = columns.filter(c => req.body[c] !== undefined);
    if (fields.length === 0) return res.status(400).json({ error: 'Nessun campo da aggiornare' });

    const sets = fields.map(c => `${c} = ?`).join(', ');
    const values = fields.map(c => sanitize(req.body[c]));

    db.prepare(`UPDATE ${table} SET ${sets}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`).run(...values, id, req.user.id);

    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    res.json(row);
  });

  router.delete('/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID non valido' });

    const db = getDb();
    const result = db.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).run(id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Non trovato' });
    res.json({ ok: true });
  });

  return router;
}

module.exports = crudRouter;
