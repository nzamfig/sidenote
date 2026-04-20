/**
 * @file App.tsx
 * Root component of the app.
 *
 * Handles four responsibilities:
 * 1. Calls usePersistence() — enables auto localStorage save/restore for the entire app.
 * 2. Renders Canvas — displays the memo canvas at the user-specified size.
 * 3. Top-center toolbar — shows the CanvasSizePanel and ExportImportPanel side by side.
 * 4. App identity UI — shows a fixed label at the top left (icon + app name + description).
 *
 * All state and business logic are delegated to the Zustand stores and custom hooks,
 * keeping this component as thin as possible.
 */

import { usePersistence } from './hooks/usePersistence';
import { Canvas } from './components/Canvas/Canvas';
import { CanvasSizePanel } from './components/CanvasSizePanel/CanvasSizePanel';
import { ExportImportPanel } from './components/ExportImportPanel/ExportImportPanel';
import styles from './App.module.css';

function App() {
  /**
   * Call the localStorage sync hook once at the root level.
   * - On mount: restores memos from localStorage into the store
   * - Afterwards: auto-saves to localStorage on every store change
   */
  usePersistence();

  return (
    <div className={styles.app}>
      <div className={styles.canvasArea}>
        <Canvas />
      </div>
      {/*
       * Top-center toolbar — fixed via position: fixed, stays at the top center regardless of scroll.
       * CanvasSizePanel and ExportImportPanel are laid out horizontally side by side.
       */}
      <div className={styles.topBar}>
        <CanvasSizePanel />
        <ExportImportPanel />
      </div>

      {/*
       * App identity label — fixed via position: fixed, stays at the top left regardless of scroll.
       * pointer-events: none so it does not block canvas clicks/double-clicks.
       */}
      <div className={styles.appLabel}>
        <svg width="30" height="30" viewBox="0 0 15 15" fill="none" className={styles.appIcon}>
          <rect x="1" y="1" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M10 3.5h3M10 6h3M10 8.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <line x1="3.5" y1="5" x2="7.5" y2="5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="3.5" y1="7.5" x2="7.5" y2="7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="3.5" y1="10" x2="6" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
        <div className={styles.appText}>
          <span className={styles.appName}>SideNote</span>
          <span className={styles.appDesc}>
            A quick notes space while browsing the web.<br />
            All data is saved in your browser only — never sent to any server.
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
