/**
 * @file generateId.ts
 * Isolates unique ID generation logic in one place.
 * Replacing the ID generation strategy or mocking it in tests only requires changing this file.
 */

/**
 * Returns a unique ID used throughout the app.
 *
 * Priority:
 * 1. `crypto.randomUUID()` — built-in browser API, RFC 4122 UUID v4 format.
 *    Collision probability is effectively zero and requires no third-party library.
 * 2. Fallback — in environments without the crypto API (legacy browsers, some test environments),
 *    combines Math.random() and Date.now() to maximize uniqueness.
 *    (Not a true UUID, but sufficient for a memo app)
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Convert to base-36, strip the leading '0.', then append a timestamp
  // so IDs generated within the same millisecond don't collide.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
