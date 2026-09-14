const { Router } = require('express');
const { getDb } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM impostazioni WHERE user_id = ?').all(req.user.id);
  const obj = {};
  for (const r of rows) {
    try { obj[r.key] = JSON.parse(r.value); } catch { obj[r.key] = r.value; }
  }
  res.json(obj);
});

router.get('/:key', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT value FROM impostazioni WHERE user_id = ? AND key = ?').get(req.user.id, req.params.key);
  if (!row) return res.status(404).json({ error: 'Impostazione non trovata' });
  try { res.json({ key: req.params.key, value: JSON.parse(row.value) }); }
  catch { res.json({ key: req.params.key, value: row.value }); }
});

router.put('/:key', (req, res) => {
  const db = getDb();
  const value = typeof req.body.value === 'string' ? req.body.value : JSON.stringify(req.body.value);
  db.prepare('INSERT OR REPLACE INTO impostazioni (user_id, key, value) VALUES (?, ?, ?)').run(req.user.id, req.params.key, value);
  res.json({ key: req.params.key, value: req.body.value });
});

router.delete('/:key', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM impostazioni WHERE user_id = ? AND key = ?').run(req.user.id, req.params.key);
  if (result.changes === 0) return res.status(404).json({ error: 'Non trovata' });
  res.json({ ok: true });
});

module.exports = router;
