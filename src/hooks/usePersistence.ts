/**
 * @file usePersistence.ts
 * 메모 데이터를 localStorage에 자동으로 저장하고 불러오는 훅.
 *
 * 두 가지 역할을 담당한다:
 * 1. 앱 최초 마운트 시 localStorage → 스토어로 데이터 복원 (hydration)
 * 2. 스토어의 memos가 변경될 때마다 localStorage에 자동 저장 (auto-save)
 *
 * 사용법: App 컴포넌트에서 한 번만 호출한다.
 */

import { useEffect } from 'react';
import { useMemoStore } from '../store/useMemoStore';
import { loadMemos, saveMemos } from '../utils/localStorage';

export function usePersistence() {
  // 스토어 액션을 구독 (함수 참조는 변경되지 않으므로 리렌더를 유발하지 않음)
  const hydrateFromStorage = useMemoStore((s) => s.hydrateFromStorage);

  /**
   * [1단계] 앱 시작 시 localStorage 데이터를 스토어에 주입한다.
   *
   * - 빈 배열이면 아무 것도 하지 않는다 (스토어 초기값 [] 유지).
   * - hydrateFromStorage가 의존성 배열에 있지만, Zustand 액션은 항등 참조이므로
   *   이 effect는 실질적으로 마운트 시 한 번만 실행된다.
   */
  useEffect(() => {
    const saved = loadMemos();
    if (saved.length > 0) {
      hydrateFromStorage(saved);
    }
  }, [hydrateFromStorage]);

  /**
   * [2단계] 스토어의 memos 배열이 바뀔 때마다 localStorage에 저장한다.
   *
   * Zustand의 `subscribe`를 사용하는 이유:
   * - useEffect + useMemoStore 셀렉터를 쓰면 React 렌더 사이클 안에서 실행되지만,
   *   subscribe는 렌더와 무관하게 상태 변경 즉시 실행된다.
   * - 이를 통해 저장 로직이 렌더 성능에 영향을 주지 않는다.
   *
   * prevMemos 참조 비교를 사용하는 이유:
   * - Zustand v5에서는 subscribe(selector, callback) 형태가 제거됐다.
   * - 대신 subscribe(listener) 하나만 지원하므로, memos가 실제로 변경됐을 때만
   *   saveMemos를 호출하도록 이전 참조를 직접 추적한다.
   * - Zustand는 불변 업데이트 패턴을 따르므로 memos 배열이 바뀌면 반드시
   *   새로운 참조가 할당된다 → 참조 비교(state.memos !== prevMemos)로 충분하다.
   */
  useEffect(() => {
    let prevMemos = useMemoStore.getState().memos;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useMemoStore.subscribe((state) => {
      if (state.memos !== prevMemos) {
        const memosToSave = state.memos;
        prevMemos = memosToSave;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveMemos(memosToSave), 300);
      }
    });

    return () => {
      unsubscribe();
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, []);
}
