/**
 * @file ColorPicker.tsx
 * Swatch grid component for selecting a memo color.
 *
 * Pure presentational component — no internal state; all behavior is delegated
 * to the parent via props. The color list comes from MEMO_COLORS in types/memo.ts,
 * keeping the type and UI always in sync.
 */

import type { MemoColor } from '../../types/memo';
import { MEMO_COLORS } from '../../types/memo';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  /** Currently selected color. Applies selection styling (border, size emphasis) to that swatch. */
  currentColor: MemoColor;
  /** Callback called when a swatch is clicked. Receives the clicked color value. */
  onChange: (color: MemoColor) => void;
}

export function ColorPicker({ currentColor, onChange }: ColorPickerProps) {
  return (
    <div className={styles.picker}>
      {MEMO_COLORS.map((color) => (
        <button
          key={color}
          className={styles.swatch}
          /**
           * data-color: used by CSS to set each swatch's background color.
           * (matches selectors like [data-color='yellow'] in ColorPicker.module.css)
           */
          data-color={color}
          /**
           * data-active: applies emphasis styling to the currently selected swatch.
           * The CSS [data-active='true'] selector adjusts border and size.
           */
          data-active={color === currentColor}
          aria-label={color}              // screen reader reads "yellow", "pink", etc.
          aria-pressed={color === currentColor} // conveys toggle state to screen readers
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
