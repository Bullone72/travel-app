import { v4 as uuidv4 } from 'uuid';

export function createTrip(data = {}) {
  return {
    id: uuidv4(),
    name: data.name || '',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    days: data.days || 0,
    transportModes: data.transportModes || [],
    accommodationTypes: data.accommodationTypes || [],
    destinations: data.destinations || [],
    totalKm: data.totalKm || 0,
    budget: data.budget || 0,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createExpense(data = {}) {
  return {
    id: uuidv4(),
    tripId: data.tripId,
    description: data.description || '',
    amount: data.amount || 0,
    category: data.category || 'altro',
    paidBy: data.paidBy || '',
    date: data.date || new Date().toISOString().split('T')[0],
    splitAmong: data.splitAmong || [],
    excludedFrom: data.excludedFrom || [],
    isShared: data.isShared || false,
    receiptImage: data.receiptImage || null,
    createdAt: new Date().toISOString(),
  };
}

export function createWalletItem(data = {}) {
  return {
    id: uuidv4(),
    tripId: data.tripId,
    type: data.type || 'biglietto',
    title: data.title || '',
    details: data.details || '',
    barcode: data.barcode || '',
    date: data.date || '',
    time: data.time || '',
    seat: data.seat || '',
    gate: data.gate || '',
    image: data.image || null,
    createdAt: new Date().toISOString(),
  };
}

export function createItineraryItem(data = {}) {
  return {
    id: uuidv4(),
    tripId: data.tripId,
    dayNumber: data.dayNumber || 1,
    time: data.time || '',
    title: data.title || '',
    description: data.description || '',
    location: data.location || '',
    lat: data.lat || null,
    lng: data.lng || null,
    departure: data.departure || '',
    departureLat: data.departureLat || null,
    departureLng: data.departureLng || null,
    arrival: data.arrival || '',
    arrivalLat: data.arrivalLat || null,
    arrivalLng: data.arrivalLng || null,
    type: data.type || 'visita',
    km: data.km || 0,
    transportMode: data.transportMode || '',
    duration: data.duration || '',
    cost: data.cost || 0,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
  };
}

export function createParticipant(data = {}) {
  return {
    id: uuidv4(),
    tripId: data.tripId,
    name: data.name || '',
    email: data.email || '',
    sharePercentage: data.sharePercentage || 0,
    totalOwed: data.totalOwed || 0,
    totalPaid: data.totalPaid || 0,
    isExcluded: data.isExcluded || false,
    createdAt: new Date().toISOString(),
  };
}

export const EXPENSE_CATEGORIES = [
  { value: 'alloggio', label: 'Alloggio', icon: '🏠' },
  { value: 'trasporto', label: 'Trasporto', icon: '🚗' },
  { value: 'cibo', label: 'Cibo e Bevande', icon: '🍽️' },
  { value: 'attivita', label: 'Attività', icon: '🎭' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'biglietti', label: 'Biglietti', icon: '🎫' },
  { value: 'assicurazione', label: 'Assicurazione', icon: '🛡️' },
  { value: 'comunicazioni', label: 'Comunicazioni', icon: '📱' },
  { value: 'salute', label: 'Salute', icon: '💊' },
  { value: 'altro', label: 'Altro', icon: '📦' },
];

export const TRANSPORT_MODES = [
  { value: 'auto', label: 'Auto', icon: '🚗' },
  { value: 'treno', label: 'Treno', icon: '🚆' },
  { value: 'aereo', label: 'Aereo', icon: '✈️' },
  { value: 'nave', label: 'Nave', icon: '🚢' },
  { value: 'bus', label: 'Bus', icon: '🚌' },
  { value: 'motorino', label: 'Motorino', icon: '🛵' },
  { value: 'bicicletta', label: 'Bicicletta', icon: '🚲' },
  { value: 'taxi', label: 'Taxi', icon: '🚕' },
  { value: 'a piedi', label: 'A piedi', icon: '🚶' },
];

export const ACCOMMODATION_TYPES = [
  { value: 'hotel', label: 'Hotel', icon: '🏨' },
  { value: 'bnb', label: 'B&B', icon: '🛏️' },
  { value: 'ostello', label: 'Ostello', icon: '🏠' },
  { value: 'appartamento', label: 'Appartamento', icon: '🏢' },
  { value: 'campeggio', label: 'Campeggio', icon: '⛺' },
  { value: 'villa', label: 'Villa', icon: '🏡' },
  { value: 'resort', label: 'Resort', icon: '🌴' },
  { value: 'vacanze', label: 'Case vacanza', icon: '🏖️' },
];

export const WALLET_TYPES = [
  { value: 'biglietto', label: 'Biglietto', icon: '🎫' },
  { value: 'imbarco', label: 'Carta d\'imbarco', icon: '✈️' },
  { value: 'prenotazione', label: 'Prenotazione', icon: '📋' },
  { value: 'assicurazione', label: 'Assicurazione', icon: '🛡️' },
  { value: 'noleggio', label: 'Noleggio', icon: '🔑' },
  { value: 'altro', label: 'Altro', icon: '📄' },
];

export const ITINERARY_TYPES = [
  { value: 'visita', label: 'Visita', icon: '🏛️' },
  { value: 'ristorante', label: 'Ristorante', icon: '🍽️' },
  { value: 'spostamento', label: 'Spostamento', icon: '🗺️' },
  { value: 'soggiorno', label: 'Soggiorno', icon: '🏨' },
  { value: 'attivita', label: 'Attività', icon: '🎭' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'riposo', label: 'Riposo', icon: '😴' },
  { value: 'altro', label: 'Altro', icon: '📍' },
];

export function formatCurrency(amount) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function formatKm(km) {
  const value = Number(km) || 0;
  return value.toLocaleString('it-IT', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

export function formatDuration(minutes) {
  const total = Number(minutes) || 0;
  if (total <= 0) return '';
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h (${m} min)`;
}

export function calculateTotalExpenses(expenses) {
  return expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
}

export function calculateTotalKm(itinerary) {
  return itinerary.reduce((sum, item) => sum + (Number(item.km) || 0), 0);
}

export function calculateSharedExpenses(expenses, participants) {
  const totalAll = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  if (participants.length === 0) return { perPerson: 0, total: 0, totalAll };
  return { perPerson: totalAll / participants.length, total: totalAll, totalAll };
}
