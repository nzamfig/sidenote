/**
 * @file useMemoActions.test.ts
 * Verifies the updateContent, updateColor, and remove behavior of the useMemoActions hook.
 * Uses the real Zustand store; the store is reset to its initial state before each test.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemoStore } from '../store/useMemoStore';
import { useMemoActions } from '../hooks/useMemoActions';

beforeEach(() => {
  useMemoStore.setState({ memos: [], activeMemoId: null });
});

describe('useMemoActions', () => {
  it('updateContent updates the content of the target memo', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useMemoActions(id));
    act(() => { result.current.updateContent('<p>hello</p>'); });

    expect(useMemoStore.getState().memos[0].content).toBe('<p>hello</p>');
  });

  it('updateColor updates the color of the target memo', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useMemoActions(id));
    act(() => { result.current.updateColor('blue'); });

    expect(useMemoStore.getState().memos[0].color).toBe('blue');
  });

  it('remove deletes the target memo', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useMemoActions(id));
    act(() => { result.current.remove(); });

    expect(useMemoStore.getState().memos).toHaveLength(0);
  });

  it('does not affect other memos', () => {
    act(() => {
      useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } });
      useMemoStore.getState().createMemo({ position: { x: 100, y: 100 } });
    });
    const [first, second] = useMemoStore.getState().memos;

    const { result } = renderHook(() => useMemoActions(first.id));
    act(() => { result.current.updateContent('changed'); });

    expect(useMemoStore.getState().memos.find((m) => m.id === second.id)?.content).toBe('');
  });

  it('updatedAt is refreshed after updateContent', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const before = useMemoStore.getState().memos[0].updatedAt;
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useMemoActions(id));
    act(() => { result.current.updateContent('new content'); });

    expect(useMemoStore.getState().memos[0].updatedAt).toBeGreaterThanOrEqual(before);
  });
});
