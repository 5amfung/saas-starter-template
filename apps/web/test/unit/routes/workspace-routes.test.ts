import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insideServerFn: false,
  redirectCalledInsideServerFn: false,
  workspaceIndexRouteTarget: {
    kind: 'redirect',
    to: '/signin',
  } as unknown,
  workspaceRouteAccess: {
    kind: 'redirect',
    to: '/signin',
  } as unknown,
  ensureQueryData: vi.fn(),
  redirect: vi.fn((options: unknown) => {
    if (mocks.insideServerFn) {
      mocks.redirectCalledInsideServerFn = true;
    }
    throw options;
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  notFound: vi.fn((options: unknown) => {
    throw options;
  }),
  redirect: mocks.redirect,
}));

vi.mock('@/workspace/workspace.functions', () => ({
  getWorkspaceById: vi.fn(),
  getWorkspaceIndexRouteTarget: () => {
    mocks.insideServerFn = true;
    try {
      return Promise.resolve(mocks.workspaceIndexRouteTarget);
    } finally {
      mocks.insideServerFn = false;
    }
  },
  getWorkspaceRouteAccess: () => {
    mocks.insideServerFn = true;
    try {
      return Promise.resolve(mocks.workspaceRouteAccess);
    } finally {
      mocks.insideServerFn = false;
    }
  },
}));

describe('workspace routes', () => {
  it('throws workspace index redirects outside the server function boundary', async () => {
    const { Route } = await import('@/routes/_protected/ws/index');
    const route = Route as unknown as { loader: () => Promise<never> };

    await expect(route.loader()).rejects.toEqual({ to: '/signin' });
    expect(mocks.redirect).toHaveBeenCalledWith({ to: '/signin' });
    expect(mocks.redirectCalledInsideServerFn).toBe(false);
  });

  it('throws workspace detail auth redirects outside the server function boundary', async () => {
    const { Route } = await import('@/routes/_protected/ws/$workspaceId');
    const route = Route as unknown as {
      loader: (args: {
        context: {
          queryClient: { ensureQueryData: typeof mocks.ensureQueryData };
        };
        params: { workspaceId: string };
      }) => Promise<never>;
    };

    await expect(
      route.loader({
        context: { queryClient: { ensureQueryData: mocks.ensureQueryData } },
        params: { workspaceId: 'ws-1' },
      })
    ).rejects.toEqual({ to: '/signin' });
    expect(mocks.ensureQueryData).not.toHaveBeenCalled();
    expect(mocks.redirectCalledInsideServerFn).toBe(false);
  });
});
