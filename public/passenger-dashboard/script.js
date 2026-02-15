/* 
  Passenger Dashboard Script
  - Leaflet map setup
  - Nominatim search & autocomplete
  - OSRM routing (distance & ETA)
  - Booking panel logic
  - Live driver tracking (simulation + Firebase structure placeholder)
*/

// -----------------------------
// CONFIG
// -----------------------------
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=';
const OSRM_BASE = 'https://router.project-osrm.org';

// -----------------------------
// STATE
// -----------------------------
let map;
let userMarker = null;
let pickup = null;      // { lat, lng, label }
let destination = null; // { lat, lng, label }
let routeLayer = null;
let driverMarker = null;
let driverTimer = null;
let currentRideId = null;
let scheduleAt = null; // ISO-like local string "YYYY-MM-DDTHH:mm"
let routeDurationSec = null;

// -----------------------------
// UTILITIES
// -----------------------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function formatKm(meters) {
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}
function formatMinutes(seconds) {
  const min = Math.round(seconds / 60);
  return `${min} min`;
}
function debounce(fn, delay = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
function formatTimeLabel(d) {
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hr12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = String(minutes).padStart(2, '0');
  return `${hr12}:${mm} ${ampm}`;
}
function initScheduleControls() {
  const dateSel = $('#sheet-date');
  const hourSel = $('#sheet-hour');
  const minuteSel = $('#sheet-minute');
  const ampmSel = $('#sheet-ampm');
  // Populate next 14 days
  dateSel.innerHTML = '';
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const label =
      i === 0 ? 'Today' :
      i === 1 ? 'Tomorrow' :
      d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const value = d.toISOString().slice(0, 10);
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    dateSel.appendChild(opt);
  }
  // Hours 1-12
  hourSel.innerHTML = '';
  for (let h = 1; h <= 12; h++) {
    const opt = document.createElement('option');
    opt.value = String(h).padStart(2, '0');
    opt.textContent = h;
    hourSel.appendChild(opt);
  }
  // Minutes 0/15/30/45
  minuteSel.innerHTML = '';
  [0, 15, 30, 45].forEach(m => {
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2, '0');
    opt.textContent = String(m).padStart(2, '0');
    minuteSel.appendChild(opt);
  });
  // AM/PM preset
  ampmSel.value = 'AM';

  // Default to nearest 15 min now
  const now = new Date();
  const mins = now.getMinutes();
  let rounded = Math.round(mins / 15) * 15;
  if (rounded === 60) { now.setHours(now.getHours() + 1); rounded = 0; }
  minuteSel.value = String(rounded).padStart(2, '0');
  const hours = now.getHours();
  const hr12 = hours % 12 === 0 ? 12 : hours % 12;
  hourSel.value = String(hr12).padStart(2, '0');
  ampmSel.value = hours >= 12 ? 'PM' : 'AM';
}
function openScheduleSheet() {
  $('#schedule-backdrop').classList.remove('hidden');
  $('#schedule-sheet').classList.remove('hidden');
  updateSheetPreview();
}
function closeScheduleSheet() {
  $('#schedule-backdrop').classList.add('hidden');
  $('#schedule-sheet').classList.add('hidden');
}
function computeScheduleIsoLocal() {
  const date = $('#sheet-date').value; // YYYY-MM-DD
  const hr12 = Number($('#sheet-hour').value);
  const min = Number($('#sheet-minute').value);
  const ampm = $('#sheet-ampm').value;
  let hour24 = hr12 % 12;
  if (ampm === 'PM') hour24 += 12;
  const hh = String(hour24).padStart(2, '0');
  const mm = String(min).padStart(2, '0');
  return `${date}T${hh}:${mm}`;
}
function updateSheetPreview() {
  const iso = computeScheduleIsoLocal();
  const [y, m, d, h, mi] = iso.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/).slice(1).map(Number);
  const local = new Date(y, m - 1, d, h, mi);
  const timeLabel = formatTimeLabel(local);
  const dateLabel = local.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const etaText = routeDurationSec ? ` • About ${formatMinutes(routeDurationSec)}` : '';
  $('#sheet-preview').textContent = `Pickup ${dateLabel} at ${timeLabel}${etaText}`;
}
function applySchedule() {
  scheduleAt = computeScheduleIsoLocal();
  // Update pill label
  const [y, m, d, h, mi] = scheduleAt.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/).slice(1).map(Number);
  const local = new Date(y, m - 1, d, h, mi);
  $('#schedule-btn .pill-text').textContent = formatTimeLabel(local);
  closeScheduleSheet();
}

// -----------------------------
// MAP INIT
// -----------------------------
function initMap() {
  map = L.map('map', { zoomControl: true });
  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  });
  tiles.addTo(map);

  // Try to center on user's location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 15);
        userMarker = L.circleMarker([latitude, longitude], {
          radius: 8, color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.9
        }).addTo(map).bindTooltip('You are here');
      },
      () => {
        // Fallback: center on a generic location
        map.setView([12.9716, 77.5946], 12); // Bengaluru as default
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  } else {
    map.setView([12.9716, 77.5946], 12);
  }
}

// -----------------------------
// MARKERS & ROUTE
// -----------------------------
function setPickup(lat, lng, label) {
  pickup = { lat, lng, label };
  $('#pickup-input').value = label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (pickupMarker) map.removeLayer(pickupMarker);
}
let pickupMarker = null;
function placePickupMarker(lat, lng) {
  if (pickupMarker) { map.removeLayer(pickupMarker); }
  pickupMarker = L.circleMarker([lat, lng], {
    radius: 8, color: '#10b981', fillColor: '#10b981', fillOpacity: 0.9
  }).addTo(map);
}

let destMarker = null;
function setDestination(lat, lng, label) {
  destination = { lat, lng, label };
  $('#dest-input').value = label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (destMarker) map.removeLayer(destMarker);
}
function placeDestMarker(lat, lng) {
  if (destMarker) { map.removeLayer(destMarker); }
  destMarker = L.circleMarker([lat, lng], {
    radius: 8, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.9
  }).addTo(map);
}

function fitBoundsToPoints() {
  if (!pickup || !destination) return;
  const group = L.featureGroup([
    L.marker([pickup.lat, pickup.lng]),
    L.marker([destination.lat, destination.lng])
  ]);
  map.fitBounds(group.getBounds().pad(0.35));
}

async function drawRoute() {
  if (!pickup || !destination) return;
  // Call OSRM
  const url = `${OSRM_BASE}/route/v1/driving/${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.routes || !data.routes[0]) return;

  const route = data.routes[0];
  const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  if (routeLayer) map.removeLayer(routeLayer);
  routeLayer = L.polyline(coords, { color: '#2563eb', weight: 5, opacity: 0.9 }).addTo(map);

  // Show distance and ETA bubble
  $('#route-distance').textContent = formatKm(route.distance);
  $('#route-eta').textContent = formatMinutes(route.duration);
  $('#route-info').classList.remove('hidden');
  routeDurationSec = route.duration;

  // Fit bounds and prepare simulated driver tracking
  fitBoundsToPoints();
  startDriverSimulation(coords);
}

// -----------------------------
// NOMINATIM SEARCH & AUTOCOMPLETE
// -----------------------------
const searchPickupDebounced = debounce(async () => {
  await doSearch('pickup');
}, 300);
const searchDestDebounced = debounce(async () => {
  await doSearch('dest');
}, 300);

async function doSearch(which) {
  const input = which === 'pickup' ? $('#pickup-input') : $('#dest-input');
  const listContainer = which === 'pickup' ? $('#pickup-suggestions') : $('#dest-suggestions');
  const query = input.value.trim();
  clearSuggestions(listContainer);
  if (!query) return;
  const res = await fetch(NOMINATIM_URL + encodeURIComponent(query), {
    headers: { 'Accept-Language': 'en' }
  });
  const results = await res.json();
  if (!Array.isArray(results)) return;
  const list = document.createElement('div');
  list.className = 'list';
  results.forEach(r => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <div>${escapeHtml(r.display_name)}</div>
      <div class="muted">${Number(r.lat).toFixed(5)}, ${Number(r.lon).toFixed(5)}</div>
    `;
    item.addEventListener('click', () => {
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      if (which === 'pickup') {
        setPickup(lat, lng, r.display_name);
        placePickupMarker(lat, lng);
      } else {
        setDestination(lat, lng, r.display_name);
        placeDestMarker(lat, lng);
      }
      map.setView([lat, lng], 16);
      clearSuggestions(listContainer);
      if (pickup && destination) drawRoute();
    });
    list.appendChild(item);
  });
  listContainer.appendChild(list);
}
function clearSuggestions(container) {
  container.innerHTML = '';
}
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// -----------------------------
// DRIVER SIMULATION + Firebase structure
// -----------------------------
function startDriverSimulation(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return;
  if (driverTimer) clearInterval(driverTimer);
  if (driverMarker) { map.removeLayer(driverMarker); driverMarker = null; }
  currentRideId = `ride_${Date.now()}`;

  let i = 0;
  driverMarker = L.circleMarker(coords[0], {
    radius: 7, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.95
  }).addTo(map).bindTooltip('Driver');

  // Firebase Realtime DB structure (placeholder)
  // live_rides/{rideId}/
  //   driver_lat: number
  //   driver_lng: number
  //   status: 'enroute' | 'arriving' | 'arrived'
  function updateFirebaseMock(lat, lng, status) {
    // In a real integration, you'd use:
    // set(ref(db, `live_rides/${currentRideId}`), { driver_lat: lat, driver_lng: lng, status })
    console.log('firebase-mock', { rideId: currentRideId, lat, lng, status });
  }

  driverTimer = setInterval(() => {
    if (i >= coords.length) {
      clearInterval(driverTimer);
      updateFirebaseMock(coords[coords.length - 1][0], coords[coords.length - 1][1], 'arrived');
      return;
    }
    const [lat, lng] = coords[i];
    driverMarker.setLatLng([lat, lng]);
    const status = (i > coords.length - 10) ? 'arriving' : 'enroute';
    updateFirebaseMock(lat, lng, status);
    i += 1;
  }, 1500);
}

// -----------------------------
// EVENT WIRING
// -----------------------------
function wireEvents() {
  $('#pickup-input').addEventListener('input', searchPickupDebounced);
  $('#dest-input').addEventListener('input', searchDestDebounced);

  $('#schedule-btn').addEventListener('click', openScheduleSheet);
  $('#sheet-cancel').addEventListener('click', closeScheduleSheet);
  $('#sheet-done').addEventListener('click', applySchedule);
  $('#sheet-date').addEventListener('change', updateSheetPreview);
  $('#sheet-hour').addEventListener('change', updateSheetPreview);
  $('#sheet-minute').addEventListener('change', updateSheetPreview);
  $('#sheet-ampm').addEventListener('change', updateSheetPreview);
  $('#use-current-btn').addEventListener('click', () => {
    if (!userMarker) return;
    const latlng = userMarker.getLatLng();
    setPickup(latlng.lat, latlng.lng, 'Current location');
    placePickupMarker(latlng.lat, latlng.lng);
    if (pickup && destination) drawRoute();
  });

  $('#find-pool-btn').addEventListener('click', () => {
    if (!pickup || !destination) {
      alert('Please select pickup and destination');
      return;
    }
    // Basic submission preview (placeholder)
    const payload = {
      pickup, destination,
      datetime: scheduleAt,
      recurring: $('#recurring-switch').checked
    };
    console.log('find-pool payload', payload);
    // If a route is present, the driver simulation already starts in drawRoute()
    alert('Searching nearby pools… (prototype)');
  });
}

// -----------------------------
// INIT
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initScheduleControls();
  wireEvents();
});
