import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { WALLET_TYPES } from '../utils/helpers';

export default function WalletPage() {
  const { id } = useParams();
  const { walletItems, addWalletItem, removeWalletItem, currentTrip, loadTripData } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    type: 'biglietto', title: '', details: '', barcode: '',
    date: '', time: '', seat: '', gate: '',
  });
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    loadTripData(id);
  }, [id]);

  const tripItems = walletItems.filter(w => w.tripId === id);

  function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    addWalletItem({ ...form, tripId: id, image: previewImage });
    setForm({ type: 'biglietto', title: '', details: '', barcode: '', date: '', time: '', seat: '', gate: '' });
    setPreviewImage(null);
    setShowModal(false);
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPreviewImage(ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <h1 className="page-title">💳 Wallet</h1>
      <p className="page-subtitle">Carte d'imbarco, biglietti e documenti</p>

      {tripItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💳</div>
          <h3>Wallet vuoto</h3>
          <p>Aggiungi biglietti, carte d'imbarco e prenotazioni</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ➕ Aggiungi documento
          </button>
        </div>
      ) : (
        <>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginBottom: 16 }}>
            ➕ Aggiungi documento
          </button>
          {tripItems.map(item => {
            const typeInfo = WALLET_TYPES.find(t => t.value === item.type);
            return (
              <div key={item.id} className="wallet-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div className="wallet-type">{typeInfo?.icon} {typeInfo?.label}</div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginTop: 6 }}>{item.title}</h3>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => removeWalletItem(item.id)}>🗑️</button>
                </div>
                {item.details && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                    {item.details}
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {item.date && <span>📅 {new Date(item.date).toLocaleDateString('it-IT')}</span>}
                  {item.time && <span>🕐 {item.time}</span>}
                  {item.seat && <span>💺 Posto: {item.seat}</span>}
                  {item.gate && <span>🚪 Gate: {item.gate}</span>}
                  {item.barcode && <span>📊 Codice: {item.barcode}</span>}
                </div>
                {item.image && <img src={item.image} alt={item.title} className="receipt-image" />}
              </div>
            );
          })}
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">Nuovo documento</h2>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <div className="tag-group">
                  {WALLET_TYPES.map(type => (
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
                <input
                  className="form-input"
                  placeholder="Es: Volo Roma-Milano, Prenotazione Hotel..."
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Dettagli</label>
                <textarea
                  className="form-textarea"
                  placeholder="Compagnia aerea, numero prenotazione, dettagli..."
                  value={form.details}
                  onChange={e => setForm({ ...form, details: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Data</label>
                  <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Orario</label>
                  <input className="form-input" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Posto</label>
                  <input className="form-input" placeholder="Es: 12A" value={form.seat} onChange={e => setForm({ ...form, seat: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Gate</label>
                  <input className="form-input" placeholder="Es: B12" value={form.gate} onChange={e => setForm({ ...form, gate: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Codice / Barcode</label>
                <input className="form-input" placeholder="Numero biglietto o codice" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Foto biglietto / documento</label>
                <input className="form-input" type="file" accept="image/*" onChange={handleImageUpload} />
                {previewImage && <img src={previewImage} alt="Preview" className="receipt-image" />}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">Salva</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
