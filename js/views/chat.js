import * as db from '../db.js';
import { parseMessage } from '../parser.js';
import * as ai from '../ai.js';
import { emit } from '../store.js';
import { show as toast } from '../components/toast.js';

let ollamaAvailable = false;
let recognition = null;
let isRecording = false;
let ttsEnabled = true;

export function destroy() {
  if (recognition) {
    try { recognition.abort(); } catch {}
    recognition = null;
  }
  isRecording = false;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export async function render(container) {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeech = !!SpeechRec;

  container.innerHTML = `
    <div class="chat-view">
      <div class="chat-header">
        <div>
          <h1>Chat</h1>
          <p id="ai-status"><span class="status-dot offline"></span> Verifica connessione...</p>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button id="clear-chat" class="btn-circle btn-circle-sm" title="Pulisci chat" style="background:var(--bg-input);border:1px solid var(--border)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          <button id="tts-toggle" class="btn-circle btn-circle-sm" title="Attiva/disattiva voce" style="background:var(--bg-input);border:1px solid var(--border)">
            <svg id="tts-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
        </div>
      </div>
      <div id="chat-messages" style="flex:1;overflow-y:auto;padding:var(--space-sm) 0 72px"></div>
      <div id="chat-toast" class="chat-toast"></div>
      <div class="chat-input-bar">
        <form id="chat-form" class="chat-form">
          ${hasSpeech ? `
            <button type="button" id="mic-btn" class="btn-circle mic-btn" title="Registra voce">
              <svg id="mic-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
          ` : ''}
          <input type="text" id="chat-input" class="chat-input" placeholder="Scrivi qualcosa..." autocomplete="off">
          <button type="submit" class="btn-circle send-btn">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  `;

  const messagesEl = document.getElementById('chat-messages');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');

  checkAiStatus();

  const ttsToggle = document.getElementById('tts-toggle');
  ttsToggle.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    const icon = document.getElementById('tts-icon');
    icon.style.opacity = ttsEnabled ? '1' : '0.3';
    showChatToast(ttsEnabled ? 'Voce attivata' : 'Voce disattivata');
  });

  document.getElementById('clear-chat').addEventListener('click', async () => {
    const msgs = await db.getAll('messages');
    if (msgs.length === 0) {
      showChatToast('La chat è già vuota');
      return;
    }
    if (!confirm(`Eliminare ${msgs.length} messaggi?`)) return;
    await db.clear('messages');
    showChatToast('Chat pulita');
    messagesEl.innerHTML = '';
    showSuggestionChips(messagesEl, input, form);
  });

  if (hasSpeech) {
    const micBtn = document.getElementById('mic-btn');
    setupSpeechRecognition(input, form);
    micBtn.addEventListener('click', toggleRecording);
  }

  const messages = await db.getAll('messages');
  messages.sort((a, b) => a.timestamp - b.timestamp);

  if (messages.length === 0) {
    showSuggestionChips(messagesEl, input, form);
  } else {
    let lastDate = null;
    for (const msg of messages) {
      const msgDate = new Date(msg.timestamp).toLocaleDateString('it-IT');
      if (msgDate !== lastDate) {
        appendDateSeparator(messagesEl, msg.timestamp);
        lastDate = msgDate;
      }
      appendMessage(messagesEl, msg);
    }
    scrollToBottom(messagesEl);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    await processMessage(text, messagesEl);
  });

  input.focus();
}

function showChatToast(text) {
  const toastEl = document.getElementById('chat-toast');
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.add('visible');
  setTimeout(() => toastEl.classList.remove('visible'), 2500);
}

async function processMessage(text, messagesEl) {
  const userMsg = {
    timestamp: Date.now(),
    text,
    sender: 'user',
    parsed: false,
    actions: []
  };

  const msgId = await db.add('messages', userMsg);
  userMsg.id = msgId;
  appendMessage(messagesEl, userMsg);
  scrollToBottom(messagesEl);

  appendTyping(messagesEl);

  let result;

  if (ollamaAvailable) {
    const aiResult = await ai.chat(text);
    if (aiResult && aiResult.response) {
      result = aiResult;
      await executeAiActions(result.actions || []);
    } else {
      result = await parseMessage(text);
    }
  } else {
    result = await parseMessage(text);
  }

  removeTyping(messagesEl);

  const botMsg = {
    timestamp: Date.now(),
    text: result.response,
    sender: 'focus',
    parsed: true,
    actions: result.actions || []
  };

  const botId = await db.add('messages', botMsg);
  botMsg.id = botId;
  appendMessage(messagesEl, botMsg);
  scrollToBottom(messagesEl);

  if (ttsEnabled) {
    speak(result.response);
  }

  if (botMsg.actions.length > 0) {
    emit('data-changed', { source: 'chat', actions: botMsg.actions });
  }
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const cleanText = text.replace(/\*\*/g, '').replace(/[✅📅💰🛒]/g, '');
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'it-IT';
  utterance.rate = 1.05;
  utterance.pitch = 1;

  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const italian = voices.find(v => v.lang.startsWith('it'));
    if (italian) utterance.voice = italian;
    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    setVoice();
  } else {
    window.speechSynthesis.onvoiceschanged = setVoice;
  }
}

let silenceTimer = null;

function setupSpeechRecognition(input, form) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  try {
    recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      input.value = finalTranscript + interimTranscript;

      if (silenceTimer) clearTimeout(silenceTimer);

      if (finalTranscript) {
        silenceTimer = setTimeout(() => {
          if (isRecording) {
            try { recognition.stop(); } catch {}
            stopRecording();
            if (input.value.trim()) {
              form.dispatchEvent(new Event('submit'));
            }
          }
        }, 2000);
      }
    };

    recognition.onerror = (event) => {
      if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
      if (event.error === 'no-speech') {
        if (isRecording && input.value.trim()) {
          try { recognition.stop(); } catch {}
          stopRecording();
          form.dispatchEvent(new Event('submit'));
          return;
        }
        showChatToast('Nessun audio rilevato, riprova');
      } else if (event.error === 'not-allowed') {
        showChatToast('Permesso microfono negato');
      } else if (event.error === 'network') {
        showChatToast('Errore di rete per il riconoscimento vocale');
      } else if (event.error !== 'aborted') {
        showChatToast('Microfono non disponibile');
      }
      stopRecording();
    };

    recognition.onend = () => {
      if (isRecording && input.value.trim()) {
        stopRecording();
        form.dispatchEvent(new Event('submit'));
      } else if (isRecording) {
        stopRecording();
      }
    };
  } catch (e) {
    recognition = null;
  }
}

function toggleRecording() {
  if (!recognition) {
    showChatToast('Riconoscimento vocale non supportato su questo dispositivo');
    return;
  }
  if (isRecording) {
    recognition.stop();
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  if (!recognition) {
    showChatToast('Riconoscimento vocale non disponibile');
    return;
  }
  try {
    isRecording = true;
    const btn = document.getElementById('mic-btn');
    if (btn) btn.classList.add('recording');
    showChatToast('Sto ascoltando...');
    recognition.start();
  } catch (e) {
    stopRecording();
    if (e.message && e.message.includes('already started')) {
      recognition.stop();
      setTimeout(() => {
        try { recognition.start(); isRecording = true; } catch (_) {
          showChatToast('Errore avvio microfono');
        }
      }, 200);
    } else {
      showChatToast('Impossibile avviare il microfono');
    }
  }
}

function stopRecording() {
  isRecording = false;
  if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
  const btn = document.getElementById('mic-btn');
  if (btn) btn.classList.remove('recording');
}

async function checkAiStatus() {
  const statusEl = document.getElementById('ai-status');
  if (!statusEl) return;

  ollamaAvailable = await ai.isAvailable();

  if (ollamaAvailable) {
    const models = await ai.getModels();
    const model = await db.getSetting('ollama_model') || models[0] || 'llama3.2';
    statusEl.innerHTML = `<span class="status-dot online"></span> AI connessa (${model})`;
  } else {
    statusEl.innerHTML = `<span class="status-dot offline"></span> Assistente locale attivo`;
  }
}

async function executeAiActions(actions) {
  for (const action of actions) {
    switch (action.type) {
      case 'spesa_add':
        await db.add('spesa', {
          nome: action.item, quantita: action.quantita || null, unita: action.unita || null,
          completato: false, dataAggiunta: new Date().toISOString(), dataCompletato: null
        });
        break;
      case 'spesa_done':
        await db.add('spesa', {
          nome: action.item, quantita: null, unita: null,
          completato: true, dataAggiunta: new Date().toISOString(), dataCompletato: new Date().toISOString()
        });
        break;
      case 'transazione':
        await db.add('transazioni', {
          importo: action.importo, tipo: 'uscita',
          categoria: action.categoria || 'Altro',
          descrizione: action.descrizione || null,
          data: new Date().toISOString()
        });
        break;
      case 'evento':
        if (action.titolo && action.data) {
          await db.add('eventi', {
            titolo: action.titolo, data: action.data,
            ora: action.ora || null, luogo: action.luogo || null,
            tipo: action.tipo || 'personale', costo: action.costo || null,
            ricorrenza: null, note: null
          });
        }
        break;
      case 'dispensa_add': {
        const items = await db.getAll('dispensa');
        const found = items.find(i => i.nome.toLowerCase() === action.item.toLowerCase());
        if (found) {
          found.ultimoAcquisto = new Date().toISOString();
          if (action.quantita) found.quantita = (found.quantita || 0) + action.quantita;
          await db.put('dispensa', found);
        } else {
          await db.add('dispensa', {
            nome: action.item, quantita: action.quantita || null, unita: action.unita || null,
            ultimoAcquisto: new Date().toISOString(), consumoMedio: null, stimaEsaurimento: null
          });
        }
        break;
      }
      case 'dispensa_update': {
        const items = await db.getAll('dispensa');
        const found = items.find(i => i.nome.toLowerCase() === action.item.toLowerCase());
        if (found) {
          if (action.quantita !== undefined) found.quantita = action.quantita;
          await db.put('dispensa', found);
        }
        break;
      }
    }
  }
}

function showSuggestionChips(messagesEl, input, form) {
  const suggestions = [
    { text: 'compra pane e uova', icon: '🍞' },
    { text: 'latte 2 euro', icon: '🥛' },
    { text: 'ho speso 30 euro al supermercato', icon: '💰' },
    { text: 'ho il dentista giovedì', icon: '🏥' },
    { text: 'è finito il latte', icon: '📦' },
    { text: 'quanto ho speso?', icon: '📊' },
  ];

  messagesEl.innerHTML = `
    <div class="chat-chips-intro">
      <div style="font-size:48px;margin-bottom:var(--space-md);opacity:0.3">💬</div>
      <p style="font-size:var(--font-md);font-weight:600;color:var(--text-primary);margin-bottom:6px">Focus Chat</p>
      <p>Dimmi cosa hai comprato, cosa devi comprare, o i tuoi impegni. Capisco il linguaggio naturale!</p>
    </div>
    <div class="chat-chips">
      ${suggestions.map(s => `<button class="chat-chip" type="button">${s.icon} ${s.text}</button>`).join('')}
    </div>
  `;

  messagesEl.querySelectorAll('.chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const text = chip.textContent.replace(/^[^\s]+\s/, '').trim();
      input.value = text;
      input.focus();
      messagesEl.innerHTML = '';
      form.dispatchEvent(new Event('submit'));
    });
  });
}

function formatBotText(text) {
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/✅/g, '<span style="color:var(--success)">✅</span>')
    .replace(/📅/g, '<span>📅</span>')
    .replace(/💰/g, '<span>💰</span>')
    .replace(/🛒/g, '<span>🛒</span>')
    .replace(/(€[\d.,]+)/g, '<strong>$1</strong>');
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function appendDateSeparator(container, timestamp) {
  const div = document.createElement('div');
  div.style.cssText = 'text-align:center;padding:16px 0 8px;font-size:11px;color:var(--text-muted);font-weight:600;letter-spacing:0.5px;text-transform:uppercase';
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) div.textContent = 'Oggi';
  else if (d.toDateString() === yesterday.toDateString()) div.textContent = 'Ieri';
  else div.textContent = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });

  container.appendChild(div);
}

function appendMessage(container, msg) {
  const div = document.createElement('div');
  const isUser = msg.sender === 'user';
  div.className = `chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-bot'}`;
  div.dataset.id = msg.id;

  if (isUser) {
    div.textContent = msg.text;
  } else {
    div.innerHTML = formatBotText(msg.text);
  }

  const timeEl = document.createElement('div');
  timeEl.style.cssText = `font-size:10px;color:${isUser ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)'};margin-top:4px;text-align:${isUser ? 'right' : 'left'}`;
  timeEl.textContent = formatTime(msg.timestamp);
  div.appendChild(timeEl);

  if (msg.actions && msg.actions.length > 0 && !isUser) {
    const tags = document.createElement('div');
    tags.className = 'chat-action-tags';
    for (const a of msg.actions) {
      const tag = document.createElement('span');
      tag.className = 'chat-action-tag';
      const icons = { spesa_add: '🛒', spesa: '🛒', transazione: '💰', evento: '📅', scadenza: '⏰', dispensa_add: '🏠', dispensa_update: '🏠' };
      tag.textContent = `${icons[a.type] || '✓'} ${a.item || a.descrizione || a.titolo || ''}`.trim();
      tags.appendChild(tag);
    }
    div.appendChild(tags);
  }

  div.addEventListener('long-press', () => deleteMessage(msg.id, div));
  let pressTimer = null;
  div.addEventListener('touchstart', (e) => {
    pressTimer = setTimeout(() => deleteMessage(msg.id, div), 600);
  }, { passive: true });
  div.addEventListener('touchend', () => clearTimeout(pressTimer));
  div.addEventListener('touchmove', () => clearTimeout(pressTimer));

  container.appendChild(div);
}

async function deleteMessage(id, element) {
  if (!confirm('Eliminare questo messaggio?')) return;
  await db.del('messages', id);
  element.style.transition = 'opacity 0.2s, transform 0.2s';
  element.style.opacity = '0';
  element.style.transform = 'scale(0.9)';
  setTimeout(() => element.remove(), 200);
  toast('Messaggio eliminato');
}

function appendTyping(container) {
  const div = document.createElement('div');
  div.id = 'typing-indicator';
  div.className = 'chat-bubble chat-bubble-bot';
  div.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
  container.appendChild(div);
}

function removeTyping(container) {
  const el = container.querySelector('#typing-indicator');
  if (el) el.remove();
}

function scrollToBottom(el) {
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
    setTimeout(() => { el.scrollTop = el.scrollHeight; }, 100);
  });
}
