// test/mocks/router.ts
import * as React from 'react';

/**
 * Creates hoisted router mock functions.
 */
export function createRouterMocks() {
  return {
    navigate: vi.fn(),
    redirect: vi.fn((opts: unknown) => {
      throw opts;
    }),
  };
}

/**
 * Creates a simple Link mock that renders an anchor tag.
 * Suitable for tests that only need basic navigation rendering.
 */
export function createRouterLinkMock() {
  return ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children);
}
