import { describe, expect, it } from 'vitest';
import {
  evaluateAdminAppCapabilities,
  hasAdminAppCapability,
} from '../../src/admin-app';

describe('evaluateAdminAppCapabilities operational coverage', () => {
  it('grants operational read, modify, support, and destructive capabilities to admins', () => {
    const capabilities = evaluateAdminAppCapabilities({
      platformRole: 'admin',
    });

    expect(capabilities.canAccessAdminApp).toBe(true);
    expect(capabilities.canViewDashboard).toBe(true);
    expect(capabilities.canViewAnalytics).toBe(true);
    expect(capabilities.canViewUsers).toBe(true);
    expect(capabilities.canManageUsers).toBe(true);
    expect(capabilities.canDeleteUsers).toBe(true);
    expect(capabilities.canViewWorkspaces).toBe(true);
    expect(capabilities.canViewWorkspaceBilling).toBe(true);
    expect(capabilities.canManageEntitlementOverrides).toBe(true);
    expect(capabilities.canPerformSupportActions).toBe(true);
    expect(hasAdminAppCapability(capabilities, 'canDeleteUsers')).toBe(true);
  });

  it('denies operational capabilities to non-admins', () => {
    const capabilities = evaluateAdminAppCapabilities({
      platformRole: 'user',
    });

    expect(capabilities.canAccessAdminApp).toBe(false);
    expect(capabilities.canViewDashboard).toBe(false);
    expect(capabilities.canViewAnalytics).toBe(false);
    expect(capabilities.canViewUsers).toBe(false);
    expect(capabilities.canManageUsers).toBe(false);
    expect(capabilities.canDeleteUsers).toBe(false);
    expect(capabilities.canViewWorkspaces).toBe(false);
    expect(capabilities.canViewWorkspaceBilling).toBe(false);
    expect(capabilities.canManageEntitlementOverrides).toBe(false);
    expect(capabilities.canPerformSupportActions).toBe(false);
  });
});
