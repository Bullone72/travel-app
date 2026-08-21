import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatKm, calculateTotalExpenses, calculateTotalKm, TRANSPORT_MODES, ACCOMMODATION_TYPES } from '../utils/helpers';
import { exportTripData } from '../services/database';

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trips, currentTrip, expenses, itinerary, selectTrip, updateTrip, participants, loadTripData } = useApp();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [showAccommodationModal, setShowAccommodationModal] = useState(false);

  useEffect(() => {
    loadTripData(id);
  }, [id]);

  useEffect(() => {
    const trip = trips.find(t => t.id === id);
    if (trip) {
      selectTrip(trip);
      setForm(trip);
    }
  }, [id, trips]);

  if (!currentTrip || currentTrip.id !== id) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>Viaggio non trovato</h3>
        <Link to="/" className="btn btn-primary">Torna alla home</Link>
      </div>
    );
  }

  const totalExpenses = calculateTotalExpenses(expenses);
  const totalKm = calculateTotalKm(itinerary);
  const budgetUsed = currentTrip.budget > 0 ? (totalExpenses / currentTrip.budget * 100) : 0;

  const [shareMsg, setShareMsg] = useState('');

  function handleSave() {
    updateTrip({ ...form, totalKm });
    setEditing(false);
  }

  async function handleShareTrip() {
    try {
      const data = await exportTripData(id);
      const json = JSON.stringify(data, null, 2);
      const filename = `travelmate-${currentTrip.name || 'viaggio'}.json`;

      try {
        const { Share } = await import('@capacitor/share');
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache });
        const uriResult = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
        await Share.share({ title: `Viaggio: ${currentTrip.name}`, files: [uriResult.uri], dialogTitle: 'Condividi viaggio' });
        return;
      } catch {}

      try {
        await navigator.clipboard.writeText(json);
        setShareMsg('📋 JSON copiato negli appunti!');
        setTimeout(() => setShareMsg(''), 3000);
        return;
      } catch {}

      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
      setShareMsg('✅ File scaricato!');
      setTimeout(() => setShareMsg(''), 3000);
    } catch (e) {
      setShareMsg('❌ Errore: ' + e.message);
      setTimeout(() => setShareMsg(''), 4000);
    }
  }

  function toggleTransport(mode) {
    const current = form.transportModes || [];
    const updated = current.includes(mode)
      ? current.filter(m => m !== mode)
      : [...current, mode];
    setForm({ ...form, transportModes: updated });
  }

  function toggleAccommodation(type) {
    const current = form.accommodationTypes || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    setForm({ ...form, accommodationTypes: updated });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{currentTrip.name}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleShareTrip}>📤 Condividi</button>
          <button className="btn btn-secondary btn-sm" onClick={() => editing ? handleSave() : setEditing(true)}>
            {editing ? '💾 Salva' : '✏️ Modifica'}
          </button>
        </div>
      </div>
      {shareMsg && <p style={{ fontSize: '0.8rem', color: shareMsg.includes('❌') ? 'var(--danger)' : 'var(--success)', margin: '0 0 8px 0' }}>{shareMsg}</p>}

      <p className="page-subtitle" style={{ marginTop: 0 }}>
        {currentTrip.destination && <span style={{ fontWeight: 600 }}>📍 {currentTrip.destination}</span>}
        {currentTrip.destination && currentTrip.startDate && ' · '}
        {currentTrip.startDate && currentTrip.endDate
          ? `${new Date(currentTrip.startDate).toLocaleDateString('it-IT')} - ${new Date(currentTrip.endDate).toLocaleDateString('it-IT')}`
          : 'Date non impostate'}
      </p>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-value">{currentTrip.days || '—'}</div>
          <div className="stat-label">Giorni</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalKm ? formatKm(totalKm) : '—'}</div>
          <div className="stat-label">Km totali</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(totalExpenses)}</div>
          <div className="stat-label">Speso</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(currentTrip.budget || 0)}</div>
          <div className="stat-label">Budget</div>
        </div>
      </div>

      {currentTrip.budget > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
            <span>Budget utilizzato</span>
            <span>{budgetUsed.toFixed(1)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(budgetUsed, 100)}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            <span>{formatCurrency(totalExpenses)}</span>
            <span>Rimanente: {formatCurrency(Math.max(currentTrip.budget - totalExpenses, 0))}</span>
          </div>
        </div>
      )}

      <div className="card" onClick={() => !editing && setShowTransportModal(true)} style={{ cursor: editing ? 'default' : 'pointer' }}>
        <div className="card-header">
          <span className="card-title">🚗 Mezzi di trasporto</span>
          {!editing && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Modifica ›</span>}
        </div>
        <div className="tag-group">
          {(form.transportModes || []).length > 0
            ? form.transportModes.map(mode => {
                const info = TRANSPORT_MODES.find(m => m.value === mode);
                return <span key={mode} className="tag active">{info?.icon} {info?.label}</span>;
              })
            : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nessun mezzo selezionato</span>
          }
        </div>
      </div>

      <div className="card" onClick={() => !editing && setShowAccommodationModal(true)} style={{ cursor: editing ? 'default' : 'pointer' }}>
        <div className="card-header">
          <span className="card-title">🏨 Tipo alloggio</span>
          {!editing && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Modifica ›</span>}
        </div>
        <div className="tag-group">
          {(form.accommodationTypes || []).length > 0
            ? form.accommodationTypes.map(type => {
                const info = ACCOMMODATION_TYPES.find(t => t.value === type);
                return <span key={type} className="tag active">{info?.icon} {info?.label}</span>;
              })
            : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nessun alloggio selezionato</span>
          }
        </div>
      </div>

      {editing && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📝 Modifica viaggio</span>
          </div>
          <div className="form-group">
            <label className="form-label">Destinazione</label>
            <input
              className="form-input"
              type="text"
              placeholder="Es: Roma, Parigi, Toscana..."
              value={form.destination || ''}
              onChange={e => setForm({ ...form, destination: e.target.value })}
            />
          </div>
          <textarea
            className="form-textarea"
            placeholder="Note sul viaggio..."
            value={form.notes || ''}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">👥 Partecipanti</span>
          <Link to={`/trip/${currentTrip.id}/split`} className="btn btn-secondary btn-sm">Gestisci</Link>
        </div>
        {participants.length > 0 ? (
          <div>
            {participants.map(p => {
              const tripExpenses = expenses.filter(e => e.tripId === id);
              const tripParticipants = participants;
              const paid = tripExpenses.filter(e => e.paidBy === p.name).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
              let owed = 0;
              for (const e of tripExpenses) {
                const amount = Number(e.amount) || 0;
                if (!e.isShared) continue;
                let splitters = tripParticipants.filter(pp => !pp.isExcluded);
                if (e.splitAmong && e.splitAmong.length > 0) {
                  splitters = splitters.filter(pp => e.splitAmong.includes(pp.name));
                }
                if (e.paidBy && !splitters.some(pp => pp.name === e.paidBy)) {
                  const payer = tripParticipants.find(pp => pp.name === e.paidBy);
                  if (payer && !payer.isExcluded) splitters = [...splitters, payer];
                }
                splitters = splitters.filter(pp => !(e.excludedFrom || []).includes(pp.name));
                if (splitters.length === 0 || !splitters.some(pp => pp.name === p.name)) continue;
                owed += amount / splitters.length;
              }
              const balance = paid - owed;
              return (
              <div key={p.id} className="participant-card">
                <div className="participant-avatar">{p.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Pagato: {formatCurrency(paid)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nessun partecipante aggiunto</p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
        <Link to={`/trip/${currentTrip.id}/wallet`} className="card" style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>💳</div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Wallet</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Biglietti e documenti</div>
        </Link>
        <Link to={`/trip/${currentTrip.id}/itinerary`} className="card" style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Programma</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pianifica le visite</div>
        </Link>
        <Link to={`/trip/${currentTrip.id}/expenses`} className="card" style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>💰</div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Spese</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{expenses.length} spese registrate</div>
        </Link>
        <Link to={`/trip/${currentTrip.id}/map`} className="card" style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🗺️</div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Mappa</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Itinerario interattivo</div>
        </Link>
      </div>

      {showTransportModal && (
        <div className="modal-overlay" onClick={() => setShowTransportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">Mezzi di trasporto</h2>
            <div className="tag-group" style={{ gap: 10 }}>
              {TRANSPORT_MODES.map(mode => (
                <span
                  key={mode.value}
                  className={`tag ${(form.transportModes || []).includes(mode.value) ? 'active' : ''}`}
                  onClick={() => toggleTransport(mode.value)}
                  style={{ fontSize: '0.9rem', padding: '10px 16px' }}
                >
                  {mode.icon} {mode.label}
                </span>
              ))}
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => { updateTrip({ ...form }); setShowTransportModal(false); }}>
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {showAccommodationModal && (
        <div className="modal-overlay" onClick={() => setShowAccommodationModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">Tipo alloggio</h2>
            <div className="tag-group" style={{ gap: 10 }}>
              {ACCOMMODATION_TYPES.map(type => (
                <span
                  key={type.value}
                  className={`tag ${(form.accommodationTypes || []).includes(type.value) ? 'active' : ''}`}
                  onClick={() => toggleAccommodation(type.value)}
                  style={{ fontSize: '0.9rem', padding: '10px 16px' }}
                >
                  {type.icon} {type.label}
                </span>
              ))}
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => { updateTrip({ ...form }); setShowAccommodationModal(false); }}>
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
