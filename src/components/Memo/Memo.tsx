/**
 * @file Memo.tsx
 * 개별 포스트잇 메모를 렌더링하는 컴포넌트.
 *
 * 이 컴포넌트의 책임:
 * - 드래그 동작: useDraggable 훅으로 드래그 상태(transform, isDragging)를 관리한다.
 * - 위치·크기·z-index: 인라인 style로 설정한다.
 * - 포커스·선택: onPointerDownCapture로 activeMemoId 갱신 + 배열 최상위로 reorder한다.
 * - 입력일시 표시: 타이틀 영역 비호버 시 YYYY-MM-DD HH:MM:SS 형식으로 중앙에 표시한다.
 * - 하위 컴포넌트 조율: MemoToolbar(색상·삭제)와 MemoContent(텍스트+이미지+지도 편집)를 조합한다.
 * - 이미지 업로드: 좌측 하단 버튼으로 로컬 이미지를 커서 위치에 삽입한다.
 * - 지도 삽입: 좌측 하단 버튼으로 Leaflet 지도를 커서 위치에 삽입한다.
 */

import { useRef, memo as reactMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Memo as MemoType } from '../../types/memo';
import { useMemoActions } from '../../hooks/useMemoActions';
import { useResizable } from '../../hooks/useResizable';
import { useMemoStore } from '../../store/useMemoStore';
import { MemoToolbar } from '../MemoToolbar/MemoToolbar';
import { MemoContent, type MemoContentHandle } from './MemoContent';
import { MEMO_UI } from '../../constants';
import styles from './Memo.module.css';

interface MemoProps {
  /** 렌더링할 메모 데이터 (스토어의 Memo 객체를 그대로 전달) */
  memo: MemoType;
  /** CSS z-index 값. memos 배열의 index + 1이 전달된다. */
  zIndex: number;
}

export const Memo = reactMemo(function Memo({ memo, zIndex }: MemoProps) {
  // 이 메모 전용 수정·삭제 액션 (id 고정)
  const { updateContent, updateColor, remove } = useMemoActions(memo.id);

  // 오른쪽 하단 핸들 드래그로 크기 조절
  const { handlePointerDown: handleResizePointerDown } = useResizable(memo.id, memo.size);

  // MemoContent의 insertImage 메서드에 접근하기 위한 ref
  const contentRef = useRef<MemoContentHandle>(null);
  // 숨겨진 파일 input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reorderToTop = useMemoStore((s) => s.reorderToTop);
  const setActiveMemo = useMemoStore((s) => s.setActiveMemo);
  const activeMemoId = useMemoStore((s) => s.activeMemoId);

  /** 현재 이 메모가 선택(활성화)됐는지 여부 → CSS data-active 속성으로 스타일에 반영 */
  const isActive = activeMemoId === memo.id;

  /**
   * @dnd-kit useDraggable 훅.
   *
   * - `attributes`: aria-* 접근성 속성 (드래그 핸들 요소에 spread)
   * - `listeners`: onPointerDown 등 드래그 시작 이벤트 (드래그 핸들 요소에 spread)
   * - `setNodeRef`: 드래그 대상 DOM 요소를 @dnd-kit에 등록하는 ref 콜백
   * - `transform`: 드래그 중 이동 거리(delta). 드래그가 끝나면 null이 된다.
   *   { x: dx, y: dy, scaleX: 1, scaleY: 1} 형태이며, CSS.Translate.toString()으로
   *   `translate(dx px, dy px)` 문자열로 변환해 CSS transform에 적용한다.
   * - `isDragging`: 현재 이 메모가 드래그 중인지 여부
   */
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: memo.id,
  });

  /**
   * 메모의 인라인 스타일.
   *
   * position: 'absolute' + left/top으로 캔버스 내 절대 위치를 지정한다.
   * (CSS transform이 아닌 left/top을 쓰는 이유: 스토어에 저장되는 좌표가 캔버스 원점
   * 기준이기 때문. transform은 드래그 중 시각적 오프셋에만 추가로 사용한다.)
   *
   * transform: 드래그 중에는 @dnd-kit이 제공하는 delta를 CSS transform으로 표현한다.
   * GPU가 처리하는 transform을 사용해 드래그 애니메이션이 부드럽게 동작한다.
   * CSS.Translate.toString(null)은 빈 문자열을 반환하므로 드래그가 아닐 때는 무해하다.
   *
   * zIndex: 드래그 중에는 9999로 올려 다른 메모 위에 항상 표시되게 한다.
   */
  const style: React.CSSProperties = {
    position: 'absolute',
    left: memo.position.x,
    top: memo.position.y,
    width: memo.size.width,
    height: memo.size.height,
    zIndex: isDragging ? 9999 : zIndex,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.85 : 1, // 드래그 중 반투명으로 "들린" 느낌 표현
  };

  /**
   * 메모를 클릭(포인터 누름)할 때 실행된다.
   * - reorderToTop: 클릭한 메모를 배열 맨 끝으로 올려 z-index를 최상위로 만든다.
   * - setActiveMemo: 이 메모를 선택 상태로 표시한다.
   *
   * onPointerDownCapture(캡처 단계)를 사용하는 이유:
   * MemoContent 내부 editor div는 자체 편집 기능을 위해 onPointerDown에서
   * e.stopPropagation()을 호출한다. 버블 단계(onPointerDown)에서는 이 차단에 걸려
   * 텍스트 영역 클릭 시 reorderToTop이 실행되지 않는다.
   * 캡처 단계는 이벤트가 target으로 내려가는 경로이므로 stopPropagation보다 먼저 실행돼
   * 텍스트 영역을 클릭해도 항상 호출이 보장된다.
   */
  const handlePointerDown = () => {
    reorderToTop(memo.id);
    setActiveMemo(memo.id);
  };

  /**
   * "새로 생성된 메모"인지 판별한다.
   * 생성 시 createdAt === updatedAt이고 내용이 비어있으면 방금 만든 메모로 간주한다.
   * MemoContent에 autoFocus를 전달해 생성 직후 바로 타이핑할 수 있게 한다.
   */
  const isNew = memo.createdAt === memo.updatedAt && memo.content === '';

  /** 업로드 버튼 클릭 → 파일 다이얼로그 열기 */
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * 파일 선택 완료 후 처리.
   * - FileReader로 base64 DataURL을 읽은 뒤 MemoContent.insertImage를 호출한다.
   * - 이미지 최대 크기: 콘텐츠 영역(메모 너비/높이에서 chrome 영역 제외)으로 제한한다.
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const maxWidth = memo.size.width - MEMO_UI.CONTENT_PADDING;
      const maxHeight = memo.size.height - MEMO_UI.CHROME_HEIGHT;
      contentRef.current?.insertImage(src, maxWidth, maxHeight);
    };
    reader.readAsDataURL(file);

    // 동일 파일을 연속으로 업로드할 수 있도록 값 초기화
    e.target.value = '';
  };

  /**
   * 입력일시를 YYYY-MM-DD HH:MM:SS 형식으로 변환한다.
   * 렌더마다 Date 객체를 새로 생성하지 않도록 IIFE로 작성해 값을 한 번만 계산한다.
   * (memo.createdAt은 변경되지 않으므로 memo 자체가 바뀌지 않는 한 항상 동일한 결과)
   */
  const formattedDate = (() => {
    const d = new Date(memo.createdAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  })();

  return (
    <div
      ref={setNodeRef}         // @dnd-kit이 이 DOM 요소를 드래그 대상으로 추적
      style={style}
      className={styles.memo}
      data-color={memo.color}  // CSS에서 색상별 배경 적용에 사용
      data-memo-id={memo.id}   // useCanvasInteraction에서 "메모 위 더블클릭" 감지에 사용
      data-active={isActive}   // CSS에서 선택된 메모의 그림자 강조에 사용
      onPointerDownCapture={handlePointerDown}
    >
      {/*
       * titleArea: dragHandle(툴바)와 createdAt(날짜)을 형제 요소로 묶는 컨테이너.
       *
       * 왜 형제 구조인가 — CSS opacity 상속 문제:
       * CSS opacity는 부모→자식으로 곱셈 상속되며, 자식에서 opacity: 1로 되돌릴 수 없다.
       * 비호버 시 dragHandle의 opacity가 0이 되면, 그 안에 있는 createdAt도 보이지 않게 된다.
       * 해결책: createdAt을 dragHandle의 형제로 두고 position: absolute로 같은 영역에 겹친다.
       * 이렇게 하면 두 요소가 서로 독립된 opacity를 갖게 되어 교차 페이드가 가능하다.
       * (비호버: dragHandle 숨김 + createdAt 표시 / 호버: dragHandle 표시 + createdAt 숨김)
       *
       * listeners와 attributes는 dragHandle에만 적용해 툴바 영역만 드래그 핸들로 동작하게 하고,
       * MemoContent에는 적용하지 않아 텍스트 선택·커서 이동이 정상 동작한다.
       */}
      <div className={styles.titleArea}>
        <div {...listeners} {...attributes} className={styles.dragHandle}>
          <MemoToolbar
            currentColor={memo.color}
            onColorChange={updateColor}
            onDelete={remove}
          />
        </div>
        <span className={styles.createdAt}>{formattedDate}</span>
      </div>

      <MemoContent
        ref={contentRef}
        content={memo.content}
        autoFocus={isNew}
        onChange={updateContent}
      />

      {/* 하단 액션 버튼 바 (호버 시에만 표시) */}
      <div className={styles.actionBar}>
        {/* 이미지 업로드 버튼 */}
        <button
          className={styles.actionBtn}
          title="이미지 추가"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleUploadClick}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>

        {/* 지도 삽입 버튼 */}
        <button
          className={styles.actionBtn}
          title="지도 추가"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => contentRef.current?.insertMap()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
            <line x1="9" y1="3" x2="9" y2="18"/>
            <line x1="15" y1="6" x2="15" y2="21"/>
          </svg>
        </button>
      </div>

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* 오른쪽 하단 리사이즈 핸들 */}
      <div
        className={styles.resizeHandle}
        onPointerDown={handleResizePointerDown}
      />
    </div>
  );
});
