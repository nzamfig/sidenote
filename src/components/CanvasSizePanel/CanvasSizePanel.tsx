/**
 * @file CanvasSizePanel.tsx
 * UI panel for configuring the canvas area size.
 *
 * - Default: small button showing the current size (W × H), fixed at the top center
 * - On click: switches to a width/height input form
 * - Enter / Apply button: applies the size; Escape / click outside: cancels
 */

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import styles from './CanvasSizePanel.module.css';

/** Minimum allowed values */
const MIN_W = 400;
const MIN_H = 300;

export function CanvasSizePanel() {
  const { width, height, setSize } = useCanvasStore();
  const [open, setOpen] = useState(false);
  const [inputW, setInputW] = useState('');
  const [inputH, setInputH] = useState('');
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const wInputRef = useRef<HTMLInputElement>(null);

  /** On trigger button click, populate fields with current store values and open the form */
  const handleOpen = () => {
    setInputW(String(width));
    setInputH(String(height));
    setError(false);
    setOpen(true);
  };

  // When the form opens, select all text in the width field so typing starts immediately
  useEffect(() => {
    if (open) wInputRef.current?.select();
  }, [open]);

  /**
   * Validates input and applies the canvas size.
   * parseInt-based parsing: decimal inputs (e.g. "800.5") are truncated to integers.
   * Sets error state (red border) if values are below the minimum.
   */
  const handleApply = () => {
    const w = parseInt(inputW, 10);
    const h = parseInt(inputH, 10);
    if (isNaN(w) || isNaN(h) || w < MIN_W || h < MIN_H) {
      setError(true);
      return;
    }
    setSize(w, h);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleApply(); }
    if (e.key === 'Escape') setOpen(false);
    // Prevent key events from propagating to dnd-kit listeners on the canvas
    e.stopPropagation();
  };

  // Close the form when clicking outside. Skip registering the listener when open=false.
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  return (
    <div ref={panelRef} className={styles.panel}>
      {open ? (
        <div className={styles.form} data-error={error}>
          <span className={styles.label}>W</span>
          <input
            ref={wInputRef}
            className={styles.input}
            type="number"
            value={inputW}
            min={MIN_W}
            onChange={(e) => { setInputW(e.target.value); setError(false); }}
            onKeyDown={handleKeyDown}
            aria-label="Canvas width"
          />
          <span className={styles.sep}>×</span>
          <span className={styles.label}>H</span>
          <input
            className={styles.input}
            type="number"
            value={inputH}
            min={MIN_H}
            onChange={(e) => { setInputH(e.target.value); setError(false); }}
            onKeyDown={handleKeyDown}
            aria-label="Canvas height"
          />
          <button className={styles.applyBtn} onClick={handleApply}>Apply</button>
        </div>
      ) : (
        <button className={styles.trigger} onClick={handleOpen} title="Set canvas size">
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          <span className={styles.sizeText}>{width} × {height}</span>
        </button>
      )}
    </div>
  );
}
