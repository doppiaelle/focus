const { Router } = require('express');
const { authenticate } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

router.post('/chat', async (req, res) => {
  const { model, messages, stream } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array richiesto' });
  }

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3.2',
        messages,
        stream: !!stream,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Ollama error: ${text}` });
    }

    if (stream) {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Transfer-Encoding', 'chunked');
      const reader = response.body;
      reader.pipe(res);
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (err) {
    res.status(502).json({ error: `Ollama non raggiungibile: ${err.message}` });
  }
});

router.get('/status', async (_req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      res.json({ online: true, models: data.models || [] });
    } else {
      res.json({ online: false });
    }
  } catch {
    res.json({ online: false });
  }
});

module.exports = router;
