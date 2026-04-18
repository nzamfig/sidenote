import { describe, it, expect, beforeEach } from 'vitest';
import { useMemoStore } from '../store/useMemoStore';

// 각 테스트 전 스토어 초기화
beforeEach(() => {
  useMemoStore.setState({ memos: [], activeMemoId: null });
});

describe('createMemo', () => {
  it('올바른 위치와 기본값으로 메모를 생성한다', () => {
    const { createMemo } = useMemoStore.getState();
    createMemo({ position: { x: 100, y: 200 } });

    const { memos } = useMemoStore.getState();
    expect(memos).toHaveLength(1);
    expect(memos[0].position).toEqual({ x: 100, y: 200 });
    expect(memos[0].color).toBe('white');
    expect(memos[0].content).toBe('');
    expect(memos[0].id).toBeTruthy();
  });

  it('지정된 색상으로 메모를 생성한다', () => {
    const { createMemo } = useMemoStore.getState();
    createMemo({ position: { x: 0, y: 0 }, color: 'pink' });

    const { memos } = useMemoStore.getState();
    expect(memos[0].color).toBe('pink');
  });

  it('생성된 메모가 activeMemoId로 설정된다', () => {
    const { createMemo } = useMemoStore.getState();
    createMemo({ position: { x: 0, y: 0 } });

    const { memos, activeMemoId } = useMemoStore.getState();
    expect(activeMemoId).toBe(memos[0].id);
  });
});

describe('deleteMemo', () => {
  it('id로 메모를 삭제한다', () => {
    const { createMemo, deleteMemo } = useMemoStore.getState();
    createMemo({ position: { x: 0, y: 0 } });
    createMemo({ position: { x: 100, y: 100 } });

    const { memos } = useMemoStore.getState();
    const firstId = memos[0].id;
    deleteMemo(firstId);

    const updated = useMemoStore.getState().memos;
    expect(updated).toHaveLength(1);
    expect(updated.find((m) => m.id === firstId)).toBeUndefined();
  });

  it('삭제 시 다른 메모에 영향을 주지 않는다', () => {
    const { createMemo, deleteMemo } = useMemoStore.getState();
    createMemo({ position: { x: 0, y: 0 } });
    createMemo({ position: { x: 100, y: 100 } });

    const { memos } = useMemoStore.getState();
    const [first, second] = memos;
    deleteMemo(first.id);

    const updated = useMemoStore.getState().memos;
    expect(updated[0].id).toBe(second.id);
  });
});

describe('moveMemo', () => {
  it('위치를 업데이트하고 다른 필드는 변경하지 않는다', () => {
    const { createMemo, moveMemo } = useMemoStore.getState();
    createMemo({ position: { x: 0, y: 0 } });

    const { memos } = useMemoStore.getState();
    const memo = memos[0];
    moveMemo(memo.id, { x: 300, y: 400 });

    const updated = useMemoStore.getState().memos[0];
    expect(updated.position).toEqual({ x: 300, y: 400 });
    expect(updated.content).toBe(memo.content);
    expect(updated.color).toBe(memo.color);
  });
});

describe('reorderToTop', () => {
  it('메모를 배열 마지막으로 이동한다', () => {
    const { createMemo, reorderToTop } = useMemoStore.getState();
    createMemo({ position: { x: 0, y: 0 } });
    createMemo({ position: { x: 100, y: 100 } });
    createMemo({ position: { x: 200, y: 200 } });

    const { memos } = useMemoStore.getState();
    const firstId = memos[0].id;
    reorderToTop(firstId);

    const updated = useMemoStore.getState().memos;
    expect(updated[updated.length - 1].id).toBe(firstId);
  });

  it('이미 마지막인 메모는 변경하지 않는다', () => {
    const { createMemo, reorderToTop } = useMemoStore.getState();
    createMemo({ position: { x: 0, y: 0 } });
    createMemo({ position: { x: 100, y: 100 } });

    const before = useMemoStore.getState().memos;
    const lastId = before[before.length - 1].id;
    reorderToTop(lastId);

    const after = useMemoStore.getState().memos;
    expect(after.map((m) => m.id)).toEqual(before.map((m) => m.id));
  });
});

describe('hydrateFromStorage', () => {
  it('메모 배열을 통째로 교체한다', () => {
    const { createMemo, hydrateFromStorage } = useMemoStore.getState();
    createMemo({ position: { x: 0, y: 0 } });

    const fakeMemos = [
      {
        id: 'test-1',
        content: '저장된 메모',
        position: { x: 50, y: 50 },
        size: { width: 200, height: 200 },
        color: 'blue' as const,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    hydrateFromStorage(fakeMemos);
    const { memos } = useMemoStore.getState();
    expect(memos).toHaveLength(1);
    expect(memos[0].id).toBe('test-1');
    expect(memos[0].content).toBe('저장된 메모');
  });
});
