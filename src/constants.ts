/**
 * @file constants.ts
 * UI-related constants shared across the app.
 *
 * Consolidates magic numbers that were previously scattered across files.
 * Constants that must stay in sync with CSS values (e.g. CHROME_HEIGHT)
 * require updating both this file and the relevant stylesheet when changed.
 */

/**
 * Memo UI layout constants.
 * Must stay in sync with Memo.module.css and MemoContent.module.css.
 */
export const MEMO_UI = {
  /** Toolbar height + top/bottom padding total (px). Used to compute image max-height. */
  CHROME_HEIGHT: 44,
  /** Content area left + right padding total (px). Used to compute image max-width. */
  CONTENT_PADDING: 16,
  /** Side length of the image resize handle (px). */
  RESIZE_HANDLE_SIZE: 10,
  /** Default height of the map container (px). */
  MAP_HEIGHT: 160,
  /** Width of the image alignment toolbar (px). */
  IMAGE_TOOLBAR_WIDTH: 66,
} as const;

/**
 * Memo size constraint constants.
 * Must stay in sync with useResizable.ts and Memo.module.css min-width/min-height.
 */
export const MEMO_CONSTRAINTS = {
  /** Minimum memo width (px). */
  MIN_WIDTH: 160,
  /** Minimum memo height (px). */
  MIN_HEIGHT: 120,
} as const;
