/**
 * @file Memo.tsx
 * Component that renders an individual sticky-note memo.
 *
 * Responsibilities:
 * - Drag behavior: manages drag state (transform, isDragging) via the useDraggable hook.
 * - Position, size, z-index: set as inline style.
 * - Focus/selection: onPointerDownCapture updates activeMemoId and reorders to the top.
 * - Creation timestamp: shown centered in the title area when not hovered, in YYYY-MM-DD HH:MM:SS format.
 * - Child coordination: composes MemoToolbar (color/delete) and MemoContent (text + image + map editing).
 * - Image upload: inserts a local image at the cursor position via the bottom-left button.
 * - Map insert: inserts a Leaflet map at the cursor position via the bottom-left button.
 */

import { useRef, memo as reactMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Memo as MemoType } from '../../types/memo';
import { useMemoActions } from '../../hooks/useMemoActions';
import { useResizable } from '../../hooks/useResizable';
import { useMemoStore } from '../../store/useMemoStore';
import { MemoToolbar } from '../MemoToolbar/MemoToolbar';
import { MemoContent, type MemoContentHandle } from './MemoContent';
import { MEMO_UI } from '../../constants';
import styles from './Memo.module.css';

interface MemoProps {
  /** Memo data to render (the Memo object from the store, passed directly) */
  memo: MemoType;
  /** CSS z-index value. Receives memos array index + 1. */
  zIndex: number;
}

export const Memo = reactMemo(function Memo({ memo, zIndex }: MemoProps) {
  // Update/delete actions scoped to this memo (id fixed)
  const { updateContent, updateColor, remove } = useMemoActions(memo.id);

  // Resize by dragging the bottom-right handle
  const { handlePointerDown: handleResizePointerDown } = useResizable(memo.id, memo.size);

  // Ref to call MemoContent's insertImage method
  const contentRef = useRef<MemoContentHandle>(null);
  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reorderToTop = useMemoStore((s) => s.reorderToTop);
  const setActiveMemo = useMemoStore((s) => s.setActiveMemo);
  const activeMemoId = useMemoStore((s) => s.activeMemoId);
  const resizeMemo = useMemoStore((s) => s.resizeMemo);

  /** Whether this memo is currently selected (active) → reflected via CSS data-active attribute */
  const isActive = activeMemoId === memo.id;

  /**
   * @dnd-kit useDraggable hook.
   *
   * - `attributes`: aria-* accessibility attributes (spread onto the drag handle element)
   * - `listeners`: drag start events like onPointerDown (spread onto the drag handle element)
   * - `setNodeRef`: ref callback to register the draggable DOM element with @dnd-kit
   * - `transform`: movement delta during drag. Becomes null when drag ends.
   *   Has the shape { x: dx, y: dy, scaleX: 1, scaleY: 1 }; converted to
   *   `translate(dx px, dy px)` string via CSS.Translate.toString() for CSS transform.
   * - `isDragging`: whether this memo is currently being dragged
   */
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: memo.id,
  });

  /**
   * Inline style for the memo.
   *
   * position: 'absolute' + left/top sets the absolute position within the canvas.
   * (Using left/top rather than CSS transform because the stored coordinates are
   * canvas-origin-based. transform is used on top of that only for the visual drag offset.)
   *
   * transform: during drag, @dnd-kit's delta is expressed as a CSS transform.
   * GPU-handled transforms make drag animations smooth.
   * CSS.Translate.toString(null) returns an empty string so it is harmless when not dragging.
   *
   * zIndex: raised to 9999 while dragging so the memo always appears above others.
   */
  const style: React.CSSProperties = {
    position: 'absolute',
    left: memo.position.x,
    top: memo.position.y,
    width: memo.size.width,
    height: memo.size.height,
    zIndex: isDragging ? 9999 : zIndex,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.85 : 1, // semi-transparent while dragging for a "lifted" effect
  };

  /**
   * Runs when the memo is clicked (pointer pressed).
   * - reorderToTop: moves the clicked memo to the end of the array, giving it the highest z-index.
   * - setActiveMemo: marks this memo as selected.
   *
   * Why onPointerDownCapture (capture phase):
   * The editor div inside MemoContent calls e.stopPropagation() on its own onPointerDown
   * to support text editing. During the bubble phase (onPointerDown), that stops propagation
   * and reorderToTop would not fire when clicking the text area.
   * The capture phase runs before stopPropagation, so this handler is always guaranteed to run.
   */
  const handlePointerDown = () => {
    reorderToTop(memo.id);
    setActiveMemo(memo.id);
  };

  const handleAutoResize = (scrollHeight: number) => {
    const neededHeight = scrollHeight + MEMO_UI.CHROME_HEIGHT;
    if (neededHeight > memo.size.height) {
      resizeMemo(memo.id, { width: memo.size.width, height: neededHeight });
    }
  };

  /**
   * Determines whether this is a "newly created" memo.
   * A memo is considered new if createdAt === updatedAt and content is empty.
   * Passes autoFocus to MemoContent so the user can start typing immediately after creation.
   */
  const isNew = memo.createdAt === memo.updatedAt && memo.content === '';

  /** Upload button click → open file dialog */
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Handles file selection.
   * - Reads the file as a base64 DataURL via FileReader, then calls MemoContent.insertImage.
   * - Max image size is constrained to the content area (memo size minus chrome area).
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const maxWidth = memo.size.width - MEMO_UI.CONTENT_PADDING;
      const maxHeight = memo.size.height - MEMO_UI.CHROME_HEIGHT;
      contentRef.current?.insertImage(src, maxWidth, maxHeight);
    };
    reader.readAsDataURL(file);

    // Reset value so the same file can be uploaded again consecutively
    e.target.value = '';
  };

  /**
   * Formats the creation timestamp as YYYY-MM-DD HH:MM:SS.
   * Written as an IIFE to compute the value once rather than creating a new Date on every render.
   * (memo.createdAt never changes, so the result is always the same as long as memo is stable)
   */
  const formattedDate = (() => {
    const d = new Date(memo.createdAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  })();

  return (
    <div
      ref={setNodeRef}         // register this DOM element as the @dnd-kit drag target
      style={style}
      className={styles.memo}
      data-color={memo.color}  // used by CSS to apply per-color backgrounds
      data-memo-id={memo.id}   // used by useCanvasInteraction to detect "double-click on memo"
      data-active={isActive}   // used by CSS to apply shadow emphasis for the selected memo
      onPointerDownCapture={handlePointerDown}
    >
      {/*
       * titleArea: container that groups dragHandle (toolbar) and createdAt (date) as siblings.
       *
       * Why sibling structure — CSS opacity inheritance problem:
       * CSS opacity multiplies from parent to child and cannot be reset to 1 in a child.
       * If createdAt were inside dragHandle, it would be invisible when dragHandle opacity is 0.
       * Solution: make createdAt a sibling of dragHandle and position it absolutely over the same area.
       * This gives the two elements independent opacity values for cross-fading.
       * (not hovered: dragHandle hidden + createdAt visible / hovered: dragHandle visible + createdAt hidden)
       *
       * listeners and attributes are applied only to dragHandle so only the toolbar area acts as the
       * drag handle; MemoContent is left untouched so text selection and cursor movement work normally.
       */}
      <div className={styles.titleArea}>
        <div {...listeners} {...attributes} className={styles.dragHandle}>
          <MemoToolbar
            currentColor={memo.color}
            onColorChange={updateColor}
            onDelete={remove}
          />
        </div>
        <span className={styles.createdAt}>{formattedDate}</span>
      </div>

      <MemoContent
        ref={contentRef}
        content={memo.content}
        autoFocus={isNew}
        onChange={updateContent}
        onAutoResize={handleAutoResize}
      />

      {/* Bottom action button bar (visible only on hover) */}
      <div className={styles.actionBar}>
        {/* Image upload button */}
        <button
          className={styles.actionBtn}
          title="Add image"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleUploadClick}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>

        {/* Map insert button */}
        <button
          className={styles.actionBtn}
          title="Add map"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => contentRef.current?.insertMap()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
            <line x1="9" y1="3" x2="9" y2="18"/>
            <line x1="15" y1="6" x2="15" y2="21"/>
          </svg>
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Bottom-right resize handle */}
      <div
        className={styles.resizeHandle}
        onPointerDown={handleResizePointerDown}
      />
    </div>
  );
});
