import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadMemos, saveMemos } from '../utils/localStorage';
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
  vi.restoreAllMocks();
});

describe('loadMemos', () => {
  it('returns an empty array when the key is missing', () => {
    expect(loadMemos()).toEqual([]);
  });

  it('parses and returns saved memos', () => {
    saveMemos([fakeMemo]);
    const result = loadMemos();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-1');
    expect(result[0].content).toBe('test');
  });

  it('returns an empty array when the JSON is corrupted', () => {
    localStorage.setItem('sidenote-v1', '{broken json}');
    expect(loadMemos()).toEqual([]);
  });

  it('returns an empty array when the memos field is not an array', () => {
    localStorage.setItem('sidenote-v1', JSON.stringify({ memos: null, version: 1 }));
    expect(loadMemos()).toEqual([]);
  });
});

describe('saveMemos', () => {
  it('serializes memos to JSON and saves them', () => {
    saveMemos([fakeMemo]);
    const raw = localStorage.getItem('sidenote-v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.memos).toHaveLength(1);
    expect(parsed.version).toBe(1);
  });

  it('correctly saves an empty array', () => {
    saveMemos([]);
    const raw = localStorage.getItem('sidenote-v1');
    const parsed = JSON.parse(raw!);
    expect(parsed.memos).toEqual([]);
  });
});
