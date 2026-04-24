import { describe, expect, it, vi } from 'vitest';
import type { AdminAppEntryCapabilities } from '@workspace/policy';
import type { AdminAppEntry } from '@/policy/admin-app-capabilities.shared';

function capabilities(
  overrides: Partial<AdminAppEntryCapabilities>
): AdminAppEntryCapabilities {
  return {
    canEnterAdminApp: false,
    mustSignIn: false,
    mustVerifyEmail: false,
    isAdminOnlyDenied: false,
    ...overrides,
  };
}

const guestEntry = {
  kind: 'redirect',
  to: '/signin',
  search: { redirect: '/admin/dashboard' },
  facts: {
    hasSession: false,
    emailVerified: false,
    platformRole: null,
  },
  capabilities: capabilities({ mustSignIn: true }),
} satisfies AdminAppEntry;

const nonAdminEntry = {
  kind: 'accessDenied',
  facts: {
    hasSession: true,
    emailVerified: true,
    platformRole: 'user',
  },
  capabilities: capabilities({ isAdminOnlyDenied: true }),
} satisfies AdminAppEntry;

const adminEntry = {
  kind: 'canEnterAdminApp',
  facts: {
    hasSession: true,
    emailVerified: true,
    platformRole: 'admin',
  },
  capabilities: capabilities({ canEnterAdminApp: true }),
} satisfies AdminAppEntry;

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  redirect: vi.fn((options: unknown) => {
    throw options;
  }),
  Outlet: () => null,
  useNavigate: () => vi.fn(),
}));

vi.mock('@workspace/ui/components/sidebar', () => ({
  SidebarInset: ({ children }: { children: React.ReactNode }) => children,
  SidebarProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/layout', () => ({
  SiteHeader: () => null,
}));

vi.mock('@/components/admin-app-sidebar', () => ({
  AdminAppSidebar: () => null,
}));

vi.mock('@/policy/admin-app-capabilities', () => ({
  useAdminAppEntry: vi.fn(() => ({
    data: undefined,
    error: null,
    isPending: false,
  })),
}));

vi.mock('@/policy/admin-app-capabilities.functions', () => ({
  getAdminAppEntry: vi.fn(),
}));

describe('admin route shell helpers', () => {
  it('keeps /admin entry redirects on admin intent paths', async () => {
    const { getIndexRedirectTarget } = await import('@/routes/admin');

    expect(getIndexRedirectTarget(adminEntry)).toEqual({
      to: '/admin/dashboard',
    });
    expect(getIndexRedirectTarget(guestEntry)).toEqual({
      to: '/signin',
      search: { redirect: '/admin/dashboard' },
    });
    expect(getIndexRedirectTarget(nonAdminEntry)).toEqual({
      to: '/admin/access-denied',
    });
  });

  it('renders the admin shell only for admin entry state', async () => {
    const {
      canRenderProtectedLayout,
      getProtectedLayoutRedirectTarget,
      getProtectedLayoutState,
    } = await import('@/routes/admin/_protected');

    expect(canRenderProtectedLayout(undefined)).toBe(false);
    expect(canRenderProtectedLayout(nonAdminEntry)).toBe(false);
    expect(canRenderProtectedLayout(adminEntry)).toBe(true);
    expect(getProtectedLayoutRedirectTarget(nonAdminEntry)).toEqual({
      to: '/admin/access-denied',
    });
    expect(
      getProtectedLayoutState({
        entry: adminEntry,
        error: null,
        isPending: false,
      })
    ).toBe('ready');
  });
});
