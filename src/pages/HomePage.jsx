import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatKm } from '../utils/helpers';

export default function HomePage() {
  const { trips, addTrip, selectTrip, removeTrip, exportAllTrips, importTrips } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', destination: '', startDate: '', endDate: '', budget: '', notes: '' });
  const navigate = useNavigate();

  function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const days = form.startDate && form.endDate ? Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1 : 0;
    addTrip({ ...form, days, budget: Number(form.budget) || 0 });
    setForm({ name: '', destination: '', startDate: '', endDate: '', budget: '', notes: '' });
    setShowModal(false);
  }

  function handleSelectTrip(trip) {
    selectTrip(trip);
    navigate(`/trip/${trip.id}`);
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
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        importTrips(data);
      } catch {
        alert('File non valido');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <h1 className="page-title">I miei viaggi</h1>

      {trips.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✈️</div>
          <h3>Nessun viaggio ancora</h3>
          <p>Crea il tuo primo viaggio per iniziare a pianificare!</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ➕ Nuovo Viaggio
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              ➕ Nuovo Viaggio
            </button>
            <button className="btn btn-secondary" onClick={handleExport}>
              📤 Backup
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              📥 Importa
              <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            </label>
          </div>
          {trips.map(trip => (
            <div key={trip.id} className="trip-card" onClick={() => handleSelectTrip(trip)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div className="trip-name">✈️ {trip.name}</div>
                  <div className="trip-dates">
                    {trip.startDate && trip.endDate
                      ? `${new Date(trip.startDate).toLocaleDateString('it-IT')} - ${new Date(trip.endDate).toLocaleDateString('it-IT')}`
                      : 'Date non impostate'}
                    {trip.days > 0 && ` · ${trip.days} giorni`}
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={(e) => { e.stopPropagation(); if (confirm('Eliminare questo viaggio?')) removeTrip(trip.id); }}
                >
                  🗑️
                </button>
              </div>
              <div className="trip-stats">
                {trip.budget > 0 && <span className="trip-stat">💰 {formatCurrency(trip.budget)}</span>}
                {trip.totalKm > 0 && <span className="trip-stat">🛣️ {formatKm(trip.totalKm)} km</span>}
                {trip.transportModes?.length > 0 && (
                  <span className="trip-stat">
                    {trip.transportModes.map(t => {
                      const icons = { auto: '🚗', treno: '🚆', aereo: '✈️', nave: '🚢', bus: '🚌', motorino: '🛵', bicicletta: '🚲', taxi: '🚕', 'a piedi': '🚶' };
                      return icons[t] || '🚗';
                    }).join(' ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">Nuovo Viaggio</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Nome del viaggio</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Es: Vacanza in Toscana"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Destinazione</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Es: Roma, Parigi, Toscana..."
                  value={form.destination}
                  onChange={e => setForm({ ...form, destination: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Data inizio</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Data fine</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Budget (€)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="0.00"
                  value={form.budget}
                  onChange={e => setForm({ ...form, budget: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <textarea
                  className="form-textarea"
                  placeholder="Note sul viaggio..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Annulla
                </button>
                <button type="submit" className="btn btn-primary">
                  Crea Viaggio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
