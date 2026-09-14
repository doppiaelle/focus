const { Router } = require('express');
const { getDb } = require('../db');
const { authenticate } = require('../middleware/auth');

function crudRouter(table, { columns, validate } = {}) {
  const router = Router();
  router.use(authenticate);

  router.get('/', (req, res) => {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM ${table} WHERE user_id = ? ORDER BY id DESC`).all(req.user.id);
    res.json(rows);
  });

  router.get('/:id', (req, res) => {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
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
    const values = fields.map(c => req.body[c]);

    const sql = `INSERT INTO ${table} (user_id, ${fields.join(', ')}) VALUES (?, ${fields.map(() => '?').join(', ')})`;
    const result = db.prepare(sql).run(req.user.id, ...values);

    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(row);
  });

  router.put('/:id', (req, res) => {
    if (validate) {
      const err = validate(req.body);
      if (err) return res.status(400).json({ error: err });
    }

    const db = getDb();
    const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Non trovato' });

    const fields = columns.filter(c => req.body[c] !== undefined);
    if (fields.length === 0) return res.status(400).json({ error: 'Nessun campo da aggiornare' });

    const sets = fields.map(c => `${c} = ?`).join(', ');
    const values = fields.map(c => req.body[c]);

    db.prepare(`UPDATE ${table} SET ${sets}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`).run(...values, req.params.id, req.user.id);

    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    res.json(row);
  });

  router.delete('/:id', (req, res) => {
    const db = getDb();
    const result = db.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Non trovato' });
    res.json({ ok: true });
  });

  return router;
}

module.exports = crudRouter;
