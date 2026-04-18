/**
 * @file memo.ts
 * 앱 전체에서 사용하는 타입 정의의 단일 진실 소스(Single Source of Truth).
 * 모든 인터페이스·상수는 여기서만 선언하고, 다른 파일은 이 파일을 import해서 사용한다.
 */

/** 메모가 가질 수 있는 색상 목록 (유니온 타입으로 오타 방지) */
export type MemoColor = 'white' | 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

/**
 * 색상 스와치를 렌더링할 때 순서를 보장하기 위한 배열.
 * MemoColor 타입과 항상 동기화해야 한다.
 */
export const MEMO_COLORS: MemoColor[] = ['white', 'yellow', 'pink', 'blue', 'green', 'purple', 'orange'];

/** 새 메모가 생성될 때 적용되는 기본 크기 (픽셀) */
export const DEFAULT_MEMO_SIZE = { width: 200, height: 200 };

/** 새 메모가 생성될 때 적용되는 기본 색상 */
export const DEFAULT_MEMO_COLOR: MemoColor = 'white';

/**
 * 캔버스 내에서 메모의 위치를 나타낸다.
 * x, y 모두 캔버스 좌상단을 원점(0, 0)으로 하는 픽셀 값이다.
 * (뷰포트 기준이 아님에 주의)
 */
export interface MemoPosition {
  x: number; // 캔버스 왼쪽 끝에서의 거리 (px)
  y: number; // 캔버스 위쪽 끝에서의 거리 (px)
}

/**
 * 메모의 너비·높이를 나타낸다.
 * 현재는 고정 크기이지만, 추후 리사이즈 기능 추가 시 이 타입을 그대로 사용한다.
 */
export interface MemoSize {
  width: number;  // 메모 너비 (px)
  height: number; // 메모 높이 (px)
}

/**
 * 메모 하나의 완전한 데이터 구조.
 * 스토어와 localStorage 모두 이 형태로 데이터를 저장한다.
 */
export interface Memo {
  /** crypto.randomUUID()로 생성된 고유 식별자 */
  id: string;

  /** 메모의 본문 텍스트 (현재는 plain text만 지원) */
  content: string;

  /** 캔버스 내 절대 위치 */
  position: MemoPosition;

  /** 메모 박스의 크기 */
  size: MemoSize;

  /** 메모 배경 색상 */
  color: MemoColor;

  /** 메모가 최초 생성된 시각 (Date.now() 기준 ms). 변경되지 않는다. */
  createdAt: number;

  /**
   * 메모가 마지막으로 수정된 시각 (Date.now() 기준 ms).
   * content, color, position 등이 바뀔 때마다 갱신된다.
   * createdAt === updatedAt 이면 "방금 막 생성된 새 메모"로 판단한다.
   */
  updatedAt: number;
}

/**
 * localStorage에 저장되는 최상위 구조.
 * version 필드 덕분에 데이터 스키마가 바뀌어도 안전하게 마이그레이션할 수 있다.
 */
export interface PersistedState {
  memos: Memo[];
  /**
   * 스키마 버전 번호.
   * 새 필드를 추가하거나 기존 필드 구조를 변경할 때 이 값을 올리고
   * localStorage.ts의 migrate() 함수에 변환 로직을 추가한다.
   */
  version: number;
}

/** 현재 앱이 사용하는 스키마 버전. PersistedState.version과 비교해 마이그레이션 여부를 결정한다. */
export const CURRENT_VERSION = 1;
