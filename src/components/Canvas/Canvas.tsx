/**
 * @file Canvas.tsx
 * 메모들이 놓이는 무한 캔버스(배경 영역) 컴포넌트.
 *
 * 이 컴포넌트의 책임:
 * 1. DndContext 제공 — 하위의 모든 Memo 컴포넌트가 드래그를 사용할 수 있게 한다.
 * 2. 드래그 종료 처리 — 드래그가 끝난 메모의 최종 위치를 계산해 스토어에 저장한다.
 * 3. 이벤트 위임 — 더블클릭·클릭 이벤트를 useCanvasInteraction 훅에 위임한다.
 * 4. 메모 목록 렌더링 — memos 배열을 순서대로 렌더링 (배열 뒤쪽 = 높은 z-index).
 */

import { useRef } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { useMemoStore } from '../../store/useMemoStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { Memo } from '../Memo/Memo';
import styles from './Canvas.module.css';

export function Canvas() {
  // memos 배열 전체를 구독 (메모 추가/삭제/이동 시 리렌더)
  const memos = useMemoStore((s) => s.memos);
  const moveMemo = useMemoStore((s) => s.moveMemo);
  // 사용자가 지정한 캔버스 크기 — 변경 시 canvas div에 인라인 style로 즉시 반영된다
  const { width: canvasWidth, height: canvasHeight } = useCanvasStore();

  /**
   * 캔버스 크기를 추적하는 ref.
   * state 대신 ref를 사용하는 이유: 크기 변경 시 리렌더를 유발할 필요가 없다.
   * 드래그 종료 시점에만 읽으면 충분하기 때문이다.
   */
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  // 더블클릭·클릭 핸들러와 캔버스 ref를 훅에서 가져온다
  const { canvasRef, handleDoubleClick, handleCanvasClick } = useCanvasInteraction();

  /**
   * @dnd-kit 센서 설정.
   *
   * PointerSensor: 마우스와 터치 이벤트를 모두 처리한다.
   * activationConstraint.distance: 5px 이상 움직여야 드래그로 인식한다.
   * → 이 설정이 없으면 클릭·더블클릭도 드래그로 오인식될 수 있다.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  /**
   * 드래그 종료 이벤트 핸들러.
   *
   * @dnd-kit은 드래그 중 메모를 실제로 이동시키지 않는다.
   * 대신 Memo 컴포넌트가 `transform` 델타를 CSS로 시각적으로만 반영한다.
   * 드래그가 끝나면 이 핸들러에서 최종 위치를 계산해 스토어에 커밋한다.
   *
   * 위치 계산:
   *   최종 x = 드래그 시작 시 스토어의 position.x + 드래그 이동 거리(delta.x)
   *   최종 y = 드래그 시작 시 스토어의 position.y + 드래그 이동 거리(delta.y)
   *
   * 경계 클램핑:
   *   메모가 캔버스 밖으로 나가지 않도록 [0, canvasSize - memoSize] 범위로 제한한다.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;

    // 드래그된 메모를 id로 찾는다
    const memo = memos.find((m) => m.id === active.id);
    if (!memo) return;

    // 드래그 종료 시점의 캔버스 실제 크기를 측정해 ref에 저장
    const canvas = canvasRef.current;
    if (canvas) {
      canvasSizeRef.current = {
        width: canvas.offsetWidth,
        height: canvas.offsetHeight,
      };
    }

    const { width: canvasW, height: canvasH } = canvasSizeRef.current;

    // 드래그 전 위치 + 이동 거리 = 드래그 후 위치
    const rawX = memo.position.x + delta.x;
    const rawY = memo.position.y + delta.y;

    /**
     * 캔버스 경계를 벗어나지 않도록 클램핑.
     * Math.max(0, ...) → 왼쪽/위쪽 경계
     * Math.min(..., canvasW - memo.size.width) → 오른쪽/아래쪽 경계
     * (메모 우하단이 캔버스 밖으로 나가지 않도록 width/height만큼 여유를 뺀다)
     *
     * canvasW가 0이면(캔버스 DOM을 읽지 못한 경우) 클램핑 없이 그대로 사용한다.
     */
    const x = canvasW > 0 ? Math.max(0, Math.min(rawX, canvasW - memo.size.width)) : rawX;
    const y = canvasH > 0 ? Math.max(0, Math.min(rawY, canvasH - memo.size.height)) : rawY;

    moveMemo(String(active.id), { x, y });
  };

  return (
    /**
     * DndContext: 하위 트리에 드래그&드롭 컨텍스트를 제공한다.
     * onDragEnd: 드래그가 완전히 끝났을 때(포인터 업) 호출된다.
     */
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        ref={canvasRef}
        className={styles.canvas}
        style={{ width: canvasWidth, height: canvasHeight }}
        onDoubleClick={handleDoubleClick} // 메모 생성
        onClick={handleCanvasClick}       // 선택 해제
      >
        {/*
         * memos 배열 순서대로 렌더링한다.
         * index + 1이 CSS z-index가 된다 (0은 피하기 위해 +1).
         * 배열 마지막 원소가 가장 높은 z-index를 가져 화면 최상위에 표시된다.
         */}
        {memos.map((memo, index) => (
          <Memo key={memo.id} memo={memo} zIndex={index + 1} />
        ))}

        {/* 사용 방법 힌트 — 포인터 이벤트를 차단하지 않도록 pointer-events: none으로 설정됨 */}
        <div className={styles.hint}>
          더블클릭하여 메모 추가
        </div>
      </div>
    </DndContext>
  );
}
