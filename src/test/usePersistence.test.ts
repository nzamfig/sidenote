/**
 * @file usePersistence.test.ts
 * Verifies the hydration (restore) and debounced save behavior of the usePersistence hook.
 * Uses vi.useFakeTimers() to control setTimeout and test the 300ms debounce deterministically.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemoStore } from '../store/useMemoStore';
import { usePersistence } from '../hooks/usePersistence';
import type { Memo } from '../types/memo';

const fakeMemo: Memo = {
  id: 'test-1',
  content: 'test',
  position: { x: 10, y: 20 },
  size: { width: 200, height: 200 },
  color: 'yellow',
  createdAt: 1000,
  updatedAt: 1000,
};

beforeEach(() => {
  localStorage.clear();
  useMemoStore.setState({ memos: [], activeMemoId: null });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePersistence', () => {
  it('does not modify the store when localStorage is empty', () => {
    renderHook(() => usePersistence());
    expect(useMemoStore.getState().memos).toHaveLength(0);
  });

  it('restores memos from localStorage into the store on mount', () => {
    localStorage.setItem('sidenote-v1', JSON.stringify({ memos: [fakeMemo], version: 1 }));
    renderHook(() => usePersistence());
    expect(useMemoStore.getState().memos).toHaveLength(1);
    expect(useMemoStore.getState().memos[0].id).toBe('test-1');
  });

  it('saves to localStorage after 300ms following a store change', () => {
    renderHook(() => usePersistence());

    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });

    // Still within debounce window — not yet saved
    expect(localStorage.getItem('sidenote-v1')).toBeNull();

    // Saved after 300ms
    act(() => { vi.advanceTimersByTime(300); });

    const raw = localStorage.getItem('sidenote-v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.memos).toHaveLength(1);
  });

  it('saves only the last state when multiple changes occur within 300ms', () => {
    renderHook(() => usePersistence());

    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { useMemoStore.getState().createMemo({ position: { x: 100, y: 100 } }); });
    act(() => { vi.advanceTimersByTime(300); });

    const parsed = JSON.parse(localStorage.getItem('sidenote-v1')!);
    expect(parsed.memos).toHaveLength(2);
  });

  it('cancels the save timer after unmount', () => {
    const saveSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { unmount } = renderHook(() => usePersistence());

    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    unmount();

    // Timer fires after unmount but save should not happen
    act(() => { vi.advanceTimersByTime(300); });
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
