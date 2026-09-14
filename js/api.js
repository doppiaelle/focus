const STORE_TO_ENDPOINT = {
  spesa: '/api/spesa',
  dispensa: '/api/dispensa',
  transazioni: '/api/transazioni',
  ricorrenti: '/api/ricorrenti',
  eventi: '/api/eventi',
  scadenze: '/api/scadenze',
  buoni_pasto: '/api/buoni',
  messages: '/api/messages',
  impostazioni: '/api/impostazioni',
  widget_config: '/api/widgets',
};

function getBaseUrl() {
  return localStorage.getItem('focus_api_url') || '';
}

function getToken() {
  return localStorage.getItem('focus_token') || '';
}

export function setAuth(token, apiUrl) {
  localStorage.setItem('focus_token', token);
  if (apiUrl) localStorage.setItem('focus_api_url', apiUrl);
}

export function clearAuth() {
  localStorage.removeItem('focus_token');
  localStorage.removeItem('focus_api_url');
}

export function isLoggedIn() {
  return !!getToken() && !!getBaseUrl();
}

async function apiFetch(path, options = {}) {
  const base = getBaseUrl();
  if (!base) throw new Error('No API URL configured');

  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(base + path, { ...options, headers, signal: AbortSignal.timeout(10000) });

  if (resp.status === 401) {
    clearAuth();
    window.location.hash = '/login';
    throw new Error('Sessione scaduta');
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${resp.status}`);
  }

  return resp.json();
}

export async function getAll(storeName) {
  const endpoint = STORE_TO_ENDPOINT[storeName];
  if (!endpoint) throw new Error(`Unknown store: ${storeName}`);

  if (storeName === 'impostazioni') {
    const obj = await apiFetch(endpoint);
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  }
  if (storeName === 'widget_config') {
    const obj = await apiFetch(endpoint);
    return Object.entries(obj).map(([key, enabled]) => ({ key, enabled }));
  }
  return apiFetch(endpoint);
}

export async function get(storeName, id) {
  const endpoint = STORE_TO_ENDPOINT[storeName];
  if (!endpoint) throw new Error(`Unknown store: ${storeName}`);

  if (storeName === 'impostazioni') {
    try {
      const result = await apiFetch(`${endpoint}/${id}`);
      return { key: id, value: result.value };
    } catch { return undefined; }
  }
  if (storeName === 'widget_config') {
    const all = await apiFetch(endpoint);
    return all[id] !== undefined ? { key: id, enabled: all[id] } : undefined;
  }
  try { return await apiFetch(`${endpoint}/${id}`); }
  catch { return undefined; }
}

export async function add(storeName, data) {
  const endpoint = STORE_TO_ENDPOINT[storeName];
  if (!endpoint) throw new Error(`Unknown store: ${storeName}`);

  const result = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(data) });
  return result.id;
}

export async function put(storeName, data) {
  const endpoint = STORE_TO_ENDPOINT[storeName];
  if (!endpoint) throw new Error(`Unknown store: ${storeName}`);

  if (storeName === 'impostazioni') {
    await apiFetch(`${endpoint}/${data.key}`, { method: 'PUT', body: JSON.stringify({ value: data.value }) });
    return;
  }
  if (storeName === 'widget_config') {
    await apiFetch(`${endpoint}/${data.key}`, { method: 'PUT', body: JSON.stringify({ enabled: data.enabled }) });
    return;
  }

  if (data.id) {
    await apiFetch(`${endpoint}/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
  } else {
    await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }
}

export async function del(storeName, id) {
  const endpoint = STORE_TO_ENDPOINT[storeName];
  if (!endpoint) throw new Error(`Unknown store: ${storeName}`);
  await apiFetch(`${endpoint}/${id}`, { method: 'DELETE' });
}

export async function clear(storeName) {
  const items = await getAll(storeName);
  for (const item of items) {
    if (item.id) await del(storeName, item.id);
  }
}

export async function getByIndex(storeName, indexName, value) {
  const all = await getAll(storeName);
  return all.filter(item => item[indexName] === value);
}

export async function getSetting(key) {
  const result = await get('impostazioni', key);
  return result ? result.value : null;
}

export async function setSetting(key, value) {
  return put('impostazioni', { key, value });
}

export async function login(apiUrl, username, password) {
  const resp = await fetch(apiUrl + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || 'Login fallito');
  }
  const data = await resp.json();
  setAuth(data.token, apiUrl);
  return data;
}

export async function register(apiUrl, username, password, nome, invite) {
  const resp = await fetch(apiUrl + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, nome, invite }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || 'Registrazione fallita');
  }
  const data = await resp.json();
  setAuth(data.token, apiUrl);
  return data;
}

export async function checkHealth(apiUrl) {
  try {
    const resp = await fetch(apiUrl + '/api/health', { signal: AbortSignal.timeout(5000) });
    return resp.ok;
  } catch { return false; }
}

export function open() {
  return Promise.resolve();
}
