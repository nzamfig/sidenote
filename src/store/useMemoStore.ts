/**
 * @file useMemoStore.ts
 * 앱의 모든 상태(state)와 상태 변경 함수(action)를 관리하는 Zustand 스토어.
 *
 * 설계 원칙:
 * - 컴포넌트는 스토어를 직접 변경하지 않고, 반드시 이 파일의 action을 통해 변경한다.
 * - 파생 상태(derived state)는 스토어에 저장하지 않고 컴포넌트에서 계산한다.
 * - z-index는 숫자 값 대신 memos 배열의 순서로 표현한다 (마지막 원소 = 최상위).
 */

import { create } from 'zustand';
import type { Memo, MemoColor, MemoPosition, MemoSize } from '../types/memo';
import { DEFAULT_MEMO_COLOR, DEFAULT_MEMO_SIZE } from '../types/memo';
import { generateId } from '../utils/generateId';

/** createMemo 액션에 전달하는 인자 타입 */
interface CreateMemoPayload {
  /** 새 메모가 배치될 캔버스 내 좌표 */
  position: MemoPosition;
  /** 생략하면 DEFAULT_MEMO_COLOR가 사용됨 */
  color?: MemoColor;
}

/**
 * 스토어의 전체 형태(shape).
 * 상태(state)와 액션(action)을 하나의 인터페이스로 정의한다.
 */
interface MemoState {
  // ─── 상태 ───────────────────────────────────────────────────────────

  /** 모든 메모의 배열. 배열 순서 = z-index 순서 (마지막 원소가 가장 위에 표시됨) */
  memos: Memo[];

  /**
   * 현재 선택(활성화)된 메모의 id.
   * 하나의 메모만 동시에 활성화될 수 있으므로 전역 단일 값으로 관리한다.
   * null이면 선택된 메모 없음.
   */
  activeMemoId: string | null;

  // ─── 액션 ───────────────────────────────────────────────────────────

  /** 새 메모를 생성하고 memos 배열 맨 끝에 추가한다. 생성 직후 activeMemoId가 새 메모로 설정된다. */
  createMemo: (payload: CreateMemoPayload) => void;

  /**
   * 특정 메모의 필드를 부분 업데이트한다.
   * id와 createdAt은 불변이므로 변경 불가.
   * 호출 시 updatedAt이 자동으로 현재 시각으로 갱신된다.
   */
  updateMemo: (id: string, changes: Partial<Omit<Memo, 'id' | 'createdAt'>>) => void;

  /** 특정 메모를 삭제한다. 삭제된 메모가 활성화 상태였다면 activeMemoId를 null로 초기화한다. */
  deleteMemo: (id: string) => void;

  /**
   * 메모의 위치만 업데이트하는 전용 액션.
   * updateMemo로 대체할 수 있지만, 드래그 종료 시점에만 호출되므로 분리 유지.
   * (향후 드래그 중 실시간 위치 업데이트가 필요해질 경우를 대비한 확장 지점)
   */
  moveMemo: (id: string, position: MemoPosition) => void;

  /** 메모의 크기를 업데이트한다. 현재는 고정 크기이지만 리사이즈 기능 추가 시 사용한다. */
  resizeMemo: (id: string, size: MemoSize) => void;

  /** activeMemoId를 변경한다. null을 전달하면 선택을 해제한다. */
  setActiveMemo: (id: string | null) => void;

  /**
   * 특정 메모를 memos 배열의 맨 끝으로 이동시킨다.
   * CSS z-index를 숫자로 관리하면 메모가 많아질수록 renumbering이 필요하지만,
   * 배열 순서로 z-index를 표현하면 splice 한 번으로 해결된다.
   * 이미 맨 끝이거나 id가 없으면 아무 것도 하지 않는다.
   */
  reorderToTop: (id: string) => void;

  /**
   * localStorage에서 불러온 메모 배열로 스토어를 초기화한다.
   * 앱 최초 마운트 시 usePersistence 훅이 한 번만 호출한다.
   * 기존 memos를 완전히 교체하므로 앱 실행 중에는 호출하면 안 된다.
   */
  hydrateFromStorage: (memos: Memo[]) => void;
}

/**
 * Zustand 스토어 인스턴스.
 * 컴포넌트에서 `useMemoStore(selector)` 형태로 필요한 상태/액션만 구독한다.
 * React 렌더 사이클 바깥에서는 `useMemoStore.getState()` / `useMemoStore.subscribe()`로 접근한다.
 */
export const useMemoStore = create<MemoState>((set) => ({
  // ─── 초기 상태 ───────────────────────────────────────────────────────
  memos: [],
  activeMemoId: null,

  // ─── 액션 구현 ───────────────────────────────────────────────────────

  createMemo: ({ position, color = DEFAULT_MEMO_COLOR }) => {
    const now = Date.now();
    const memo: Memo = {
      id: generateId(),
      content: '',
      position,
      size: { ...DEFAULT_MEMO_SIZE }, // 참조 공유를 피하기 위해 spread
      color,
      createdAt: now,
      updatedAt: now, // 생성 시 createdAt === updatedAt → "새 메모" 판별에 사용
    };
    // 새 메모를 배열 맨 끝에 추가 → 자동으로 최상위 z-index
    set((state) => ({ memos: [...state.memos, memo], activeMemoId: memo.id }));
  },

  updateMemo: (id, changes) => {
    set((state) => ({
      memos: state.memos.map((m) =>
        // id가 일치하는 메모만 변경, 나머지는 그대로 반환
        m.id === id ? { ...m, ...changes, updatedAt: Date.now() } : m
      ),
    }));
  },

  deleteMemo: (id) => {
    set((state) => ({
      memos: state.memos.filter((m) => m.id !== id),
      // 삭제된 메모가 활성 상태였으면 선택 해제
      activeMemoId: state.activeMemoId === id ? null : state.activeMemoId,
    }));
  },

  moveMemo: (id, position) => {
    set((state) => ({
      memos: state.memos.map((m) =>
        m.id === id ? { ...m, position, updatedAt: Date.now() } : m
      ),
    }));
  },

  resizeMemo: (id, size) => {
    set((state) => ({
      memos: state.memos.map((m) =>
        m.id === id ? { ...m, size, updatedAt: Date.now() } : m
      ),
    }));
  },

  setActiveMemo: (id) => set({ activeMemoId: id }),

  reorderToTop: (id) => {
    set((state) => {
      const idx = state.memos.findIndex((m) => m.id === id);
      // 이미 맨 끝이거나 id가 없으면 상태 변경 없이 그대로 반환 (불필요한 리렌더 방지)
      if (idx === -1 || idx === state.memos.length - 1) return state;

      const memos = [...state.memos];
      // splice(idx, 1)[0]: idx 위치의 원소를 꺼내고, push로 맨 뒤에 삽입
      memos.push(memos.splice(idx, 1)[0]);
      return { memos };
    });
  },

  hydrateFromStorage: (memos) => set({ memos }),
}));
