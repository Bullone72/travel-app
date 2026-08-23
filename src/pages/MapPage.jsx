import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ITINERARY_TYPES, calculateTotalKm, formatDuration, formatKm } from '../utils/helpers';
import PlaceSearch from '../components/PlaceSearch';
import {
  createMap, addMarker, addMarkerWithPopup, addRoutePolyline, addRouteSegment, fitMapToPoints, clearMarkers,
  geocodeNominatim, getRouteDistance, getRouteAlternatives, openInHereWeGo, openInGoogleMaps, openInWaze, DAY_COLORS,
} from '../components/LeafletMap';

export default function MapPage() {
  const { id } = useParams();
  const { itinerary, currentTrip, updateItineraryItem, loadTripData } = useApp();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [activeDay, setActiveDay] = useState(1);
  const [viewMode, setViewMode] = useState('itinerary');
  const [routeKm, setRouteKm] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [searchLocation, setSearchLocation] = useState(null);
  const [searchPoints, setSearchPoints] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [altRoutes, setAltRoutes] = useState([]);
  const [selectedAlts, setSelectedAlts] = useState([]);
  const [transitQuery, setTransitQuery] = useState('');
  const [transitFrom, setTransitFrom] = useState('');
  const [transitTo, setTransitTo] = useState('');
  const [transitResults, setTransitResults] = useState(null);
  const [transitLoading, setTransitLoading] = useState(false);

  useEffect(() => {
    loadTripData(id);
  }, [id]);

  useEffect(() => {
    const dest = (currentTrip?.destination || '').trim();
    if (dest) {
      geocodeNominatim(dest).then(r => {
        if (r) setSearchLocation({ name: r.label, lat: r.lat, lng: r.lng });
      });
    }
  }, [currentTrip?.destination]);

  function showSearchOnMap(places) {
    const pts = places.filter(p => p.lat && p.lng);
    if (pts.length === 0) return;
    setSearchPoints(pts);
    setTimeout(() => {
      if (mapRef.current) mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  function handleLocationChange(loc) {
    setSearchLocation(loc);
    if (mapInstance.current && loc?.lat && loc?.lng) {
      mapInstance.current.setView([loc.lat, loc.lng], 13);
    }
  }

  function detectCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Il tuo browser non supporta la geolocalizzazione.');
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      const r = await geocodeNominatim(`${latitude},${longitude}`);
      setSearchLocation({
        name: r?.label || 'Posizione attuale',
        lat: latitude,
        lng: longitude,
      });
      setDetecting(false);
      if (mapInstance.current) {
        mapInstance.current.setView([latitude, longitude], 13);
      }
    }, () => {
      setDetecting(false);
      alert('Impossibile ottenere la posizione: controlla i permessi del browser.');
    }, { enableHighAccuracy: true });
  }

  const tripItems = itinerary.filter(i => i.tripId === id);
  const days = currentTrip?.days || 7;
  const dayItems = tripItems.filter(i => i.dayNumber === activeDay);
  const totalKm = calculateTotalKm(tripItems);

  const sortByTime = (a, b) => (a.time || '').localeCompare(b.time || '');

  function getRoutePointsForItem(item) {
    const pts = [];
    if (item.departureLat && item.departureLng) pts.push({ lat: item.departureLat, lng: item.departureLng, kind: 'dep', label: item.departure });
    if (item.tappe && item.tappe.length > 0) {
      item.tappe.forEach((t, i) => {
        if (t.lat && t.lng) pts.push({ lat: t.lat, lng: t.lng, kind: 'tappa', label: t.name || `Tappa ${i + 1}` });
      });
    }
    if (item.lat && item.lng) pts.push({ lat: item.lat, lng: item.lng, kind: 'loc', label: item.location });
    if (item.arrivalLat && item.arrivalLng) pts.push({ lat: item.arrivalLat, lng: item.arrivalLng, kind: 'arr', label: item.arrival });
    return pts;
  }

  function getVisibleItems() {
    return viewMode === 'itinerary' ? dayItems : tripItems;
  }

  function getDayGroups() {
    const groups = {};
    tripItems.forEach(i => {
      if (!groups[i.dayNumber]) groups[i.dayNumber] = [];
      groups[i.dayNumber].push(i);
    });
    Object.keys(groups).forEach(d => groups[d].sort(sortByTime));
    return groups;
  }

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    mapInstance.current = createMap(mapRef.current);
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapInstance.current) renderMap();
  }, [activeDay, viewMode, tripItems, searchPoints, selectedAlts, altRoutes]);

  useEffect(() => {
    if (viewMode === 'itinerary') {
      calculateRouteDistance();
      fetchAlternatives();
    } else {
      setRouteKm(null);
      setRouteDuration(null);
      setAltRoutes([]);
      setSelectedAlts([]);
    }
  }, [viewMode, activeDay]);

  useEffect(() => {
    if (viewMode === 'itinerary' && altRoutes.length > 0) {
      calculateRouteDistance();
    }
  }, [selectedAlts, altRoutes]);

  function getDaySegments() {
    const ordered = [...dayItems].sort(sortByTime);
    const segments = [];
    let lastArrival = null;
    let lastMode = null;
    for (const item of ordered) {
      const pts = getRoutePointsForItem(item);
      if (pts.length >= 2) {
        for (let i = 0; i < pts.length - 1; i++) {
          segments.push({ a: pts[i], b: pts[i + 1], mode: item.transportMode });
        }
        lastArrival = pts[pts.length - 1];
      } else if (pts.length === 1) {
        if (lastArrival) {
          segments.push({ a: lastArrival, b: pts[0], mode: lastMode || 'car' });
        }
        lastArrival = pts[0];
      }
      lastMode = item.transportMode;
    }
    return segments;
  }

  async function fetchAlternatives() {
    const segments = getDaySegments();
    if (segments.length === 0) {
      setAltRoutes([]);
      setSelectedAlts([]);
      return;
    }
    const routes = await Promise.all(segments.map(s => getRouteAlternatives([s.a, s.b], s.mode)));
    setAltRoutes(routes);
    setSelectedAlts(routes.map(() => 0));
  }

  async function renderMap() {
    const map = mapInstance.current;
    if (!map) return;
    clearMarkers(map);

    if (searchPoints.length > 0) {
      searchPoints.forEach((p, i) => addMarkerWithPopup(map, p.lat, p.lng, p, i + 1));
      fitMapToPoints(map, searchPoints.map(p => ({ lat: p.lat, lng: p.lng })));
      return;
    }

    const items = getVisibleItems();
    const markerItems = items.filter(i => (i.lat && i.lng) || (i.arrivalLat && i.arrivalLng));

    if (viewMode === 'itinerary') {
      const ordered = [...dayItems].sort(sortByTime);
      const segments = getDaySegments();
      let allCoords = [];

      if (segments.length > 0 && altRoutes.length === segments.length) {
        for (let s = 0; s < segments.length; s++) {
          const alts = altRoutes[s] || [];
          const route = alts[selectedAlts[s]] || null;
          let coords = route?.coordinates || null;
          if (!coords) {
            const seg = await getRouteDistance(segments[s].a, segments[s].b, segments[s].mode);
            coords = seg?.coordinates || null;
          }
          if (coords) {
            addRouteSegment(map, coords, DAY_COLORS[activeDay % DAY_COLORS.length]);
            allCoords = allCoords.concat(coords);
          }
        }
      } else {
        for (const item of ordered) {
          const pts = getRoutePointsForItem(item);
          if (pts.length >= 2) {
            for (let i = 0; i < pts.length - 1; i++) {
              const seg = await getRouteDistance(pts[i], pts[i + 1], item.transportMode);
              if (seg && seg.coordinates) {
                addRouteSegment(map, seg.coordinates, DAY_COLORS[activeDay % DAY_COLORS.length]);
                allCoords = allCoords.concat(seg.coordinates);
              }
            }
          }
          if (pts.length === 0 && item.lat && item.lng) {
            allCoords.push({ lat: item.lat, lng: item.lng });
          }
        }
      }
      if (allCoords.length >= 2) {
        const flat = allCoords.map(c => ({ lat: c.lat, lng: c.lng }));
        addRoutePolyline(map, dedupe(flat), DAY_COLORS[activeDay % DAY_COLORS.length]);
      }
    } else {
      const groups = getDayGroups();
      const dayNumbers = Object.keys(groups).map(Number).sort((a, b) => a - b);
      for (const day of dayNumbers) {
        const color = DAY_COLORS[day % DAY_COLORS.length];
        let allCoords = [];
        for (const item of groups[day]) {
          const pts = getRoutePointsForItem(item);
          if (pts.length >= 2) {
            for (let i = 0; i < pts.length - 1; i++) {
              const seg = await getRouteDistance(pts[i], pts[i + 1], item.transportMode);
              if (seg && seg.coordinates) {
                addRouteSegment(map, seg.coordinates, color);
                allCoords = allCoords.concat(seg.coordinates);
              }
            }
          }
          if (pts.length === 0 && item.lat && item.lng) {
            allCoords.push({ lat: item.lat, lng: item.lng });
          }
        }
        if (allCoords.length >= 2) {
          addRoutePolyline(map, dedupe(allCoords), color);
        }
      }
    }

    let markerIdx = 1;
    if (viewMode === 'itinerary') {
      const ordered = [...dayItems].sort(sortByTime);
      for (const item of ordered) {
        const pts = getRoutePointsForItem(item);
        pts.forEach(pt => {
          addMarker(map, pt.lat, pt.lng, markerIdx++, pt.label || item.title);
        });
      }
    } else {
      const groups = getDayGroups();
      const dayNumbers = Object.keys(groups).map(Number).sort((a, b) => a - b);
      for (const day of dayNumbers) {
        for (const item of groups[day]) {
          const pts = getRoutePointsForItem(item);
          pts.forEach(pt => {
            addMarker(map, pt.lat, pt.lng, markerIdx++, pt.label || item.title);
          });
        }
      }
    }

    const fitPoints = [];
    if (viewMode === 'itinerary') {
      dayItems.forEach(item => {
        const pts = getRoutePointsForItem(item);
        pts.forEach(pt => fitPoints.push({ lat: pt.lat, lng: pt.lng }));
      });
    } else {
      markerItems.forEach(i => {
        fitPoints.push(i.lat && i.lng ? { lat: i.lat, lng: i.lng } : { lat: i.arrivalLat, lng: i.arrivalLng });
      });
    }
    if (fitPoints.length > 0) fitMapToPoints(map, fitPoints);
  }

  function dedupe(points) {
    const out = [];
    for (const p of points) {
      const last = out[out.length - 1];
      if (!last || last.lat !== p.lat || last.lng !== p.lng) out.push(p);
    }
    return out;
  }

  async function calculateRouteDistance() {
    const segments = getDaySegments();
    if (segments.length === 0) {
      setRouteKm(null);
      setRouteDuration(null);
      return;
    }
    setLoadingRoute(true);
    let total = 0;
    let minutes = 0;
    for (let s = 0; s < segments.length; s++) {
      const alts = altRoutes[s];
      const route = (alts && alts[selectedAlts[s]]) || (await getRouteDistance(segments[s].a, segments[s].b, segments[s].mode));
      if (route) {
        total += route.distanceKm;
        minutes += route.durationMin;
      }
    }
    setRouteKm(Math.round(total * 10) / 10);
    setRouteDuration(Math.round(minutes));
    setLoadingRoute(false);
  }

  async function handleGeocode(item) {
    const updates = { ...item };
    if (item.departure && !(item.departureLat && item.departureLng)) {
      const r = await geocodeNominatim(item.departure);
      if (r) {
        updates.departureLat = r.lat;
        updates.departureLng = r.lng;
      }
    }
    if (item.arrival && !(item.arrivalLat && item.arrivalLng)) {
      const r = await geocodeNominatim(item.arrival);
      if (r) {
        updates.arrivalLat = r.lat;
        updates.arrivalLng = r.lng;
      }
    }
    if (item.location && !(item.lat && item.lng)) {
      const r = await geocodeNominatim(item.location);
      if (r) {
        updates.lat = r.lat;
        updates.lng = r.lng;
      }
    }
    if (item.tappe && item.tappe.length > 0) {
      const tappeNext = await Promise.all(item.tappe.map(async (t) => {
        if (t.lat && t.lng) return t;
        if (t.name) {
          const r = await geocodeNominatim(t.name);
          if (r) return { name: t.name, lat: r.lat, lng: r.lng };
        }
        return t;
      }));
      updates.tappe = tappeNext;
    }
    if (JSON.stringify(updates) !== JSON.stringify(item)) {
      await updateItineraryItem(updates);
    }
  }

  async function handleAutoGeocodeAll() {
    const items = getVisibleItems().filter(i =>
      (i.departure && !(i.departureLat && i.departureLng)) ||
      (i.arrival && !(i.arrivalLat && i.arrivalLng)) ||
      (i.location && !(i.lat && i.lng))
    );
    for (const item of items) {
      await handleGeocode(item);
    }
  }

  const visibleItems = getVisibleItems();
  const points = visibleItems.filter(i => (i.lat && i.lng) || (i.arrivalLat && i.arrivalLng));
  const missingLocation = visibleItems.filter(i =>
    (i.location && !(i.lat && i.lng)) || (i.departure && !(i.departureLat && i.departureLng)) || (i.arrival && !(i.arrivalLat && i.arrivalLng))
  );

  return (
    <div>
      <h1 className="page-title">🗺️ Mappa</h1>

      <PlaceSearch location={searchLocation} onShowOnMap={showSearchOnMap} onDetect={detectCurrentLocation} detecting={detecting} onLocationChange={handleLocationChange} />

      <div className="card" style={{ margin: '12px 0 16px', overflow: 'hidden' }}>
        <div className="card-title" style={{ marginBottom: 8 }}>🚂 Trasporti pubblici</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
          Cerca orari reali di treni e bus in tutta Europa.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Da (es. München Hbf, Roma Termini, Wien Hbf)"
            value={transitFrom}
            onChange={e => setTransitFrom(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', fontSize: '0.85rem', boxSizing: 'border-box' }}
          />
          <input
            type="text"
            placeholder="A (es. Innsbruck Hbf, Firenze SMN, Berlin Hbf)"
            value={transitTo}
            onChange={e => setTransitTo(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', fontSize: '0.85rem', boxSizing: 'border-box' }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={async () => {
              if (!transitFrom.trim() || !transitTo.trim()) return;
              setTransitLoading(true);
              setTransitResults(null);

              async function fetchWithTimeout(url, opts, ms = 15000) {
                const c = new AbortController();
                const t = setTimeout(() => c.abort(), ms);
                try { return await fetch(url, { ...opts, signal: c.signal }); } finally { clearTimeout(t); }
              }

              function dedupTrips(trips) {
                const seen = new Set();
                return trips.filter(t => {
                  const key = `${t.depTime}-${t.line}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
              }

              async function searchTransportRest(from, to) {
                const r1 = await fetchWithTimeout(`https://v6.db.transport.rest/locations?query=${encodeURIComponent(from)}&addresses=false&poi=false`);
                if (!r1.ok) return null;
                const stops1 = await r1.json();
                const s1 = stops1.find(s => s.type === 'stop');
                if (!s1) return null;

                const r2 = await fetchWithTimeout(`https://v6.db.transport.rest/locations?query=${encodeURIComponent(to)}&addresses=false&poi=false`);
                if (!r2.ok) return null;
                const stops2 = await r2.json();
                const s2 = stops2.find(s => s.type === 'stop');
                if (!s2) return null;

                const r3 = await fetchWithTimeout(`https://v6.db.transport.rest/stops/${s1.id}/departures?results=20&stopovers=true`);
                if (!r3.ok) return null;
                const departures = await r3.json();

                const matching = departures.filter(d => {
                  const destName = (d.direction || '').toLowerCase();
                  const target = s2.name.toLowerCase().split(',')[0];
                  return destName.includes(target) || destName.includes(to.toLowerCase().split(',')[0]);
                });

                const all = matching.length > 0 ? matching : departures;
                const raw = all.slice(0, 12).map(d => {
                  const depDate = new Date(d.when);
                  const arrDate = d.plannedArrival ? new Date(d.plannedArrival) : null;
                  const durMin = arrDate ? Math.round((arrDate - depDate) / 60000) : null;
                  let lineName = d.line?.name || '';
                  if (lineName.length > 12) lineName = lineName.slice(0, 10) + '…';
                  const dest = d.direction || '';
                  return {
                    line: lineName,
                    dest,
                    depTime: depDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
                    arrTime: arrDate ? arrDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '',
                    duration: durMin != null ? `${durMin} min` : '',
                    platform: d.platform || '',
                  };
                });
                return { from: s1.name, to: s2.name, trips: dedupTrips(raw) };
              }

              async function searchEFA(from, to) {
                const r1 = await fetchWithTimeout(`https://efa.sta.bz.it/api/endpoint/XML_STOPFINDER_REQUEST?language=it&sf=${encodeURIComponent(from)}&type_sf=any`);
                const x1 = new DOMParser().parseFromString(await r1.text(), 'text/xml');
                const stops1 = [...x1.querySelectorAll('stop')].map(s => ({ id: s.getAttribute('ref'), name: s.getAttribute('name') })).filter(s => s.id);
                const r2 = await fetchWithTimeout(`https://efa.sta.bz.it/api/endpoint/XML_STOPFINDER_REQUEST?language=it&sf=${encodeURIComponent(to)}&type_sf=any`);
                const x2 = new DOMParser().parseFromString(await r2.text(), 'text/xml');
                const stops2 = [...x2.querySelectorAll('stop')].map(s => ({ id: s.getAttribute('ref'), name: s.getAttribute('name') })).filter(s => s.id);
                if (!stops1.length || !stops2.length) return null;
                const r3 = await fetchWithTimeout(`https://efa.sta.bz.it/api/endpoint/XML_TRIP_REQUEST2?language=it&name_origin=${stops1[0].id}&name_destination=${stops2[0].id}&type_origin=stop&type_destination=stop`);
                const x3 = new DOMParser().parseFromString(await r3.text(), 'text/xml');
                const raw = [...x3.querySelectorAll('trip')].slice(0, 8).map(trip => {
                  const legs = [...trip.querySelectorAll('leg')];
                  const depLeg = legs[0];
                  const arrLeg = legs[legs.length - 1];
                  const depTime = depLeg?.querySelector('departure')?.getAttribute('datetime') || '';
                  const arrTime = arrLeg?.querySelector('arrival')?.getAttribute('datetime') || '';
                  const duration = trip.getAttribute('duration') || '';
                  const line = depLeg?.querySelector('line')?.getAttribute('number') || '';
                  const dest = depLeg?.querySelector('direction')?.getAttribute('name') || '';
                  const depDate = depTime ? new Date(depTime) : null;
                  const arrDate = arrTime ? new Date(arrTime) : null;
                  return {
                    line, dest,
                    depTime: depDate ? depDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : depTime,
                    arrTime: arrDate ? arrDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : arrTime,
                    duration, platform: '',
                  };
                });
                if (raw.length === 0) return null;
                return { from: stops1[0].name, to: stops2[0].name, trips: dedupTrips(raw) };
              }

              try {
                let result = null;
                try { result = await searchTransportRest(transitFrom, transitTo); } catch {}
                if (!result || !result.trips?.length) {
                  try { result = await searchEFA(transitFrom, transitTo); } catch {}
                }
                if (result && result.trips?.length > 0) {
                  setTransitResults(result);
                } else {
                  setTransitResults({ error: 'Nessuna connessione trovata. Prova con il nome completo della stazione (es. "München Hbf" invece di "Monaco").' });
                }
              } catch {
                setTransitResults({ error: 'Errore durante la ricerca. Riprova.' });
              }
              setTransitLoading(false);
            }}
            disabled={transitLoading || !transitFrom.trim() || !transitTo.trim()}
          >
            {transitLoading ? '⏳ Cerco...' : '🔍 Cerca collegamenti'}
          </button>
        </div>
        {transitResults && (
          <div style={{ marginTop: 4 }}>
            {transitResults.error ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--warning)', margin: 0 }}>{transitResults.error}</p>
            ) : (
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  {transitResults.from} → {transitResults.to}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {transitResults.trips.map((t, i) => (
                    <div key={i} style={{
                      padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--bg)', fontSize: '0.8rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          fontWeight: 700, color: '#fff', background: 'var(--primary)',
                          padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', whiteSpace: 'nowrap',
                        }}>{t.line || '🚇'}</span>
                        <span style={{ fontWeight: 600 }}>{t.depTime}</span>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span style={{ fontWeight: 600 }}>{t.arrTime}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{t.duration}</span>
                        {t.platform && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 4 }}>Bin {t.platform}</span>}
                      </div>
                      {t.dest && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                          → {t.dest}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {searchPoints.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            setSearchPoints([]);
          }}>
            ✖️ Torna al percorso itinerario
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => { setViewMode('itinerary'); }}>
          📋 Giorno corrente
        </button>
        <button className="btn btn-secondary" onClick={() => setViewMode('all')}>
          🗺️ Tutti i giorni (percorso totale)
        </button>
      </div>

      {dayItems.length > 0 && (
        <div className="card" style={{ marginBottom: 12, padding: 12 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>🧭 Naviga giorno {activeDay}</div>
          {(() => {
            const allPts = [];
            dayItems.forEach(i => {
              if (i.departureLat && i.departureLng) allPts.push({ lat: i.departureLat, lng: i.departureLng, label: i.departure });
              if (i.lat && i.lng) allPts.push({ lat: i.lat, lng: i.lng, label: i.location });
              if (i.arrivalLat && i.arrivalLng) allPts.push({ lat: i.arrivalLat, lng: i.arrivalLng, label: i.arrival });
            });
            if (allPts.length < 2) {
              return (
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                    Servono almeno 2 punti con coordinate. Usa "📍 Geocodifica" o "📍 Trova posizioni" nella mappa qui sotto.
                  </p>
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => {
                    const items = dayItems.filter(i => i.location || i.departure || i.arrival);
                    items.forEach(i => handleGeocode(i));
                  }}>
                    📍 Geocodifica tutti i punti del giorno {activeDay}
                  </button>
                </div>
              );
            }
            const start = allPts[0];
            const end = allPts[allPts.length - 1];
            const waypoints = allPts.slice(1, -1);
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '10px 8px' }} onClick={() => openInHereWeGo(start, end, waypoints)}>
                  🗺️ HERE WeGo
                </button>
                <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '10px 8px', background: '#4285F4' }} onClick={() => openInGoogleMaps(start, end)}>
                  📍 Google Maps
                </button>
                <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '10px 8px', background: '#33CCFF' }} onClick={() => openInWaze(start, end)}>
                  💙 Waze
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {viewMode === 'itinerary' && (
        <div style={{ marginBottom: 12 }}>
          {getDaySegments().map((seg, s) => {
            const alts = altRoutes[s] || [];
            const sel = selectedAlts[s] || 0;
            return (
              <div key={s} style={{ marginBottom: 8, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  🛣️ Tragitto {s + 1}: {seg.a.label || 'A'} → {seg.b.label || 'B'}
                </div>
                {loadingRoute && alts.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Calcolo percorso...</div>
                ) : alts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {alts.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const next = [...selectedAlts];
                          next[s] = i;
                          setSelectedAlts(next);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                          borderRadius: 8, border: sel === i ? '2px solid var(--primary)' : '1px solid var(--border)',
                          background: sel === i ? 'var(--primary-bg, rgba(102,126,234,0.1))' : 'var(--bg-input)',
                          cursor: 'pointer', textAlign: 'left', width: '100%', fontSize: '0.8rem',
                          color: sel === i ? 'var(--primary)' : 'var(--text-secondary)',
                        }}
                      >
                        <span style={{
                          width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: sel === i ? 'var(--primary)' : 'var(--border)', color: sel === i ? '#fff' : 'var(--text-muted)',
                          fontWeight: 700, fontSize: '0.7rem', flexShrink: 0,
                        }}>{i + 1}</span>
                        <span style={{ flex: 1 }}>
                          <strong>{formatKm(r.distanceKm)} km</strong> · {formatDuration(Math.round(r.durationMin))}
                        </span>
                        {sel === i && <span style={{ color: 'var(--primary)', fontWeight: 700 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {seg.a.lat && seg.b.lat ? 'Nessuna alternativa trovata' : 'Inserisci partenza e arrivo'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="day-tabs">
        {Array.from({ length: days }, (_, i) => i + 1).map(day => (
          <button key={day} className={`day-tab ${activeDay === day ? 'active' : ''}`} onClick={() => { setActiveDay(day); setViewMode('itinerary'); }}>
            Giorno {day}
          </button>
        ))}
      </div>

      {viewMode === 'all' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 12px' }}>
          {Object.keys(getDayGroups()).map(Number).sort((a, b) => a - b).map(day => (
            <span key={day} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span style={{ width: 14, height: 4, borderRadius: 2, background: DAY_COLORS[day % DAY_COLORS.length] }} />
              Giorno {day}
            </span>
          ))}
        </div>
      )}

      <div className="map-container" ref={mapRef} style={{ height: 420 }} />

      {(routeKm !== null || totalKm > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '12px 0' }}>
          {routeKm !== null && (
            <div className="stat-card">
              <div className="stat-value">{routeKm} km</div>
              <div className="stat-label">Distanza percorso</div>
            </div>
          )}
          {routeDuration !== null && (
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '1rem' }}>{formatDuration(routeDuration)}</div>
              <div className="stat-label">Durata stimata</div>
            </div>
          )}
          {routeKm === null && totalKm > 0 && (
            <div className="stat-card">
              <div className="stat-value">{totalKm} km</div>
              <div className="stat-label">Km inseriti</div>
            </div>
          )}
        </div>
      )}
      {loadingRoute && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0' }}>
          Calcolo percorso in corso...
        </p>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {viewMode === 'itinerary' ? `📍 Punti del giorno ${activeDay}` : '📍 Tutti i punti'}
          </span>
          {missingLocation.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={handleAutoGeocodeAll}>
              📍 Trova posizioni ({missingLocation.length})
            </button>
          )}
        </div>
        {visibleItems.filter(i => i.location || i.departure || i.arrival || (i.lat && i.lng)).length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Nessun punto con posizione. Aggiungi luoghi, partenza e arrivo nel programma, poi usa "Trova posizioni".
          </p>
        ) : (
          visibleItems.filter(i => i.location || i.departure || i.arrival || (i.lat && i.lng)).map((item, idx) => {
            const typeInfo = ITINERARY_TYPES.find(t => t.value === item.type);
            const hasCoords = (item.lat && item.lng) || (item.arrivalLat && item.arrivalLng);
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, fontSize: '0.85rem' }}>
                  <span>{typeInfo?.icon} {item.title}</span>
                  {item.location && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 {item.location}</div>}
                  {(item.departure || item.arrival) && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      🚏 {item.departure || '—'}
                      {(item.tappe && item.tappe.length > 0) && item.tappe.map((t, i) => (
                        <span key={i}> <span style={{ color: 'var(--text-muted)' }}>→</span> 📍{t.name || `Tappa ${i + 1}`}</span>
                      ))}
                      <span style={{ color: 'var(--text-muted)' }}> →</span> {item.arrival || '—'}
                    </div>
                  )}
                </div>
                {item.km > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--primary-light)' }}>{item.km} km</span>}
                {!hasCoords && (item.location || item.departure || item.arrival) && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleGeocode(item)} style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
                    📍 Geocodifica
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
