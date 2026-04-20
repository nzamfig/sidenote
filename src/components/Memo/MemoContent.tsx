/**
 * @file MemoContent.tsx
 * Contenteditable component for editing memo body content.
 *
 * Features:
 * - Mixed editing of text + images + maps (contenteditable div)
 * - insertImage: inserts an image at the cursor position (exposed via useImperativeHandle)
 * - insertMap: inserts a Leaflet/OpenStreetMap map on the next line after the cursor
 * - Image alignment toolbar: shows left/center/right alignment buttons on img hover
 * - Image resize handle: shows a transparent handle at the bottom-right on img hover, drag to resize
 * - Uncontrolled pattern: innerHTML is set only once on mount, saved on onBlur
 *
 * Map persistence strategy:
 * - Map state is preserved via data-map / data-lat / data-lng / data-zoom / data-markers attributes
 * - Before saving innerHTML, the Leaflet-generated DOM and action bar are removed; only attributes are serialized
 * - On load, [data-map] elements are found and Leaflet is re-initialized with marker restoration
 *
 * Map DOM structure:
 * <div data-map-wrapper>           ← contenteditable=false, position:relative
 *   <div data-map>                 ← container where Leaflet mounts
 *   <div data-map-action-bar>      ← marker add/delete button bar (position:absolute, below the map)
 */

import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MEMO_UI } from '../../constants';
import styles from './MemoContent.module.css';

export interface MemoContentHandle {
  insertImage: (src: string, maxWidth: number, maxHeight: number) => void;
  insertMap: () => void;
}

interface MemoContentProps {
  content: string;
  autoFocus?: boolean;
  onChange: (content: string) => void;
  onAutoResize?: (scrollHeight: number) => void;
}

type AlignType = 'left' | 'center' | 'right';

interface ImgToolbarState {
  img: HTMLImageElement;
  top: number;
  left: number;
}

/**
 * Position state of the image resize handle.
 * Stored as coordinates relative to wrapperRef, with the handle center placed at the image's bottom-right corner.
 * (top = imgRect.bottom - wrapperRect.top - MEMO_UI.RESIZE_HANDLE_SIZE/2)
 */
interface ResizeHandleState {
  img: HTMLImageElement;
  top: number;
  left: number;
}

/**
 * Converts a saved content string to HTML suitable for innerHTML.
 *
 * Strings containing HTML tags (saved after inserting images or maps) are returned as-is.
 * Plain text (legacy or empty memos) has special characters escaped and newlines replaced with <br>.
 * The output of this function must always pass through sanitizeHTML to prevent XSS.
 */
function toHTML(content: string): string {
  if (/<[a-z][\s\S]*>/i.test(content)) return content;
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

/**
 * Removes dangerous elements and event handler attributes before setting innerHTML.
 * XSS prevention: blocks executable elements like script/iframe and on* attributes via allowlist.
 */
function sanitizeHTML(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
    });
    const href = el.getAttribute('href');
    if (href && /^javascript:/i.test(href.trim())) el.removeAttribute('href');
    const src = el.getAttribute('src');
    if (src && /^javascript:/i.test(src.trim())) el.removeAttribute('src');
  });
  return doc.body.innerHTML;
}

/**
 * Before saving innerHTML, removes the Leaflet DOM inside map containers and keeps only data attributes.
 * Leaflet's internal DOM is restored on re-initialization, so it does not need to be saved.
 */
function getCleanedHTML(div: HTMLDivElement): string {
  const clone = div.cloneNode(true) as HTMLDivElement;
  clone.querySelectorAll<HTMLDivElement>('[data-map="true"]').forEach((el) => {
    el.innerHTML = '';
  });
  clone.querySelectorAll<HTMLDivElement>('[data-map-action-bar]').forEach((el) => {
    el.remove();
  });
  return clone.innerHTML;
}

/** Helper that bulk-applies a style object to an element's style */
function applyStyles(el: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(el.style, styles);
}

/**
 * Initializes a Leaflet map on the given container.
 * - Zoom controls: shown/hidden via CSS hover (.memo-map class)
 * - Action bar: shows add/delete marker buttons below the map (visible on wrapper hover)
 * - Delete mode: clicking the delete button switches markers to a ✕ icon; clicking a marker deletes it
 * - Marker persistence: preserved in data-markers (JSON), restored on load
 */
function initLeafletMap(container: HTMLDivElement, onSave: () => void) {
  if ((container as any)._leaflet_id) return;

  // Class for CSS hover-based zoom control visibility
  container.classList.add('memo-map');

  const lat = parseFloat(container.dataset.lat ?? '37.5665');
  const lng = parseFloat(container.dataset.lng ?? '126.9780');
  const zoom = parseInt(container.dataset.zoom ?? '11');

  // Block only at the bubble phase: events still propagate normally to Leaflet's child elements
  container.addEventListener('mousedown', (e) => e.stopPropagation());
  container.addEventListener('pointerdown', (e) => e.stopPropagation());

  const map = L.map(container, { center: [lat, lng], zoom, scrollWheelZoom: true });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
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

  // Restore saved markers
  try {
    const saved = JSON.parse(container.dataset.markers || '[]') as { lat: number; lng: number }[];
    saved.forEach(({ lat: mLat, lng: mLng }) => markerList.push(createMarker(mLat, mLng)));
  } catch { /* ignore parse errors */ }

  // Update data attributes on map move or zoom change
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
  // Also handles legacy saved data (no wrapper)
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

  // Marker add button
  const markerAddBtn = document.createElement('button');
  markerAddBtn.title = 'Add marker';
  markerAddBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
  applyStyles(markerAddBtn, { ...btnStyle });
  actionBar.appendChild(markerAddBtn);

  // Marker delete mode button (pin + X in top-right)
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

  // Hover / active colors (delete button stays red when delete mode is active)
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

  // Toggle delete mode
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
  latInput.type = 'number'; latInput.placeholder = 'Latitude (e.g. 37.5665)'; latInput.step = 'any';
  applyStyles(latInput, inputCSS);

  const lngInput = document.createElement('input');
  lngInput.type = 'number'; lngInput.placeholder = 'Longitude (e.g. 126.9780)'; lngInput.step = 'any';
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
    // Deactivate delete mode before showing the form
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

  // Prevent mouse events inside the form from propagating to the map
  markerForm.addEventListener('mousedown', (e) => e.stopPropagation());
  markerForm.addEventListener('pointerdown', (e) => e.stopPropagation());
}

export const MemoContent = forwardRef<MemoContentHandle, MemoContentProps>(
  function MemoContent({ content, autoFocus, onChange, onAutoResize }, ref) {
    const divRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [imgToolbar, setImgToolbar] = useState<ImgToolbarState | null>(null);
    const [resizeHandle, setResizeHandle] = useState<ResizeHandleState | null>(null);
    const resizeHandleRef = useRef<HTMLDivElement>(null);

    // Uncontrolled pattern: set innerHTML on mount + re-initialize existing maps
    useEffect(() => {
      const div = divRef.current;
      if (!div) return;
      div.innerHTML = sanitizeHTML(toHTML(content));

      const onSave = () => { if (div) onChange(getCleanedHTML(div)); };
      div.querySelectorAll<HTMLDivElement>('[data-map="true"]').forEach((el) => {
        initLeafletMap(el, onSave);
      });

      return () => {
        div.querySelectorAll<HTMLDivElement>('[data-map="true"]').forEach((el) => {
          const mapInstance = (el as any)._leafletMap as L.Map | undefined;
          if (mapInstance) mapInstance.remove();
        });
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * When autoFocus is true (newly created memo), moves the cursor to the end of the content.
     * div.focus() alone places the cursor at the start, so range.collapse(false)
     * moves it to the end so the user can start typing immediately.
     */
    useEffect(() => {
      if (autoFocus && divRef.current) {
        const div = divRef.current;
        div.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(div);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, [autoFocus]);

    useImperativeHandle(ref, () => ({
      insertImage(src: string, maxWidth: number, maxHeight: number) {
        const div = divRef.current;
        if (!div) return;
        div.focus();

        const sel = window.getSelection();
        if (sel && savedRangeRef.current) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        }

        const img = document.createElement('img');
        img.style.maxWidth = `${maxWidth}px`;
        img.style.maxHeight = `${maxHeight}px`;
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.marginRight = 'auto';
        img.onload = () => {
          const d = divRef.current;
          if (d && onAutoResize) onAutoResize(d.scrollHeight);
        };
        img.src = src;

        const currentSel = window.getSelection();
        if (currentSel && currentSel.rangeCount > 0) {
          const range = currentSel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          range.setStartAfter(img);
          range.collapse(true);
          currentSel.removeAllRanges();
          currentSel.addRange(range);
        } else {
          div.appendChild(img);
        }
        onChange(div.innerHTML);
      },

      insertMap() {
        const div = divRef.current;
        if (!div) return;
        div.focus();

        const sel = window.getSelection();
        if (sel && savedRangeRef.current) {
          sel.removeAllRanges();
          sel.addRange(savedRangeRef.current);
        }

        // Create wrapper + map container (wrapper groups the map and action bar)
        const wrapper = document.createElement('div');
        wrapper.setAttribute('contenteditable', 'false');
        wrapper.setAttribute('data-map-wrapper', 'true');
        wrapper.style.cssText = 'margin: 4px 0; flex-shrink: 0; position: relative;';

        const container = document.createElement('div');
        container.setAttribute('data-map', 'true');
        container.setAttribute('contenteditable', 'false');
        container.dataset.lat = '37.5665';
        container.dataset.lng = '126.9780';
        container.dataset.zoom = '11';
        // Inline styles preserve appearance across save/load
        container.style.cssText = [
          `height: ${MEMO_UI.MAP_HEIGHT}px`,
          'width: 100%',
          'border-radius: 6px',
          'overflow: hidden',
        ].join('; ');

        wrapper.appendChild(container);

        const currentSel = window.getSelection();
        if (currentSel && currentSel.rangeCount > 0) {
          const range = currentSel.getRangeAt(0);
          range.deleteContents();
          // Insert on the next line after the cursor
          const br = document.createElement('br');
          range.insertNode(br);
          range.setStartAfter(br);
          range.insertNode(wrapper);
          range.setStartAfter(wrapper);
          range.collapse(true);
          currentSel.removeAllRanges();
          currentSel.addRange(range);
        } else {
          div.appendChild(wrapper);
        }

        const onSave = () => { if (div) onChange(getCleanedHTML(div)); };
        requestAnimationFrame(() => {
          initLeafletMap(container, onSave);
          if (onAutoResize) onAutoResize(div.scrollHeight);
        });

        onChange(getCleanedHTML(div));
      },
    }));

    /**
     * Saves the current cursor/selection to savedRangeRef.
     * Connected to onSelect and onKeyUp to record the last cursor position before
     * focus moves away (e.g. when the image upload button is clicked) so
     * insertImage/insertMap can restore it.
     * Checks that the anchor node is inside divRef to avoid overwriting the saved range
     * when focus is on a different element.
     */
    const saveSelection = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && divRef.current?.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
    };

    /**
     * Shows the alignment toolbar and resize handle when hovering over an image.
     * - Alignment toolbar: below the image by default, flips above if it would overflow the bottom
     * - Resize handle: overlaid at the image's bottom-right corner (absolute coordinates relative to wrapperRef)
     * Both states are updated together to keep the image and handle in sync.
     */
    const showImgToolbar = (img: HTMLImageElement) => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const wrapperRect = wrapper.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      const TOOLBAR_H = 28;
      const ideal = imgRect.left - wrapperRect.left + imgRect.width / 2 - MEMO_UI.IMAGE_TOOLBAR_WIDTH / 2;
      const left = Math.max(0, Math.min(wrapper.offsetWidth - MEMO_UI.IMAGE_TOOLBAR_WIDTH, ideal));
      const belowTop = imgRect.bottom - wrapperRect.top + 4;
      const top = belowTop + TOOLBAR_H > wrapper.offsetHeight
        ? Math.max(0, imgRect.top - wrapperRect.top - TOOLBAR_H - 4)  // flip above the image
        : belowTop;
      setImgToolbar({ img, top, left });
      setResizeHandle({
        img,
        top: imgRect.bottom - wrapperRect.top - MEMO_UI.RESIZE_HANDLE_SIZE / 2,
        left: imgRect.right - wrapperRect.left - MEMO_UI.RESIZE_HANDLE_SIZE / 2,
      });
    };

    /**
     * Hides the alignment toolbar and resize handle 120ms after the mouse leaves the image.
     * If the mouse moves to the toolbar/handle during the delay, cancelHideToolbar cancels the timer.
     */
    const scheduleHideToolbar = () => {
      hideTimerRef.current = setTimeout(() => {
        setImgToolbar(null);
        setResizeHandle(null);
      }, 120);
    };

    const cancelHideToolbar = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };

    /**
     * Resize handle drag start handler.
     *
     * Performance: updating React state on every mousemove would cause a re-render per pixel.
     * Instead, img/handle styles are updated imperatively via document-level event listeners,
     * achieving smooth drag without any re-renders.
     * React state is synced and onChange is called only once on mouseup.
     *
     * Why document-level: fast drags can move the mouse outside the handle element.
     * Registering on document ensures no events are missed regardless of pointer position.
     */
    const handleResizePointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const img = resizeHandle?.img;
      if (!img) return;

      // Capture pointer so fast movement outside the handle doesn't drop events
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = img.offsetWidth;
      const startH = img.offsetHeight;

      // Hide the alignment toolbar during drag to reduce visual interference
      setImgToolbar(null);

      const onPointerMove = (ev: PointerEvent) => {
        const newW = Math.max(20, startW + (ev.clientX - startX));
        const newH = Math.max(20, startH + (ev.clientY - startY));
        img.style.width = `${newW}px`;
        img.style.height = `${newH}px`;
        // Remove the maxWidth/maxHeight constraints set on initial insert to allow free resizing
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';

        // Update handle position via direct DOM manipulation (without React setState)
        const wrapper = wrapperRef.current;
        const handle = resizeHandleRef.current;
        if (wrapper && handle) {
          const wr = wrapper.getBoundingClientRect();
          const ir = img.getBoundingClientRect();
          handle.style.top = `${ir.bottom - wr.top - MEMO_UI.RESIZE_HANDLE_SIZE / 2}px`;
          handle.style.left = `${ir.right - wr.left - MEMO_UI.RESIZE_HANDLE_SIZE / 2}px`;
        }
      };

      const onPointerUp = () => {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        // Restore cursor
        document.body.style.cursor = '';
        // Save after drag completes
        const div = divRef.current;
        if (div) onChange(div.innerHTML);
        // Sync final handle position to React state (for correct position on next interaction)
        const wrapper = wrapperRef.current;
        if (wrapper) {
          const wr = wrapper.getBoundingClientRect();
          const ir = img.getBoundingClientRect();
          setResizeHandle({
            img,
            top: ir.bottom - wr.top - MEMO_UI.RESIZE_HANDLE_SIZE / 2,
            left: ir.right - wr.left - MEMO_UI.RESIZE_HANDLE_SIZE / 2,
          });
        }
      };

      document.body.style.cursor = 'nwse-resize';
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    };

    /**
     * Changes image alignment.
     * Since img is display: block, horizontal alignment is controlled with auto margins.
     * left:   marginRight=auto → image hugs the left, space on the right
     * center: both auto       → centered
     * right:  marginLeft=auto → image hugs the right, space on the left
     */
    const applyAlignment = (align: AlignType) => {
      const img = imgToolbar?.img;
      if (!img || !divRef.current) return;
      if (align === 'left')        { img.style.marginLeft = '0';    img.style.marginRight = 'auto'; }
      else if (align === 'center') { img.style.marginLeft = 'auto'; img.style.marginRight = 'auto'; }
      else                         { img.style.marginLeft = 'auto'; img.style.marginRight = '0';    }
      onChange(divRef.current.innerHTML);
    };

    return (
      <div ref={wrapperRef} className={styles.editorWrapper}>
        <div
          ref={divRef}
          className={styles.editor}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Type a note..."
          onBlur={() => {
            const div = divRef.current;
            if (div && div.innerHTML !== content) onChange(getCleanedHTML(div));
          }}
          onSelect={saveSelection}
          onKeyUp={saveSelection}
          onPointerDown={(e) => {
            e.stopPropagation();
            // On touch devices, show image toolbar on tap; hide it when tapping elsewhere
            if (e.pointerType !== 'mouse') {
              if (e.target instanceof HTMLImageElement) {
                showImgToolbar(e.target);
              } else {
                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                setImgToolbar(null);
                setResizeHandle(null);
              }
            }
          }}
          onMouseOver={(e) => {
            if (e.target instanceof HTMLImageElement) showImgToolbar(e.target);
          }}
          onMouseOut={(e) => {
            if (e.target instanceof HTMLImageElement) scheduleHideToolbar();
          }}
        />

        {imgToolbar && (
          <div
            className={styles.imgAlignToolbar}
            style={{ top: imgToolbar.top, left: imgToolbar.left }}
            onMouseEnter={cancelHideToolbar}
            onMouseLeave={scheduleHideToolbar}
            onPointerEnter={cancelHideToolbar}
            onPointerLeave={scheduleHideToolbar}
          >
            <button className={styles.alignBtn} title="Align left"
              onPointerDown={(e) => e.preventDefault()} onClick={() => applyAlignment('left')}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                <rect x="1" y="2"   width="12" height="1.5" rx="0.75"/>
                <rect x="1" y="5.5" width="8"  height="1.5" rx="0.75"/>
                <rect x="1" y="9"   width="10" height="1.5" rx="0.75"/>
              </svg>
            </button>
            <button className={styles.alignBtn} title="Align center"
              onPointerDown={(e) => e.preventDefault()} onClick={() => applyAlignment('center')}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                <rect x="1" y="2"   width="12" height="1.5" rx="0.75"/>
                <rect x="3" y="5.5" width="8"  height="1.5" rx="0.75"/>
                <rect x="2" y="9"   width="10" height="1.5" rx="0.75"/>
              </svg>
            </button>
            <button className={styles.alignBtn} title="Align right"
              onPointerDown={(e) => e.preventDefault()} onClick={() => applyAlignment('right')}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                <rect x="1" y="2"   width="12" height="1.5" rx="0.75"/>
                <rect x="5" y="5.5" width="8"  height="1.5" rx="0.75"/>
                <rect x="3" y="9"   width="10" height="1.5" rx="0.75"/>
              </svg>
            </button>
          </div>
        )}

        {resizeHandle && (
          <div
            ref={resizeHandleRef}
            className={styles.imgResizeHandle}
            style={{ top: resizeHandle.top, left: resizeHandle.left }}
            onMouseEnter={cancelHideToolbar}
            onMouseLeave={scheduleHideToolbar}
            onPointerEnter={cancelHideToolbar}
            onPointerLeave={scheduleHideToolbar}
            onPointerDown={handleResizePointerDown}
          />
        )}
      </div>
    );
  }
);
