import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, EXPENSE_CATEGORIES } from '../utils/helpers';

export default function SplitPage() {
  const { id } = useParams();
  const { participants, expenses, addParticipant, updateParticipant, removeParticipant, loadTripData } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '' });
  const [expandedParticipant, setExpandedParticipant] = useState(null);

  useEffect(() => {
    loadTripData(id);
  }, [id]);

  const tripParticipants = participants.filter(p => p.tripId === id);
  const activeParticipants = tripParticipants.filter(p => !p.isExcluded);
  const tripExpenses = expenses.filter(e => e.tripId === id);
  const totalAll = tripExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const sharedTotal = tripExpenses.filter(e => e.isShared).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    addParticipant({ ...form, tripId: id });
    setForm({ name: '', email: '' });
    setShowModal(false);
  }

  function toggleExcluded(p) {
    updateParticipant({ ...p, isExcluded: !p.isExcluded });
  }

  function getParticipantExpenses(name) {
    return tripExpenses.filter(e => e.paidBy === name);
  }

  function getParticipantPaid(name) {
    return getParticipantExpenses(name).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  function getSplitters(e) {
    if (e.splitAmong && e.splitAmong.length > 0) {
      return activeParticipants.filter(p => e.splitAmong.includes(p.name));
    }
    return activeParticipants;
  }

  function getParticipantOwed(name) {
    let owed = 0;
    for (const e of tripExpenses) {
      const amount = Number(e.amount) || 0;
      if (!e.isShared) {
        if (e.paidBy === name) owed += amount;
        continue;
      }
      const splitters = getSplitters(e);
      if (splitters.length === 0) continue;
      const includes = splitters.some(p => p.name === name);
      if (!includes) continue;
      owed += amount / splitters.length;
    }
    return owed;
  }

  function getBalance(name) {
    return getParticipantPaid(name) - getParticipantOwed(name);
  }

  return (
    <div>
      <h1 className="page-title">👥 Divisione Spese</h1>

      {tripParticipants.length > 0 && (
        <div className="split-summary" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Totale spese del viaggio</div>
          <div className="total-shared">{formatCurrency(totalAll)}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 8 }}>
            Spese da dividere: <strong>{formatCurrency(sharedTotal)}</strong>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {tripParticipants.length} partecipanti ({activeParticipants.length} in divisione) · {tripExpenses.length} spese totali
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginBottom: 16 }}>
        ➕ Aggiungi partecipante
      </button>

      {tripParticipants.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>Nessun partecipante</h3>
          <p>Aggiungi le persone con cui vuoi dividere le spese</p>
        </div>
      ) : (
        tripParticipants.map(p => {
          const pExpenses = getParticipantExpenses(p.name);
          const pPaid = getParticipantPaid(p.name);
          const pOwed = getParticipantOwed(p.name);
          const balance = pPaid - pOwed;
          const isExpanded = expandedParticipant === p.id;

          return (
            <div key={p.id} className="card" style={{ opacity: p.isExcluded ? 0.55 : 1 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setExpandedParticipant(isExpanded ? null : p.id)}
              >
                <div className="participant-avatar" style={p.isExcluded ? { filter: 'grayscale(1)' } : undefined}>{p.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                    {p.name}
                    {p.isExcluded && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>(escluso dalla divisione)</span>}
                  </div>
                  {p.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-light)' }}>
                    {formatCurrency(pPaid)}
                  </div>
                  {!p.isExcluded && (
                    <div style={{
                      fontSize: '0.75rem', fontWeight: 600,
                      color: balance >= 0 ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {balance >= 0 ? 'deve ricevere ' : 'deve dare '}
                      {formatCurrency(Math.abs(balance))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    className={`btn btn-sm ${p.isExcluded ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={(e) => { e.stopPropagation(); toggleExcluded(p); }}
                    title={p.isExcluded ? 'Includi nella divisione' : 'Escludi dalla divisione'}
                  >
                    {p.isExcluded ? '🙋 Includi' : '🙅 Escludi'}
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => { e.stopPropagation(); removeParticipant(p.id); }}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ha pagato</div>
                  <div style={{ fontWeight: 700, color: 'var(--primary-light)', marginTop: 2, fontSize: '0.85rem' }}>{formatCurrency(pPaid)}</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>A suo carico</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginTop: 2, fontSize: '0.85rem' }}>{formatCurrency(pOwed)}</div>
                </div>
                <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bilancio</div>
                  <div style={{
                    fontWeight: 700, marginTop: 2, fontSize: '0.85rem',
                    color: balance >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                    Spese pagate da {p.name} ({pExpenses.length})
                  </div>
                  {pExpenses.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nessuna spesa registrata</p>
                  ) : (
                    pExpenses.map(expense => {
                      const catInfo = EXPENSE_CATEGORIES.find(c => c.value === expense.category);
                      const splitters = expense.isShared ? getSplitters(expense) : [];
                      return (
                        <div key={expense.id} className="expense-row" style={{ marginBottom: 6 }}>
                          <div className="expense-icon" style={{ width: 32, height: 32, fontSize: '1rem' }}>{catInfo?.icon}</div>
                          <div className="expense-info">
                            <div className="expense-desc" style={{ fontSize: '0.8rem' }}>{expense.description}</div>
                            <div className="expense-meta">
                              {catInfo?.label} · {new Date(expense.date).toLocaleDateString('it-IT')}
                              {expense.isShared && (
                                splitters.length > 0
                                  ? ` · 🔄 Divisa tra ${splitters.map(s => s.name).join(', ')}`
                                  : ' · 🔄 Divisa'
                              )}
                              {!expense.isShared && ' · 👤 Personale'}
                            </div>
                          </div>
                          <div className="expense-amount" style={{ fontSize: '0.85rem' }}>{formatCurrency(expense.amount)}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {activeParticipants.length > 1 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>📊 Riepilogo compensi</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Chi deve dare cosa a chi per pareggiare
          </p>
          {(() => {
            const balances = activeParticipants.map(p => ({
              name: p.name,
              balance: getBalance(p.name),
            }));
            const debtors = balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance);
            const creditors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance);
            const transfers = [];
            const dCopy = debtors.map(d => ({ ...d }));
            const cCopy = creditors.map(c => ({ ...c }));
            let i = 0, j = 0;
            while (i < dCopy.length && j < cCopy.length) {
              const amount = Math.min(Math.abs(dCopy[i].balance), cCopy[j].balance);
              if (amount > 0.01) {
                transfers.push({ from: dCopy[i].name, to: cCopy[j].name, amount });
              }
              dCopy[i].balance += amount;
              cCopy[j].balance -= amount;
              if (Math.abs(dCopy[i].balance) < 0.01) i++;
              if (Math.abs(cCopy[j].balance) < 0.01) j++;
            }
            if (transfers.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tutti in pari! Nessun compenso necessario.</p>;
            return transfers.map((t, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: 6,
                fontSize: '0.85rem',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{t.from}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>→</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>{t.to}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--primary-light)' }}>{formatCurrency(t.amount)}</span>
              </div>
            ));
          })()}
        </div>
      )}

      {tripParticipants.some(p => p.isExcluded) && (
        <div className="card" style={{ marginTop: 16, background: 'var(--bg-warning)', borderColor: 'var(--warning)' }}>
          <div className="card-title" style={{ marginBottom: 6, color: 'var(--warning)' }}>⚠️ Viaggiatori esclusi</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Le spese condivise vengono divise solo tra i viaggiatori inclusi. I viaggiatori esclusi continuano a dover ricevere quanto hanno anticipato per le spese condivise, ma non contribuiscono alla loro quota.
          </p>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">Nuovo partecipante</h2>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" placeholder="Nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Email (opzionale)</label>
                <input className="form-input" type="email" placeholder="email@esempio.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">Aggiungi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
