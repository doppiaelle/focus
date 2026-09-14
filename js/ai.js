import * as db from './db.js';
import { isLoggedIn } from './api.js';

function getApiBase() {
  return localStorage.getItem('focus_api_url') || '';
}

function getToken() {
  return localStorage.getItem('focus_token') || '';
}

export async function isAvailable() {
  if (isLoggedIn() && navigator.onLine) {
    try {
      const base = getApiBase();
      const resp = await fetch(base + '/api/ai/status', {
        headers: { 'Authorization': `Bearer ${getToken()}` },
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.online;
      }
    } catch {}
  }

  const url = await getLocalUrl();
  try {
    const resp = await fetch(url + '/api/tags', { signal: AbortSignal.timeout(2000) });
    return resp.ok;
  } catch {
    return false;
  }
}

async function getLocalUrl() {
  return await db.getSetting('ollama_url') || 'http://localhost:11434';
}

export async function getUrl() {
  return getLocalUrl();
}

export async function getModels() {
  if (isLoggedIn() && navigator.onLine) {
    try {
      const base = getApiBase();
      const resp = await fetch(base + '/api/ai/status', {
        headers: { 'Authorization': `Bearer ${getToken()}` },
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.online && data.models) return data.models.map(m => m.name);
      }
    } catch {}
  }

  const url = await getLocalUrl();
  try {
    const resp = await fetch(url + '/api/tags', { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.models || []).map(m => m.name);
  } catch {
    return [];
  }
}

export async function chat(userMessage) {
  const model = await db.getSetting('ollama_model') || 'llama3.2';

  const systemPrompt = `Sei Focus, un assistente personale italiano creato da DoubleL. L'utente ti racconta la sua giornata e tu devi estrarre azioni strutturate.

Rispondi SEMPRE in JSON con questo formato:
{
  "response": "risposta breve e amichevole in italiano",
  "actions": [
    { "type": "spesa_add", "item": "nome prodotto" },
    { "type": "spesa_done", "item": "nome prodotto" },
    { "type": "transazione", "importo": 42, "categoria": "Alimentazione", "descrizione": "supermercato" },
    { "type": "dispensa_add", "item": "nome prodotto", "quantita": 2, "unita": "kg" },
    { "type": "dispensa_update", "item": "nome prodotto", "quantita": 0 }
  ]
}

Categorie valide per le transazioni: Alimentazione, Casa, Trasporti, Svago, Salute, Abbonamenti, Altro.

Se non ci sono azioni da fare, rispondi comunque con "actions": [].`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  if (isLoggedIn() && navigator.onLine) {
    try {
      const base = getApiBase();
      const resp = await fetch(base + '/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ model, messages, stream: false }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const content = data.message?.content;
        if (content) return JSON.parse(content);
      }
    } catch {}
  }

  const url = await getLocalUrl();
  try {
    const resp = await fetch(url + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ model, messages, stream: false, format: 'json' })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    return null;
  }
}
