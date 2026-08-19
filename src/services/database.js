import { openDB } from 'idb';

const DB_NAME = 'travelmate-db';
const DB_VERSION = 1;

const STORES = {
  TRIPS: 'trips',
  EXPENSES: 'expenses',
  WALLETS: 'wallets',
  ITINERARY: 'itinerary',
  PARTICIPANTS: 'participants',
  SETTINGS: 'settings',
};

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.TRIPS)) {
        const tripStore = db.createObjectStore(STORES.TRIPS, { keyPath: 'id' });
        tripStore.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
        const expStore = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
        expStore.createIndex('tripId', 'tripId');
      }
      if (!db.objectStoreNames.contains(STORES.WALLETS)) {
        const walStore = db.createObjectStore(STORES.WALLETS, { keyPath: 'id' });
        walStore.createIndex('tripId', 'tripId');
      }
      if (!db.objectStoreNames.contains(STORES.ITINERARY)) {
        const itStore = db.createObjectStore(STORES.ITINERARY, { keyPath: 'id' });
        itStore.createIndex('tripId', 'tripId');
      }
      if (!db.objectStoreNames.contains(STORES.PARTICIPANTS)) {
        const partStore = db.createObjectStore(STORES.PARTICIPANTS, { keyPath: 'id' });
        partStore.createIndex('tripId', 'tripId');
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    },
  });
}

export async function getAllTrips() {
  const db = await getDB();
  return db.getAllFromIndex(STORES.TRIPS, 'createdAt');
}

export async function getTrip(id) {
  const db = await getDB();
  return db.get(STORES.TRIPS, id);
}

export async function saveTrip(trip) {
  const db = await getDB();
  const data = { ...trip, updatedAt: new Date().toISOString() };
  if (!trip.createdAt) data.createdAt = new Date().toISOString();
  await db.put(STORES.TRIPS, data);
  return data;
}

export async function deleteTrip(id) {
  const db = await getDB();
  const tx = db.transaction([STORES.TRIPS, STORES.EXPENSES, STORES.WALLETS, STORES.ITINERARY, STORES.PARTICIPANTS], 'readwrite');
  await tx.objectStore(STORES.TRIPS).delete(id);
  const expenses = await tx.objectStore(STORES.EXPENSES).index('tripId').getAllKeys(id);
  for (const key of expenses) await tx.objectStore(STORES.EXPENSES).delete(key);
  const wallets = await tx.objectStore(STORES.WALLETS).index('tripId').getAllKeys(id);
  for (const key of wallets) await tx.objectStore(STORES.WALLETS).delete(key);
  const itineraries = await tx.objectStore(STORES.ITINERARY).index('tripId').getAllKeys(id);
  for (const key of itineraries) await tx.objectStore(STORES.ITINERARY).delete(key);
  const participants = await tx.objectStore(STORES.PARTICIPANTS).index('tripId').getAllKeys(id);
  for (const key of participants) await tx.objectStore(STORES.PARTICIPANTS).delete(key);
  await tx.done;
}

export async function getExpensesByTrip(tripId) {
  const db = await getDB();
  return db.getAllFromIndex(STORES.EXPENSES, 'tripId', tripId);
}

export async function saveExpense(expense) {
  const db = await getDB();
  await db.put(STORES.EXPENSES, expense);
  return expense;
}

export async function deleteExpense(id) {
  const db = await getDB();
  await db.delete(STORES.EXPENSES, id);
}

export async function getWalletByTrip(tripId) {
  const db = await getDB();
  return db.getAllFromIndex(STORES.WALLETS, 'tripId', tripId);
}

export async function saveWalletItem(item) {
  const db = await getDB();
  await db.put(STORES.WALLETS, item);
  return item;
}

export async function deleteWalletItem(id) {
  const db = await getDB();
  await db.delete(STORES.WALLETS, id);
}

export async function getItineraryByTrip(tripId) {
  const db = await getDB();
  return db.getAllFromIndex(STORES.ITINERARY, 'tripId', tripId);
}

export async function saveItineraryItem(item) {
  const db = await getDB();
  await db.put(STORES.ITINERARY, item);
  return item;
}

export async function deleteItineraryItem(id) {
  const db = await getDB();
  await db.delete(STORES.ITINERARY, id);
}

export async function getParticipantsByTrip(tripId) {
  const db = await getDB();
  return db.getAllFromIndex(STORES.PARTICIPANTS, 'tripId', tripId);
}

export async function saveParticipant(participant) {
  const db = await getDB();
  await db.put(STORES.PARTICIPANTS, participant);
  return participant;
}

export async function deleteParticipant(id) {
  const db = await getDB();
  await db.delete(STORES.PARTICIPANTS, id);
}

export async function exportAllData() {
  const db = await getDB();
  const [trips, expenses, wallets, itinerary, participants] = await Promise.all([
    db.getAll(STORES.TRIPS),
    db.getAll(STORES.EXPENSES),
    db.getAll(STORES.WALLETS),
    db.getAll(STORES.ITINERARY),
    db.getAll(STORES.PARTICIPANTS),
  ]);
  return { trips, expenses, wallets, itinerary, participants, exportedAt: new Date().toISOString() };
}

export async function importAllData(data) {
  const db = await getDB();
  const tx = db.transaction(Object.values(STORES), 'readwrite');
  for (const storeName of Object.values(STORES)) {
    if (storeName === STORES.SETTINGS) continue;
    const items = data[storeName];
    if (items) {
      for (const item of items) {
        await tx.objectStore(storeName).put(item);
      }
    }
  }
  await tx.done;
}

export async function importTripData(data) {
  const db = await getDB();
  const tx = db.transaction([STORES.TRIPS, STORES.EXPENSES, STORES.WALLETS, STORES.ITINERARY, STORES.PARTICIPANTS], 'readwrite');
  if (data.trip) await tx.objectStore(STORES.TRIPS).put(data.trip);
  const mapItems = (storeName, items) => {
    if (!items) return;
    const store = tx.objectStore(storeName);
    for (const item of items) store.put(item);
  };
  mapItems(STORES.EXPENSES, data.expenses);
  mapItems(STORES.WALLETS, data.wallets);
  mapItems(STORES.ITINERARY, data.itinerary);
  mapItems(STORES.PARTICIPANTS, data.participants);
  await tx.done;
  return data.trip;
}

export async function exportTripData(tripId) {
  const db = await getDB();
  const trip = await db.get(STORES.TRIPS, tripId);
  const expenses = await db.getAllFromIndex(STORES.EXPENSES, 'tripId', tripId);
  const wallets = await db.getAllFromIndex(STORES.WALLETS, 'tripId', tripId);
  const itinerary = await db.getAllFromIndex(STORES.ITINERARY, 'tripId', tripId);
  const participants = await db.getAllFromIndex(STORES.PARTICIPANTS, 'tripId', tripId);
  return { trip, expenses, wallets, itinerary, participants, exportedAt: new Date().toISOString() };
}

export async function getSetting(key) {
  const db = await getDB();
  const result = await db.get(STORES.SETTINGS, key);
  return result?.value;
}

export async function saveSetting(key, value) {
  const db = await getDB();
  await db.put(STORES.SETTINGS, { key, value });
}
