import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { EXPENSE_CATEGORIES, formatCurrency, calculateTotalExpenses } from '../utils/helpers';

export default function ExpensesPage() {
  const { id } = useParams();
  const { expenses, addExpense, updateExpense, removeExpense, currentTrip, participants, loadTripData } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [editingExpense, setEditingExpense] = useState(null);

  useEffect(() => {
    loadTripData(id);
  }, [id]);
  const [form, setForm] = useState({
    description: '', amount: '', category: 'cibo', paidBy: '', date: new Date().toISOString().split('T')[0],
    isShared: false, splitAmong: [],
  });
  const [receiptImage, setReceiptImage] = useState(null);

  const tripExpenses = expenses.filter(e => e.tripId === id);
  const filtered = filterCategory === 'all' ? tripExpenses : tripExpenses.filter(e => e.category === filterCategory);
  const totalAll = calculateTotalExpenses(tripExpenses);
  const totalShared = calculateTotalExpenses(tripExpenses.filter(e => e.isShared));

  const categoryTotals = EXPENSE_CATEGORIES.map(cat => ({
    ...cat,
    total: calculateTotalExpenses(tripExpenses.filter(e => e.category === cat.value)),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  function handleAdd(e) {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) return;
    if (editingExpense) {
      updateExpense({ ...editingExpense, ...form, amount: Number(form.amount), receiptImage });
      setEditingExpense(null);
    } else {
      addExpense({ ...form, amount: Number(form.amount), receiptImage });
    }
    setForm({ description: '', amount: '', category: 'cibo', paidBy: '', date: new Date().toISOString().split('T')[0], isShared: false, splitAmong: [] });
    setReceiptImage(null);
    setShowModal(false);
  }

  function handleEdit(expense) {
    setEditingExpense(expense);
    setForm({
      description: expense.description, amount: expense.amount?.toString(), category: expense.category,
      paidBy: expense.paidBy, date: expense.date, isShared: expense.isShared, splitAmong: expense.splitAmong || [],
    });
    setReceiptImage(expense.receiptImage || null);
    setShowModal(true);
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptImage(ev.target.result);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <h1 className="page-title">💰 Spese</h1>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(totalAll)}</div>
          <div className="stat-label">Totale</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(totalShared)}</div>
          <div className="stat-label">Da dividere</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{tripExpenses.length}</div>
          <div className="stat-label">Spese</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {currentTrip?.budget > 0 ? `${((totalAll / currentTrip.budget) * 100).toFixed(0)}%` : '—'}
          </div>
          <div className="stat-label">Budget usato</div>
        </div>
      </div>

      {categoryTotals.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>📊 Riepilogo per categoria</div>
          {categoryTotals.map(cat => (
            <div key={cat.value} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: '1.1rem' }}>{cat.icon}</span>
              <span style={{ flex: 1, fontSize: '0.85rem' }}>{cat.label}</span>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary-light)' }}>{formatCurrency(cat.total)}</span>
              <div style={{ width: 80 }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(cat.total / totalAll) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="tab-bar" style={{ marginBottom: 16 }}>
        <button className={`tab-btn ${filterCategory === 'all' ? 'active' : ''}`} onClick={() => setFilterCategory('all')}>Tutte</button>
        {categoryTotals.slice(0, 4).map(cat => (
          <button key={cat.value} className={`tab-btn ${filterCategory === cat.value ? 'active' : ''}`} onClick={() => setFilterCategory(cat.value)}>
            {cat.icon}
          </button>
        ))}
      </div>

      <button className="btn btn-primary" onClick={() => { setEditingExpense(null); setShowModal(true); }} style={{ marginBottom: 16 }}>
        ➕ Nuova spesa
      </button>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <h3>Nessuna spesa</h3>
          <p>Aggiungi la tua prima spesa</p>
        </div>
      ) : (
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).map(expense => {
          const catInfo = EXPENSE_CATEGORIES.find(c => c.value === expense.category);
          return (
            <div key={expense.id} className="expense-row" onClick={() => handleEdit(expense)}>
              <div className="expense-icon">{catInfo?.icon}</div>
              <div className="expense-info">
                <div className="expense-desc">{expense.description}</div>
                <div className="expense-meta">
                  {catInfo?.label} · {new Date(expense.date).toLocaleDateString('it-IT')}
                  {expense.paidBy && ` · ${expense.paidBy}`}
                  {expense.isShared && ' · 🔄 Divisa'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="expense-amount">{formatCurrency(expense.amount)}</div>
                <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); removeExpense(expense.id); }} style={{ padding: '4px 8px' }}>🗑️</button>
              </div>
            </div>
          );
        })
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">{editingExpense ? 'Modifica spesa' : 'Nuova spesa'}</h2>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Descrizione</label>
                <input className="form-input" placeholder="Es: Cena al ristorante" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Importo (€)</label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Data</label>
                  <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <div className="tag-group">
                  {EXPENSE_CATEGORIES.map(cat => (
                    <span key={cat.value} className={`tag ${form.category === cat.value ? 'active' : ''}`} onClick={() => setForm({ ...form, category: cat.value })}>
                      {cat.icon} {cat.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Pagato da</label>
                <select className="form-select" value={form.paidBy} onChange={e => setForm({ ...form, paidBy: e.target.value })}>
                  <option value="">Seleziona...</option>
                  {participants.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  <option value="Altro">Altro</option>
                </select>
              </div>
              <div className="form-group">
                <label className="checkbox-group" onClick={() => setForm({ ...form, isShared: !form.isShared })}>
                  <input type="checkbox" checked={form.isShared} readOnly />
                  <span style={{ fontSize: '0.85rem' }}>🔄 Spesa da dividere con i partecipanti</span>
                </label>
              </div>
              {form.isShared && (
                <div className="form-group">
                  <label className="form-label">Dividi tra (deseleziona chi escludere)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto', padding: 4 }}>
                    {participants.filter(p => p.tripId === id).map(p => {
                      const isIncluded = form.splitAmong.includes(p.name);
                      return (
                        <label key={p.id} className="checkbox-group"
                          onClick={() => setForm({
                            ...form,
                            splitAmong: isIncluded
                              ? form.splitAmong.filter(n => n !== p.name)
                              : [...form.splitAmong, p.name],
                          })}
                        >
                          <input type="checkbox" checked={isIncluded} readOnly />
                          <span style={{ fontSize: '0.8rem' }}>{p.name}</span>
                        </label>
                      );
                    })}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Nessuno selezionato = divisa tra tutti i partecipanti attivi.
                    </span>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Scontrino / Ricevuta (foto)</label>
                <input className="form-input" type="file" accept="image/*" onChange={handleImageUpload} />
                {receiptImage && <img src={receiptImage} alt="Ricevuta" className="receipt-image" />}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">{editingExpense ? 'Aggiorna' : 'Aggiungi'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
