import { describe, expect, it } from 'vitest';
import {
  evaluateAdminAppCapabilities,
  hasAdminAppCapability,
} from '../../src/admin-app';
import type { AdminAppPolicyContext } from '../../src/admin-app';

describe('evaluateAdminAppCapabilities', () => {
  it('denies non-admin platform users', () => {
    const capabilities = evaluateAdminAppCapabilities({
      platformRole: 'user',
    } satisfies AdminAppPolicyContext);

    expect(capabilities.canAccessAdminApp).toBe(false);
    expect(capabilities.canViewAdminDashboard).toBe(false);
    expect(capabilities.canViewUsers).toBe(false);
    expect(capabilities.canViewWorkspaces).toBe(false);
    expect(capabilities.canManageEntitlementOverrides).toBe(false);
  });

  it('grants platform admins access to admin-app operations', () => {
    const capabilities = evaluateAdminAppCapabilities({
      platformRole: 'admin',
    } satisfies AdminAppPolicyContext);

    expect(capabilities.canAccessAdminApp).toBe(true);
    expect(capabilities.canViewAdminDashboard).toBe(true);
    expect(capabilities.canViewUsers).toBe(true);
    expect(capabilities.canViewWorkspaces).toBe(true);
    expect(capabilities.canManageEntitlementOverrides).toBe(true);
    expect(hasAdminAppCapability(capabilities, 'canViewWorkspaces')).toBe(true);
  });
});
