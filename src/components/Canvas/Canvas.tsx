/**
 * @file Canvas.tsx
 * The infinite canvas (background area) where memos are placed.
 *
 * Responsibilities:
 * 1. Provides DndContext — enables drag support for all child Memo components.
 * 2. Handles drag end — computes the final position of a dragged memo and commits it to the store.
 * 3. Delegates events — double-click and click events are handled by useCanvasInteraction.
 * 4. Renders memo list — renders memos in array order (later in array = higher z-index).
 */

import { useRef } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { useMemoStore } from '../../store/useMemoStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { Memo } from '../Memo/Memo';
import styles from './Canvas.module.css';

export function Canvas() {
  // Subscribe to the full memos array (re-renders on memo add/delete/move)
  const memos = useMemoStore((s) => s.memos);
  const moveMemo = useMemoStore((s) => s.moveMemo);
  // User-specified canvas size — applied immediately as inline style on the canvas div
  const { width: canvasWidth, height: canvasHeight } = useCanvasStore();

  /**
   * Ref tracking the canvas size.
   * Using a ref instead of state because size changes don't need to trigger a re-render;
   * the value only needs to be read at drag end time.
   */
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  // Get double-click/click/double-tap handlers and the canvas ref from the hook
  const { canvasRef, handleDoubleClick, handleCanvasClick, handleTouchEnd } = useCanvasInteraction();

  /**
   * @dnd-kit sensor configuration.
   *
   * PointerSensor: handles both mouse and touch events.
   * activationConstraint.distance: requires at least 5px of movement before recognizing a drag.
   * → Without this, clicks and double-clicks could be mistaken for drags.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  /**
   * Drag end event handler.
   *
   * @dnd-kit does not physically move memos during a drag.
   * Instead, the Memo component applies the `transform` delta visually via CSS.
   * When the drag ends, this handler computes the final position and commits it to the store.
   *
   * Position calculation:
   *   final x = store's position.x at drag start + drag delta.x
   *   final y = store's position.y at drag start + drag delta.y
   *
   * Boundary clamping:
   *   Clamps to [0, canvasSize - memoSize] to prevent memos from escaping the canvas.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;

    // Find the dragged memo by id
    const memo = memos.find((m) => m.id === active.id);
    if (!memo) return;

    // Measure the actual canvas size at drag end and store it in the ref
    const canvas = canvasRef.current;
    if (canvas) {
      canvasSizeRef.current = {
        width: canvas.offsetWidth,
        height: canvas.offsetHeight,
      };
    }

    const { width: canvasW, height: canvasH } = canvasSizeRef.current;

    // Pre-drag position + movement delta = post-drag position
    const rawX = memo.position.x + delta.x;
    const rawY = memo.position.y + delta.y;

    /**
     * Clamp to canvas boundaries.
     * Math.max(0, ...) → left/top boundary
     * Math.min(..., canvasW - memo.size.width) → right/bottom boundary
     * (subtract width/height so the memo's bottom-right corner stays inside the canvas)
     *
     * If canvasW is 0 (canvas DOM not yet measured), skip clamping.
     */
    const x = canvasW > 0 ? Math.max(0, Math.min(rawX, canvasW - memo.size.width)) : rawX;
    const y = canvasH > 0 ? Math.max(0, Math.min(rawY, canvasH - memo.size.height)) : rawY;

    moveMemo(String(active.id), { x, y });
  };

  return (
    /**
     * DndContext: provides drag-and-drop context to the subtree.
     * onDragEnd: called when the drag fully ends (pointer up).
     */
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        ref={canvasRef}
        className={styles.canvas}
        style={{ width: canvasWidth, height: canvasHeight }}
        onDoubleClick={handleDoubleClick} // create memo (mouse)
        onTouchEnd={handleTouchEnd}       // create memo (double-tap on touch)
        onClick={handleCanvasClick}       // deselect memo
      >
        {/*
         * Render memos in array order.
         * index + 1 becomes the CSS z-index (+1 to avoid 0).
         * The last element in the array has the highest z-index and appears on top.
         */}
        {memos.map((memo, index) => (
          <Memo key={memo.id} memo={memo} zIndex={index + 1} />
        ))}

        {/* Usage hint — pointer-events: none so it doesn't intercept canvas events */}
        <div className={styles.hint}>
          Double-click / Double-tap<br />to add a memo
        </div>
      </div>
    </DndContext>
  );
}
