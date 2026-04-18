/**
 * @file localStorage.ts
 * localStorage 읽기·쓰기 로직을 캡슐화한다.
 *
 * 이 파일에만 JSON 직렬화/역직렬화, 예외 처리, 스키마 마이그레이션 코드가 존재한다.
 * 다른 파일에서 localStorage를 직접 참조하지 않음으로써 나중에 IndexedDB 등으로
 * 교체할 때 이 파일만 수정하면 된다.
 */

import type { Memo, PersistedState } from '../types/memo';
import { CURRENT_VERSION } from '../types/memo';

/**
 * localStorage에서 사용하는 키.
 * 키 이름에 버전을 포함시켜, 스키마가 크게 바뀔 경우 다른 키를 사용해
 * 기존 데이터와 충돌 없이 새 앱을 시작할 수 있다.
 */
const STORAGE_KEY = 'sidenote-v1';

/**
 * 저장된 데이터의 스키마 버전을 현재 버전과 맞춰주는 함수.
 *
 * 사용 방법:
 * - 새 필드를 Memo에 추가하면 CURRENT_VERSION을 올리고
 *   이 함수에 `if (state.version === N) { /* 변환 로직 *\/ }` 블록을 추가한다.
 * - 이렇게 하면 구형 데이터를 가진 사용자도 앱 업데이트 후 데이터를 잃지 않는다.
 *
 * @param state - localStorage에서 파싱한 원본 상태
 * @returns 현재 버전에 맞게 변환된 Memo 배열
 */
function migrate(state: PersistedState): Memo[] {
  // 이미 최신 버전이면 변환 없이 그대로 반환
  if (state.version === CURRENT_VERSION) return state.memos;

  // 예시: 버전 1 → 2 마이그레이션이 필요한 경우
  // if (state.version === 1) {
  //   return state.memos.map(m => ({ ...m, tags: [] })); // 새 필드 기본값 추가
  // }

  return state.memos;
}

/**
 * localStorage에서 저장된 메모 목록을 불러온다.
 *
 * 실패 경우를 모두 빈 배열로 처리한다:
 * - 키가 존재하지 않는 경우 (최초 실행)
 * - JSON이 손상된 경우
 * - memos 필드가 배열이 아닌 경우
 * - localStorage 접근이 차단된 경우 (시크릿 모드 등)
 *
 * @returns 저장된 Memo 배열. 데이터가 없거나 오류 시 빈 배열.
 */
export function loadMemos(): Memo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return []; // 최초 실행: 키 없음

    const parsed: PersistedState = JSON.parse(raw);

    // 데이터 손상 방어: memos가 배열이 아니면 무시
    if (!Array.isArray(parsed.memos)) return [];

    // 스키마 버전에 맞게 변환 후 반환
    return migrate(parsed);
  } catch {
    // JSON 파싱 오류, localStorage 접근 차단 등 모든 예외를 조용히 처리
    return [];
  }
}

/**
 * 현재 메모 목록을 localStorage에 저장한다.
 *
 * 저장 형식: `{ memos: Memo[], version: number }` (PersistedState)
 * try-catch로 감싸 저장 실패 시에도 앱이 멈추지 않도록 한다.
 * (시크릿 모드, 용량 초과 등의 상황에서 localStorage.setItem이 예외를 던질 수 있다)
 *
 * @param memos - 저장할 메모 배열
 */
export function saveMemos(memos: Memo[]): void {
  try {
    const state: PersistedState = { memos, version: CURRENT_VERSION };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패는 치명적 오류가 아니므로 무시 (앱은 계속 동작)
  }
}
