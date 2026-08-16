import https from 'node:https';
import http from 'node:http';

function request(urlStr, options, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function buildUrl(baseUrl, folder, filename) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const folderClean = String(folder || '').replace(/^\/+|\/+$/g, '');
  const file = filename ? `/${filename}` : '/';
  return `${base}/${encodeURIComponent(folderClean)}${file}`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metodo non supportato' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Body non valido' });
  }

  const { action, baseUrl, username, password, folder = 'TravelMate', filename = 'travelmate-sync.json', data } = body || {};

  if (!baseUrl || !username || !password) {
    return res.status(400).json({ ok: false, error: 'Configurazione mancante: indirizzo NAS, utente e password sono obbligatori' });
  }

  const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  try {
    if (action === 'test') {
      const url = buildUrl(baseUrl, folder, '');
      const r = await request(url, { method: 'PROPFIND', headers: { Authorization: auth, Depth: '0' } });
      if (r.status === 401 || r.status === 403) {
        return res.status(401).json({ ok: false, error: 'Credenziali non valide (401/403). Controlla utente e password QNAP.' });
      }
      if (r.status === 404) {
        return res.status(404).json({ ok: false, error: 'Cartella non trovata. Controlla il nome della cartella condivisa e che WebDAV sia abilitato per essa.' });
      }
      if (!r.ok && r.status >= 400) {
        return res.status(r.status).json({ ok: false, error: `Errore ${r.status}: impossibile raggiungere la cartella.` });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'get') {
      const url = buildUrl(baseUrl, folder, filename);
      const r = await request(url, { method: 'GET', headers: { Authorization: auth } });
      if (r.status === 404) return res.status(200).json({ ok: true, exists: false });
      if (r.status === 401 || r.status === 403) {
        return res.status(401).json({ ok: false, error: 'Credenziali non valide (401/403). Controlla utente e password QNAP.' });
      }
      if (!r.ok && r.status >= 400) {
        return res.status(r.status).json({ ok: false, error: `Errore ${r.status}: ${r.statusText || ''}` });
      }
      return res.status(200).json({ ok: true, exists: true, data: r.text });
    }

    if (action === 'put') {
      if (!data) return res.status(400).json({ ok: false, error: 'Dati mancanti' });
      const url = buildUrl(baseUrl, folder, filename);
      const r = await request(
        url,
        { method: 'PUT', headers: { Authorization: auth, 'Content-Type': 'application/json' } },
        data
      );
      if (r.status === 401 || r.status === 403) {
        return res.status(401).json({ ok: false, error: 'Credenziali non valide (401/403). Controlla utente e password QNAP.' });
      }
      if (r.status === 404) {
        return res.status(404).json({ ok: false, error: 'Cartella non trovata. Controlla che la cartella condivisa esista e che l\'utente abbia permessi di scrittura.' });
      }
      if (!r.ok && r.status >= 400) {
        return res.status(r.status).json({ ok: false, error: `Errore ${r.status}: ${r.statusText || ''}` });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'Azione non valida' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: `Impossibile contattare il NAS: ${e.message}` });
  }
}
