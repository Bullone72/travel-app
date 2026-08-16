import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getSetting, saveSetting } from '../services/database';
import { getNcAutoSync, getNcConfig, saveNcConfig, setNcAutoSync } from '../services/ncSync';

export default function SettingsPage() {
  const { exportAllTrips, importTrips, loadTrips, triggerAutoBackup, syncNow, testNcConnection } = useApp();
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [autoBackup, setAutoBackup] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [keyTestMsg, setKeyTestMsg] = useState('');
  const [testing, setTesting] = useState(false);

  const [ncServer, setNcServer] = useState('');
  const [ncFolder, setNcFolder] = useState('TravelMate');
  const [ncUser, setNcUser] = useState('');
  const [ncPassword, setNcPassword] = useState('');
  const [showNcPw, setShowNcPw] = useState(false);
  const [ncAuto, setNcAuto] = useState(false);
  const [ncMsg, setNcMsg] = useState('');
  const [ncBusy, setNcBusy] = useState(false);

  function cleanKey(value) {
    return value.replace(/\s+/g, '').trim();
  }

  useEffect(() => {
    getSetting('openrouter_api_key').then(v => v && setOpenrouterKey(v));
    getSetting('auto_backup').then(v => setAutoBackup(!!v));
    getNcConfig().then(cfg => {
      setNcServer(cfg.server || '');
      setNcFolder(cfg.folder || 'TravelMate');
      setNcUser(cfg.username || '');
      setNcPassword(cfg.password || '');
    });
    getNcAutoSync().then(v => setNcAuto(!!v));
  }, []);

  async function saveKeys() {
    const trimmed = cleanKey(openrouterKey);
    if (trimmed) await saveSetting('openrouter_api_key', trimmed);
    else await saveSetting('openrouter_api_key', '');
    setOpenrouterKey(trimmed);
    await saveSetting('auto_backup', autoBackup);
    setImportMsg('Impostazioni salvate!');
    setTimeout(() => setImportMsg(''), 2000);
  }

  async function testApiKey() {
    const trimmed = cleanKey(openrouterKey);
    if (!trimmed) {
      setKeyTestMsg('❌ Inserisci prima la API key.');
      return;
    }
    setTesting(true);

    const len = trimmed.length;
    const prefix = trimmed.slice(0, 12);
    const suffix = trimmed.slice(-4);
    if (!prefix.startsWith('sk-or-v1-')) {
      setTesting(false);
      setKeyTestMsg(`❌ La chiave non sembra una chiave OpenRouter.\n\nFormato trovato: "${prefix}...${suffix}" (${len} caratteri).\nLe chiavi OpenRouter iniziano SEMPRE con "sk-or-v1-" e sono lunghe circa 60+ caratteri.\n\nSe la chiave inizia con "sk-ant-" (Anthropic), "sk-proj-" (OpenAI) o simile, hai copiato la chiave del sito sbagliato: apri openrouter.ai/keys e copia quella lì.`);
      return;
    }
    if (len < 40) {
      setTesting(false);
      setKeyTestMsg(`❌ La chiave è troppo corta (${len} caratteri).\n\nLe chiavi OpenRouter complete sono lunghe 60+ caratteri.\nTi mostra "${trimmed.slice(0, 20)}..." — controlla di aver copiato la chiave PER INTERA da openrouter.ai/keys (a volte si copia solo una parte).`);
      return;
    }

    setKeyTestMsg(`⏳ Verifica di "${trimmed.slice(0, 15)}...${suffix}" (${len} caratteri) in corso...`);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { 'Authorization': `Bearer ${trimmed}` },
      });
      if (res.ok) {
        const data = await res.json();
        const key = data?.data?.label || trimmed.slice(0, 8) + '...';
        const credits = data?.data?.limit ? `${data.data.limit}` : 'illimitato';
        setKeyTestMsg(`✅ Chiave VALIDA (${key}). Crediti disponibili: ${credits}. Ora premi "Salva impostazioni".`);
      } else {
        const err = await res.json().catch(() => ({}));
        setKeyTestMsg(`❌ Chiave NON valida (HTTP ${res.status}): ${err?.error?.message || err?.message || 'errore sconosciuto'}. Controlla di averla copiata per intero, senza spazi.`);
      }
    } catch (e) {
      setKeyTestMsg(`❌ Impossibile contattare OpenRouter: ${e.message}. Controlla la connessione.`);
    } finally {
      setTesting(false);
    }
  }

  async function handleExport() {
    const data = await exportAllTrips();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travelmate-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        await importTrips(data);
        setImportMsg('Dati importati con successo!');
        setTimeout(() => setImportMsg(''), 3000);
      } catch {
        setImportMsg('❌ File non valido');
      }
    };
    reader.readAsText(file);
  }

  async function saveNc() {
    await saveNcConfig({
      server: cleanKey(ncServer),
      username: cleanKey(ncUser),
      password: ncPassword,
      folder: cleanKey(ncFolder) || 'TravelMate',
    });
    await setNcAutoSync(ncAuto);
    setNcMsg('✅ Configurazione salvata!');
    setTimeout(() => setNcMsg(''), 2000);
  }

  async function handleNcTest() {
    setNcBusy(true);
    setNcMsg('⏳ Test in corso...');
    try {
      await saveNcConfig({
        server: cleanKey(ncServer),
        username: cleanKey(ncUser),
        password: ncPassword,
        folder: cleanKey(ncFolder) || 'TravelMate',
      });
      const res = await testNcConnection();
      setNcMsg(res.ok ? '✅ Connessione al NAS riuscita' : '❌ ' + res.error);
    } catch (e) {
      setNcMsg('❌ ' + e.message);
    } finally {
      setNcBusy(false);
    }
  }

  async function handleNcSync() {
    setNcBusy(true);
    setNcMsg('⏳ Sincronizzazione in corso...');
    try {
      await saveNcConfig({
        server: cleanKey(ncServer),
        username: cleanKey(ncUser),
        password: ncPassword,
        folder: cleanKey(ncFolder) || 'TravelMate',
      });
      const res = await syncNow();
      setNcMsg(res.ok ? '✅ Dati sincronizzati con il NAS' : '❌ ' + res.error);
    } finally {
      setNcBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">⚙️ Impostazioni</h1>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>🔑 Assistente AI (gratuito)</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          L'app usa <strong>OpenRouter</strong> per l'assistente AI con modelli gratuiti (Llama, Qwen, DeepSeek).
          Registrati gratis su openrouter.ai senza carta di credito per ottenere la key.
        </p>
        <div className="form-group">
          <label className="form-label">OpenRouter API Key</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              type={showKey ? 'text' : 'password'}
              placeholder="sk-or-..."
              value={openrouterKey}
              onChange={e => setOpenrouterKey(cleanKey(e.target.value))}
              onPaste={e => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text');
                setOpenrouterKey(cleanKey(pasted));
              }}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setShowKey(!showKey)}
              title={showKey ? 'Nascondi chiave' : 'Mostra chiave'}
              style={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
            >
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Ottieni la key su <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)' }}>openrouter.ai/keys</a>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={saveKeys}>💾 Salva impostazioni</button>
          <button className="btn btn-secondary" onClick={testApiKey} disabled={testing}>
            {testing ? '⏳ Verifica...' : '🔍 Testa la chiave'}
          </button>
        </div>
        {keyTestMsg && (
          <p style={{ marginTop: 10, fontSize: '0.85rem', color: keyTestMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)', whiteSpace: 'pre-wrap' }}>
            {keyTestMsg}
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>🗺️ Mappe (100% gratuite)</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Le mappe usano <strong>OpenStreetMap</strong> e <strong>Leaflet</strong> — nessuna API key richiesta, nessun pagamento.
          <br />
          <br />
          • 🗺️ <strong>Mappa interattiva</strong>: OpenStreetMap (gratis)
          <br />
          • 📍 <strong>Geocoding</strong>: Nominatim (gratis)
          <br />
          • 🧭 <strong>Calcolo distanze</strong>: OSRM (gratis)
          <br />
          • 🚗 <strong>Indicazioni stradali</strong>: si apre in OpenStreetMap (gratis)
        </p>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>📤 Backup e Ripristino</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Esporta tutti i tuoi viaggi in un file JSON. Puoi condividerlo con Resilio Sync o conservarlo come backup.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className="btn btn-primary" onClick={handleExport}>
            📤 Esporta tutto (Backup)
          </button>
          <button className="btn btn-secondary" onClick={() => triggerAutoBackup()}>
            📤 Backup adesso
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            📥 Importa da file
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>

        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="checkbox-group" onClick={() => setAutoBackup(!autoBackup)}>
            <input type="checkbox" checked={autoBackup} readOnly />
            <span style={{ fontSize: '0.85rem' }}>🔄 Backup automatico (dopo ogni modifica)</span>
          </label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, marginLeft: 26 }}>
            Scarica automaticamente un file backup nella cartella Downloads quando aggiungi/modifichi dati.
            Il file poi verrà copiato nella cartella Resilio Sync dal monitor automatico.
          </p>
        </div>
        {importMsg && (
          <p style={{ marginTop: 8, fontSize: '0.85rem', color: importMsg.includes('❌') ? 'var(--danger)' : 'var(--success)' }}>
            {importMsg}
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>☁️ Sincronizzazione multi-dispositivo (NAS)</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Sincronizza i dati tra PC e telefono salvando il backup sul tuo NAS via WebDAV.
          Funziona da qualsiasi PC e dal telefono, anche in 4G.
        </p>

        <div className="form-group">
          <label className="form-label">Indirizzo del NAS (con porta WebDAV)</label>
          <input
            className="form-input"
            placeholder="https://tua.myqnapcloud.com:8081"
            value={ncServer}
            onChange={e => setNcServer(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Cartella condivisa</label>
          <input
            className="form-input"
            placeholder="TravelMate"
            value={ncFolder}
            onChange={e => setNcFolder(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Utente QNAP</label>
          <input
            className="form-input"
            placeholder="admin"
            value={ncUser}
            onChange={e => setNcUser(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password QNAP</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              type={showNcPw ? 'text' : 'password'}
              value={ncPassword}
              onChange={e => setNcPassword(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setShowNcPw(!showNcPw)}
              title={showNcPw ? 'Nascondi password' : 'Mostra password'}
              style={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
            >
              {showNcPw ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="btn btn-secondary" onClick={handleNcTest} disabled={ncBusy}>
            🔗 Testa connessione
          </button>
          <button className="btn btn-secondary" onClick={saveNc} disabled={ncBusy}>
            💾 Salva configurazione
          </button>
          <button className="btn btn-primary" onClick={handleNcSync} disabled={ncBusy}>
            ☁️ Sincronizza ora
          </button>
        </div>

        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="checkbox-group" onClick={() => setNcAuto(!ncAuto)}>
            <input type="checkbox" checked={ncAuto} readOnly />
            <span style={{ fontSize: '0.85rem' }}>🔄 Sincronizzazione automatica (dopo ogni modifica e all'avvio)</span>
          </label>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 8 }}>
          <p style={{ marginBottom: 4 }}><strong>Come preparare il NAS (una volta sola):</strong></p>
          <p>1. App Center → installa <strong>WebDAV Server</strong></p>
          <p>2. Apri WebDAV Server → abilitalo e appunta la <strong>porta HTTPS</strong> (di solito 8081)</p>
          <p>3. Crea una cartella condivisa (es. <strong>TravelMate</strong>) e abilitala nel WebDAV Server</p>
          <p>4. Verifica che la porta sia aperta verso l'esterno (myQNAPcloud / router) e che l'utente QNAP abbia accesso alla cartella</p>
          <p>5. Inserisci qui sopra <code>https://tua.myqnapcloud.com:PORTA</code> e premi "Testa connessione"</p>
        </div>

        {ncMsg && (
          <p style={{ marginTop: 8, fontSize: '0.85rem', color: ncMsg.startsWith('✅') ? 'var(--success)' : ncMsg.startsWith('❌') ? 'var(--danger)' : 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
            {ncMsg}
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>📱 Info</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <p><strong>TravelMate</strong> - Gestione Viaggi v1.1</p>
          <p>Tutti i dati sono salvati localmente nel browser (IndexedDB).</p>
          <p>Usa il backup per sincronizzare i dispositivi con Resilio Sync.</p>
          <p style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Per Resilio Sync: esporta il backup, salva nella cartella condivisa, e importa sull'altro dispositivo.
          </p>
        </div>
      </div>
    </div>
  );
}
