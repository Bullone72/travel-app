import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export const MAP_DEFAULT_CENTER = [41.9028, 12.4964];
export const MAP_DEFAULT_ZOOM = 6;

export function createMap(container, center = MAP_DEFAULT_CENTER, zoom = MAP_DEFAULT_ZOOM) {
  const map = L.map(container, {
    center,
    zoom,
    scrollWheelZoom: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  return map;
}

export function addMarker(map, lat, lng, index = '', title = '') {
  const html = index
    ? `<div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${index}</div>`
    : `<div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:50%;width:14px;height:14px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`;

  const icon = L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
  return L.marker([lat, lng], { icon }).bindPopup(title).addTo(map);
}

export function addRoutePolyline(map, points, color = '#667eea') {
  if (points.length < 2) return;
  const latlngs = points.map(p => [p.lat, p.lng]);
  L.polyline(latlngs, {
    color,
    weight: 3,
    opacity: 0.8,
    dashArray: '6 6',
  }).addTo(map);
}

export function addRouteSegment(map, coordinates, color = '#667eea') {
  if (!coordinates || coordinates.length < 2) return;
  const latlngs = coordinates.map(c => [c.lat, c.lng]);
  L.polyline(latlngs, {
    color,
    weight: 5,
    opacity: 0.8,
  }).addTo(map);
}

export const DAY_COLORS = ['#667eea', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#3b82f6', '#14b8a6', '#a855f7', '#e11d48', '#0ea5e9', '#22c55e'];

export function fitMapToPoints(map, points) {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.setView([points[0].lat, points[0].lng], 13);
    return;
  }
  const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
  map.fitBounds(bounds, { padding: [30, 30] });
}

export function clearMarkers(map) {
  map.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.Polyline) {
      map.removeLayer(layer);
    }
  });
}

export async function geocodeNominatim(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error('Geocoding failed');
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
    }
    return null;
  } catch (err) {
    console.error('Nominatim geocode error:', err);
    return null;
  }
}

export async function getRouteDistance(start, end, transportMode = 'car') {
  try {
    const profile = transportMode === 'foot' || transportMode === 'a piedi' || transportMode === 'bicicletta'
      ? (transportMode === 'bicicletta' ? 'bike' : 'foot')
      : 'driving';
    const url = `https://router.project-osrm.org/route/v1/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=true`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Routing failed');
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coordinates = route.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
      return {
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
        coordinates,
      };
    }
    return null;
  } catch (err) {
    console.error('OSRM routing error:', err);
    return null;
  }
}

export async function getRouteAlternatives(points, transportMode = 'car') {
  try {
    if (!points || points.length < 2) return [];
    const profile = transportMode === 'foot' || transportMode === 'a piedi' || transportMode === 'bicicletta'
      ? (transportMode === 'bicicletta' ? 'bike' : 'foot')
      : 'driving';
    const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&alternatives=true`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Routing failed');
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes.slice(0, 3).map(route => ({
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
        coordinates: route.geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] })),
      }));
    }
    return [];
  } catch (err) {
    console.error('OSRM routing error:', err);
    return [];
  }
}

function buildHereDirectionsUrl(startPoint, endPoint, waypoints = []) {
  const parts = [`${startPoint.lat},${startPoint.lng}`];
  waypoints.forEach(w => {
    if (w.lat && w.lng) parts.push(`${w.lat},${w.lng}`);
  });
  parts.push(`${endPoint.lat},${endPoint.lng}`);
  return `here.directions://v1.0/${parts.join('/')}`;
}

export async function openInHereWeGo(startPoint, endPoint, waypoints = []) {
  if (!startPoint || !endPoint) return;

  const directionsUrl = buildHereDirectionsUrl(startPoint, endPoint, waypoints);

  try {
    const { registerPlugin } = await import('@capacitor/core');
    const Navigation = registerPlugin('Navigation');
    const shareUrl = `https://share.here.com/r/${[`${startPoint.lat},${startPoint.lng}`, ...waypoints.filter(w => w.lat && w.lng).map(w => `${w.lat},${w.lng}`), `${endPoint.lat},${endPoint.lng}`].join('/')}`;
    const result = await Navigation.openHereWeGo({ shareUrl: directionsUrl, fallbackUrl: shareUrl });
    if (result?.opened) return;
  } catch {}

  try {
    window.location.href = directionsUrl;
    return;
  } catch {}

  const shareUrl = `https://share.here.com/r/${[`${startPoint.lat},${startPoint.lng}`, ...waypoints.filter(w => w.lat && w.lng).map(w => `${w.lat},${w.lng}`), `${endPoint.lat},${endPoint.lng}`].join('/')}`;
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: shareUrl });
    return;
  } catch {}

  window.open(shareUrl, '_blank');
}

export async function openInGoogleMaps(startPoint, endPoint, waypoints = []) {
  if (!startPoint || !endPoint) return;

  let url = `https://www.google.com/maps/dir/?api=1&origin=${startPoint.lat},${startPoint.lng}&destination=${endPoint.lat},${endPoint.lng}&travelmode=driving`;
  if (waypoints.length > 0) {
    const wpStr = waypoints.map(w => `${w.lat},${w.lng}`).join('|');
    url += `&waypoints=${encodeURIComponent(wpStr)}`;
  }

  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
    return;
  } catch {}

  window.open(url, '_blank');
}

export function openInOsm(startPoint, endPoint) {
  const base = 'https://www.openstreetmap.org/directions?engine=fossgis_osrm_car';
  if (startPoint && endPoint) {
    const params = `&route=${startPoint.lat},${startPoint.lng};${endPoint.lat},${endPoint.lng}`;
    window.open(base + params, '_blank');
  } else {
    window.open('https://www.openstreetmap.org/directions', '_blank');
  }
}
