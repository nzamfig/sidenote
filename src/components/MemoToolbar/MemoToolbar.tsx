/**
 * @file MemoToolbar.tsx
 * Toolbar displayed at the top of a memo.
 *
 * Serves two purposes simultaneously:
 * 1. Drag handle — Memo.tsx wraps this component in a div and applies @dnd-kit's
 *    `listeners` and `attributes`, making the toolbar area the drag start point.
 * 2. Memo settings UI — provides color selection (ColorPicker) and a delete button.
 *
 * This component is purely responsible for rendering; all state changes are
 * delegated to the parent (Memo) via callback props.
 */

import type { MemoColor } from '../../types/memo';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import styles from './MemoToolbar.module.css';

interface MemoToolbarProps {
  /** Current memo color (passed to ColorPicker to highlight the selected color) */
  currentColor: MemoColor;
  /** Callback called when a color is selected. Receives the selected color value. */
  onColorChange: (color: MemoColor) => void;
  /** Callback called when the delete button is clicked. */
  onDelete: () => void;
}

export function MemoToolbar({ currentColor, onColorChange, onDelete }: MemoToolbarProps) {
  return (
    /*
     * cursor: grab is applied via CSS.
     * This entire div acts as the drag handle so users can tell the area is draggable.
     */
    <div className={styles.toolbar}>
      {/* Color swatch list — clicking triggers the onColorChange callback */}
      <ColorPicker currentColor={currentColor} onChange={onColorChange} />

      {/*
       * Delete button.
       * aria-label: label for screen readers (the "✕" text alone is ambiguous)
       * title: tooltip shown on mouse hover
       */}
      <button
        className={styles.deleteBtn}
        onClick={onDelete}
        aria-label="Delete memo"
        title="Delete"
      >
        ✕
      </button>
    </div>
  );
}
