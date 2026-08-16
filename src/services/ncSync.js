import { getSetting, saveSetting } from './database';

const KEYS = {
  token: 'gh_token',
  gistId: 'gh_gist_id',
  auto: 'nc_auto',
  lastSync: 'nc_last_sync',
};

export const SYNC_FILE = 'travelmate-sync.json';

const GH_BASE = 'https://api.github.com';

export async function getNcConfig() {
  const [token, gistId] = await Promise.all([getSetting(KEYS.token), getSetting(KEYS.gistId)]);
  return { token, gistId };
}

export async function saveNcConfig({ token }) {
  await saveSetting(KEYS.token, token);
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
  return !!(cfg && cfg.token);
}

async function gh(url, options = {}) {
  const cfg = await getNcConfig();
  if (!cfg.token) throw new Error('Inserisci prima il token GitHub nelle Impostazioni');
  const res = await fetch(GH_BASE + url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${cfg.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `Errore ${res.status}`;
    try {
      const e = await res.json();
      if (e?.message) msg = e.message;
    } catch {
      /* ignore */
    }
    if (res.status === 401 || res.status === 403) {
      msg = 'Token non valido o senza permessi (401/403). Rigenera il token con lo scope "gist".';
    }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export async function testConnection() {
  await gh('/user');
}

export async function pullBackup() {
  const cfg = await getNcConfig();
  if (!cfg.token || !cfg.gistId) return null;
  const gist = await gh(`/gists/${encodeURIComponent(cfg.gistId)}`);
  const file = gist?.files?.[SYNC_FILE];
  if (!file) return null;
  try {
    return JSON.parse(file.content);
  } catch {
    return null;
  }
}

export async function pushBackup(data) {
  const cfg = await getNcConfig();
  if (!cfg.token) throw new Error('Inserisci prima il token GitHub nelle Impostazioni');
  const content = JSON.stringify(data);
  let gistId = cfg.gistId;
  if (!gistId) {
    const created = await gh('/gists', {
      method: 'POST',
      body: JSON.stringify({
        description: 'TravelMate - backup sincronizzato',
        public: false,
        files: { [SYNC_FILE]: { content } },
      }),
    });
    gistId = created.id;
    await saveSetting(KEYS.gistId, gistId);
  } else {
    await gh(`/gists/${encodeURIComponent(gistId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ files: { [SYNC_FILE]: { content } } }),
    });
  }
  await saveSetting(KEYS.lastSync, data.exportedAt || new Date().toISOString());
}
