/**
 * @file useCanvasInteraction.ts
 * Hook that handles user interactions with the canvas (background area).
 *
 * Handles these events:
 * - Double-click (mouse) → create a new memo at that position
 * - Double-tap (touch)   → create a new memo at that position
 * - Single click/tap (directly on the canvas background) → deselect the active memo
 *
 * Used in the Canvas component; canvasRef must be attached to the root canvas div.
 */

import { useCallback, useRef } from 'react';
import { useMemoStore } from '../store/useMemoStore';

export function useCanvasInteraction() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const createMemo = useMemoStore((s) => s.createMemo);
  const setActiveMemo = useMemoStore((s) => s.setActiveMemo);

  /**
   * Tracks the previous tap to detect double-tap on touch devices.
   * Stores the time and canvas-relative position of the last tap.
   */
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-memo-id]')) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      createMemo({
        position: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
      });
    },
    [createMemo]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === canvasRef.current) {
        setActiveMemo(null);
      }
    },
    [setActiveMemo]
  );

  /**
   * Touch-end handler that detects double-tap for memo creation on mobile.
   *
   * Two taps within 300ms and within 30px of each other are treated as a double-tap.
   * The memo is placed at the position of the second tap.
   */
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-memo-id]')) return;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const now = Date.now();
      const last = lastTapRef.current;

      if (
        last &&
        now - last.time < 300 &&
        Math.abs(x - last.x) < 30 &&
        Math.abs(y - last.y) < 30
      ) {
        // Double-tap confirmed
        lastTapRef.current = null;
        createMemo({ position: { x, y } });
      } else {
        lastTapRef.current = { time: now, x, y };
      }
    },
    [createMemo]
  );

  return { canvasRef, handleDoubleClick, handleCanvasClick, handleTouchEnd };
}
