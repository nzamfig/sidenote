/**
 * @file useResizable.ts
 * 메모 오른쪽 하단 핸들을 드래그해 크기를 조절하는 훅.
 *
 * - pointerdown 시 pointermove/pointerup 리스너를 document에 등록하고,
 *   pointerup에서 제거한다.
 * - setPointerCapture를 사용해 커서가 핸들 밖으로 빠르게 나가도 리사이즈가 끊기지 않게 한다.
 * - 스토어의 resizeMemo를 실시간으로 호출해 드래그 중에도 크기가 즉시 반영된다.
 */

import { useCallback } from 'react';
import { useMemoStore } from '../store/useMemoStore';
import type { MemoSize } from '../types/memo';
import { MEMO_CONSTRAINTS } from '../constants';

export function useResizable(memoId: string, currentSize: MemoSize) {
  const resizeMemo = useMemoStore((s) => s.resizeMemo);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // dnd-kit의 드래그 시작을 막는다
      e.stopPropagation();
      e.preventDefault();

      // 포인터를 이 요소에 고정해 빠른 마우스 이동에도 이벤트가 끊기지 않게 한다
      e.currentTarget.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = currentSize.width;
      const startHeight = currentSize.height;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const newWidth = Math.max(MEMO_CONSTRAINTS.MIN_WIDTH, startWidth + (moveEvent.clientX - startX));
        const newHeight = Math.max(MEMO_CONSTRAINTS.MIN_HEIGHT, startHeight + (moveEvent.clientY - startY));
        resizeMemo(memoId, { width: newWidth, height: newHeight });
      };

      const handlePointerUp = () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [memoId, currentSize, resizeMemo]
  );

  return { handlePointerDown };
}
