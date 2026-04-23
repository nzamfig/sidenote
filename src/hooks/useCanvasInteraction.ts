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
import { INTERACTION_TIMING } from '../constants';

export function useCanvasInteraction() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const createMemo = useMemoStore((s) => s.createMemo);
  const setActiveMemo = useMemoStore((s) => s.setActiveMemo);

  /**
   * Tracks the previous tap to detect double-tap on touch devices.
   * Stores the time and canvas-relative position of the last tap.
   */
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  /**
   * Set to true when handleTouchEnd creates a memo via double-tap.
   * Mobile browsers fire a synthetic dblclick after a double-tap, which would
   * trigger handleDoubleClick a second time and create a duplicate memo.
   * This flag lets handleDoubleClick skip that synthetic event.
   */
  const suppressNextDblClickRef = useRef(false);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (suppressNextDblClickRef.current) {
        suppressNextDblClickRef.current = false;
        return;
      }
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
        now - last.time < INTERACTION_TIMING.DOUBLE_TAP_MAX_MS &&
        Math.abs(x - last.x) < INTERACTION_TIMING.DOUBLE_TAP_MAX_DIST &&
        Math.abs(y - last.y) < INTERACTION_TIMING.DOUBLE_TAP_MAX_DIST
      ) {
        // Double-tap confirmed — suppress the synthetic dblclick the browser will fire next
        lastTapRef.current = null;
        suppressNextDblClickRef.current = true;
        createMemo({ position: { x, y } });
      } else {
        lastTapRef.current = { time: now, x, y };
      }
    },
    [createMemo]
  );

  return { canvasRef, handleDoubleClick, handleCanvasClick, handleTouchEnd };
}
