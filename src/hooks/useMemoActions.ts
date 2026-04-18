/**
 * @file useMemoActions.ts
 * 특정 메모 하나에 대한 수정·삭제 액션을 묶어서 제공하는 훅.
 *
 * Memo 컴포넌트가 스토어를 직접 import하는 대신 이 훅을 통해 액션을 받는다.
 * 덕분에 Memo 컴포넌트는 스토어 구조를 몰라도 되고, 테스트 시 이 훅만 모킹하면 된다.
 *
 * @param id - 액션을 적용할 메모의 고유 id
 */

import { useCallback } from 'react';
import { useMemoStore } from '../store/useMemoStore';
import type { MemoColor } from '../types/memo';

export function useMemoActions(id: string) {
  // 스토어에서 원시 액션만 가져온다 (전체 상태를 구독하지 않음 → 불필요한 리렌더 없음)
  const updateMemo = useMemoStore((s) => s.updateMemo);
  const deleteMemo = useMemoStore((s) => s.deleteMemo);

  /**
   * 메모의 본문 텍스트를 변경한다.
   * MemoContent의 onBlur 이벤트에 연결된다.
   * useCallback으로 감싸 id·updateMemo가 바뀌지 않으면 함수 참조를 유지한다.
   */
  const updateContent = useCallback(
    (content: string) => updateMemo(id, { content }),
    [id, updateMemo]
  );

  /**
   * 메모의 배경 색상을 변경한다.
   * ColorPicker의 onChange 이벤트에 연결된다.
   */
  const updateColor = useCallback(
    (color: MemoColor) => updateMemo(id, { color }),
    [id, updateMemo]
  );

  /**
   * 메모를 삭제한다.
   * MemoToolbar의 삭제 버튼 onClick에 연결된다.
   * 함수 이름을 `delete` 대신 `remove`로 사용한 이유: `delete`는 JS 예약어이기 때문.
   */
  const remove = useCallback(() => deleteMemo(id), [id, deleteMemo]);

  return { updateContent, updateColor, remove };
}
