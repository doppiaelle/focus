const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// API routes
app.use('/api/auth', require('./routes/auth'));
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

// Serve frontend in production
const frontendPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

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
