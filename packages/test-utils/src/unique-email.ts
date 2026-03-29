/**
 * Generates a collision-free email address for E2E tests.
 *
 * Each call produces a unique address using a timestamp + random suffix,
 * ensuring parallel test workers never collide.
 *
 * @param prefix - Optional prefix to identify the test context (e.g. "signin", "billing").
 */
export function uniqueEmail(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
}
