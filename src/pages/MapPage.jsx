import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ITINERARY_TYPES, calculateTotalKm, formatDuration, formatKm } from '../utils/helpers';
import PlaceSearch from '../components/PlaceSearch';
import {
  createMap, addMarker, addRoutePolyline, addRouteSegment, fitMapToPoints, clearMarkers,
  geocodeNominatim, getRouteDistance, getRouteAlternatives, openInOsm, DAY_COLORS,
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
  const [selectedAlt, setSelectedAlt] = useState(0);

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
  }, [activeDay, viewMode, tripItems, searchPoints, selectedAlt, altRoutes]);

  useEffect(() => {
    if (viewMode === 'itinerary') {
      calculateRouteDistance();
      fetchAlternatives();
    } else {
      setRouteKm(null);
      setRouteDuration(null);
      setAltRoutes([]);
      setSelectedAlt(0);
    }
  }, [viewMode, activeDay]);

  async function getDayRoutePoints() {
    const ordered = [...dayItems].sort(sortByTime);
    const pts = [];
    for (const item of ordered) {
      const itemPts = getRoutePointsForItem(item);
      for (const p of itemPts) {
        const last = pts[pts.length - 1];
        if (!last || last.lat !== p.lat || last.lng !== p.lng) pts.push(p);
      }
    }
    return pts;
  }

  async function fetchAlternatives() {
    const pts = await getDayRoutePoints();
    if (pts.length < 2) {
      setAltRoutes([]);
      setSelectedAlt(0);
      return;
    }
    const firstMode = dayItems.find(i => i.transportMode)?.transportMode || 'auto';
    const routes = await getRouteAlternatives(pts, firstMode);
    setAltRoutes(routes);
    setSelectedAlt(0);
  }

  async function renderMap() {
    const map = mapInstance.current;
    if (!map) return;
    clearMarkers(map);

    if (searchPoints.length > 0) {
      searchPoints.forEach((p, i) => addMarker(map, p.lat, p.lng, i + 1, p.name));
      fitMapToPoints(map, searchPoints.map(p => ({ lat: p.lat, lng: p.lng })));
      return;
    }

    const items = getVisibleItems();
    const markerItems = items.filter(i => (i.lat && i.lng) || (i.arrivalLat && i.arrivalLng));

    if (viewMode === 'itinerary') {
      const ordered = [...dayItems].sort(sortByTime);
      let allCoords = [];
      let colorIdx = 0;

      if (altRoutes.length > 0 && altRoutes[selectedAlt]) {
        addRouteSegment(map, altRoutes[selectedAlt].coordinates, DAY_COLORS[activeDay % DAY_COLORS.length]);
        allCoords = allCoords.concat(altRoutes[selectedAlt].coordinates);
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
          colorIdx++;
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
    markerItems.forEach(item => {
      const mpt = item.lat && item.lng ? { lat: item.lat, lng: item.lng } : { lat: item.arrivalLat, lng: item.arrivalLng };
      addMarker(map, mpt.lat, mpt.lng, markerIdx++, item.title);
    });

    const fitPoints = markerItems.map(i => i.lat && i.lng ? { lat: i.lat, lng: i.lng } : { lat: i.arrivalLat, lng: i.arrivalLng });
    fitMapToPoints(map, fitPoints);
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
    if (altRoutes.length > 0 && altRoutes[selectedAlt]) {
      setRouteKm(Math.round(altRoutes[selectedAlt].distanceKm * 10) / 10);
      setRouteDuration(Math.round(altRoutes[selectedAlt].durationMin));
      return;
    }
    const ordered = [...dayItems].sort(sortByTime);
    let segments = [];
    for (const item of ordered) {
      const pts = getRoutePointsForItem(item);
      if (pts.length >= 2) segments.push({ a: pts[0], b: pts[pts.length - 1], mode: item.transportMode });
    }
    if (segments.length === 0) {
      setRouteKm(null);
      setRouteDuration(null);
      return;
    }
    setLoadingRoute(true);
    let total = 0;
    let minutes = 0;
    for (const seg of segments) {
      const route = await getRouteDistance(seg.a, seg.b, seg.mode);
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
        {points.length >= 2 && (
          <button className="btn btn-primary" onClick={() => {
            const pts = points.map(i => i.lat && i.lng ? { lat: i.lat, lng: i.lng } : { lat: i.arrivalLat, lng: i.arrivalLng });
            openInOsm(pts[0], pts[pts.length - 1]);
          }}>
            🧭 Apri indicazioni stradali
          </button>
        )}
      </div>

      {altRoutes.length > 1 && (
        <div className="route-options">
          {altRoutes.map((r, i) => (
            <button
              key={i}
              className={`route-option ${selectedAlt === i ? 'active' : ''}`}
              onClick={() => { setSelectedAlt(i); }}
            >
              Percorso {i + 1} · {formatKm(r.distanceKm)} km · {formatDuration(Math.round(r.durationMin))}
            </button>
          ))}
        </div>
      )}
      {altRoutes.length === 1 && (
        <div className="route-options">
          <span className="route-option active">Unico percorso · {formatKm(altRoutes[0].distanceKm)} km · {formatDuration(Math.round(altRoutes[0].durationMin))}</span>
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
                      🚏 {item.departure || '—'} → {item.arrival || '—'}
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
