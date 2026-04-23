/**
 * @file leafletMap.ts
 * Imperative Leaflet map initialization and cleanup.
 *
 * Extracted from MemoContent so that the component stays focused on React concerns.
 * initLeafletMap is idempotent: it checks _leaflet_id before doing any work.
 */

import L from 'leaflet';
import { MAP_DEFAULTS } from '../constants';

/** Bulk-applies a style object to an element's inline style. */
function applyStyles(el: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(el.style, styles);
}

/**
 * Initializes a Leaflet map on the given container element.
 *
 * - Reads initial center/zoom from data-lat / data-lng / data-zoom attributes.
 * - Restores saved markers from data-markers (JSON array).
 * - Calls onSave() whenever map position, zoom, or markers change.
 * - Zoom controls are shown/hidden via CSS hover (.memo-map class).
 * - Action bar (add/delete marker buttons) appears below the map on wrapper hover.
 */
export function initLeafletMap(container: HTMLDivElement, onSave: () => void) {
  if ((container as any)._leaflet_id) return;

  container.classList.add('memo-map');

  const lat = parseFloat(container.dataset.lat ?? String(MAP_DEFAULTS.LAT));
  const lng = parseFloat(container.dataset.lng ?? String(MAP_DEFAULTS.LNG));
  const zoom = parseInt(container.dataset.zoom ?? String(MAP_DEFAULTS.ZOOM));

  container.addEventListener('mousedown', (e) => e.stopPropagation());
  container.addEventListener('pointerdown', (e) => e.stopPropagation());

  const map = L.map(container, { center: [lat, lng], zoom, scrollWheelZoom: true });

  L.tileLayer(MAP_DEFAULTS.TILE_URL, {
    attribution: MAP_DEFAULTS.TILE_ATTRIBUTION,
    subdomains: MAP_DEFAULTS.TILE_SUBDOMAINS,
    maxZoom: MAP_DEFAULTS.TILE_MAX_ZOOM,
  }).addTo(map);

  // ─── Marker list and delete mode ─────────────────────────────────────
  const markerList: L.Marker[] = [];
  let deleteMode = false;

  const deletableIcon = L.divIcon({
    html: `<div style="position:relative;width:25px;height:41px;cursor:pointer;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#3388ff" stroke="white" stroke-width="1.5"/>
        <circle cx="12.5" cy="12.5" r="4" fill="white"/>
      </svg>
      <div style="position:absolute;top:-4px;right:-6px;width:13px;height:13px;background:rgba(239,68,68,0.95);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:8px;font-weight:bold;border:1.5px solid white;line-height:1;">✕</div>
    </div>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    className: '',
  });
  const defaultIcon = new L.Icon.Default();

  const saveMarkers = () => {
    container.dataset.markers = JSON.stringify(
      markerList.map((m) => ({ lat: m.getLatLng().lat, lng: m.getLatLng().lng }))
    );
    onSave();
  };

  const createMarker = (mLat: number, mLng: number): L.Marker => {
    const marker = L.marker([mLat, mLng]).addTo(map);
    marker.on('click', () => {
      if (!deleteMode) return;
      marker.remove();
      const idx = markerList.indexOf(marker);
      if (idx !== -1) markerList.splice(idx, 1);
      saveMarkers();
    });
    return marker;
  };

  try {
    const saved = JSON.parse(container.dataset.markers || '[]') as { lat: number; lng: number }[];
    saved.forEach(({ lat: mLat, lng: mLng }) => markerList.push(createMarker(mLat, mLng)));
  } catch { /* ignore parse errors */ }

  map.on('moveend', () => {
    const c = map.getCenter();
    container.dataset.lat = c.lat.toFixed(6);
    container.dataset.lng = c.lng.toFixed(6);
    container.dataset.zoom = map.getZoom().toString();
    onSave();
  });

  (container as any)._leafletMap = map;
  requestAnimationFrame(() => map.invalidateSize());

  // ─── Find or create wrapper ───────────────────────────────────────────
  let wrapper: HTMLDivElement;
  const parent = container.parentElement as HTMLDivElement;
  if (parent.hasAttribute('data-map-wrapper')) {
    wrapper = parent;
  } else {
    wrapper = document.createElement('div');
    wrapper.setAttribute('contenteditable', 'false');
    wrapper.setAttribute('data-map-wrapper', 'true');
    wrapper.style.cssText = 'margin: 4px 0; flex-shrink: 0; position: relative;';
    parent.insertBefore(wrapper, container);
    wrapper.appendChild(container);
  }

  // ─── Action bar (overlay at the bottom of the map) ───────────────────
  let formVisible = false;

  const actionBar = document.createElement('div');
  actionBar.setAttribute('data-map-action-bar', 'true');
  applyStyles(actionBar, {
    position: 'absolute', top: '100%', left: '0', right: '0',
    display: 'flex', gap: '3px', padding: '2px 0', justifyContent: 'center',
    opacity: '0', transition: 'opacity 0.15s', pointerEvents: 'none',
    zIndex: '10',
  });
  wrapper.appendChild(actionBar);

  const btnStyle: Partial<CSSStyleDeclaration> = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '20px', height: '20px',
    background: 'white', border: 'none', borderRadius: '50%',
    cursor: 'pointer', color: 'rgba(0,0,0,0.5)', padding: '0',
    transition: 'color 0.1s, box-shadow 0.1s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
  };

  const markerAddBtn = document.createElement('button');
  markerAddBtn.title = 'Add marker';
  markerAddBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
  applyStyles(markerAddBtn, { ...btnStyle });
  actionBar.appendChild(markerAddBtn);

  const markerDeleteBtn = document.createElement('button');
  markerDeleteBtn.title = 'Delete marker';
  markerDeleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 26 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/><line x1="19" y1="1" x2="25" y2="7"/><line x1="25" y1="1" x2="19" y2="7"/></svg>`;
  applyStyles(markerDeleteBtn, { ...btnStyle });
  actionBar.appendChild(markerDeleteBtn);

  const ACTIONBAR_H = 26;
  const showBar = () => {
    const wrapperRect = wrapper.getBoundingClientRect();
    const memoEl = wrapper.closest('[data-memo-id]');
    const memoRect = memoEl?.getBoundingClientRect();
    if (memoRect && wrapperRect.bottom + ACTIONBAR_H > memoRect.bottom) {
      actionBar.style.top = 'auto';
      actionBar.style.bottom = '100%';
    } else {
      actionBar.style.top = '100%';
      actionBar.style.bottom = 'auto';
    }
    actionBar.style.opacity = '1';
    actionBar.style.pointerEvents = 'auto';
  };
  const hideBar = () => { actionBar.style.opacity = '0'; actionBar.style.pointerEvents = 'none'; };

  wrapper.addEventListener('pointerenter', () => { if (!formVisible) showBar(); });
  wrapper.addEventListener('pointerleave', () => { if (!formVisible) hideBar(); });

  [markerAddBtn, markerDeleteBtn].forEach((btn) => {
    btn.addEventListener('pointerover', () => {
      btn.style.color = 'rgba(0,0,0,0.8)';
      btn.style.boxShadow = '0 1px 6px rgba(0,0,0,0.28)';
    });
    btn.addEventListener('pointerout', () => {
      btn.style.color = (deleteMode && btn === markerDeleteBtn)
        ? 'rgba(239,68,68,0.8)' : 'rgba(0,0,0,0.5)';
      btn.style.boxShadow = '0 1px 4px rgba(0,0,0,0.18)';
    });
  });

  markerDeleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (deleteMode) {
      deleteMode = false;
      markerList.forEach((m) => m.setIcon(defaultIcon));
      markerDeleteBtn.style.color = 'rgba(0,0,0,0.5)';
    } else {
      deleteMode = true;
      markerList.forEach((m) => m.setIcon(deletableIcon));
      markerDeleteBtn.style.color = 'rgba(239,68,68,0.8)';
    }
  });

  // ─── Marker input form (bottom center inside the map) ────────────────
  const markerForm = document.createElement('div');
  applyStyles(markerForm, {
    position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
    zIndex: '2000', background: 'white', borderRadius: '8px',
    padding: '10px 12px', boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
    display: 'none', flexDirection: 'column', gap: '6px', minWidth: '176px',
  });
  container.appendChild(markerForm);

  const inputCSS: Partial<CSSStyleDeclaration> = {
    width: '100%', padding: '4px 7px', border: '1px solid #ddd',
    borderRadius: '4px', fontSize: '12px', outline: 'none',
    boxSizing: 'border-box', color: '#1a1a1a',
  };
  const latInput = document.createElement('input');
  latInput.type = 'number'; latInput.placeholder = `Latitude (e.g. ${MAP_DEFAULTS.LAT})`; latInput.step = 'any';
  applyStyles(latInput, inputCSS);

  const lngInput = document.createElement('input');
  lngInput.type = 'number'; lngInput.placeholder = `Longitude (e.g. ${MAP_DEFAULTS.LNG})`; lngInput.step = 'any';
  applyStyles(lngInput, inputCSS);

  const btnRow = document.createElement('div');
  applyStyles(btnRow, { display: 'flex', gap: '4px', justifyContent: 'flex-end' });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  applyStyles(cancelBtn, {
    padding: '3px 9px', border: '1px solid #ddd', borderRadius: '4px',
    background: 'white', fontSize: '11px', cursor: 'pointer', color: '#666',
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Add';
  applyStyles(confirmBtn, {
    padding: '3px 9px', border: 'none', borderRadius: '4px',
    background: '#3b82f6', fontSize: '11px', cursor: 'pointer', color: 'white',
  });

  btnRow.append(cancelBtn, confirmBtn);
  markerForm.append(latInput, lngInput, btnRow);

  const openForm = () => {
    if (deleteMode) {
      deleteMode = false;
      markerList.forEach((m) => m.setIcon(defaultIcon));
      markerDeleteBtn.style.color = 'rgba(0,0,0,0.5)';
    }
    formVisible = true;
    markerForm.style.display = 'flex';
    latInput.value = ''; lngInput.value = '';
    setTimeout(() => latInput.focus(), 0);
  };

  const closeForm = () => {
    formVisible = false;
    markerForm.style.display = 'none';
  };

  const addMarker = () => {
    const newLat = parseFloat(latInput.value);
    const newLng = parseFloat(lngInput.value);
    if (
      isNaN(newLat) || isNaN(newLng) ||
      newLat < -90 || newLat > 90 ||
      newLng < -180 || newLng > 180
    ) return;
    markerList.push(createMarker(newLat, newLng));
    map.flyTo([newLat, newLng], 15);
    saveMarkers();
    closeForm();
  };

  markerAddBtn.addEventListener('click', (e) => { e.stopPropagation(); openForm(); });
  confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); addMarker(); });
  cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); closeForm(); });

  [latInput, lngInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addMarker();
      if (e.key === 'Escape') closeForm();
      e.stopPropagation();
    });
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
  });

  markerForm.addEventListener('mousedown', (e) => e.stopPropagation());
  markerForm.addEventListener('pointerdown', (e) => e.stopPropagation());
}
