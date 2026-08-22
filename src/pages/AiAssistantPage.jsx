import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { getSetting, saveSetting } from '../services/database';
import PlaceInput from '../components/PlaceInput';

const FREE_MODELS = [
  { value: 'nvidia/nemotron-3-nano-30b-a3b:free', label: 'NVIDIA Nemotron 3 Nano 30B (free)' },
  { value: 'openai/gpt-oss-20b:free', label: 'OpenAI GPT-OSS 20B (free)' },
  { value: 'google/gemma-4-31b-it:free', label: 'Google Gemma 4 31B (free)' },
  { value: 'inclusionai/ling-3.0-flash:free', label: 'Ling 3.0 Flash (free)' },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'NVIDIA Nemotron 3 Super 120B (free)' },
  { value: 'nvidia/nemotron-nano-9b-v2:free', label: 'NVIDIA Nemotron Nano 9B (free)' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o mini (molto economico)' },
  { value: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (economico)' },
];

export default function AiAssistantPage() {
  const { id } = useParams();
  const { currentTrip, itinerary, loadTripData } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(FREE_MODELS[0].value);
  const [showSettings, setShowSettings] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState(FREE_MODELS);
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [manualLocation, setManualLocation] = useState(null);
  const [showLocModal, setShowLocModal] = useState(false);
  const [locInput, setLocInput] = useState('');
  const [locPicked, setLocPicked] = useState(null);
  const [locDetecting, setLocDetecting] = useState(false);
  const [locSaving, setLocSaving] = useState(false);
  const messagesEndRef = useRef(null);
  function cleanKey(value) {
    return value.replace(/\s+/g, '').trim();
  }

  useEffect(() => {
    loadTripData(id);
    getSetting('openrouter_api_key').then(key => {
      if (key) setApiKey(key);
      else setShowSettings(true);
    });
    getSetting('openrouter_model').then(m => {
      const valid = models.some(f => f.value === m);
      if (m && valid) setModel(m);
      else {
        setModel(models[0].value);
        saveSetting('openrouter_model', models[0].value);
      }
    });
    getSetting('manual_ai_location').then(v => {
      if (v) {
        try { setManualLocation(JSON.parse(v)); } catch {}
      } else {
        silentDetectLocation();
      }
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function buildTripContext(trip) {
    if (!trip) return '';
    const parts = [];
    const dest = (trip.destination || '').trim();
    if (dest) {
      parts.push(`Il viaggio attivo è "${trip.name}" e la DESTINAZIONE è ${dest}.`);
    } else {
      parts.push(`Il viaggio attivo è "${trip.name}".`);
    }
    if (trip.startDate) parts.push(`Date: dal ${trip.startDate} al ${trip.endDate || '?'} (${trip.days || '?'} giorni).`);
    if (trip.budget) parts.push(`Budget: ${trip.budget} €.`);

    const placeNames = (itinerary || [])
      .map(i => (i.location || '').trim())
      .filter(Boolean);
    const uniquePlaces = [...new Set(placeNames)];
    if (uniquePlaces.length > 0) {
      parts.push(`Luoghi già nel programma del viaggio: ${uniquePlaces.join(', ')}.`);
    }
    return parts.join(' ');
  }

  async function refreshModels() {
    setRefreshingModels(true);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const free = (data?.data || [])
        .filter(m => String(m.id).endsWith(':free'))
        .map(m => ({ value: m.id, label: `${m.name} (free)` }));
      if (free.length === 0) throw new Error('Nessun modello free trovato');
      setModels([...free, ...FREE_MODELS.filter(m => !String(m.value).endsWith(':free'))]);
    } catch (e) {
      alert(`Impossibile aggiornare la lista modelli: ${e.message}`);
    } finally {
      setRefreshingModels(false);
    }
  }

  async function saveApiKey() {
    const trimmed = cleanKey(apiKey);
    await saveSetting('openrouter_api_key', trimmed);
    await saveSetting('openrouter_model', model);
    if (trimmed) setApiKey(trimmed);
    setShowSettings(false);
  }

  async function getCurrentLocation() {
    if (!('geolocation' in navigator)) return null;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 12000);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          clearTimeout(timeout);
          const { latitude, longitude, accuracy } = pos.coords;
          try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) return resolve(null);
            const data = await res.json();
            const name = data?.display_name?.split(',')[0] || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            resolve({ name, lat: latitude, lng: longitude, accuracy });
          } catch {
            resolve({ name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, lat: latitude, lng: longitude, accuracy });
          }
        },
        () => {
          clearTimeout(timeout);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  async function detectLocation() {
    setLocDetecting(true);
    const loc = await getCurrentLocation();
    setLocDetecting(false);
    if (!loc) {
      alert('Posizione non rilevata. Controlla che GPS e permessi di localizzazione siano attivi, oppure usa ✏️ Manuale.');
      return;
    }
    const saved = { name: loc.name, lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy };
    setManualLocation(saved);
    try {
      await saveSetting('manual_ai_location', JSON.stringify(saved));
    } catch {}
  }

  async function silentDetectLocation() {
    if (!('geolocation' in navigator)) return;
    const loc = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 8000);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          clearTimeout(timeout);
          const { latitude, longitude, accuracy } = pos.coords;
          try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) return resolve(null);
            const data = await res.json();
            const name = data?.display_name?.split(',')[0] || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            resolve({ name, lat: latitude, lng: longitude, accuracy });
          } catch {
            resolve({ name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, lat: latitude, lng: longitude, accuracy });
          }
        },
        () => { clearTimeout(timeout); resolve(null); },
        { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 }
      );
    });
    if (loc) {
      const saved = { name: loc.name, lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy };
      setManualLocation(saved);
      try {
        await saveSetting('manual_ai_location', JSON.stringify(saved));
      } catch {}
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    if (!apiKey) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Configura la API key di OpenRouter nelle impostazioni per utilizzare l\'assistente AI.\n\nClicca l\'icona ⚙️ in alto a destra, registrati gratis su openrouter.ai e ottieni una key gratuita (nessuna carta di credito richiesta).',
      }]);
      setLoading(false);
      setShowSettings(true);
      return;
    }

    const context = buildTripContext(currentTrip);

    const loc = manualLocation;

    const locationInstruction = loc
      ? `\n\n📍 POSIZIONE ATTUALE DELL'UTENTE IN QUESTO MOMENTO: "${loc.name}" (lat ${loc.lat.toFixed(4)}, lng ${loc.lng.toFixed(4)}).\nL'utente si trova ORA in questo luogo. Per QUALSIASI consiglio su ristoranti, luoghi, attività o cose da vedere, usa SEMPRE questa posizione come riferimento. La destinazione del viaggio può essere diversa: IGNORALA completamente quando consigli luoghi o ristoranti, a meno che l'utente non chieda esplicitamente di quella.`
      : `\n\nL'utente NON ha condiviso la posizione attuale: in questo caso usa la destinazione del viaggio come posizione di riferimento per i consigli.`;

    let nearbyPois = '';
    if (loc && loc.lat && loc.lng) {
      try {
        const query = `[out:json][timeout:8];
(
  node["amenity"~"restaurant|cafe|bar|pub|fast_food|biergarten"](around:1000,${loc.lat},${loc.lng});
  node["tourism"~"attraction|museum|viewpoint|artwork|information"](around:1500,${loc.lat},${loc.lng});
  node["shop"~"supermarket|convenience|bakery|deli"](around:800,${loc.lat},${loc.lng});
);
out body 25;`;
        const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        if (overpassRes.ok) {
          const overpassData = await overpassRes.json();
          const elements = overpassData.elements || [];
          if (elements.length > 0) {
            const pois = elements.map(el => {
              const name = el.tags?.name || '';
              const type = el.tags?.amenity || el.tags?.tourism || el.tags?.shop || '';
              const cuisine = el.tags?.cuisine || '';
              const addr = [el.tags?.['addr:street'], el.tags?.['addr:housenumber']].filter(Boolean).join(' ') || '';
              const rating = el.tags?.rating || '';
              const phone = el.tags?.phone || el.tags?.['contact:phone'] || '';
              const hours = el.tags?.opening_hours || '';
              const dist = Math.round(Math.sqrt(Math.pow((el.lat - loc.lat) * 111320, 2) + Math.pow((el.lon - loc.lng) * 111320 * Math.cos(loc.lat * Math.PI / 180), 2)));
              return { name, type, cuisine, addr, rating, phone, hours, dist };
            }).filter(p => p.name);
            if (pois.length > 0) {
              nearbyPois = '\n\n📍 LOCALI REALI TROVATI NELLA ZONA (da OpenStreetMap, raggio ~1km): ' + pois.map(p =>
                `\n- ${p.name} (${p.type}${p.cuisine ? ', cucina: ' + p.cuisine : ''})${p.addr ? ', ' + p.addr : ''}${p.hours ? ', orari: ' + p.hours : ''}, ~${p.dist}m`
              ).join('');
            }
          }
        }
      } catch {}
    }

    let transitInfo = '';
    const transitKeywords = /\b(tren[oi]|treno|bus|autobus|fermata|stazion[eai]|linea|orari?\s*(del|dei|degli)?\s*(tren[oi]|bus)|trasport[oi]|collegament[oi]|partenz[ae]|arriv[oi]|percorso|viaggi[ao]|colleg[ao]|how (do i|to get)|come (arriv|vad)|come si va)\b/i;
    const fromToMatch = userMessage.match(/(?:da|from|partendo da)\s+(.+?)(?:\s+(?:a|per|→|arriv[ao] a|to)\s+)\s*(.+?)(?:\?|$|\.|!|,|\s*$)/i)
      || userMessage.match(/(.+?)\s+(?:a|→|per|arriv[ao] a)\s+(.+?)(?:\?|$|\.|!|,|\s*$)/i)
      || userMessage.match(/(?:orari|collegamenti|tren[oi]|bus)\s+(?:da|from)\s+(.+?)\s+(?:a|to)\s+(.+?)(?:\?|$|\.|!|,)/i);
    if (transitKeywords.test(userMessage) && fromToMatch) {
      const fromName = fromToMatch[1].trim();
      const toName = fromToMatch[2].trim();
      try {
        const [fromStops, toStops] = await Promise.all([
          fetch(`https://efa.sta.bz.it/apb/XML_STOPFINDER_REQUEST?locationServerActive=1&stateless=1&type_sf=any&name_sf=${encodeURIComponent(fromName)}&outputFormat=JSON`).then(r => r.json()),
          fetch(`https://efa.sta.bz.it/apb/XML_STOPFINDER_REQUEST?locationServerActive=1&stateless=1&type_sf=any&name_sf=${encodeURIComponent(toName)}&outputFormat=JSON`).then(r => r.json()),
        ]);
        const fromPts = fromStops?.stopFinder?.points || [];
        const toPts = toStops?.stopFinder?.points || [];
        const fromStop = fromPts.find(p => p.anyType === 'stop' && p.best === '1') || fromPts.find(p => p.anyType === 'stop');
        const toStop = toPts.find(p => p.anyType === 'stop' && p.best === '1') || toPts.find(p => p.anyType === 'stop');
        if (fromStop && toStop) {
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          const tripUrl = `https://efa.sta.bz.it/apb/XML_TRIP_REQUEST2?language=it&odvMacro=true&coordOutputFormat=WGS84[DD.DDDDD]&name_origin=${fromStop.ref.id}&type_origin=stop&name_destination=${toStop.ref.id}&type_destination=stop&calcNumberOfTrips=5&itdDate=${y}${m}${d}&itdTime=${hh}${mm}`;
          const tripRes = await fetch(tripUrl);
          const tripXml = await tripRes.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(tripXml, 'text/xml');
          const routes = doc.querySelectorAll('itdRoute');
          if (routes.length > 0) {
            const lines = [];
            routes.forEach((route, i) => {
              const dur = route.getAttribute('publicDuration') || route.getAttribute('duration') || '?';
              const changes = route.getAttribute('changes') || '0';
              const legs = route.querySelectorAll('itdPartialRoute');
              const legParts = [];
              legs.forEach(leg => {
                const mot = leg.querySelector('itdMeansOfTransport');
                const lineName = mot?.getAttribute('shortname') || mot?.getAttribute('name') || '?';
                const operator = mot?.querySelector('itdOperator name')?.textContent || mot?.getAttribute('productName') || '';
                const depPt = leg.querySelector('itdPoint[usage="departure"]');
                const arrPt = leg.querySelector('itdPoint[usage="arrival"]');
                const depTime = depPt ? `${depPt.querySelector('itdTime')?.getAttribute('hour')}:${depPt.querySelector('itdTime')?.getAttribute('minute')}` : '?';
                const arrTime = arrPt ? `${arrPt.querySelector('itdTime')?.getAttribute('hour')}:${arrPt.querySelector('itdTime')?.getAttribute('minute')}` : '?';
                const depStation = depPt?.getAttribute('nameWO') || depPt?.getAttribute('name') || '';
                const arrStation = arrPt?.getAttribute('nameWO') || arrPt?.getAttribute('name') || '';
                legParts.push(`${depTime}-${arrTime} ${lineName} (${operator}) ${depStation}→${arrStation}`);
              });
              lines.push(`  ${i + 1}. Durata: ${dur}, Cambi: ${changes}\n     ${legParts.join('\n     ')}`);
            });
            transitInfo = `\n\n🚂 ORARI TRENO/BUS REALI (fonte: Südtirol EFA, dati live):\nPercorso da "${fromStop.name}" a "${toStop.name}":\n${lines.join('\n')}`;
          } else {
            transitInfo = `\n\n🚂 Ho cercato treni/bus da "${fromName}" a "${toName}" ma non ho trovato collegamenti nelle prossime ore. Prova a verificare su suedtirolmobil.info o trenitalia.com.`;
          }
        }
      } catch {}
    }

    const systemPrompt = `IMPORTANTE: Rispondi SEMPRE e ESCLUSIVAMENTE in italiano. NON usare MAI l'inglese né altre lingue. Tutte le parole, le frasi e le spiegazioni DEVONO essere in italiano.\n\nSei un assistente di viaggio esperto e amichevole. Fornisci consigli pratici e dettagliati su ristoranti, luoghi da vedere, attività, trasporti, alloggi e qualsiasi informazione utile per i viaggiatori. Sii conciso ma informativo. ${context} ${locationInstruction}${nearbyPois}${transitInfo}\n\nQuando hai a disposizione la lista dei locali reali dalla zona, PUOI e DEVi consigliarli all'utente per nome, menzionando tipo di locale, cucina, indirizzo e distanza. Usa quelli come riferimento concreto. Se l'utente chiede qualcosa che non è nella lista, dai comunque consigli generali ma specifica che non hai dati verificati per quel tipo.\n\nQuando hai dati sui trasporti in tempo reale (treno/bus), USALI per rispondere con orari precisi. Non inventare orari: se hai i dati reali, cita orari e durata esatti.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'TravelMate',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage },
          ],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let detail = errText;
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error?.message) detail = parsed.error.message;
        } catch { /* keep raw text */ }
        let hint = 'Verifica che la API key sia corretta e copiata per intero (senza spazi).';
        if (response.status === 401) {
          hint = 'La API key non è valida: apri Impostazioni → "Testa la chiave" per maggiori dettagli.';
        } else if (response.status === 404 || /model not found/i.test(detail)) {
          hint = 'Il modello selezionato non è più disponibile su OpenRouter: apri le impostazioni AI (⚙️) e scegli un altro modello.';
        } else if (response.status === 429 || /insufficient|rate limit|quota/i.test(detail)) {
          hint = 'Quota gratuita esaurita o troppe richieste: aspetta qualche minuto o usa un altro modello.';
        }
        throw new Error(`${detail}\n\n💡 ${hint}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || 'Nessuna risposta ricevuta.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Errore: ${error.message}\n\nVerifica che la API key sia corretta e che il modello selezionato sia disponibile.`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    '🍽️ Consigliami ristoranti nella zona',
    '🏛️ Cosa vedere qui vicino?',
    '🚗 Come muovermi nella città?',
    '🏨 Consigli per alloggi economici',
    '💡 Consigli per risparmiare sul viaggio',
    '🎭 Attività e cose da fare oggi',
  ];

  return (
    <div>
      <h1 className="page-title">🤖 Assistente AI</h1>
      <p className="page-subtitle">Consigli in tempo reale powered by OpenRouter (modelli gratuiti)</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
        {locDetecting ? (
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)' }}>📡 Rilevamento posizione...</p>
        ) : (
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)' }}>
            {manualLocation
              ? `📌 Posizione impostata: ${manualLocation.name}`
              : '📍 Posizione non impostata — usa la destinazione del viaggio'}
          </p>
        )}
        <button className="btn btn-secondary btn-sm" onClick={detectLocation} disabled={locDetecting}>
          📍 Rileva ora
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setLocInput(manualLocation?.name || ''); setLocPicked(null); setShowLocModal(true); }}>
          ✏️ Manuale
        </button>
        {manualLocation && (
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            setManualLocation(null);
            await saveSetting('manual_ai_location', '');
          }}>
            🗑️
          </button>
        )}
      </div>

      {showSettings && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid var(--warning)' }}>
          <div className="card-title" style={{ color: 'var(--warning)', marginBottom: 8 }}>⚠️ Configurazione gratuita</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
            1. Registrati gratis su <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-light)' }}>openrouter.ai</a> (nessuna carta richiesta)
            <br />
            2. Crea una API key nella sezione "Keys" del pannello
            <br />
            3. Incollala qui sotto — avrai crediti gratis e accesso ai modelli gratuiti
          </p>
          <div className="form-group">
            <label className="form-label">API Key OpenRouter</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-or-..."
                value={apiKey}
                onChange={e => setApiKey(cleanKey(e.target.value))}
                onPaste={e => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData('text');
                  setApiKey(cleanKey(pasted));
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
          </div>
          <div className="form-group">
            <label className="form-label">Modello AI</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="form-select"
                value={model}
                onChange={e => setModel(e.target.value)}
                style={{ flex: 1 }}
              >
                {models.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={refreshModels}
                disabled={refreshingModels}
                title="Aggiorna la lista dei modelli gratuiti da OpenRouter"
                style={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
              >
                {refreshingModels ? '⏳' : '🔄'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={saveApiKey}>Salva</button>
            <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>Annulla</button>
          </div>
        </div>
      )}

      <div className="ai-chat">
        <div className="ai-messages">
          {messages.length === 0 && (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="empty-icon">🤖</div>
              <h3>Ciao! Sono il tuo assistente di viaggio</h3>
              <p>Chiedimi consigli su ristoranti, luoghi da vedere, trasporti e molto altro!</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`ai-message ${msg.role}`}>
              <div className="ai-avatar">
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="ai-bubble" style={{ whiteSpace: 'pre-wrap' }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="ai-message assistant">
              <div className="ai-avatar">🤖</div>
              <div className="ai-bubble">
                <span style={{ animation: 'pulse 1s infinite' }}>Sto pensando...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {messages.length === 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                className="btn btn-secondary btn-sm"
                onClick={() => { setInput(s.replace(/^[^\s]+\s/, '')); }}
                style={{ fontSize: '0.75rem' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="ai-input-area">
          <input
            className="form-input"
            placeholder="Chiedi qualcosa..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <button className="btn btn-primary" onClick={sendMessage} disabled={loading || !input.trim()}>
            {loading ? '⏳' : '📤'}
          </button>
          {!showSettings && (
            <button className="btn btn-secondary" onClick={() => setShowSettings(true)}>
              ⚙️
            </button>
          )}
        </div>
      </div>

      {showLocModal && (
        <div className="modal-overlay" onClick={() => setShowLocModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-title">📌 Imposta la tua posizione</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Se la posizione automatica è sbagliata, scegli il luogo esatto in cui ti trovi ora.
            </p>
            <div className="form-group">
              <label className="form-label">Dove sei adesso?</label>
              <PlaceInput
                value={locInput}
                onChange={(v) => { setLocInput(v.value); setLocPicked(v.lat ? v : null); }}
                placeholder="Cerca la tua città o luogo..."
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                className="btn btn-primary"
                disabled={!locInput.trim() || locSaving}
                onClick={async () => {
                  if (!locInput.trim() || locSaving) return;
                  setLocSaving(true);
                  let picked = locPicked;
                  if (!picked) {
                    try {
                      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locInput.trim())}&limit=1`;
                      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                      if (res.ok) {
                        const data = await res.json();
                        if (data && data.length > 0) {
                          picked = { value: data[0].display_name, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                        }
                      }
                    } catch {}
                  }
                  setLocSaving(false);
                  if (!picked) {
                    alert('Luogo non trovato. Prova a selezionarlo dalla lista dei suggerimenti.');
                    return;
                  }
                  const loc = { name: picked.value, lat: picked.lat, lng: picked.lng, manual: true };
                  setManualLocation(loc);
                  setShowLocModal(false);
                  await saveSetting('manual_ai_location', JSON.stringify(loc));
                }}
              >
                {locSaving ? '⏳' : 'Salva'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowLocModal(false)}>Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
