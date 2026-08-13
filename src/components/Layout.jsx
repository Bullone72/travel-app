import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function Layout() {
  const { currentTrip } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const isSettings = location.pathname === '/settings';

  return (
    <div className="app-layout">
      <header className="header">
        <div className="header-title">
          {!isHome && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginRight: 4 }}>
              ← Indietro
            </button>
          )}
          {!isHome && <img src="/favicon.svg" alt="TravelMate" className="logo" />}
          <h1>{isHome ? 'TravelMate' : ''}</h1>
        </div>
        {!isSettings && (
          <NavLink to="/settings" className="btn btn-secondary btn-sm">
            ⚙️
          </NavLink>
        )}
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      {currentTrip && !isHome && !isSettings && (
        <nav className="bottom-nav">
          <NavLink to={`/trip/${currentTrip.id}`} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">🏠</span>
            <span>Info</span>
          </NavLink>
          <NavLink to={`/trip/${currentTrip.id}/wallet`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">💳</span>
            <span>Wallet</span>
          </NavLink>
          <NavLink to={`/trip/${currentTrip.id}/itinerary`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">📋</span>
            <span>Programma</span>
          </NavLink>
          <NavLink to={`/trip/${currentTrip.id}/expenses`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">💰</span>
            <span>Spese</span>
          </NavLink>
          <NavLink to={`/trip/${currentTrip.id}/map`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">🗺️</span>
            <span>Mappa</span>
          </NavLink>
          <NavLink to={`/trip/${currentTrip.id}/ai`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">🤖</span>
            <span>AI</span>
          </NavLink>
        </nav>
      )}
    </div>
  );
}
