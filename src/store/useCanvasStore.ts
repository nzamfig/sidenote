/**
 * @file useCanvasStore.ts
 * Zustand store managing canvas area (width × height) state.
 *
 * - Initial value: falls back to current viewport size if no saved value exists
 * - Changes are persisted to localStorage immediately (survives browser restart)
 * - Storage key: 'canvas-size' (managed independently from memo-app-v1)
 */

import { create } from 'zustand';
import { STORAGE_KEYS } from '../constants';

interface CanvasStore {
  width: number;
  height: number;
  setSize: (width: number, height: number) => void;
}

/**
 * Reads canvas size from localStorage and returns it.
 *
 * A type guard verifies that both width and height are numbers because
 * localStorage values are external input — casting without runtime validation
 * could let corrupt data arrive as NaN and make the canvas disappear.
 * Falls back to the current viewport size on validation failure or missing key (first run).
 */
function loadSize(): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CANVAS_SIZE);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        typeof (parsed as Record<string, unknown>).width === 'number' &&
        typeof (parsed as Record<string, unknown>).height === 'number'
      ) {
        return {
          width: (parsed as Record<string, number>).width,
          height: (parsed as Record<string, number>).height,
        };
      }
    }
  } catch { /* ignore parse errors */ }
  // No saved value (first run) or parse failure — use viewport size as default
  return { width: window.innerWidth, height: window.innerHeight };
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  ...loadSize(),
  setSize: (width, height) => {
    set({ width, height });
    try {
      localStorage.setItem(STORAGE_KEYS.CANVAS_SIZE, JSON.stringify({ width, height }));
    } catch { /* ignore save failures */ }
  },
}));
