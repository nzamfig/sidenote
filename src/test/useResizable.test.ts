/**
 * @file useResizable.test.ts
 * useResizable 훅의 포인터 드래그 리사이즈 동작을 검증한다.
 * jsdom은 setPointerCapture를 지원하지 않으므로 vi.fn()으로 모킹한다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type React from 'react';
import { useMemoStore } from '../store/useMemoStore';
import { useResizable } from '../hooks/useResizable';
import { DEFAULT_MEMO_SIZE } from '../types/memo';
import { MEMO_CONSTRAINTS } from '../constants';

beforeEach(() => {
  useMemoStore.setState({ memos: [], activeMemoId: null });
});

function makePointerEvent(clientX: number, clientY: number): PointerEvent {
  return new PointerEvent('pointermove', { clientX, clientY, bubbles: true });
}

function simulatePointerDown(handlePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void, clientX: number, clientY: number) {
  const div = document.createElement('div');
  div.setPointerCapture = vi.fn();
  handlePointerDown({
    clientX,
    clientY,
    currentTarget: div,
    pointerId: 1,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  } as unknown as React.PointerEvent<HTMLDivElement>);
}

describe('useResizable', () => {
  it('pointermove 이벤트로 메모 크기를 갱신한다', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useResizable(id, DEFAULT_MEMO_SIZE));

    act(() => { simulatePointerDown(result.current.handlePointerDown, 100, 100); });
    act(() => { document.dispatchEvent(makePointerEvent(150, 160)); });

    const { size } = useMemoStore.getState().memos[0];
    expect(size.width).toBe(DEFAULT_MEMO_SIZE.width + 50);
    expect(size.height).toBe(DEFAULT_MEMO_SIZE.height + 60);
  });

  it('최소 크기 이하로 줄어들지 않는다', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useResizable(id, DEFAULT_MEMO_SIZE));

    act(() => { simulatePointerDown(result.current.handlePointerDown, 300, 300); });
    act(() => { document.dispatchEvent(makePointerEvent(0, 0)); }); // 크게 줄이기

    const { size } = useMemoStore.getState().memos[0];
    expect(size.width).toBe(MEMO_CONSTRAINTS.MIN_WIDTH);
    expect(size.height).toBe(MEMO_CONSTRAINTS.MIN_HEIGHT);
  });

  it('pointerup 이벤트 후 pointermove 리스너가 제거된다', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useResizable(id, DEFAULT_MEMO_SIZE));

    act(() => { simulatePointerDown(result.current.handlePointerDown, 100, 100); });
    act(() => { document.dispatchEvent(new PointerEvent('pointerup')); });
    act(() => { document.dispatchEvent(makePointerEvent(200, 200)); }); // pointerup 후 이동

    // pointerup 이후에는 크기가 변경되지 않아야 함
    const { size } = useMemoStore.getState().memos[0];
    expect(size.width).toBe(DEFAULT_MEMO_SIZE.width);
    expect(size.height).toBe(DEFAULT_MEMO_SIZE.height);
  });
});
