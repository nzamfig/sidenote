/**
 * @file setup.ts
 * Vitest 전역 테스트 환경 설정.
 * vite.config.ts의 test.setupFiles에 등록되어 각 테스트 파일 실행 전에 한 번 로드된다.
 */
import '@testing-library/jest-dom';

// jsdom이 PointerEvent를 지원하지 않으므로 MouseEvent 기반 폴리필 추가
if (typeof PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init?: MouseEventInit & { pointerId?: number }) {
      super(type, init);
      this.pointerId = init?.pointerId ?? 0;
    }
  }
  (globalThis as unknown as Record<string, unknown>).PointerEvent = PointerEventPolyfill;
}
