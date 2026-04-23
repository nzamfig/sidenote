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
import 'leaflet/dist/leaflet.css';
import { MEMO_UI, MAP_DEFAULTS } from '../../constants';
import { initLeafletMap } from '../../utils/leafletMap';
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

/**
 * Removes nested font-size spans inside `root` so that the outermost new size wins.
 * Processes innermost spans first (reversed querySelectorAll order) to avoid
 * re-processing already-unwrapped nodes.
 * Spans that had only font-size are fully unwrapped; spans with other styles keep
 * them but lose font-size.
 */
function removeInnerFontSizes(root: HTMLElement): void {
  Array.from(root.querySelectorAll<HTMLElement>('span')).reverse().forEach((el) => {
    if (!el.style.fontSize) return;
    el.style.removeProperty('font-size');
    if (!el.style.cssText.trim()) {
      el.replaceWith(...Array.from(el.childNodes));
    }
  });
}

/** Removes spans that have no children (left empty after extractContents). */
function cleanupEmptySpans(root: HTMLElement): void {
  root.querySelectorAll('span').forEach((el) => {
    if (el.childNodes.length === 0) el.remove();
  });
}

export const MemoContent = forwardRef<MemoContentHandle, MemoContentProps>(
  function MemoContent({ content, autoFocus, onChange, onAutoResize }, ref) {
    const divRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [imgToolbar, setImgToolbar] = useState<ImgToolbarState | null>(null);
    const [resizeHandle, setResizeHandle] = useState<ResizeHandleState | null>(null);
    const [textToolbar, setTextToolbar] = useState(false);
    const [showSizeMenu, setShowSizeMenu] = useState(false);
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

    // Show/hide text formatting toolbar based on selection inside the editor
    useEffect(() => {
      const handleSelectionChange = () => {
        const sel = window.getSelection();
        const div = divRef.current;
        if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !div) {
          setTextToolbar(false);
          setShowSizeMenu(false);
          return;
        }
        if (!div.contains(sel.anchorNode) || !div.contains(sel.focusNode)) {
          setTextToolbar(false);
          setShowSizeMenu(false);
          return;
        }
        if (sel.getRangeAt(0).getClientRects().length === 0) {
          setTextToolbar(false);
          setShowSizeMenu(false);
          return;
        }
        setTextToolbar(true);
      };
      document.addEventListener('selectionchange', handleSelectionChange);
      return () => document.removeEventListener('selectionchange', handleSelectionChange);
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
        container.dataset.lat = String(MAP_DEFAULTS.LAT);
        container.dataset.lng = String(MAP_DEFAULTS.LNG);
        container.dataset.zoom = String(MAP_DEFAULTS.ZOOM);
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

    const applyFormat = (command: 'bold' | 'italic') => {
      document.execCommand(command);
      const div = divRef.current;
      if (div) {
        cleanupEmptySpans(div);
        onChange(getCleanedHTML(div));
      }
    };

    const applyFontSize = (size: number) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      let span: HTMLSpanElement;
      try {
        // surroundContents preserves surrounding formatting (e.g. <b>, <i>) by inserting
        // the new span inside the existing element rather than extracting the text node.
        // Throws when the selection crosses element boundaries (partial containment).
        span = document.createElement('span');
        span.style.fontSize = `${size}px`;
        range.surroundContents(span);
      } catch {
        // Cross-element selection: extract fragment (preserves inner <b>/<i> clones)
        // then wrap and re-insert.
        span = document.createElement('span');
        span.style.fontSize = `${size}px`;
        span.appendChild(range.extractContents());
        range.insertNode(span);
      }
      // Remove any nested font-size spans so the new size takes full effect.
      removeInnerFontSizes(span);
      range.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(range);
      setShowSizeMenu(false);
      const div = divRef.current;
      if (div) {
        cleanupEmptySpans(div);
        onChange(getCleanedHTML(div));
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
      <div ref={wrapperRef} className={`${styles.editorWrapper}${textToolbar ? ` ${styles.textSelecting}` : ''}`}>
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

        {imgToolbar && !textToolbar && (
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

        {resizeHandle && !textToolbar && (
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

        {textToolbar && (
          <>
            <div className={styles.textFormatToolbar}>
              <button
                className={styles.formatBtn}
                title="Bold"
                onPointerDown={(e) => { e.preventDefault(); applyFormat('bold'); }}
              >
                <b>B</b>
              </button>
              <button
                className={styles.formatBtn}
                title="Italic"
                onPointerDown={(e) => { e.preventDefault(); applyFormat('italic'); }}
              >
                <i>I</i>
              </button>
              <button
                className={`${styles.formatBtn} ${showSizeMenu ? styles.formatBtnActive : ''}`}
                title="Font size"
                onPointerDown={(e) => { e.preventDefault(); setShowSizeMenu((v) => !v); }}
              >
                <b style={{ fontFamily: 'serif', fontSize: '12px' }}>A</b>
              </button>
            </div>
            {showSizeMenu && (
              <div className={styles.sizeMenu}>
                {[10, 12, 14, 16, 18, 24].map((size) => (
                  <button
                    key={size}
                    className={styles.sizeOption}
                    onPointerDown={(e) => { e.preventDefault(); applyFontSize(size); }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);
