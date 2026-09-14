const { Router } = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('../db');
const { generateToken, authenticate } = require('../middleware/auth');

const router = Router();

router.post('/register', async (req, res) => {
  const { username, password, nome } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password richiesti' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimo 6 caratteri' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username già in uso' });
  }

  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare('INSERT INTO users (username, password, nome) VALUES (?, ?, ?)').run(username, hash, nome || null);

  const user = { id: result.lastInsertRowid, username };
  res.status(201).json({ token: generateToken(user), user: { id: user.id, username, nome } });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password richiesti' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }

  const valid = await bcrypt.compare(password, user.password);
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

module.exports = router;
