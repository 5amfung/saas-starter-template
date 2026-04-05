export type PlatformRole = 'admin' | 'user';

export interface AdminAppPolicyContext {
  platformRole: PlatformRole | null;
}

export interface AdminAppCapabilities {
  platformRole: PlatformRole | null;
  canAccessAdminApp: boolean;
  canViewAdminDashboard: boolean;
  canViewUsers: boolean;
  canViewWorkspaces: boolean;
  canManageEntitlementOverrides: boolean;
}

export type AdminAppCapability = keyof Omit<
  AdminAppCapabilities,
  'platformRole'
>;

export function evaluateAdminAppCapabilities(
  context: AdminAppPolicyContext
): AdminAppCapabilities {
  const isPlatformAdmin = context.platformRole === 'admin';
  return {
    platformRole: context.platformRole,
    canAccessAdminApp: isPlatformAdmin,
    canViewAdminDashboard: isPlatformAdmin,
    canViewUsers: isPlatformAdmin,
    canViewWorkspaces: isPlatformAdmin,
    canManageEntitlementOverrides: isPlatformAdmin,
  };
}

export function hasAdminAppCapability(
  capabilities: AdminAppCapabilities,
  capability: AdminAppCapability
): boolean {
  return capabilities[capability];
}
