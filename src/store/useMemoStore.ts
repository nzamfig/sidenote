/**
 * @file useMemoStore.ts
 * Zustand store managing all app state and state-mutation actions.
 *
 * Design principles:
 * - Components never mutate the store directly; all changes go through the actions defined here.
 * - Derived state is not stored; it is computed in components.
 * - z-index is represented by the order of the memos array, not a numeric value (last element = topmost).
 */

import { create } from 'zustand';
import type { Memo, MemoColor, MemoPosition, MemoSize } from '../types/memo';
import { DEFAULT_MEMO_COLOR, DEFAULT_MEMO_SIZE } from '../types/memo';
import { generateId } from '../utils/generateId';

/** Argument type passed to the createMemo action */
interface CreateMemoPayload {
  /** Canvas coordinates where the new memo will be placed */
  position: MemoPosition;
  /** Defaults to DEFAULT_MEMO_COLOR if omitted */
  color?: MemoColor;
}

/**
 * Full shape of the store.
 * State and actions are defined together in a single interface.
 */
interface MemoState {
  // ─── State ──────────────────────────────────────────────────────────

  /** Array of all memos. Array order = z-index order (last element is displayed on top) */
  memos: Memo[];

  /**
   * The id of the currently selected (active) memo.
   * Only one memo can be active at a time, so this is a single global value.
   * null means no memo is selected.
   */
  activeMemoId: string | null;

  // ─── Actions ────────────────────────────────────────────────────────

  /** Creates a new memo and appends it to the end of the memos array. Sets activeMemoId to the new memo immediately. */
  createMemo: (payload: CreateMemoPayload) => void;

  /**
   * Partially updates fields of a specific memo.
   * id and createdAt are immutable and cannot be changed.
   * updatedAt is automatically set to the current time on each call.
   */
  updateMemo: (id: string, changes: Partial<Omit<Memo, 'id' | 'createdAt'>>) => void;

  /** Deletes a specific memo. If the deleted memo was active, activeMemoId is reset to null. */
  deleteMemo: (id: string) => void;

  /**
   * Dedicated action to update only the position of a memo.
   * Could be replaced by updateMemo, but kept separate since it is only called on drag end.
   * (Extension point in case real-time position updates during drag are needed later)
   */
  moveMemo: (id: string, position: MemoPosition) => void;

  /** Updates the size of a memo. Currently fixed size; used when resize support is added. */
  resizeMemo: (id: string, size: MemoSize) => void;

  /** Changes activeMemoId. Passing null deselects the current memo. */
  setActiveMemo: (id: string | null) => void;

  /**
   * Moves a specific memo to the end of the memos array.
   * Managing z-index as numeric values requires renumbering as memos grow,
   * but expressing z-index via array order only requires a single splice.
   * Does nothing if the memo is already last or the id is not found.
   */
  reorderToTop: (id: string) => void;

  /**
   * Initializes the store with a memo array loaded from localStorage.
   * Called once by the usePersistence hook on first mount.
   * Completely replaces existing memos, so it must not be called during normal app use.
   */
  hydrateFromStorage: (memos: Memo[]) => void;
}

/** Returns a new memos array with the given id's fields merged and updatedAt refreshed. */
function patchMemo(memos: Memo[], id: string, patch: Partial<Memo>): Memo[] {
  return memos.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m));
}

/**
 * Zustand store instance.
 * Components subscribe to only the state/actions they need via `useMemoStore(selector)`.
 * Outside the React render cycle, use `useMemoStore.getState()` / `useMemoStore.subscribe()`.
 */
export const useMemoStore = create<MemoState>((set) => ({
  // ─── Initial state ───────────────────────────────────────────────────
  memos: [],
  activeMemoId: null,

  // ─── Action implementations ──────────────────────────────────────────

  createMemo: ({ position, color = DEFAULT_MEMO_COLOR }) => {
    const now = Date.now();
    const memo: Memo = {
      id: generateId(),
      content: '',
      position,
      size: { ...DEFAULT_MEMO_SIZE }, // spread to avoid shared reference
      color,
      createdAt: now,
      updatedAt: now, // createdAt === updatedAt on creation → used to identify "new memo"
    };
    // Append to end of array → automatically gets the highest z-index
    set((state) => ({ memos: [...state.memos, memo], activeMemoId: memo.id }));
  },

  updateMemo: (id, changes) => {
    set((state) => ({ memos: patchMemo(state.memos, id, changes) }));
  },

  deleteMemo: (id) => {
    set((state) => ({
      memos: state.memos.filter((m) => m.id !== id),
      // Deselect if the deleted memo was active
      activeMemoId: state.activeMemoId === id ? null : state.activeMemoId,
    }));
  },

  moveMemo: (id, position) => {
    set((state) => ({ memos: patchMemo(state.memos, id, { position }) }));
  },

  resizeMemo: (id, size) => {
    set((state) => ({ memos: patchMemo(state.memos, id, { size }) }));
  },

  setActiveMemo: (id) => set({ activeMemoId: id }),

  reorderToTop: (id) => {
    set((state) => {
      const idx = state.memos.findIndex((m) => m.id === id);
      // Already last or not found — return state unchanged to avoid unnecessary re-render
      if (idx === -1 || idx === state.memos.length - 1) return state;

      const memos = [...state.memos];
      // splice(idx, 1)[0]: remove element at idx, then push it to the end
      memos.push(memos.splice(idx, 1)[0]);
      return { memos };
    });
  },

  hydrateFromStorage: (memos) => set({ memos }),
}));
