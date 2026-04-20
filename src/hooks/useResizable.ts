/**
 * @file useResizable.ts
 * Hook for resizing a memo by dragging its bottom-right handle.
 *
 * - Attaches pointermove/pointerup listeners to document on pointerdown, and removes them on pointerup.
 * - Uses setPointerCapture so resizing continues even if the cursor moves quickly outside the handle.
 * - Calls resizeMemo from the store in real time so size updates are reflected during the drag.
 */

import { useCallback } from 'react';
import { useMemoStore } from '../store/useMemoStore';
import type { MemoSize } from '../types/memo';
import { MEMO_CONSTRAINTS } from '../constants';

export function useResizable(memoId: string, currentSize: MemoSize) {
  const resizeMemo = useMemoStore((s) => s.resizeMemo);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Prevent dnd-kit from starting a drag
      e.stopPropagation();
      e.preventDefault();

      // Capture the pointer to this element so fast mouse movement doesn't drop events
      e.currentTarget.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = currentSize.width;
      const startHeight = currentSize.height;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const newWidth = Math.max(MEMO_CONSTRAINTS.MIN_WIDTH, startWidth + (moveEvent.clientX - startX));
        const newHeight = Math.max(MEMO_CONSTRAINTS.MIN_HEIGHT, startHeight + (moveEvent.clientY - startY));
        resizeMemo(memoId, { width: newWidth, height: newHeight });
      };

      const handlePointerUp = () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [memoId, currentSize, resizeMemo]
  );

  return { handlePointerDown };
}
