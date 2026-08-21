import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, EXPENSE_CATEGORIES } from '../utils/helpers';

export default function SplitPage() {
  const { id } = useParams();
  const { participants, expenses, addParticipant, addExpense, updateExpense, removeParticipant, loadTripData } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', paidBy: '', category: 'altro', isShared: true, splitAmong: [], date: new Date().toISOString().split('T')[0] });
  const [form, setForm] = useState({ name: '', email: '' });
  const [expandedParticipant, setExpandedParticipant] = useState(null);
  const [exclusionFor, setExclusionFor] = useState(null);
  const [exclusionDraft, setExclusionDraft] = useState({});

  useEffect(() => {
    loadTripData(id);
  }, [id]);

  const tripParticipants = participants.filter(p => p.tripId === id);
  const tripExpenses = expenses.filter(e => e.tripId === id);
  const sharedExpenses = tripExpenses.filter(e => e.isShared);
  const totalAll = tripExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const sharedTotal = sharedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    addParticipant({ ...form, tripId: id });
    setForm({ name: '', email: '' });
    setShowModal(false);
  }

  function getParticipantExpenses(name) {
    return tripExpenses.filter(e => e.paidBy === name);
  }

  function getParticipantPaid(name) {
    return getParticipantExpenses(name).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  function getSplitters(e) {
    let base = tripParticipants.filter(p => !p.isExcluded);
    if (e.splitAmong && e.splitAmong.length > 0) {
      base = base.filter(p => e.splitAmong.includes(p.name));
    }
    if (e.paidBy && !base.some(p => p.name === e.paidBy)) {
      const payer = tripParticipants.find(p => p.name === e.paidBy);
      if (payer && !payer.isExcluded) base = [...base, payer];
    }
    return base.filter(p => !(e.excludedFrom || []).includes(p.name));
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
      if (!splitters.some(p => p.name === name)) continue;
      owed += amount / splitters.length;
    }
    return owed;
  }

  function getBalance(name) {
    return getParticipantPaid(name) - getParticipantOwed(name);
  }

  function getExcludedCount(name) {
    return tripExpenses.filter(e => (e.excludedFrom || []).includes(name)).length;
  }

  function openExclusion(p) {
    const draft = {};
    tripExpenses.forEach(e => {
      draft[e.id] = (e.excludedFrom || []).includes(p.name);
    });
    setExclusionFor(p);
    setExclusionDraft(draft);
  }

  async function saveExclusion() {
    const name = exclusionFor.name;
    for (const e of tripExpenses) {
      const excluded = !!exclusionDraft[e.id];
      const cur = e.excludedFrom || [];
      const curExcluded = cur.includes(name);
      if (excluded === curExcluded) continue;
      const next = excluded ? [...cur, name] : cur.filter(n => n !== name);
      await updateExpense({ ...e, excludedFrom: next });
    }
    setExclusionFor(null);
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
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
            <span className="stat-chip">{tripParticipants.length} 👥 partecipanti</span>
            <span className="stat-chip">{tripExpenses.length} 🧾 spese</span>
            <span className="stat-chip">{sharedExpenses.length} 🔄 da dividere</span>
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
          const excludedCount = getExcludedCount(p.name);

          return (
            <div key={p.id} className="card" style={{ borderColor: excludedCount > 0 ? 'var(--warning)' : undefined }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setExpandedParticipant(isExpanded ? null : p.id)}
              >
                <div className="participant-avatar" style={excludedCount > 0 ? { filter: 'grayscale(1)' } : undefined}>{p.name.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {p.name}
                    {excludedCount > 0 && (
                      <span className="excluded-badge">escluso da {excludedCount} {excludedCount === 1 ? 'spesa' : 'spese'}</span>
                    )}
                  </div>
                  {p.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.email}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-light)' }}>
                    {formatCurrency(pPaid)}
                  </div>
                  <div style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: balance >= 0 ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {balance >= 0 ? 'deve ricevere ' : 'deve dare '}
                    {formatCurrency(Math.abs(balance))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    className={`btn btn-sm ${excludedCount > 0 ? 'btn-warning' : 'btn-primary'}`}
                    onClick={(e) => { e.stopPropagation(); openExclusion(p); }}
                    title="Scegli da quali spese escludere"
                  >
                    ⚙️
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
                    Tutte le spese — tocca per escludere/includere {p.name}
                  </div>
                  {sharedExpenses.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nessuna spesa condivisa registrata</p>
                  ) : (
                    sharedExpenses.map(expense => {
                      const catInfo = EXPENSE_CATEGORIES.find(c => c.value === expense.category);
                      const isExcluded = (expense.excludedFrom || []).includes(p.name);
                      return (
                        <div
                          key={expense.id}
                          onClick={async () => {
                            const cur = expense.excludedFrom || [];
                            const next = isExcluded ? cur.filter(n => n !== p.name) : [...cur, p.name];
                            await updateExpense({ ...expense, excludedFrom: next });
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px',
                            borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                            background: isExcluded ? 'rgba(239,68,68,0.08)' : 'var(--bg-input)',
                            border: isExcluded ? '1px solid rgba(239,68,68,0.25)' : '1px solid transparent',
                            opacity: isExcluded ? 0.6 : 1,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                            background: isExcluded ? 'rgba(239,68,68,0.2)' : 'var(--primary)',
                            color: isExcluded ? 'var(--danger)' : '#fff',
                          }}>
                            {isExcluded ? '✕' : '✓'}
                          </div>
                          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
                            {catInfo?.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, textDecoration: isExcluded ? 'line-through' : 'none' }}>{expense.description}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {catInfo?.label} · {new Date(expense.date).toLocaleDateString('it-IT')} · {expense.paidBy || '—'}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: isExcluded ? 'var(--danger)' : 'var(--primary-light)', flexShrink: 0 }}>
                            {formatCurrency(expense.amount)}
                          </div>
                        </div>
                      );
                    })
                  )}

                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setExpenseForm({ ...expenseForm, paidBy: p.name });
                    setShowExpenseModal(true);
                  }} style={{ marginTop: 10, fontSize: '0.75rem' }}>
                    ➕ Aggiungi spesa
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {sharedExpenses.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>📊 Riepilogo compensi</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Chi deve dare cosa a chi per pareggiare
          </p>
          {(() => {
            const participantsWithBalance = tripParticipants.filter(p => Math.abs(getBalance(p.name)) > 0.01);
            if (participantsWithBalance.length === 0) {
              return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tutti in pari! Nessun compenso necessario.</p>;
            }
            const balances = participantsWithBalance.map(p => ({ name: p.name, balance: getBalance(p.name) }));
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
            return transfers.map((t, idx) => (
              <div key={idx} className="transfer-row">
                <span className="transfer-from">{t.from}</span>
                <span className="transfer-arrow">→</span>
                <span className="transfer-to">{t.to}</span>
                <span className="transfer-amount">{formatCurrency(t.amount)}</span>
              </div>
            ));
          })()}
        </div>
      )}

      {exclusionFor && (
        <div className="modal-overlay" onClick={() => setExclusionFor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">⚙️ Esclusione di {exclusionFor.name}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Di default è <strong>incluso in tutte</strong> le spese. Metti la spunta sulle voci da cui vuoi escluderlo.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const draft = {};
                tripExpenses.forEach(e => draft[e.id] = true);
                setExclusionDraft(draft);
              }}>
                🚫 Escludi da tutte
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const draft = {};
                tripExpenses.forEach(e => draft[e.id] = false);
                setExclusionDraft(draft);
              }}>
                🙋 Includi in tutte
              </button>
            </div>
            <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
              {tripExpenses.map(e => {
                const catInfo = EXPENSE_CATEGORIES.find(c => c.value === e.category);
                const excluded = !!exclusionDraft[e.id];
                return (
                  <label key={e.id} className="checkbox-group" style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    opacity: excluded ? 0.6 : 1,
                  }}
                    onClick={() => setExclusionDraft({ ...exclusionDraft, [e.id]: !excluded })}
                  >
                    <input type="checkbox" checked={excluded} readOnly />
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: excluded ? 'rgba(239,68,68,0.15)' : 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                      {catInfo?.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, textDecoration: excluded ? 'line-through' : 'none' }}>{e.description}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {catInfo?.label} · {new Date(e.date).toLocaleDateString('it-IT')}
                        {e.paidBy && ` · ${e.paidBy}`}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: excluded ? 'var(--danger)' : 'var(--primary-light)', flexShrink: 0 }}>
                      {formatCurrency(e.amount)}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setExclusionFor(null)}>Annulla</button>
              <button type="button" className="btn btn-primary" onClick={saveExclusion}>💾 Salva</button>
            </div>
          </div>
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

      {showExpenseModal && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h2 className="modal-title">Nuova spesa</h2>
            <div className="form-group">
              <label className="form-label">Descrizione</label>
              <input className="form-input" placeholder="Es: Cena, Biglietti..." value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} required autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Importo (€)</label>
                <input className="form-input" type="number" step="0.01" placeholder="0.00" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Data</label>
                <input className="form-input" type="date" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Pagato da</label>
              <select className="form-select" value={expenseForm.paidBy} onChange={e => setExpenseForm({ ...expenseForm, paidBy: e.target.value })}>
                <option value="">Seleziona...</option>
                {tripParticipants.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <div className="tag-group">
                {EXPENSE_CATEGORIES.map(cat => (
                  <span
                    key={cat.value}
                    className={`tag ${expenseForm.category === cat.value ? 'active' : ''}`}
                    onClick={() => setExpenseForm({ ...expenseForm, category: cat.value })}
                  >
                    {cat.icon} {cat.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={expenseForm.isShared} onChange={e => setExpenseForm({ ...expenseForm, isShared: e.target.checked })} />
                <span style={{ fontSize: '0.85rem' }}>🔄 Spesa da dividere</span>
              </label>
            </div>
            {expenseForm.isShared && (
              <div className="form-group">
                <label className="form-label">Dividi tra</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tripParticipants.map(p => {
                    const selected = expenseForm.splitAmong.includes(p.name);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? expenseForm.splitAmong.filter(n => n !== p.name)
                            : [...expenseForm.splitAmong, p.name];
                          setExpenseForm({ ...expenseForm, splitAmong: next });
                        }}
                        style={{
                          padding: '6px 12px', borderRadius: 20, border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
                          background: selected ? 'var(--primary-bg, rgba(102,126,234,0.1))' : 'var(--bg-input)',
                          color: selected ? 'var(--primary)' : 'var(--text-secondary)',
                          fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                        }}
                      >
                        {selected ? '✓ ' : ''}{p.name}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {expenseForm.splitAmong.length === 0 ? 'Tutti i partecipanti' : `${expenseForm.splitAmong.length} selezionati`}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Annulla</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!expenseForm.description.trim() || !expenseForm.amount || !expenseForm.paidBy}
                onClick={async () => {
                  await addExpense({
                    ...expenseForm,
                    amount: Number(expenseForm.amount) || 0,
                    tripId: id,
                    excludedFrom: [],
                  });
                  setExpenseForm({ description: '', amount: '', paidBy: expenseForm.paidBy, category: 'altro', isShared: true, splitAmong: [], date: new Date().toISOString().split('T')[0] });
                  setShowExpenseModal(false);
                }}
              >
                Aggiungi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
