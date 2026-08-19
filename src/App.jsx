import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import TripDetailPage from './pages/TripDetailPage';
import WalletPage from './pages/WalletPage';
import ItineraryPage from './pages/ItineraryPage';
import ExpensesPage from './pages/ExpensesPage';
import SplitPage from './pages/SplitPage';
import MapPage from './pages/MapPage';
import AiAssistantPage from './pages/AiAssistantPage';
import SettingsPage from './pages/SettingsPage';
import './index.css';

function Notification() {
  const { notification } = useApp();
  if (!notification) return null;
  return (
    <div style={{
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      background: notification.type === 'error' ? 'var(--danger)' : 'var(--success)',
      color: 'white', padding: '10px 24px', borderRadius: 'var(--radius-sm)',
      fontSize: '0.85rem', fontWeight: 600, zIndex: 300,
      boxShadow: 'var(--shadow-lg)', animation: 'fadeIn 0.3s ease',
    }}>
      {notification.message}
    </div>
  );
}

function UpdateBanner() {
  const [updateVer, setUpdateVer] = useState(null);
  useEffect(() => {
    const ver = localStorage.getItem('travelmate_update_available');
    if (ver) setUpdateVer(ver);
  }, []);
  if (!updateVer) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      color: 'white', padding: '10px 16px', zIndex: 400,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: '0.8rem', fontWeight: 600,
    }}>
      <span>Aggiornamento disponibile (v{updateVer})</span>
      <button onClick={() => {
        localStorage.removeItem('travelmate_update_available');
        window.open('https://github.com/Bullone72/travel-app/releases/latest', '_system');
      }} style={{
        background: 'rgba(255,255,255,0.25)', border: 'none', color: 'white',
        padding: '4px 12px', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
      }}>Scarica</button>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="trip/:id" element={<TripDetailPage />} />
        <Route path="trip/:id/wallet" element={<WalletPage />} />
        <Route path="trip/:id/itinerary" element={<ItineraryPage />} />
        <Route path="trip/:id/expenses" element={<ExpensesPage />} />
        <Route path="trip/:id/split" element={<SplitPage />} />
        <Route path="trip/:id/map" element={<MapPage />} />
        <Route path="trip/:id/ai" element={<AiAssistantPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <UpdateBanner />
        <Notification />
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
