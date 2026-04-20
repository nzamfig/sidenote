/**
 * @file useResizable.test.ts
 * Verifies the pointer drag resize behavior of the useResizable hook.
 * jsdom does not support setPointerCapture, so it is mocked with vi.fn().
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
  it('updates memo size on pointermove', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useResizable(id, DEFAULT_MEMO_SIZE));

    act(() => { simulatePointerDown(result.current.handlePointerDown, 100, 100); });
    act(() => { document.dispatchEvent(makePointerEvent(150, 160)); });

    const { size } = useMemoStore.getState().memos[0];
    expect(size.width).toBe(DEFAULT_MEMO_SIZE.width + 50);
    expect(size.height).toBe(DEFAULT_MEMO_SIZE.height + 60);
  });

  it('does not shrink below the minimum size', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useResizable(id, DEFAULT_MEMO_SIZE));

    act(() => { simulatePointerDown(result.current.handlePointerDown, 300, 300); });
    act(() => { document.dispatchEvent(makePointerEvent(0, 0)); }); // try to shrink a lot

    const { size } = useMemoStore.getState().memos[0];
    expect(size.width).toBe(MEMO_CONSTRAINTS.MIN_WIDTH);
    expect(size.height).toBe(MEMO_CONSTRAINTS.MIN_HEIGHT);
  });

  it('removes the pointermove listener after pointerup', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useResizable(id, DEFAULT_MEMO_SIZE));

    act(() => { simulatePointerDown(result.current.handlePointerDown, 100, 100); });
    act(() => { document.dispatchEvent(new PointerEvent('pointerup')); });
    act(() => { document.dispatchEvent(makePointerEvent(200, 200)); }); // move after pointerup

    // Size should not change after pointerup
    const { size } = useMemoStore.getState().memos[0];
    expect(size.width).toBe(DEFAULT_MEMO_SIZE.width);
    expect(size.height).toBe(DEFAULT_MEMO_SIZE.height);
  });
});
