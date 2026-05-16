// ─── ORION MAP MODULE (Leaflet.js) ──────────────────────────────────────────
import { Persons } from './db.js';
import { navigate } from './router.js';
import { avatarEl, riskClass } from './persons.js';
import { showToast } from './security.js';

let map = null;
let minimalMode = false;
let markersLayer = null;

export async function renderMap(container) {
  if (map) {
    map.remove();
    map = null;
  }
  const persons = await Persons.list();
  
  container.innerHTML = `
    <div class="section-header mb-2">
      <div class="section-title">Karte <span class="hide-on-mobile">/ Geografische Intelligenz</span></div>
      <div class="flex gap-2" style="align-items:center;">
        <span class="hide-on-mobile" style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${persons.filter(p => p.location).length} Standorte</span>
        <button class="btn btn-ghost btn-sm" id="btn-toggle-minimal">
          <i data-lucide="${minimalMode ? 'user' : 'minimize-2'}" style="width:14px;margin-right:4px;"></i> 
          <span class="hide-on-mobile">${minimalMode ? 'Avatare zeigen' : 'Minimal-Modus'}</span>
          <span class="mobile-only" style="display:none;">${minimalMode ? 'Profil' : 'Minimal'}</span>
        </button>
        <button class="btn btn-ghost btn-sm" id="btn-recenter-map">⊙ <span class="hide-on-mobile">Weltweit</span></button>
        <button class="btn btn-ghost btn-sm" id="btn-fullscreen-map" title="Vollbild"><i data-lucide="maximize" style="width:14px;"></i></button>
      </div>
    </div>
    <div class="map-container" id="map-element"></div>
  `;

  const mapEl = document.getElementById('map-element');
  if (!mapEl) return;

  // Fullscreen Logic
  document.getElementById('btn-fullscreen-map').onclick = () => {
    if (!document.fullscreenElement) {
      mapEl.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };
  document.addEventListener('fullscreenchange', () => {
    if (map) map.invalidateSize();
  });

  // Initialize Map
  map = L.map('map-element', {
    zoomControl: true,
    attributionControl: false
  }).setView([20, 0], 2);

  // Dark Theme Tiles (CartoDB Dark Matter)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
    updateWhenIdle: false, // Update during zoom for smoothness
    keepBuffer: 12        // Keep more tiles in memory
  }).addTo(map);

  // Fix for "Gray area" / incorrect rendering on load
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 200);

  markersLayer = L.layerGroup().addTo(map);

  // Process persons and add markers
  await renderMarkers(persons);

  document.getElementById('btn-recenter-map').onclick = () => {
    map.setView([20, 0], 2);
  };

  document.getElementById('btn-toggle-minimal').onclick = async () => {
    minimalMode = !minimalMode;
    // Re-render
    const freshPersons = await Persons.list();
    markersLayer.clearLayers();
    await renderMarkers(freshPersons);
    
    // Update button text/icon
    const btn = document.getElementById('btn-toggle-minimal');
    btn.innerHTML = `
      <i data-lucide="${minimalMode ? 'user' : 'minimize-2'}" style="width:14px;margin-right:4px;"></i> 
      <span class="hide-on-mobile">${minimalMode ? 'Avatare zeigen' : 'Minimal-Modus'}</span>
      <span class="mobile-only" style="display:none;">${minimalMode ? 'Profil' : 'Minimal'}</span>
    `;
    if (window.lucide) window.lucide.createIcons();
  };
}

async function renderMarkers(persons) {
  const personsWithLocation = persons.filter(p => (p.location || p.street) && (p.location?.trim() !== '' || p.street?.trim() !== ''));
  
  // Staggered loading to prevent UI freeze and API rate limits
  personsWithLocation.forEach(async (p, index) => {
    let lat = p.lat;
    let lng = p.lng;

    if (lat === undefined || lng === undefined) {
      // Build full address string
      const fullAddress = [p.street, p.houseNumber, p.location].filter(Boolean).join(' ');
      
      // Delay geocoding slightly for each person
      await new Promise(r => setTimeout(r, index * 300));
      const coords = await geocode(fullAddress);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
        await Persons.save({ ...p, lat, lng });
      }
    }

    if (lat !== undefined && lng !== undefined) {
      if (map && markersLayer) addMarker(p, lat, lng);
    }
  });
}

function addMarker(p, lat, lng) {
  const isMobile = window.innerWidth <= 768;
  const size = isMobile ? 40 : 32;
  
  let icon;
  if (minimalMode) {
    icon = L.divIcon({
      className: 'custom-map-icon-minimal',
      html: `<div class="map-marker-dot ${riskClass(p.riskLevel)}"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    });
  } else {
    icon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div class="map-marker-avatar ${riskClass(p.riskLevel)}" style="width:${size}px; height:${size}px;">${avatarEl(p, size)}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  const marker = L.marker([lat, lng], { icon }).addTo(markersLayer);
  
  const popupContent = `
    <div style="min-width:140px;">
      <div style="font-weight:bold; font-size:13px; margin-bottom:4px;">${p.name}</div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">${p.job || '–'}</div>
      <div class="map-popup-link" onclick="window.navigate('person/${p.id}')">Dossier öffnen →</div>
    </div>
  `;
  
  marker.bindPopup(popupContent, {
    offset: [0, -10]
  });
}

async function geocode(locationName) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1`;
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7' }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch (err) {
    console.error('Geocoding error for:', locationName, err);
  }
  return null;
}
