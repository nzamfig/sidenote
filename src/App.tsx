/**
 * @file App.tsx
 * 앱의 최상위 컴포넌트.
 *
 * 네 가지를 담당한다:
 * 1. usePersistence() 호출 — 앱 전체에서 localStorage 자동 저장/복원이 동작하도록 한다.
 * 2. Canvas 렌더링 — 사용자가 지정한 크기의 메모 캔버스를 표시한다.
 * 3. 상단 중앙 툴바 — 캔버스 크기 설정 + Export/Import 버튼을 나란히 표시한다.
 * 4. 앱 식별 UI — 좌측 상단 고정 레이블(아이콘 + 앱 이름 + 설명)을 표시한다.
 *
 * 상태와 비즈니스 로직은 모두 Zustand 스토어와 커스텀 훅에 위임하므로
 * 이 컴포넌트는 최대한 얇게(thin) 유지한다.
 */

import { usePersistence } from './hooks/usePersistence';
import { Canvas } from './components/Canvas/Canvas';
import { CanvasSizePanel } from './components/CanvasSizePanel/CanvasSizePanel';
import { ExportImportPanel } from './components/ExportImportPanel/ExportImportPanel';
import styles from './App.module.css';

function App() {
  /**
   * localStorage 동기화 훅을 최상위에서 한 번만 호출한다.
   * - 마운트 시: localStorage → 스토어로 메모 복원
   * - 이후: 스토어 변경 시마다 localStorage에 자동 저장
   */
  usePersistence();

  return (
    <div className={styles.app}>
      <div className={styles.canvasArea}>
        <Canvas />
      </div>
      {/*
       * 상단 중앙 툴바 — position: fixed로 스크롤 무관하게 화면 상단 중앙에 고정.
       * CanvasSizePanel과 ExportImportPanel을 가로로 나란히 배치한다.
       */}
      <div className={styles.topBar}>
        <CanvasSizePanel />
        <ExportImportPanel />
      </div>

      {/*
       * 앱 식별 레이블 — position: fixed로 스크롤과 무관하게 좌측 상단에 고정.
       * pointer-events: none이므로 캔버스 클릭/더블클릭을 가로막지 않는다.
       */}
      <div className={styles.appLabel}>
        <svg width="22" height="22" viewBox="0 0 15 15" fill="none" className={styles.appIcon}>
          <rect x="1" y="1" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M10 3.5h3M10 6h3M10 8.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <line x1="3.5" y1="5" x2="7.5" y2="5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="3.5" y1="7.5" x2="7.5" y2="7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="3.5" y1="10" x2="6" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
        <div className={styles.appText}>
          <span className={styles.appName}>SideNote</span>
          <span className={styles.appDesc}>웹 서핑 중 잠깐 기록하는 메모</span>
        </div>
      </div>
    </div>
  );
}

export default App;
