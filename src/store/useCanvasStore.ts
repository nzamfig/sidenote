/**
 * @file useCanvasStore.ts
 * 캔버스 영역(너비 × 높이) 상태를 관리하는 Zustand 스토어.
 *
 * - 초기값: 저장된 값이 없으면 현재 뷰포트 크기로 설정 (기존 동작과 동일)
 * - 변경 즉시 localStorage에 저장 (브라우저 재시작 후에도 유지)
 * - 저장 키: 'canvas-size' (memo-app-v1과 분리해 독립적으로 관리)
 */

import { create } from 'zustand';

interface CanvasStore {
  width: number;
  height: number;
  setSize: (width: number, height: number) => void;
}

const STORAGE_KEY = 'canvas-size';

/**
 * localStorage에서 캔버스 크기를 읽어 반환한다.
 *
 * 타입 가드로 width·height가 모두 number인지 확인하는 이유:
 * localStorage 값은 외부 입력이므로 런타임 타입 검증 없이 as-cast하면
 * 손상된 데이터가 NaN으로 들어와 캔버스가 사라질 수 있다.
 * 검증 실패 또는 키 없음(최초 실행) 시 현재 뷰포트 크기를 기본값으로 사용한다.
 */
function loadSize(): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        typeof (parsed as Record<string, unknown>).width === 'number' &&
        typeof (parsed as Record<string, unknown>).height === 'number'
      ) {
        return {
          width: (parsed as Record<string, number>).width,
          height: (parsed as Record<string, number>).height,
        };
      }
    }
  } catch { /* 파싱 오류 무시 */ }
  // 저장값 없음(최초 실행) 또는 파싱 실패 시 뷰포트 크기를 초기값으로 사용
  return { width: window.innerWidth, height: window.innerHeight };
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  ...loadSize(),
  setSize: (width, height) => {
    set({ width, height });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ width, height }));
    } catch { /* 저장 실패 무시 */ }
  },
}));
