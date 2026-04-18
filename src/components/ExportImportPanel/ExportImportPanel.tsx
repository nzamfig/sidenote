/**
 * @file ExportImportPanel.tsx
 * 메모 데이터를 JSON 파일로 내보내거나 가져오는 UI 패널.
 *
 * - 내보내기: 현재 스토어의 memos를 JSON 파일로 다운로드
 * - 가져오기: JSON 파일을 선택해 스토어를 교체 (기존 메모는 삭제됨)
 *
 * 파일 포맷: { memos: Memo[], version: number } — localStorage와 동일한 PersistedState 구조.
 */

import { useRef } from 'react';
import { useMemoStore } from '../../store/useMemoStore';
import type { Memo } from '../../types/memo';
import styles from './ExportImportPanel.module.css';

export function ExportImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const memos = useMemoStore.getState().memos;
    const data = JSON.stringify({ memos, version: 1 }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // 임시 <a> 태그로 다운로드 트리거
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
        // memos 배열 존재 여부와 각 항목의 필수 필드를 검증한다
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as Record<string, unknown>).memos)
        ) {
          const memos = (parsed as { memos: unknown[] }).memos.filter(
            (m): m is Memo =>
              m !== null &&
              typeof m === 'object' &&
              typeof (m as Record<string, unknown>).id === 'string' &&
              typeof (m as Record<string, unknown>).content === 'string'
          );
          if (!window.confirm(`메모 ${memos.length}개를 불러옵니다.\n현재 메모는 모두 삭제됩니다. 계속하시겠습니까?`)) return;
          useMemoStore.getState().hydrateFromStorage(memos);
        } else {
          alert('유효하지 않은 SideNote 파일입니다.');
        }
      } catch {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);

    // 같은 파일을 다시 선택할 수 있도록 값 초기화
    e.target.value = '';
  };

  return (
    <div className={styles.panel}>
      {/* 내보내기 버튼 */}
      <button className={styles.btn} title="내보내기 (JSON)" onClick={handleExport}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span className={styles.label}>내보내기</span>
      </button>

      <div className={styles.divider} />

      {/* 가져오기 버튼 */}
      <button className={styles.btn} title="가져오기 (JSON)" onClick={handleImportClick}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span className={styles.label}>가져오기</span>
      </button>

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
