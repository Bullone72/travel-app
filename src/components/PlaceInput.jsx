import { useState, useEffect, useRef } from 'react';

export default function PlaceInput({ value, onChange, placeholder, label }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selected, setSelected] = useState(null);
  const timer = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    if (selected !== null) return;
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearch(text) {
    setQuery(text);
    setSelected(null);
    onChange({ value: text, lat: null, lng: null, label: null });

    clearTimeout(timer.current);
    if (!text || text.trim().length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=6&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        setResults(data);
        setShowResults(true);
      } catch (err) {
        console.error('Nominatim search error:', err);
      }
    }, 450);
  }

  function handlePick(place) {
    setSelected(place.place_id);
    setQuery(place.display_name);
    setShowResults(false);
    onChange({
      value: place.display_name,
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      label: place.display_name,
    });
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input
        className="form-input"
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={e => handleSearch(e.target.value)}
        autoComplete="off"
      />
      {showResults && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {results.map(place => (
            <div
              key={place.place_id}
              onMouseDown={() => handlePick(place)}
              style={{
                padding: '10px 12px', cursor: 'pointer', fontSize: '0.8rem',
                borderBottom: '1px solid var(--border)', lineHeight: 1.4,
              }}
            >
              {place.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
