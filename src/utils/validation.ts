/**
 * @file validation.ts
 * Type guard for imported/parsed data.
 */

import type { Memo } from '../types/memo';

/** Returns true if `m` has the minimum required fields to be treated as a Memo. */
export function isValidMemo(m: unknown): m is Memo {
  return (
    m !== null &&
    typeof m === 'object' &&
    typeof (m as Record<string, unknown>).id === 'string' &&
    typeof (m as Record<string, unknown>).content === 'string'
  );
}
