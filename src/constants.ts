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

/**
 * Interaction timing thresholds.
 */
export const INTERACTION_TIMING = {
  /** Max milliseconds between two taps to count as a double-tap. */
  DOUBLE_TAP_MAX_MS: 300,
  /** Max pixel distance between two taps to count as a double-tap. */
  DOUBLE_TAP_MAX_DIST: 30,
  /** Debounce delay (ms) before writing memos to localStorage. */
  SAVE_DEBOUNCE_MS: 300,
} as const;

/**
 * Default map center and tile configuration (CartoDB Positron greyscale).
 */
export const MAP_DEFAULTS = {
  LAT: 37.5665,
  LNG: 126.9780,
  ZOOM: 11,
  TILE_URL: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  TILE_ATTRIBUTION:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' +
    ' &copy; <a href="https://carto.com/attributions">CARTO</a>',
  TILE_SUBDOMAINS: 'abcd',
  TILE_MAX_ZOOM: 20,
} as const;

/** Extra canvas space added when a memo is dragged beyond the current boundary (px). */
export const CANVAS_UI = {
  EXPAND_PADDING: 40,
} as const;

/** localStorage keys used across the app. */
export const STORAGE_KEYS = {
  MEMOS: 'sidenote-v1',
  CANVAS_SIZE: 'canvas-size',
} as const;
