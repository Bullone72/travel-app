import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as db from '../services/database';
import { createTrip, createExpense, createWalletItem, createItineraryItem, createParticipant } from '../utils/helpers';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [trips, setTrips] = useState([]);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [walletItems, setWalletItems] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadTrips();
  }, []);

  useEffect(() => {
    if (currentTrip) {
      loadTripData(currentTrip.id);
    }
  }, [currentTrip?.id]);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  async function loadTrips() {
    try {
      const allTrips = await db.getAllTrips();
      setTrips(allTrips.reverse());
    } catch (e) {
      console.error('Error loading trips:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadTripData(tripId) {
    if (!tripId) return;
    try {
      const [exp, wal, itin, part] = await Promise.all([
        db.getExpensesByTrip(tripId),
        db.getWalletByTrip(tripId),
        db.getItineraryByTrip(tripId),
        db.getParticipantsByTrip(tripId),
      ]);
      setExpenses(exp);
      setWalletItems(wal);
      setItinerary(itin);
      setParticipants(part);
    } catch (e) {
      console.error('Error loading trip data:', e);
    }
  }

  async function addTrip(data) {
    const trip = createTrip(data);
    await db.saveTrip(trip);
    await loadTrips();
    setCurrentTrip(trip);
    showNotification('Viaggio creato!');
    return trip;
  }

  async function updateTrip(data) {
    await db.saveTrip(data);
    await loadTrips();
    setCurrentTrip(data);
    showNotification('Viaggio aggiornato!');
  }

  async function removeTrip(id) {
    await db.deleteTrip(id);
    if (currentTrip?.id === id) {
      setCurrentTrip(null);
      setExpenses([]);
      setWalletItems([]);
      setItinerary([]);
      setParticipants([]);
    }
    await loadTrips();
    showNotification('Viaggio eliminato');
  }

  async function addExpense(data) {
    const tripId = currentTrip?.id || data.tripId;
    const expense = createExpense({ ...data, tripId });
    await db.saveExpense(expense);
    const exp = await db.getExpensesByTrip(tripId);
    setExpenses(exp);
    showNotification('Spesa aggiunta!');
    maybeAutoBackup();
    return expense;
  }

  async function updateExpense(data) {
    await db.saveExpense(data);
    if (currentTrip) {
      const exp = await db.getExpensesByTrip(currentTrip.id);
      setExpenses(exp);
    }
    maybeAutoBackup();
  }

  async function removeExpense(id) {
    await db.deleteExpense(id);
    if (currentTrip) {
      const exp = await db.getExpensesByTrip(currentTrip.id);
      setExpenses(exp);
    }
    showNotification('Spesa eliminata');
    maybeAutoBackup();
  }

  async function addWalletItem(data) {
    const tripId = currentTrip?.id || data.tripId;
    const item = createWalletItem({ ...data, tripId });
    await db.saveWalletItem(item);
    const wal = await db.getWalletByTrip(tripId);
    setWalletItems(wal);
    showNotification('Documento salvato nel wallet!');
    maybeAutoBackup();
    return item;
  }

  async function removeWalletItem(id) {
    await db.deleteWalletItem(id);
    if (currentTrip) {
      const wal = await db.getWalletByTrip(currentTrip.id);
      setWalletItems(wal);
    }
    showNotification('Documento rimosso');
    maybeAutoBackup();
  }

  async function addItineraryItem(data) {
    const tripId = currentTrip?.id || data.tripId;
    const item = createItineraryItem({ ...data, tripId });
    await db.saveItineraryItem(item);
    const itin = await db.getItineraryByTrip(tripId);
    setItinerary(itin);
    showNotification('Attività aggiunta al programma!');
    maybeAutoBackup();
    return item;
  }

  async function updateItineraryItem(data) {
    await db.saveItineraryItem(data);
    if (currentTrip) {
      const itin = await db.getItineraryByTrip(currentTrip.id);
      setItinerary(itin);
    }
    maybeAutoBackup();
  }

  async function removeItineraryItem(id) {
    await db.deleteItineraryItem(id);
    if (currentTrip) {
      const itin = await db.getItineraryByTrip(currentTrip.id);
      setItinerary(itin);
    }
    maybeAutoBackup();
  }

  async function addParticipant(data) {
    const tripId = currentTrip?.id || data.tripId;
    const participant = createParticipant({ ...data, tripId });
    await db.saveParticipant(participant);
    const part = await db.getParticipantsByTrip(tripId);
    setParticipants(part);
    showNotification('Partecipante aggiunto!');
    maybeAutoBackup();
    return participant;
  }

  async function updateParticipant(data) {
    await db.saveParticipant(data);
    if (currentTrip) {
      const part = await db.getParticipantsByTrip(currentTrip.id);
      setParticipants(part);
    }
    maybeAutoBackup();
  }

  async function removeParticipant(id) {
    await db.deleteParticipant(id);
    if (currentTrip) {
      const part = await db.getParticipantsByTrip(currentTrip.id);
      setParticipants(part);
    }
    maybeAutoBackup();
  }

  async function exportTrip(tripId) {
    return await db.exportTripData(tripId);
  }

  async function exportAllTrips() {
    return await db.exportAllData();
  }

  async function triggerAutoBackup() {
    try {
      const autoBackup = await db.getSetting('auto_backup');
      if (!autoBackup) return;
      const data = await db.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `travelmate-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Auto backup failed:', e);
    }
  }

  const lastAutoBackup = useRef(0);
  async function maybeAutoBackup() {
    try {
      const autoBackup = await db.getSetting('auto_backup');
      if (!autoBackup) return;
      const now = Date.now();
      if (now - lastAutoBackup.current < 60000) return;
      lastAutoBackup.current = now;
      await triggerAutoBackup();
    } catch (e) {
      console.error('Auto backup check failed:', e);
    }
  }

  async function importTrips(data) {
    await db.importAllData(data);
    await loadTrips();
    showNotification('Dati importati con successo!');
  }

  function selectTrip(trip) {
    setCurrentTrip(trip);
  }

  const value = {
    trips, currentTrip, expenses, walletItems, itinerary, participants,
    loading, notification,
    addTrip, updateTrip, removeTrip, selectTrip,
    addExpense, updateExpense, removeExpense,
    addWalletItem, removeWalletItem,
    addItineraryItem, updateItineraryItem, removeItineraryItem,
    addParticipant, updateParticipant, removeParticipant,
    exportTrip, exportAllTrips, importTrips, showNotification,
    loadTrips, loadTripData, triggerAutoBackup,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
