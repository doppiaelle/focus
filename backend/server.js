const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Trust proxy (behind Caddy/Nginx)
app.set('trust proxy', 1);

// CORS: solo stesso origin in produzione, aperto solo se esplicitamente richiesto
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : [];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS non permesso'));
  },
  credentials: true,
}));

// Rate limit globale
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe richieste, riprova tra poco' },
}));

// Rate limit stretto su auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi, riprova tra 15 minuti' },
});

app.use(express.json({ limit: '1mb' }));

// API routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/spesa', require('./routes/spesa'));
app.use('/api/dispensa', require('./routes/dispensa'));
app.use('/api/transazioni', require('./routes/transazioni'));
app.use('/api/ricorrenti', require('./routes/ricorrenti'));
app.use('/api/eventi', require('./routes/eventi'));
app.use('/api/scadenze', require('./routes/scadenze'));
app.use('/api/buoni', require('./routes/buoni'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/impostazioni', require('./routes/impostazioni'));
app.use('/api/widgets', require('./routes/widgets'));
app.use('/api/ai', require('./routes/ai'));

// Health check (no auth)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Serve frontend
const frontendPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath, { maxAge: '1h' }));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

async function start() {
  await initDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Focus backend running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
