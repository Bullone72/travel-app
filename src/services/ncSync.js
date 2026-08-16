import { getSetting, saveSetting } from './database';

const KEYS = {
  server: 'nc_server',
  user: 'nc_user',
  password: 'nc_password',
  folder: 'nc_folder',
  auto: 'nc_auto',
  lastSync: 'nc_last_sync',
};

export const SYNC_FILE = 'travelmate-sync.json';

export async function getNcConfig() {
  const [server, username, password, folder] = await Promise.all([
    getSetting(KEYS.server),
    getSetting(KEYS.user),
    getSetting(KEYS.password),
    getSetting(KEYS.folder),
  ]);
  return { server, username, password, folder: folder || 'TravelMate' };
}

export async function saveNcConfig({ server, username, password, folder }) {
  await Promise.all([
    saveSetting(KEYS.server, server),
    saveSetting(KEYS.user, username),
    saveSetting(KEYS.password, password),
    saveSetting(KEYS.folder, folder || 'TravelMate'),
  ]);
}

export async function getNcAutoSync() {
  return !!(await getSetting(KEYS.auto));
}

export async function setNcAutoSync(value) {
  await saveSetting(KEYS.auto, !!value);
}

export async function getNcLastSync() {
  return (await getSetting(KEYS.lastSync)) || '';
}

export function isNcConfigured(cfg) {
  return !!(cfg && cfg.server && cfg.username && cfg.password);
}

async function callProxy(action, payload) {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Risposta non valida dal server (HTTP ${res.status})`);
  }
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Errore ${res.status}`);
  }
  return json;
}

export async function testConnection() {
  const cfg = await getNcConfig();
  if (!isNcConfigured(cfg)) throw new Error('Configura prima indirizzo, utente e password.');
  await callProxy('test', cfg);
}

export async function pushBackup(data) {
  const cfg = await getNcConfig();
  await callProxy('put', { ...cfg, filename: SYNC_FILE, data: JSON.stringify(data) });
  await saveSetting(KEYS.lastSync, data.exportedAt || new Date().toISOString());
}

export async function pullBackup() {
  const cfg = await getNcConfig();
  const res = await callProxy('get', { ...cfg, filename: SYNC_FILE });
  if (!res.exists) return null;
  try {
    return JSON.parse(res.data);
  } catch {
    return null;
  }
}
