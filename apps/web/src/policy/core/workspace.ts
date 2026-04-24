export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspacePolicyContext {
  workspaceRole: WorkspaceRole | null;
  isLastWorkspace: boolean;
  hasActiveSubscription: boolean;
}

export interface WorkspaceCapabilities {
  workspaceRole: WorkspaceRole | null;
  canViewOverview: boolean;
  canViewProjects: boolean;
  canViewMembers: boolean;
  canViewSettings: boolean;
  canViewBilling: boolean;
  canViewIntegrations: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
  canManageBilling: boolean;
  canManageIntegrations: boolean;
  canDeleteWorkspace: boolean;
  deleteWorkspaceBlockedReason:
    | 'not-owner'
    | 'active-subscription'
    | 'last-workspace'
    | null;
}

export interface WorkspaceRoleOnlyCapabilities {
  workspaceRole: WorkspaceRole | null;
  canViewOverview: boolean;
  canViewProjects: boolean;
  canViewMembers: boolean;
  canViewSettings: boolean;
  canViewBilling: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
  canManageBilling: boolean;
}

export type WorkspaceCapability = keyof Omit<
  WorkspaceCapabilities,
  'workspaceRole' | 'deleteWorkspaceBlockedReason'
>;

const emptyAccessCapabilities = (
  workspaceRole: WorkspaceRole | null
): WorkspaceRoleOnlyCapabilities => ({
  workspaceRole,
  canViewOverview: false,
  canViewProjects: false,
  canViewMembers: false,
  canViewSettings: false,
  canViewBilling: false,
  canInviteMembers: false,
  canManageMembers: false,
  canManageSettings: false,
  canManageBilling: false,
});

const emptyCapabilities = (
  workspaceRole: WorkspaceRole | null
): WorkspaceCapabilities => ({
  workspaceRole,
  canViewOverview: false,
  canViewProjects: false,
  canViewMembers: false,
  canViewSettings: false,
  canViewBilling: false,
  canViewIntegrations: false,
  canInviteMembers: false,
  canManageMembers: false,
  canManageSettings: false,
  canManageBilling: false,
  canManageIntegrations: false,
  canDeleteWorkspace: false,
  deleteWorkspaceBlockedReason:
    workspaceRole === 'owner' ? 'active-subscription' : 'not-owner',
});

/**
 * Evaluates the role-only workspace permission set.
 * This path depends only on the actor's normalized workspace role.
 */
export function evaluateWorkspaceRoleOnlyCapabilities(
  workspaceRole: WorkspaceRole | null
): WorkspaceRoleOnlyCapabilities {
  if (!workspaceRole) return emptyAccessCapabilities(null);

  if (workspaceRole === 'member') {
    return {
      ...emptyAccessCapabilities(workspaceRole),
      canViewOverview: true,
      canViewProjects: true,
      canViewMembers: true,
    };
  }

  return {
    ...emptyAccessCapabilities(workspaceRole),
    canViewOverview: true,
    canViewProjects: true,
    canViewMembers: true,
    canViewSettings: true,
    canViewBilling: true,
    canInviteMembers: true,
    canManageMembers: true,
    canManageSettings: true,
    canManageBilling: true,
  };
}

export function evaluateWorkspaceCapabilities(
  context: WorkspacePolicyContext
): WorkspaceCapabilities {
  const { workspaceRole, isLastWorkspace, hasActiveSubscription } = context;
  if (!workspaceRole) return emptyCapabilities(null);

  const roleOnlyCapabilities =
    evaluateWorkspaceRoleOnlyCapabilities(workspaceRole);

  if (workspaceRole === 'member') {
    return {
      ...emptyCapabilities(workspaceRole),
      ...roleOnlyCapabilities,
      deleteWorkspaceBlockedReason: 'not-owner',
    };
  }

  const baseAdminCapabilities: WorkspaceCapabilities = {
    ...emptyCapabilities(workspaceRole),
    ...roleOnlyCapabilities,
    canViewIntegrations: hasActiveSubscription,
    canManageIntegrations: hasActiveSubscription,
    canDeleteWorkspace: false,
    deleteWorkspaceBlockedReason: 'not-owner',
  };

  if (workspaceRole === 'admin') return baseAdminCapabilities;

  return {
    ...baseAdminCapabilities,
    workspaceRole,
    canDeleteWorkspace: !isLastWorkspace && !hasActiveSubscription,
    deleteWorkspaceBlockedReason: hasActiveSubscription
      ? 'active-subscription'
      : isLastWorkspace
        ? 'last-workspace'
        : null,
  };
}

export function hasWorkspaceCapability(
  capabilities: WorkspaceCapabilities,
  capability: WorkspaceCapability
): boolean {
  return capabilities[capability];
}
