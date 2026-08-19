import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      reg.update();
    }).catch(err => console.error('SW registration failed:', err));
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

fetch('https://travel-app-tau-ashen.vercel.app/version.txt?t=' + Date.now())
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(v => {
    const serverVer = v.trim();
    const localVer = localStorage.getItem('travelmate_version') || '';
    if (localVer && serverVer !== localVer) {
      localStorage.setItem('travelmate_update_available', serverVer);
    }
    localStorage.setItem('travelmate_version', serverVer);
  })
  .catch(() => {});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
