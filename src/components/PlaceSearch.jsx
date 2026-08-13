import { useState } from 'react';
import PlaceInput from './PlaceInput';

const CATEGORIES = [
  { value: 'restaurant', label: '🍽️ Ristoranti' },
  { value: 'attraction', label: '🏛️ Cosa vedere' },
  { value: 'hotel', label: '🏨 Hotel' },
];

export default function PlaceSearch({ location, onShowOnMap, onDetect, detecting, onLocationChange }) {
  const [category, setCategory] = useState('restaurant');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualPlace, setManualPlace] = useState(null);

  const activeLocation = manualPlace?.lat && manualPlace?.lng ? manualPlace : location;

  function handleManualPick(p) {
    if (p.lat && p.lng) {
      setManualPlace({ name: p.label || p.value, lat: p.lat, lng: p.lng });
      setManualMode(false);
      setError('');
      setResults(null);
      if (onLocationChange) {
        onLocationChange({ name: p.label || p.value, lat: p.lat, lng: p.lng });
      }
    }
  }

  function clearManual() {
    setManualPlace(null);
  }

  async function search() {
    if (!activeLocation?.lat || !activeLocation?.lng) {
      setError('Imposta prima una posizione: usa "📡 Rileva ora" o "✏️ Manuale", oppure aggiungi la destinazione al viaggio.');
      setResults(null);
      return;
    }
    setLoading(true);
    setError('');
    setResults(null);
    const places = await searchRealPlaces(activeLocation.lat, activeLocation.lng, category, activeLocation.name);
    setLoading(false);
    if (places && places.length > 0) {
      setResults(places);
      if (onShowOnMap) onShowOnMap(places);
    } else {
      setError('Nessun luogo trovato nella zona o server dei luoghi non raggiungibile. Riprova tra qualche secondo o prova un\'altra categoria/posizione.');
    }
  }

  function openInOsm(p) {
    if (p.lat && p.lng) {
      window.open(`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`, '_blank');
    } else {
      window.open(`https://www.openstreetmap.org/search?query=${encodeURIComponent(p.name)}`, '_blank');
    }
  }

  return (
    <div className="card" style={{ margin: '12px 0 16px' }}>
      <div className="card-title" style={{ marginBottom: 8 }}>🔎 Cerca luoghi reali sulla mappa</div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
        {activeLocation?.name
          ? `Cerca vicino a: ${activeLocation.name}`
          : 'Posizione non impostata — usa "📡 Rileva ora" o "✏️ Manuale".'}
      </p>

      {manualMode && (
        <div style={{ marginBottom: 10 }}>
          <PlaceInput
            value=""
            placeholder="Scrivi una città o un luogo (es. Parigi, Firenze, Tokyo)..."
            onChange={handleManualPick}
          />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Digita almeno 3 caratteri e scegli un risultato dall'elenco.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {onDetect && (
          <button className="btn btn-sm" style={{
            background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff',
          }} onClick={onDetect} disabled={detecting}>
            {detecting ? '⏳' : '📡 Rileva ora'}
          </button>
        )}
        <button className={`btn btn-sm ${manualMode ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setManualMode(m => !m)}>
          {manualMode ? '✖️ Chiudi' : '✏️ Manuale'}
        </button>
        {manualPlace?.name && (
          <button className="btn btn-secondary btn-sm" onClick={clearManual}>
            🗑️ Usa destinazione
          </button>
        )}
        {CATEGORIES.map(c => (
          <button key={c.value} className={`btn btn-sm ${category === c.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCategory(c.value)}>
            {c.label}
          </button>
        ))}
        <button className="btn btn-primary btn-sm" onClick={search} disabled={loading}>
          {loading ? '⏳' : '🔎 Cerca'}
        </button>
      </div>

      {loading && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>🔍 Cerco luoghi reali nella zona...</p>}
      {error && <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: 8 }}>{error}</p>}

      {results && results.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            Clicca su un luogo per mostrarlo sulla mappa qui sotto.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((p, i) => (
              <div key={i}
                onClick={() => { if (onShowOnMap) onShowOnMap([p]); }}
                style={{
                  padding: '10px 12px', background: 'var(--bg)', borderRadius: 8,
                  border: '1px solid var(--border)', fontSize: '0.85rem',
                  cursor: onShowOnMap ? 'pointer' : 'default',
                  transition: 'border-color .15s, background .15s',
                }}
                onMouseEnter={e => { if (onShowOnMap) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--bg-card)'; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>{i + 1}. {p.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {p.phone && (
                      <a href={`tel:${p.phone.replace(/[^+\d]/g, '')}`}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.7rem', padding: '4px 8px', whiteSpace: 'nowrap', textDecoration: 'none' }}
                        onClick={e => e.stopPropagation()}>
                        📞 Chiama
                      </a>
                    )}
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.7rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
                      onClick={e => { e.stopPropagation(); openInOsm(p); }}>
                      🧭 Vedi su OSM
                    </button>
                  </div>
                </div>
                {p.address && <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>📍 {p.address}</div>}
                {p.phone && <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>📞 {p.phone}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

async function fetchWithTimeout(url, options, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchRealPlaces(lat, lng, type, locationName) {
  const amenityMap = {
    restaurant: '"amenity"~"restaurant|fast_food|bar|cafe"',
    attraction: '"tourism"~"attraction|museum|viewpoint|zoo|theme_park"',
    hotel: '"tourism"~"hotel|guest_house|hostel|apartment"',
  };
  const amenityFilter = amenityMap[type] || amenityMap.restaurant;
  const radius = type === 'attraction' ? 8000 : 3000;
  const query = `[out:json][timeout:25];(node[${amenityFilter}](around:${radius},${lat},${lng});way[${amenityFilter}](around:${radius},${lat},${lng}););out center tags 40;`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'TravelMate/1.0 (travel assistant app)' };
  const endpoints = [
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  for (let i = 0; i < endpoints.length; i++) {
    try {
      const res = await fetchWithTimeout(endpoints[i], {
        method: 'POST',
        headers,
        body: `data=${encodeURIComponent(query)}`,
      }, i === 0 ? 20000 : 15000);
      if (!res.ok) continue;
      const data = await res.json();
      const results = [];
      for (const el of (data?.elements || [])) {
        const t = el.tags || {};
        const name = t.name || t['name:it'] || '';
        if (!name) continue;
        const address = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
        const phone = t['phone'] || t['contact:phone'] || '';
        const website = t['website'] || t['contact:website'] || '';
        const plat = el.lat !== undefined ? el.lat : el.center?.lat;
        const plng = el.lon !== undefined ? el.lon : el.center?.lon;
        if (plat === undefined || plng === undefined || isNaN(plat) || isNaN(plng)) continue;
        results.push({ name, address, phone, website, lat: plat, lng: plng });
        if (results.length >= 15) break;
      }
      if (results.length > 0) return results;
    } catch {
      continue;
    }
  }
  try {
    const label = type === 'restaurant' ? 'ristoranti' : type === 'hotel' ? 'hotel' : 'attrazioni turistiche';
    const city = (locationName || '').split(',')[0].trim();
    const queries = [`${label} ${city}`.trim(), `${city} ${type === 'restaurant' ? 'restaurant' : type === 'hotel' ? 'hotel' : 'tourism attraction'}`.trim()];
    for (const q of queries) {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=10`;
      const res = await fetchWithTimeout(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'TravelMate/1.0 (travel assistant app)' },
      }, 10000);
      if (!res.ok) continue;
      const data = await res.json();
      const results = [];
      for (const el of (data || [])) {
        if (!el.display_name) continue;
        results.push({
          name: el.display_name.split(',')[0],
          address: el.display_name.split(',').slice(1).join(',').trim(),
          phone: '',
          website: '',
          lat: parseFloat(el.lat),
          lng: parseFloat(el.lon),
        });
        if (results.length >= 10) break;
      }
      if (results.length > 0) return results;
    }
    return null;
  } catch {
    return null;
  }
}
