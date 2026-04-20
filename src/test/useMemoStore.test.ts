import { describe, it, expect, beforeEach } from 'vitest';
import { useMemoStore } from '../store/useMemoStore';

// Reset store before each test
beforeEach(() => {
  useMemoStore.setState({ memos: [], activeMemoId: null });
});

describe('createMemo', () => {
  it('creates a memo with the correct position and default values', () => {
    const { createMemo } = useMemoStore.getState();
    createMemo({ position: { x: 100, y: 200 } });

    const { memos } = useMemoStore.getState();
    expect(memos).toHaveLength(1);
    expect(memos[0].position).toEqual({ x: 100, y: 200 });
    expect(memos[0].color).toBe('white');
    expect(memos[0].content).toBe('');
    expect(memos[0].id).toBeTruthy();
  });

  it('creates a memo with the specified color', () => {
    const { createMemo } = useMemoStore.getState();
    createMemo({ position: { x: 0, y: 0 }, color: 'pink' });

    const { memos } = useMemoStore.getState();
    expect(memos[0].color).toBe('pink');
  });

  it('sets the created memo as activeMemoId', () => {
    const { createMemo } = useMemoStore.getState();
    createMemo({ position: { x: 0, y: 0 } });

    const { memos, activeMemoId } = useMemoStore.getState();
    expect(activeMemoId).toBe(memos[0].id);
  });
});

describe('deleteMemo', () => {
  it('deletes a memo by id', () => {
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

  it('does not affect other memos when deleting', () => {
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
  it('updates position without changing other fields', () => {
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
  it('moves a memo to the end of the array', () => {
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

  it('does not change a memo that is already last', () => {
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
  it('replaces the entire memos array', () => {
    const { createMemo, hydrateFromStorage } = useMemoStore.getState();
    createMemo({ position: { x: 0, y: 0 } });

    const fakeMemos = [
      {
        id: 'test-1',
        content: 'saved memo',
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
    expect(memos[0].content).toBe('saved memo');
  });
});
