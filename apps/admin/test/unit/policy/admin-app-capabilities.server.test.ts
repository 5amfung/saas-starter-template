import { APIError } from 'better-auth/api';
import { createMockSessionResponse } from '@workspace/test-utils';
import {
  getCurrentAdminAppCapabilities,
  requireCurrentAdminAppCapability,
} from '@/policy/admin-app-capabilities.server';
import { getAdminAppCapabilitiesForSession } from '@/policy/admin-app-capabilities.shared';

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
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
    expect(adminCapabilities.canManageEntitlementOverrides).toBe(true);
    expect(unverifiedAdminCapabilities.canAccessAdminApp).toBe(false);
    expect(unverifiedAdminCapabilities.canViewUsers).toBe(false);
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
    expect(capabilities.canManageEntitlementOverrides).toBe(true);
  });

  it('denies admin-app capabilities for non-admin platform users', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ role: 'user' })
    );

    const capabilities = await getCurrentAdminAppCapabilities(headers);

    expect(capabilities.canAccessAdminApp).toBe(false);
    expect(capabilities.canViewUsers).toBe(false);
  });

  it('denies admin-app capabilities for unverified admin-shaped sessions', async () => {
    mockGetSession.mockResolvedValueOnce(
      createMockSessionResponse({ role: 'admin', emailVerified: false })
    );

    const capabilities = await getCurrentAdminAppCapabilities(headers);

    expect(capabilities.canAccessAdminApp).toBe(false);
    expect(capabilities.canManageEntitlementOverrides).toBe(false);
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
});
