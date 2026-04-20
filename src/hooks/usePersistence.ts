/**
 * @file usePersistence.ts
 * Hook that automatically saves and loads memo data to/from localStorage.
 *
 * Handles two responsibilities:
 * 1. Restores data from localStorage into the store on first mount (hydration)
 * 2. Auto-saves to localStorage whenever the store's memos change (auto-save)
 *
 * Usage: call once in the App component.
 */

import { useEffect } from 'react';
import { useMemoStore } from '../store/useMemoStore';
import { loadMemos, saveMemos } from '../utils/localStorage';

export function usePersistence() {
  // Subscribe to store action (function reference never changes, so no re-render is triggered)
  const hydrateFromStorage = useMemoStore((s) => s.hydrateFromStorage);

  /**
   * [Step 1] Inject localStorage data into the store on app start.
   *
   * - Does nothing if the array is empty (keeps the store's initial value []).
   * - hydrateFromStorage is in the dependency array, but Zustand actions have stable
   *   references so this effect runs only once on mount in practice.
   */
  useEffect(() => {
    const saved = loadMemos();
    if (saved.length > 0) {
      hydrateFromStorage(saved);
    }
  }, [hydrateFromStorage]);

  /**
   * [Step 2] Save to localStorage whenever the store's memos array changes.
   *
   * Why use Zustand's `subscribe` instead of useEffect + selector:
   * - useEffect runs inside the React render cycle, but subscribe fires immediately
   *   on state change, independent of rendering.
   * - This ensures save logic does not affect render performance.
   *
   * Why track prevMemos by reference:
   * - The subscribe(selector, callback) form was removed in Zustand v5.
   * - Only subscribe(listener) is supported, so we track the previous reference directly
   *   to call saveMemos only when memos actually changed.
   * - Zustand follows immutable update patterns, so a changed memos array always gets
   *   a new reference → reference comparison (state.memos !== prevMemos) is sufficient.
   */
  useEffect(() => {
    let prevMemos = useMemoStore.getState().memos;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useMemoStore.subscribe((state) => {
      if (state.memos !== prevMemos) {
        const memosToSave = state.memos;
        prevMemos = memosToSave;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveMemos(memosToSave), 300);
      }
    });

    return () => {
      unsubscribe();
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, []);
}
