import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ITINERARY_TYPES, TRANSPORT_MODES, formatCurrency, formatKm, calculateTotalKm } from '../utils/helpers';
import { geocodeNominatim, getRouteDistance } from '../components/LeafletMap';
import PlaceInput from '../components/PlaceInput';

export default function ItineraryPage() {
  const { id } = useParams();
  const { itinerary, addItineraryItem, removeItineraryItem, currentTrip, updateItineraryItem, loadTripData } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    dayNumber: 1, time: '', title: '', description: '', location: '',
    lat: null, lng: null,
    departure: '', departureLat: null, departureLng: null,
    arrival: '', arrivalLat: null, arrivalLng: null,
    type: 'visita', km: '', transportMode: '', duration: '', cost: '', notes: '',
  });

  useEffect(() => {
    loadTripData(id);
  }, [id]);

  const tripItems = itinerary.filter(i => i.tripId === id).sort((a, b) => {
    if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
    return (a.time || '').localeCompare(b.time || '');
  });

  const days = currentTrip?.days || 7;
  const dayItems = tripItems.filter(i => i.dayNumber === activeDay);
  const totalKm = calculateTotalKm(tripItems);

  async function autoCalculateKm(form) {
    try {
      const useCoords = (text, lat, lng) =>
        text && lat && lng ? { lat: Number(lat), lng: Number(lng) } : (text ? geocodeNominatim(text) : null);

      const depP = form.departureLat && form.departureLng
        ? { lat: Number(form.departureLat), lng: Number(form.departureLng) }
        : (form.departure ? geocodeNominatim(form.departure) : null);
      const locP = form.lat && form.lng
        ? { lat: Number(form.lat), lng: Number(form.lng) }
        : (form.location ? geocodeNominatim(form.location) : null);
      const arrP = form.arrivalLat && form.arrivalLng
        ? { lat: Number(form.arrivalLat), lng: Number(form.arrivalLng) }
        : (form.arrival ? geocodeNominatim(form.arrival) : null);

      const [dep, loc, arr] = await Promise.all([depP, locP, arrP]);

      const coords = {
        departureLat: dep?.lat || null,
        departureLng: dep?.lng || null,
        lat: loc?.lat || null,
        lng: loc?.lng || null,
        arrivalLat: arr?.lat || null,
        arrivalLng: arr?.lng || null,
      };

      const pts = [dep, loc, arr].filter(p => p && p.lat && p.lng);
      if (pts.length < 2) return { km: 0, coords };

      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const samePoint = Math.abs(pts[i].lat - pts[i + 1].lat) < 0.0001 && Math.abs(pts[i].lng - pts[i + 1].lng) < 0.0001;
        if (samePoint) continue;
        const route = await getRouteDistance(pts[i], pts[i + 1], form.transportMode);
        if (route && route.distanceKm > 0) total += route.distanceKm;
      }

      return { km: total > 0 ? Math.round(total * 10) / 10 : 0, coords };
    } catch {
      return { km: 0, coords: {} };
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;

    let km = Number(form.km) || 0;
    let coords = {};
    if (!km && (form.departure || form.arrival || form.location)) {
      const result = await autoCalculateKm(form);
      km = result.km || 0;
      coords = result.coords;
    }

    if (editingItem) {
      updateItineraryItem({ ...editingItem, ...form, ...coords, km, cost: Number(form.cost) || 0 });
      setEditingItem(null);
    } else {
      addItineraryItem({ ...form, ...coords, tripId: id, km, cost: Number(form.cost) || 0 });
    }
    setForm({ dayNumber: activeDay, time: '', title: '', description: '', location: '', lat: null, lng: null, departure: '', departureLat: null, departureLng: null, arrival: '', arrivalLat: null, arrivalLng: null, type: 'visita', km: '', transportMode: '', duration: '', cost: '', notes: '' });
    setShowModal(false);
  }

  function handleEdit(item) {
    setEditingItem(item);
    setForm({
      dayNumber: item.dayNumber, time: item.time || '', title: item.title,
      description: item.description || '', location: item.location || '',
      lat: item.lat || null, lng: item.lng || null,
      departure: item.departure || '', departureLat: item.departureLat || null, departureLng: item.departureLng || null,
      arrival: item.arrival || '', arrivalLat: item.arrivalLat || null, arrivalLng: item.arrivalLng || null,
      type: item.type || 'visita', km: item.km?.toString() || '',
      transportMode: item.transportMode || '', duration: item.duration || '',
      cost: item.cost?.toString() || '', notes: item.notes || '',
    });
    setShowModal(true);
  }

  function handleKmUpdate(item, newKm) {
    updateItineraryItem({ ...item, km: Number(newKm) || 0 });
  }

  const dayKm = dayItems.reduce((sum, i) => sum + (Number(i.km) || 0), 0);

  return (
    <div>
      <h1 className="page-title">📋 Programma</h1>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
        <p className="page-subtitle" style={{ margin: 0 }}>
          🛣️ Km giorno {activeDay}: <strong>{formatKm(dayKm)} km</strong>
          {totalKm > dayKm && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> · Totale viaggio: {formatKm(totalKm)} km</span>}
        </p>
      </div>

      <div className="day-tabs">
        {Array.from({ length: days }, (_, i) => i + 1).map(day => (
          <button
            key={day}
            className={`day-tab ${activeDay === day ? 'active' : ''}`}
            onClick={() => setActiveDay(day)}
          >
            Giorno {day}
          </button>
        ))}
      </div>

      {dayItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>Nessuna attività per il giorno {activeDay}</h3>
          <p>Aggiungi visite, spostamenti e attività</p>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            {dayItems.length} attività
          </div>
          {dayItems.map(item => {
            const typeInfo = ITINERARY_TYPES.find(t => t.value === item.type);
            const transportInfo = TRANSPORT_MODES.find(t => t.value === item.transportMode);
            return (
              <div key={item.id} className="timeline-item">
                <div className="timeline-time">{item.time || '—'}</div>
                <div className="timeline-content" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <div className="timeline-title">
                        {typeInfo?.icon} {item.title}
                      </div>
                      {item.location && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          📍 {item.location}
                        </div>
                      )}
                      {(item.departure || item.arrival) && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          🚏 {item.departure || '—'} <span style={{ color: 'var(--text-muted)' }}>→</span> {item.arrival || '—'}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(item)} style={{ padding: '4px 8px' }}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => removeItineraryItem(item.id)} style={{ padding: '4px 8px' }}>🗑️</button>
                    </div>
                  </div>
                  {item.description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{item.description}</div>
                  )}
                  <div className="timeline-meta" style={{ marginTop: 6 }}>
                    {transportInfo && <span>{transportInfo.icon} {transportInfo.label}</span>}
                    {item.km > 0 && (
                      <span>
                        🛣️ <input
                          type="number"
                          value={item.km}
                          onChange={(e) => handleKmUpdate(item, e.target.value)}
                          style={{
                            width: 60, background: 'var(--bg-input)', border: '1px solid var(--border)',
                            borderRadius: 4, color: 'var(--primary-light)', fontSize: '0.75rem',
                            padding: '2px 4px', textAlign: 'right',
                          }}
                          onClick={e => e.stopPropagation()}
                        /> km
                      </span>
                    )}
                    {item.duration && <span>⏱️ {item.duration}</span>}
                    {item.cost > 0 && <span>💰 {formatCurrency(item.cost)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="fab" onClick={() => { setEditingItem(null); setForm({ ...form, dayNumber: activeDay }); setShowModal(true); }}>
        ➕
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">{editingItem ? 'Modifica attività' : 'Nuova attività'}</h2>
            <form onSubmit={handleAdd}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Giorno</label>
                  <select className="form-select" value={form.dayNumber} onChange={e => setForm({ ...form, dayNumber: Number(e.target.value) })}>
                    {Array.from({ length: days }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Giorno {d}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Orario</label>
                  <input className="form-input" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <div className="tag-group">
                  {ITINERARY_TYPES.map(type => (
                    <span
                      key={type.value}
                      className={`tag ${form.type === type.value ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, type: type.value })}
                    >
                      {type.icon} {type.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Titolo</label>
                <input className="form-input" placeholder="Es: Visita Colosseo" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Luogo</label>
                <PlaceInput
                  placeholder="Indirizzo o nome del luogo"
                  value={form.location}
                  onChange={r => setForm({ ...form, location: r.value, lat: r.lat, lng: r.lng })}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">🚏 Partenza</label>
                  <PlaceInput
                    placeholder="Es: Hotel Centro"
                    value={form.departure}
                    onChange={r => setForm({ ...form, departure: r.value, departureLat: r.lat, departureLng: r.lng })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">🏁 Arrivo</label>
                  <PlaceInput
                    placeholder="Es: Stazione"
                    value={form.arrival}
                    onChange={r => setForm({ ...form, arrival: r.value, arrivalLat: r.lat, arrivalLng: r.lng })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrizione</label>
                <textarea className="form-textarea" placeholder="Dettagli..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Km spostamento</label>
                  <input className="form-input" type="number" placeholder="0" value={form.km} onChange={e => setForm({ ...form, km: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Costo (€)</label>
                  <input className="form-input" type="number" placeholder="0.00" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Mezzo di trasporto</label>
                <select className="form-select" value={form.transportMode} onChange={e => setForm({ ...form, transportMode: e.target.value })}>
                  <option value="">Nessuno</option>
                  {TRANSPORT_MODES.map(t => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Durata prevista</label>
                <input className="form-input" type="text" placeholder="Es: 2 ore" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">{editingItem ? 'Aggiorna' : 'Aggiungi'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
