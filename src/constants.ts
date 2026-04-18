/**
 * @file constants.ts
 * 앱 전체에서 사용하는 UI 관련 상수 모음.
 *
 * 기존에 각 파일에 분산되어 있던 매직 넘버를 한 곳으로 통합한다.
 * CSS 값과 동기화가 필요한 상수(CHROME_HEIGHT 등)는 스타일을 변경할 때
 * 반드시 이 파일도 함께 수정해야 한다.
 */

/**
 * 메모 UI 레이아웃 관련 상수.
 * Memo.module.css, MemoContent.module.css와 동기화 필요.
 */
export const MEMO_UI = {
  /** 툴바 높이 + 상하 패딩 합계 (px). 이미지 max-height 계산에 사용. */
  CHROME_HEIGHT: 44,
  /** 콘텐츠 영역 좌우 패딩 합계 (px). 이미지 max-width 계산에 사용. */
  CONTENT_PADDING: 16,
  /** 이미지 리사이즈 핸들의 한 변 길이 (px). */
  RESIZE_HANDLE_SIZE: 10,
  /** 지도 컨테이너 기본 높이 (px). */
  MAP_HEIGHT: 160,
  /** 이미지 정렬 툴바 너비 (px). */
  IMAGE_TOOLBAR_WIDTH: 66,
} as const;

/**
 * 메모 크기 제약 상수.
 * useResizable.ts와 Memo.module.css의 min-width/min-height와 동기화 필요.
 */
export const MEMO_CONSTRAINTS = {
  /** 메모 최소 너비 (px). */
  MIN_WIDTH: 160,
  /** 메모 최소 높이 (px). */
  MIN_HEIGHT: 120,
} as const;
