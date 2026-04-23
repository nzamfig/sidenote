/**
 * @file localStorage.ts
 * Encapsulates localStorage read/write logic.
 *
 * JSON serialization/deserialization, error handling, and schema migration code
 * all live exclusively in this file. Other files never reference localStorage directly,
 * so switching to IndexedDB or another backend later only requires changing this file.
 */

import type { Memo, PersistedState } from '../types/memo';
import { CURRENT_VERSION } from '../types/memo';
import { STORAGE_KEYS } from '../constants';

/**
 * Upgrades the schema version of persisted data to match the current version.
 *
 * Usage:
 * - When adding a new field to Memo, increment CURRENT_VERSION and add an
 *   `if (state.version === N) { /* conversion logic *\/ }` block here.
 * - This ensures users with old data do not lose it after an app update.
 *
 * @param state - Raw state parsed from localStorage
 * @returns Memo array converted to the current version
 */
function migrate(state: PersistedState): Memo[] {
  // Already on the latest version — return as-is
  if (state.version === CURRENT_VERSION) return state.memos;

  // Example: migration from version 1 → 2
  // if (state.version === 1) {
  //   return state.memos.map(m => ({ ...m, tags: [] })); // add default value for new field
  // }

  return state.memos;
}

/**
 * Loads the saved memo list from localStorage.
 *
 * All failure cases return an empty array:
 * - Key does not exist (first run)
 * - JSON is corrupted
 * - memos field is not an array
 * - localStorage access is blocked (e.g. private mode)
 *
 * @returns Saved Memo array, or empty array on missing data or error.
 */
export function loadMemos(): Memo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEMOS);
    if (!raw) return []; // first run: key not found

    const parsed: PersistedState = JSON.parse(raw);

    // Guard against corrupt data: ignore if memos is not an array
    if (!Array.isArray(parsed.memos)) return [];

    // Convert to the current schema version before returning
    return migrate(parsed);
  } catch {
    // Silently handle all exceptions: JSON parse errors, blocked localStorage access, etc.
    return [];
  }
}

/**
 * Saves the current memo list to localStorage.
 *
 * Format: `{ memos: Memo[], version: number }` (PersistedState)
 * Wrapped in try-catch so save failures do not crash the app.
 * (localStorage.setItem can throw in private mode, when storage is full, etc.)
 *
 * @param memos - Memo array to save
 */
export function saveMemos(memos: Memo[]): void {
  try {
    const state: PersistedState = { memos, version: CURRENT_VERSION };
    localStorage.setItem(STORAGE_KEYS.MEMOS, JSON.stringify(state));
  } catch (e) {
    // QuotaExceededError: base64-encoded images can easily exceed the browser's localStorage
    // limit (typically 2.5–5 MB on mobile). The previous localStorage snapshot is preserved
    // and the unsaved change is silently lost. This is non-fatal; no data corruption occurs.
    if (!(e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'))) {
      // Unexpected error — re-throw so it surfaces in the browser console
      console.warn('[sidenote] localStorage save failed:', e);
    }
  }
}
