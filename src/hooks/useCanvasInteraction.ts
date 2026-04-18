/**
 * @file useCanvasInteraction.ts
 * 캔버스(배경 영역)와의 사용자 인터랙션을 처리하는 훅.
 *
 * 담당하는 이벤트:
 * - 더블클릭 → 해당 위치에 새 메모 생성
 * - 단일 클릭(캔버스 배경 직접 클릭) → 메모 선택 해제
 *
 * Canvas 컴포넌트에서 사용하며, canvasRef를 Canvas의 최상위 div에 연결해야 한다.
 */

import { useCallback, useRef } from 'react';
import { useMemoStore } from '../store/useMemoStore';

export function useCanvasInteraction() {
  /**
   * 캔버스 DOM 요소에 대한 ref.
   * 클릭 좌표를 뷰포트 기준에서 캔버스 기준으로 변환할 때 사용한다.
   * (getBoundingClientRect로 캔버스의 뷰포트 내 위치를 구하기 위함)
   */
  const canvasRef = useRef<HTMLDivElement>(null);

  const createMemo = useMemoStore((s) => s.createMemo);
  const setActiveMemo = useMemoStore((s) => s.setActiveMemo);

  /**
   * 캔버스 더블클릭 핸들러.
   *
   * 좌표 변환 방식:
   *   캔버스 기준 x = 마우스 뷰포트 x (e.clientX) - 캔버스 뷰포트 x (rect.left)
   *   캔버스 기준 y = 마우스 뷰포트 y (e.clientY) - 캔버스 뷰포트 y (rect.top)
   *
   * useCallback을 사용해 createMemo 참조가 바뀌지 않으면 함수를 재생성하지 않는다.
   * (불필요한 Canvas 리렌더 방지)
   */
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      /**
       * 이벤트 버블링 방어:
       * 기존 메모(.memo 요소) 위에서 더블클릭하면 이 핸들러까지 이벤트가 버블링된다.
       * data-memo-id 속성을 가진 조상 요소가 있으면 메모 위에서 발생한 이벤트이므로 무시한다.
       */
      if ((e.target as HTMLElement).closest('[data-memo-id]')) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // 캔버스의 뷰포트 기준 위치를 가져와 클릭 좌표를 캔버스 기준으로 변환
      const rect = canvas.getBoundingClientRect();
      createMemo({
        position: {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
      });
    },
    [createMemo]
  );

  /**
   * 캔버스 단일 클릭 핸들러.
   *
   * e.target이 canvasRef.current 자체일 때만(= 캔버스 배경을 직접 클릭)
   * 메모 선택을 해제한다.
   * 메모 위를 클릭하면 e.target이 메모 내부 요소이므로 조건이 거짓이 되어 무시된다.
   */
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === canvasRef.current) {
        setActiveMemo(null);
      }
    },
    [setActiveMemo]
  );

  return { canvasRef, handleDoubleClick, handleCanvasClick };
}
