/**
 * @file CanvasSizePanel.tsx
 * 캔버스 영역 크기를 설정하는 UI 패널.
 *
 * - 평소: 현재 크기(W × H)를 표시하는 작은 버튼 (상단 중앙 고정)
 * - 클릭 시: 너비·높이 입력 폼으로 전환
 * - Enter / 적용 버튼: 크기 반영, Escape / 외부 클릭: 취소
 */

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import styles from './CanvasSizePanel.module.css';

/** 허용 최솟값 */
const MIN_W = 400;
const MIN_H = 300;

export function CanvasSizePanel() {
  const { width, height, setSize } = useCanvasStore();
  const [open, setOpen] = useState(false);
  const [inputW, setInputW] = useState('');
  const [inputH, setInputH] = useState('');
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const wInputRef = useRef<HTMLInputElement>(null);

  /** 트리거 버튼 클릭 시 현재 스토어 값을 입력 필드에 채우고 폼을 연다 */
  const handleOpen = () => {
    setInputW(String(width));
    setInputH(String(height));
    setError(false);
    setOpen(true);
  };

  // 폼이 열리면 너비 입력 필드 전체 선택 → 즉시 타이핑 가능
  useEffect(() => {
    if (open) wInputRef.current?.select();
  }, [open]);

  /**
   * 입력값을 검증하고 캔버스 크기를 적용한다.
   * parseInt 기반 파싱: 소수점 입력(예: "800.5")은 정수로 내림 처리된다.
   * 최솟값 미만이면 에러 상태로 전환해 빨간 테두리를 표시한다.
   */
  const handleApply = () => {
    const w = parseInt(inputW, 10);
    const h = parseInt(inputH, 10);
    if (isNaN(w) || isNaN(h) || w < MIN_W || h < MIN_H) {
      setError(true);
      return;
    }
    setSize(w, h);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleApply(); }
    if (e.key === 'Escape') setOpen(false);
    // 캔버스의 dnd-kit 이벤트 리스너로 키 이벤트가 전파되지 않도록 차단
    e.stopPropagation();
  };

  // 폼 외부 클릭 시 폼을 닫는다. open=false이면 리스너를 등록하지 않는다.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={panelRef} className={styles.panel}>
      {open ? (
        <div className={styles.form} data-error={error}>
          <span className={styles.label}>W</span>
          <input
            ref={wInputRef}
            className={styles.input}
            type="number"
            value={inputW}
            min={MIN_W}
            onChange={(e) => { setInputW(e.target.value); setError(false); }}
            onKeyDown={handleKeyDown}
            aria-label="캔버스 너비"
          />
          <span className={styles.sep}>×</span>
          <span className={styles.label}>H</span>
          <input
            className={styles.input}
            type="number"
            value={inputH}
            min={MIN_H}
            onChange={(e) => { setInputH(e.target.value); setError(false); }}
            onKeyDown={handleKeyDown}
            aria-label="캔버스 높이"
          />
          <button className={styles.applyBtn} onClick={handleApply}>적용</button>
        </div>
      ) : (
        <button className={styles.trigger} onClick={handleOpen} title="캔버스 크기 설정">
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          <span className={styles.sizeText}>{width} × {height}</span>
        </button>
      )}
    </div>
  );
}
