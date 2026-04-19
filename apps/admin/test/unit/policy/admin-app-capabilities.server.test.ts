import { APIError } from 'better-auth/api';
import { createMockSessionResponse } from '@workspace/test-utils';
import {
  getCurrentAdminAppCapabilities,
  getCurrentAdminAppEntry,
  requireAdminAnalyticsCapability,
  requireAdminDeleteUsersCapability,
  requireAdminManageEntitlementOverridesCapability,
  requireAdminManageUsersCapability,
  requireAdminViewUsersCapability,
  requireCurrentAdminAppCapability,
  requireCurrentAdminAppEntry,
} from '@/policy/admin-app-capabilities.server';
import { getAdminAppCapabilitiesForSession } from '@/policy/admin-app-capabilities.shared';

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  redirect: vi.fn((options: unknown) => {
    throw { options };
  }),
  Outlet: () => null,
  useNavigate: () => vi.fn(),
}));

vi.mock('@workspace/components/auth', () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@workspace/ui/components/sidebar', () => ({
  SidebarInset: ({ children }: { children: React.ReactNode }) => children,
  SidebarProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@workspace/components/layout', () => ({
  SiteHeader: () => null,
}));

vi.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => null,
}));

vi.mock('@/middleware/auth', () => ({
  authMiddleware: {},
  guestMiddleware: {},
}));

vi.mock('@/init', () => ({
  getAuth: () => ({
    api: {
      getSession: mockGetSession,
    },
  }),
}));

describe('admin-app-capabilities.server', () => {
  const headers = new Headers({ cookie: 'test' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('derives admin-app capabilities directly from session facts', () => {
    const adminCapabilities = getAdminAppCapabilitiesForSession(
      createMockSessionResponse({ role: 'admin' })
    );
    const unverifiedAdminCapabilities = getAdminAppCapabilitiesForSession(
      createMockSessionResponse({ role: 'admin', emailVerified: false })
    );
    const userCapabilities = getAdminAppCapabilitiesForSession(
      createMockSessionResponse({ role: 'user' })
    );

    expect(adminCapabilities.canAccessAdminApp).toBe(true);
    expect(adminCapabilities.canViewDashboard).toBe(true);
    expect(adminCapabilities.canViewAnalytics).toBe(true);
    expect(adminCapabilities.canManageUsers).toBe(true);
    expect(adminCapabilities.canDeleteUsers).toBe(true);
    expect(adminCapabilities.canViewWorkspaceBilling).toBe(true);
    expect(adminCapabilities.canPerformSupportActions).toBe(true);
    expect(adminCapabilities.canManageEntitlementOverrides).toBe(true);
    expect(unverifiedAdminCapabilities.canAccessAdminApp).toBe(false);
    expect(unverifiedAdminCapabilities.canViewUsers).toBe(false);
    expect(unverifiedAdminCapabilities.platformRole).toBe('admin');
    expect(userCapabilities.canAccessAdminApp).toBe(false);
    expect(userCapabilities.canViewUsers).toBe(false);
  });

  it('loads admin-app capabilities for the current session', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ role: 'admin' })
    );

    const capabilities = await getCurrentAdminAppCapabilities(headers);

    expect(mockGetSession).toHaveBeenCalledWith({ headers });
    expect(capabilities.canAccessAdminApp).toBe(true);
    expect(capabilities.canViewDashboard).toBe(true);
    expect(capabilities.canManageEntitlementOverrides).toBe(true);
  });

  it('denies admin-app capabilities for non-admin platform users', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ role: 'user' })
    );

    const capabilities = await getCurrentAdminAppCapabilities(headers);

    expect(capabilities.canAccessAdminApp).toBe(false);
    expect(capabilities.canViewUsers).toBe(false);
    expect(capabilities.canManageUsers).toBe(false);
  });

  it('denies admin-app capabilities for unverified admin-shaped sessions', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ role: 'admin', emailVerified: false })
    );

    const capabilities = await getCurrentAdminAppCapabilities(headers);

    expect(capabilities.canAccessAdminApp).toBe(false);
    expect(capabilities.canManageEntitlementOverrides).toBe(false);
    expect(capabilities.canDeleteUsers).toBe(false);
  });

  it('resolves guests to a sign-in redirect entry', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const entry = await getCurrentAdminAppEntry(headers);

    expect(entry).toMatchObject({
      kind: 'redirect',
      to: '/signin',
      capabilities: {
        canEnterAdminApp: false,
        mustSignIn: true,
        mustVerifyEmail: false,
        isAdminOnlyDenied: false,
      },
    });
  });

  it('resolves unverified users to a verify redirect entry', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ role: 'user', emailVerified: false })
    );

    const entry = await getCurrentAdminAppEntry(headers);

    expect(entry).toMatchObject({
      kind: 'redirect',
      to: '/verify',
      capabilities: {
        canEnterAdminApp: false,
        mustSignIn: false,
        mustVerifyEmail: true,
        isAdminOnlyDenied: false,
      },
    });
  });

  it('resolves verified non-admin users to an admin-only denial entry', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ role: 'user' })
    );

    const entry = await getCurrentAdminAppEntry(headers);

    expect(entry).toMatchObject({
      kind: 'redirect',
      to: '/signin',
      search: { error: 'admin_only' },
      capabilities: {
        canEnterAdminApp: false,
        mustSignIn: false,
        mustVerifyEmail: false,
        isAdminOnlyDenied: true,
      },
    });
  });

  it('resolves verified admins to dashboard access entry state', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ role: 'admin' })
    );

    const entry = await getCurrentAdminAppEntry(headers);

    expect(entry).toMatchObject({
      kind: 'canEnterAdminApp',
      capabilities: {
        canEnterAdminApp: true,
        mustSignIn: false,
        mustVerifyEmail: false,
        isAdminOnlyDenied: false,
      },
    });
  });

  it('throws redirect from requireCurrentAdminAppEntry when entry cannot access the admin app', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ role: 'user' })
    );

    const denied = requireCurrentAdminAppEntry(headers);

    await expect(denied).rejects.toMatchObject({
      options: {
        to: '/signin',
        search: { error: 'admin_only' },
      },
    });
  });

  it('throws a forbidden APIError when a required capability is missing', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ role: 'user' })
    );

    const denied = requireCurrentAdminAppCapability('canViewUsers', headers);

    await expect(denied).rejects.toBeInstanceOf(APIError);
    await expect(denied).rejects.toMatchObject({
      message: 'forbidden: missing admin app capability canViewUsers',
    });
  });

  it('allows richer operational capabilities for verified admins', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ role: 'admin' })
    );

    await expect(
      requireCurrentAdminAppCapability('canDeleteUsers', headers)
    ).resolves.toMatchObject({
      canDeleteUsers: true,
      canManageUsers: true,
    });
  });

  it('exposes focused capability guard helpers for admin operations', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ role: 'admin' })
    );

    await expect(
      requireAdminViewUsersCapability(headers)
    ).resolves.toMatchObject({
      canViewUsers: true,
    });
    await expect(
      requireAdminManageUsersCapability(headers)
    ).resolves.toMatchObject({
      canManageUsers: true,
    });
    await expect(
      requireAdminDeleteUsersCapability(headers)
    ).resolves.toMatchObject({
      canDeleteUsers: true,
    });
    await expect(
      requireAdminManageEntitlementOverridesCapability(headers)
    ).resolves.toMatchObject({
      canManageEntitlementOverrides: true,
    });
    await expect(
      requireAdminAnalyticsCapability(headers)
    ).resolves.toMatchObject({
      canViewAnalytics: true,
    });
  });

  it('maps root entry redirects to the expected admin destinations', async () => {
    const { getIndexRedirectTarget } = await import('@/routes/index');

    expect(
      getIndexRedirectTarget({
        kind: 'redirect',
        to: '/signin',
        facts: {
          hasSession: false,
          emailVerified: false,
          platformRole: null,
        },
        capabilities: {
          canEnterAdminApp: false,
          mustSignIn: true,
          mustVerifyEmail: false,
          isAdminOnlyDenied: false,
        },
      })
    ).toEqual({ to: '/signin' });

    expect(
      getIndexRedirectTarget({
        kind: 'redirect',
        to: '/verify',
        facts: {
          hasSession: true,
          emailVerified: false,
          platformRole: 'user',
        },
        capabilities: {
          canEnterAdminApp: false,
          mustSignIn: false,
          mustVerifyEmail: true,
          isAdminOnlyDenied: false,
        },
      })
    ).toEqual({ to: '/verify' });

    expect(
      getIndexRedirectTarget({
        kind: 'redirect',
        to: '/signin',
        search: { error: 'admin_only' },
        facts: {
          hasSession: true,
          emailVerified: true,
          platformRole: 'user',
        },
        capabilities: {
          canEnterAdminApp: false,
          mustSignIn: false,
          mustVerifyEmail: false,
          isAdminOnlyDenied: true,
        },
      })
    ).toEqual({ to: '/signin', search: { error: 'admin_only' } });

    expect(
      getIndexRedirectTarget({
        kind: 'canEnterAdminApp',
        facts: {
          hasSession: true,
          emailVerified: true,
          platformRole: 'admin',
        },
        capabilities: {
          canEnterAdminApp: true,
          mustSignIn: false,
          mustVerifyEmail: false,
          isAdminOnlyDenied: false,
        },
      })
    ).toEqual({ to: '/dashboard' });
  });

  it('redirects auth layout only for admin-capable sessions', async () => {
    const { getAuthEntryRedirectTarget } = await import('@/routes/_auth');

    expect(
      getAuthEntryRedirectTarget({
        kind: 'redirect',
        to: '/signin',
        facts: {
          hasSession: false,
          emailVerified: false,
          platformRole: null,
        },
        capabilities: {
          canEnterAdminApp: false,
          mustSignIn: true,
          mustVerifyEmail: false,
          isAdminOnlyDenied: false,
        },
      })
    ).toBeNull();

    expect(
      getAuthEntryRedirectTarget({
        kind: 'redirect',
        to: '/verify',
        facts: {
          hasSession: true,
          emailVerified: false,
          platformRole: 'user',
        },
        capabilities: {
          canEnterAdminApp: false,
          mustSignIn: false,
          mustVerifyEmail: true,
          isAdminOnlyDenied: false,
        },
      })
    ).toBeNull();

    expect(
      getAuthEntryRedirectTarget({
        kind: 'redirect',
        to: '/signin',
        search: { error: 'admin_only' },
        facts: {
          hasSession: true,
          emailVerified: true,
          platformRole: 'user',
        },
        capabilities: {
          canEnterAdminApp: false,
          mustSignIn: false,
          mustVerifyEmail: false,
          isAdminOnlyDenied: true,
        },
      })
    ).toBeNull();

    expect(
      getAuthEntryRedirectTarget({
        kind: 'canEnterAdminApp',
        facts: {
          hasSession: true,
          emailVerified: true,
          platformRole: 'admin',
        },
        capabilities: {
          canEnterAdminApp: true,
          mustSignIn: false,
          mustVerifyEmail: false,
          isAdminOnlyDenied: false,
        },
      })
    ).toEqual({ to: '/dashboard' });
  });

  it('blocks auth layout rendering on missing hydrated entry or query error', async () => {
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

  it('treats protected-layout query errors and missing/non-enter states as blocked', async () => {
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
        entry: undefined,
        isPending: false,
        error: null,
      })
    ).toBe('blocked');

    expect(
      getProtectedLayoutState({
        entry: {
          kind: 'redirect',
          to: '/signin',
          capabilities: {
            canEnterAdminApp: false,
            mustSignIn: true,
            mustVerifyEmail: false,
            isAdminOnlyDenied: false,
          },
          facts: {
            hasSession: false,
            emailVerified: false,
            platformRole: null,
          },
        },
        isPending: false,
        error: null,
      })
    ).toBe('blocked');
  });

  it('maps protected layout redirects from entry state', async () => {
    const { getProtectedLayoutRedirectTarget } =
      await import('@/routes/_protected');

    expect(
      getProtectedLayoutRedirectTarget({
        kind: 'redirect',
        to: '/signin',
        search: { error: 'admin_only' },
        capabilities: {
          canEnterAdminApp: false,
          mustSignIn: false,
          mustVerifyEmail: false,
          isAdminOnlyDenied: true,
        },
        facts: {
          hasSession: true,
          emailVerified: true,
          platformRole: 'user',
        },
      })
    ).toEqual({ to: '/signin', search: { error: 'admin_only' } });

    expect(
      getProtectedLayoutRedirectTarget({
        kind: 'canEnterAdminApp',
        capabilities: {
          canEnterAdminApp: true,
          mustSignIn: false,
          mustVerifyEmail: false,
          isAdminOnlyDenied: false,
        },
        facts: {
          hasSession: true,
          emailVerified: true,
          platformRole: 'admin',
        },
      })
    ).toBeNull();
  });
});
