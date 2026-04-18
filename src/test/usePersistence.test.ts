/**
 * @file usePersistence.test.ts
 * usePersistence 훅의 hydration(복원)과 debounce 저장 동작을 검증한다.
 * vi.useFakeTimers()로 setTimeout을 제어해 300ms 디바운스를 결정론적으로 테스트한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemoStore } from '../store/useMemoStore';
import { usePersistence } from '../hooks/usePersistence';
import type { Memo } from '../types/memo';

const fakeMemo: Memo = {
  id: 'test-1',
  content: '테스트',
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
  it('localStorage가 비어 있으면 스토어를 변경하지 않는다', () => {
    renderHook(() => usePersistence());
    expect(useMemoStore.getState().memos).toHaveLength(0);
  });

  it('마운트 시 localStorage의 메모를 스토어로 복원한다', () => {
    localStorage.setItem('sidenote-v1', JSON.stringify({ memos: [fakeMemo], version: 1 }));
    renderHook(() => usePersistence());
    expect(useMemoStore.getState().memos).toHaveLength(1);
    expect(useMemoStore.getState().memos[0].id).toBe('test-1');
  });

  it('스토어 변경 후 300ms가 지나면 localStorage에 저장한다', () => {
    renderHook(() => usePersistence());

    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });

    // 디바운스 대기 중 — 아직 저장되지 않음
    expect(localStorage.getItem('sidenote-v1')).toBeNull();

    // 300ms 경과 후 저장됨
    act(() => { vi.advanceTimersByTime(300); });

    const raw = localStorage.getItem('sidenote-v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.memos).toHaveLength(1);
  });

  it('300ms 내 연속 변경은 마지막 상태만 저장한다', () => {
    renderHook(() => usePersistence());

    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { useMemoStore.getState().createMemo({ position: { x: 100, y: 100 } }); });
    act(() => { vi.advanceTimersByTime(300); });

    const parsed = JSON.parse(localStorage.getItem('sidenote-v1')!);
    expect(parsed.memos).toHaveLength(2);
  });

  it('언마운트 후 저장 타이머가 취소된다', () => {
    const saveSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { unmount } = renderHook(() => usePersistence());

    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    unmount();

    // 언마운트 후 타이머가 실행되어도 저장되지 않아야 함
    act(() => { vi.advanceTimersByTime(300); });
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
