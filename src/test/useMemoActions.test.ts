/**
 * @file useMemoActions.test.ts
 * useMemoActions 훅의 updateContent·updateColor·remove 동작을 검증한다.
 * 실제 Zustand 스토어를 사용하며, 각 테스트 전에 스토어를 초기 상태로 리셋한다.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemoStore } from '../store/useMemoStore';
import { useMemoActions } from '../hooks/useMemoActions';

beforeEach(() => {
  useMemoStore.setState({ memos: [], activeMemoId: null });
});

describe('useMemoActions', () => {
  it('updateContent가 해당 메모의 content를 갱신한다', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useMemoActions(id));
    act(() => { result.current.updateContent('<p>안녕</p>'); });

    expect(useMemoStore.getState().memos[0].content).toBe('<p>안녕</p>');
  });

  it('updateColor가 해당 메모의 color를 갱신한다', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useMemoActions(id));
    act(() => { result.current.updateColor('blue'); });

    expect(useMemoStore.getState().memos[0].color).toBe('blue');
  });

  it('remove가 해당 메모를 삭제한다', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useMemoActions(id));
    act(() => { result.current.remove(); });

    expect(useMemoStore.getState().memos).toHaveLength(0);
  });

  it('다른 메모에는 영향을 주지 않는다', () => {
    act(() => {
      useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } });
      useMemoStore.getState().createMemo({ position: { x: 100, y: 100 } });
    });
    const [first, second] = useMemoStore.getState().memos;

    const { result } = renderHook(() => useMemoActions(first.id));
    act(() => { result.current.updateContent('변경됨'); });

    expect(useMemoStore.getState().memos.find((m) => m.id === second.id)?.content).toBe('');
  });

  it('updateContent 후 updatedAt이 갱신된다', () => {
    act(() => { useMemoStore.getState().createMemo({ position: { x: 0, y: 0 } }); });
    const before = useMemoStore.getState().memos[0].updatedAt;
    const id = useMemoStore.getState().memos[0].id;

    const { result } = renderHook(() => useMemoActions(id));
    act(() => { result.current.updateContent('새 내용'); });

    expect(useMemoStore.getState().memos[0].updatedAt).toBeGreaterThanOrEqual(before);
  });
});
