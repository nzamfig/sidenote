/**
 * @file setup.ts
 * Global Vitest test environment setup.
 * Registered in vite.config.ts test.setupFiles; loaded once before each test file runs.
 */
import '@testing-library/jest-dom';

// jsdom does not support PointerEvent, so add a MouseEvent-based polyfill
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
