const { Router } = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db');
const { generateToken, authenticate } = require('../middleware/auth');

const router = Router();

const INVITE_CODE = process.env.INVITE_CODE || null;

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

router.post('/register', async (req, res) => {
  const { username, password, nome, invite } = req.body;

  if (INVITE_CODE && invite !== INVITE_CODE) {
    return res.status(403).json({ error: 'Codice invito non valido' });
  }

  if (!username || !PASSWORD_OK(password)) {
    return res.status(400).json({ error: 'Username (3-30 alfanumerico) e password (minimo 8 caratteri) richiesti' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username: solo lettere, numeri e _ (3-30 caratteri)' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username già in uso' });
  }

  const hash = await bcrypt.hash(password, 12);
  const safeName = nome ? String(nome).slice(0, 100) : null;
  const result = db.prepare('INSERT INTO users (username, password, nome) VALUES (?, ?, ?)').run(username, hash, safeName);

  const user = { id: result.lastInsertRowid, username };
  res.status(201).json({ token: generateToken(user), user: { id: user.id, username, nome: safeName } });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password richiesti' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).slice(0, 30));
  if (!user) {
    await bcrypt.hash('dummy', 12);
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  const valid = await bcrypt.compare(String(password), user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  res.json({ token: generateToken(user), user: { id: user.id, username: user.username, nome: user.nome } });
});

router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, nome, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utente non trovato' });
  res.json(user);
});

function PASSWORD_OK(p) {
  return typeof p === 'string' && p.length >= 8 && p.length <= 128;
}

module.exports = router;
