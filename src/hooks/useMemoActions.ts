/**
 * @file useMemoActions.ts
 * Hook that bundles update/delete actions for a single memo.
 *
 * The Memo component receives actions through this hook rather than importing the store directly.
 * This means Memo does not need to know the store shape, and only this hook needs to be mocked in tests.
 *
 * @param id - Unique id of the memo to act on
 */

import { useCallback } from 'react';
import { useMemoStore } from '../store/useMemoStore';
import type { MemoColor } from '../types/memo';

export function useMemoActions(id: string) {
  // Fetch only the raw actions from the store (no full state subscription → no unnecessary re-renders)
  const updateMemo = useMemoStore((s) => s.updateMemo);
  const deleteMemo = useMemoStore((s) => s.deleteMemo);

  /**
   * Updates the body text of the memo.
   * Connected to MemoContent's onBlur event.
   * Wrapped in useCallback to keep the function reference stable when id and updateMemo don't change.
   */
  const updateContent = useCallback(
    (content: string) => updateMemo(id, { content }),
    [id, updateMemo]
  );

  /**
   * Updates the background color of the memo.
   * Connected to ColorPicker's onChange event.
   */
  const updateColor = useCallback(
    (color: MemoColor) => updateMemo(id, { color }),
    [id, updateMemo]
  );

  /**
   * Deletes the memo.
   * Connected to the delete button onClick in MemoToolbar.
   * Named `remove` instead of `delete` because `delete` is a JS reserved word.
   */
  const remove = useCallback(() => deleteMemo(id), [id, deleteMemo]);

  return { updateContent, updateColor, remove };
}
