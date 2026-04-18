/**
 * @file MemoToolbar.tsx
 * 메모 상단에 표시되는 툴바 컴포넌트.
 *
 * 두 가지 역할을 동시에 수행한다:
 * 1. 드래그 핸들 — Memo.tsx에서 이 컴포넌트를 감싸는 div에 @dnd-kit의
 *    `listeners`와 `attributes`를 적용해 툴바 영역을 드래그 시작 지점으로 삼는다.
 * 2. 메모 설정 UI — 색상 선택(ColorPicker)과 삭제 버튼을 제공한다.
 *
 * 이 컴포넌트 자체는 순수하게 렌더링만 담당하고, 모든 상태 변경은 콜백 props를 통해
 * 부모(Memo)로 위임한다.
 */

import type { MemoColor } from '../../types/memo';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import styles from './MemoToolbar.module.css';

interface MemoToolbarProps {
  /** 현재 메모의 색상 (ColorPicker에 전달해 현재 선택된 색상을 강조 표시한다) */
  currentColor: MemoColor;
  /** 색상 변경 시 호출되는 콜백. 선택된 색상 값이 인자로 전달된다. */
  onColorChange: (color: MemoColor) => void;
  /** 삭제 버튼 클릭 시 호출되는 콜백. */
  onDelete: () => void;
}

export function MemoToolbar({ currentColor, onColorChange, onDelete }: MemoToolbarProps) {
  return (
    /*
     * CSS에서 cursor: grab이 적용된다.
     * 이 div 전체가 드래그 핸들 역할을 하므로 사용자가 드래그 가능 영역임을 인지한다.
     */
    <div className={styles.toolbar}>
      {/* 색상 스와치 목록 — 클릭하면 onColorChange 콜백이 호출됨 */}
      <ColorPicker currentColor={currentColor} onChange={onColorChange} />

      {/*
       * 삭제 버튼.
       * aria-label: 스크린리더를 위한 레이블 (버튼 내 텍스트 "✕"만으로는 의미 불명확)
       * title: 마우스 호버 시 툴팁으로 "삭제" 표시
       */}
      <button
        className={styles.deleteBtn}
        onClick={onDelete}
        aria-label="메모 삭제"
        title="삭제"
      >
        ✕
      </button>
    </div>
  );
}
