import { describe, expect, it, vi } from 'vitest';
import type { WebAppEntry } from '@/policy/web-app-entry.shared';

const mocks = vi.hoisted(() => ({
  getCurrentWebAppEntry: vi.fn(),
  insideServerFn: false,
  redirectCalledInsideServerFn: false,
  redirect: vi.fn((options: unknown) => {
    if (mocks.insideServerFn) {
      mocks.redirectCalledInsideServerFn = true;
    }
    throw options;
  }),
}));

const guestEntry = {
  kind: 'redirect',
  to: '/signin',
  capabilities: {
    canEnterWebApp: false,
    mustSignIn: true,
    mustVerifyEmail: false,
    mustResolveWorkspace: false,
  },
} satisfies WebAppEntry;

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  redirect: mocks.redirect,
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: () => Promise<unknown>) => async () => {
      mocks.insideServerFn = true;
      try {
        return await fn();
      } finally {
        mocks.insideServerFn = false;
      }
    },
  }),
}));

vi.mock('@/policy/web-app-entry.server', () => ({
  getCurrentWebAppEntry: mocks.getCurrentWebAppEntry,
}));

describe('root route', () => {
  it('throws root redirects outside the server function boundary', async () => {
    mocks.getCurrentWebAppEntry.mockResolvedValue(guestEntry);

    const { Route } = await import('@/routes/index');
    const route = Route as unknown as { beforeLoad: () => Promise<never> };

    await expect(route.beforeLoad()).rejects.toEqual({ to: '/signin' });
    expect(mocks.redirect).toHaveBeenCalledWith({ to: '/signin' });
    expect(mocks.redirectCalledInsideServerFn).toBe(false);
  });
});
