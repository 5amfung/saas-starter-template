import { describe, expect, it, vi } from 'vitest';
import type { WebAppEntryCapabilities } from '@workspace/policy';

function capabilities(
  overrides: Partial<WebAppEntryCapabilities>
): WebAppEntryCapabilities {
  return {
    canEnterWebApp: false,
    mustSignIn: false,
    mustVerifyEmail: false,
    mustResolveWorkspace: false,
    ...overrides,
  };
}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  redirect: vi.fn((options: unknown) => {
    throw options;
  }),
  Outlet: () => null,
  useNavigate: () => vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: (...args: Array<unknown>) => unknown) => fn,
  }),
}));

vi.mock('@tabler/icons-react', () => ({
  IconStack2: () => null,
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    signOut: vi.fn(),
    organization: {
      acceptInvitation: vi.fn(),
    },
  },
}));

vi.mock('@workspace/components/auth', () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@workspace/ui/components/sidebar', () => ({
  SidebarInset: ({ children }: { children: React.ReactNode }) => children,
  SidebarProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/layout', () => ({
  SiteHeader: () => null,
}));

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => null,
}));

vi.mock('@/middleware/auth', () => ({
  authMiddleware: {},
  guestMiddleware: {},
}));

vi.mock('@/policy/web-app-entry', () => ({
  useWebAppEntry: vi.fn(() => ({ data: undefined, isPending: false })),
}));

describe('web app entry route helpers', () => {
  it('centralizes root redirects for all entry kinds', async () => {
    const { getWebAppEntryRedirectTarget } =
      await import('@/policy/web-app-entry.shared');

    expect(
      getWebAppEntryRedirectTarget(
        {
          kind: 'blocked',
          reason: 'noAccessibleWorkspaces',
          capabilities: capabilities({ mustResolveWorkspace: true }),
        },
        'root'
      )
    ).toBe('/ws');
  });

  it('keeps guests on guest routes only for sign-in entry state', async () => {
    const { getWebAppEntryRedirectTarget } =
      await import('@/policy/web-app-entry.shared');

    expect(
      getWebAppEntryRedirectTarget(
        {
          kind: 'redirect',
          to: '/signin',
          capabilities: capabilities({ mustSignIn: true }),
        },
        'guest'
      )
    ).toBeNull();

    expect(
      getWebAppEntryRedirectTarget(
        {
          kind: 'canEnterWebApp',
          activeWorkspaceId: 'ws-1',
          capabilities: capabilities({ canEnterWebApp: true }),
        },
        'guest'
      )
    ).toBe('/ws');
  });

  it('sends root guests to sign-in', async () => {
    const { getWebAppEntryRedirectTarget } =
      await import('@/policy/web-app-entry.shared');

    expect(
      getWebAppEntryRedirectTarget(
        {
          kind: 'redirect',
          to: '/signin',
          capabilities: capabilities({ mustSignIn: true }),
        },
        'root'
      )
    ).toBe('/signin');
  });

  it('sends root unverified users to verify', async () => {
    const { getWebAppEntryRedirectTarget } =
      await import('@/policy/web-app-entry.shared');

    expect(
      getWebAppEntryRedirectTarget(
        {
          kind: 'redirect',
          to: '/verify',
          capabilities: capabilities({ mustVerifyEmail: true }),
        },
        'root'
      )
    ).toBe('/verify');
  });

  it('sends root entered users to the workspace shell', async () => {
    const { getWebAppEntryRedirectTarget } =
      await import('@/policy/web-app-entry.shared');

    expect(
      getWebAppEntryRedirectTarget(
        {
          kind: 'canEnterWebApp',
          activeWorkspaceId: 'ws-1',
          capabilities: capabilities({ canEnterWebApp: true }),
        },
        'root'
      )
    ).toBe('/ws');
  });

  it('keeps guests on auth routes and redirects unverified users to verify', async () => {
    const { getAuthEntryRedirectTarget } = await import('@/routes/_auth');

    expect(
      getAuthEntryRedirectTarget({
        kind: 'redirect',
        to: '/signin',
        capabilities: capabilities({ mustSignIn: true }),
      })
    ).toBeNull();

    expect(
      getAuthEntryRedirectTarget({
        kind: 'redirect',
        to: '/verify',
        capabilities: capabilities({ mustVerifyEmail: true }),
      })
    ).toBe('/verify');
  });

  it('sends signed-in auth-route users to the workspace shell', async () => {
    const { getAuthEntryRedirectTarget } = await import('@/routes/_auth');

    expect(
      getAuthEntryRedirectTarget({
        kind: 'mustResolveWorkspace',
        preferredWorkspace: { id: 'ws-1' },
        capabilities: capabilities({ mustResolveWorkspace: true }),
      })
    ).toBe('/ws');
  });

  it('blocks auth layout rendering on entry query error or missing hydrated entry', async () => {
    const { getAuthPageState } = await import('@/routes/_auth');

    expect(
      getAuthPageState({
        entry: undefined,
        isPending: false,
        error: new Error('request failed'),
      })
    ).toMatchObject({ kind: 'blocked' });

    expect(
      getAuthPageState({
        entry: undefined,
        isPending: false,
        error: null,
      })
    ).toMatchObject({ kind: 'blocked' });
  });

  it('renders the protected shell only for allowed entry states', async () => {
    const { canRenderProtectedLayout } = await import('@/routes/_protected');

    expect(canRenderProtectedLayout(undefined)).toBe(false);
    expect(
      canRenderProtectedLayout({
        kind: 'redirect',
        to: '/signin',
        capabilities: capabilities({ mustSignIn: true }),
      })
    ).toBe(false);
    expect(
      canRenderProtectedLayout({
        kind: 'canEnterWebApp',
        activeWorkspaceId: 'ws-1',
        capabilities: capabilities({ canEnterWebApp: true }),
      })
    ).toBe(true);
  });

  it('treats protected-layout query errors and non-enter states as blocked', async () => {
    const { getProtectedLayoutState } = await import('@/routes/_protected');

    expect(
      getProtectedLayoutState({
        entry: undefined,
        isPending: false,
        error: new Error('request failed'),
      })
    ).toBe('blocked');

    expect(
      getProtectedLayoutState({
        entry: {
          kind: 'redirect',
          to: '/signin',
          capabilities: capabilities({ mustSignIn: true }),
        },
        isPending: false,
        error: null,
      })
    ).toBe('blocked');
  });

  it('converts web-app entry states into explicit invite-entry outcomes', async () => {
    const { resolveInviteEntryOutcome } =
      await import('@/routes/accept-invite');

    expect(
      resolveInviteEntryOutcome({
        kind: 'redirect',
        to: '/signin',
        capabilities: capabilities({ mustSignIn: true }),
      })
    ).toEqual({
      kind: 'redirectToSignup',
      reason: 'missingSession',
    });

    expect(
      resolveInviteEntryOutcome({
        kind: 'redirect',
        to: '/verify',
        capabilities: capabilities({ mustVerifyEmail: true }),
      })
    ).toEqual({
      kind: 'redirectToSignup',
      reason: 'unverifiedSession',
    });

    expect(
      resolveInviteEntryOutcome({
        kind: 'blocked',
        reason: 'noAccessibleWorkspaces',
        capabilities: capabilities({ mustResolveWorkspace: true }),
      })
    ).toEqual({
      kind: 'acceptInvite',
    });

    expect(
      resolveInviteEntryOutcome({
        kind: 'mustResolveWorkspace',
        preferredWorkspace: { id: 'ws-1' },
        capabilities: capabilities({ mustResolveWorkspace: true }),
      })
    ).toEqual({
      kind: 'acceptInvite',
    });
  });
});
