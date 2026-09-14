const { Router } = require('express');
const { getDb } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, enabled FROM widget_config WHERE user_id = ?').all(req.user.id);
  const obj = {};
  for (const r of rows) obj[r.key] = !!r.enabled;
  res.json(obj);
});

router.put('/:key', (req, res) => {
  const db = getDb();
  const enabled = req.body.enabled ? 1 : 0;
  db.prepare('INSERT OR REPLACE INTO widget_config (user_id, key, enabled) VALUES (?, ?, ?)').run(req.user.id, req.params.key, enabled);
  res.json({ key: req.params.key, enabled: !!enabled });
});

module.exports = router;
