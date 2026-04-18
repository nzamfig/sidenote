import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadMemos, saveMemos } from '../utils/localStorage';
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
  vi.restoreAllMocks();
});

describe('loadMemos', () => {
  it('키가 없으면 빈 배열을 반환한다', () => {
    expect(loadMemos()).toEqual([]);
  });

  it('저장된 메모를 파싱해서 반환한다', () => {
    saveMemos([fakeMemo]);
    const result = loadMemos();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-1');
    expect(result[0].content).toBe('테스트');
  });

  it('JSON이 손상되어 있으면 빈 배열을 반환한다', () => {
    localStorage.setItem('sidenote-v1', '{broken json}');
    expect(loadMemos()).toEqual([]);
  });

  it('memos 필드가 배열이 아니면 빈 배열을 반환한다', () => {
    localStorage.setItem('sidenote-v1', JSON.stringify({ memos: null, version: 1 }));
    expect(loadMemos()).toEqual([]);
  });
});

describe('saveMemos', () => {
  it('메모를 JSON으로 직렬화해서 저장한다', () => {
    saveMemos([fakeMemo]);
    const raw = localStorage.getItem('sidenote-v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.memos).toHaveLength(1);
    expect(parsed.version).toBe(1);
  });

  it('빈 배열도 정상적으로 저장한다', () => {
    saveMemos([]);
    const raw = localStorage.getItem('sidenote-v1');
    const parsed = JSON.parse(raw!);
    expect(parsed.memos).toEqual([]);
  });
});
