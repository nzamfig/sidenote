/**
 * @file ColorPicker.tsx
 * 메모 색상을 선택하는 스와치 그리드 컴포넌트.
 *
 * 순수 프레젠테이션 컴포넌트(Pure Presentational Component)로,
 * 내부 상태가 없고 모든 동작은 props를 통해 부모에게 위임된다.
 * 색상 목록은 types/memo.ts의 MEMO_COLORS에서 가져와 타입과 UI가 항상 동기화된다.
 */

import type { MemoColor } from '../../types/memo';
import { MEMO_COLORS } from '../../types/memo';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  /** 현재 선택된 색상. 해당 스와치에 선택 표시(테두리, 크기 강조)를 적용한다. */
  currentColor: MemoColor;
  /** 스와치 클릭 시 호출되는 콜백. 클릭된 색상 값이 인자로 전달된다. */
  onChange: (color: MemoColor) => void;
}

export function ColorPicker({ currentColor, onChange }: ColorPickerProps) {
  return (
    <div className={styles.picker}>
      {MEMO_COLORS.map((color) => (
        <button
          key={color}
          className={styles.swatch}
          /**
           * data-color: CSS에서 각 스와치의 배경색을 지정하는 데 사용한다.
           * (ColorPicker.module.css의 [data-color='yellow'] 등 선택자)
           */
          data-color={color}
          /**
           * data-active: 현재 선택된 색상 스와치에 강조 스타일을 적용한다.
           * CSS의 [data-active='true'] 선택자로 테두리와 크기를 조정한다.
           */
          data-active={color === currentColor}
          aria-label={color}              // 스크린리더: "yellow", "pink" 등으로 읽힘
          aria-pressed={color === currentColor} // 토글 버튼 상태를 스크린리더에 전달
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
