/**
 * @file ExportImportPanel.tsx
 * UI panel for exporting or importing memo data as a JSON file.
 *
 * - Export: downloads the current store's memos as a JSON file
 * - Import: selects a JSON file and replaces the store (existing memos are deleted)
 *
 * File format: { memos: Memo[], version: number } — same PersistedState structure as localStorage.
 */

import { useRef } from 'react';
import { useMemoStore } from '../../store/useMemoStore';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { isValidMemo } from '../../utils/validation';
import styles from './ExportImportPanel.module.css';

export function ExportImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canInstall, install } = usePWAInstall();

  const handleExport = () => {
    const memos = useMemoStore.getState().memos;
    const data = JSON.stringify({ memos, version: 1 }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Trigger download via a temporary <a> element
    const a = document.createElement('a');
    a.href = url;
    a.download = `sidenote-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as unknown;
        // Validate that the memos array exists and each item has required fields
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as Record<string, unknown>).memos)
        ) {
          const memos = (parsed as { memos: unknown[] }).memos.filter(isValidMemo);
          if (!window.confirm(`Import ${memos.length} memo(s).\nAll current memos will be deleted. Continue?`)) return;
          useMemoStore.getState().hydrateFromStorage(memos);
        } else {
          alert('Invalid SideNote file.');
        }
      } catch {
        alert('An error occurred while reading the file.');
      }
    };
    reader.readAsText(file);

    // Reset value so the same file can be selected again
    e.target.value = '';
  };

  return (
    <div className={styles.panel}>
      {/* Export button */}
      <button className={styles.btn} title="Export (JSON)" onClick={handleExport}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span className={styles.label}>Export</span>
      </button>

      <div className={styles.divider} />

      {/* Import button */}
      <button className={styles.btn} title="Import (JSON)" onClick={handleImportClick}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span className={styles.label}>Import</span>
      </button>

      {canInstall && (
        <>
          <div className={styles.divider} />
          <button className={styles.btn} title="Install App" onClick={install}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/>
              <path d="M12 8v8M8 12l4 4 4-4"/>
            </svg>
            <span className={styles.label}>Install</span>
          </button>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
