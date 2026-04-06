import type { WorkspaceRole } from './workspace';

export interface WorkspaceLifecycleContext {
  actorWorkspaceRole: WorkspaceRole | null;
  ownedWorkspaceCount: number;
  hasActiveSubscription: boolean;
}

export interface WorkspaceLifecycleCapabilities {
  canDeleteWorkspace: boolean;
  deleteWorkspaceBlockedReason:
    | 'not-owner'
    | 'active-subscription'
    | 'last-personal-workspace'
    | null;
  canLeaveWorkspace: boolean;
  leaveWorkspaceBlockedReason: 'owner-cannot-leave' | null;
}

export interface WorkspaceMemberRemovalContext extends WorkspaceLifecycleContext {
  targetMemberRole: WorkspaceRole | null;
  targetMemberIsSelf: boolean;
}

export interface WorkspaceMemberRemovalCapabilities {
  canRemoveMember: boolean;
  removeMemberBlockedReason:
    | 'cannot-remove-self'
    | 'cannot-remove-owner'
    | null;
}

export function evaluateWorkspaceLifecycleCapabilities(
  context: WorkspaceLifecycleContext
): WorkspaceLifecycleCapabilities {
  const isOwner = context.actorWorkspaceRole === 'owner';
  const canDeleteWorkspace =
    isOwner &&
    !context.hasActiveSubscription &&
    context.ownedWorkspaceCount > 1;

  return {
    canDeleteWorkspace,
    deleteWorkspaceBlockedReason: !isOwner
      ? 'not-owner'
      : context.hasActiveSubscription
        ? 'active-subscription'
        : context.ownedWorkspaceCount <= 1
          ? 'last-personal-workspace'
          : null,
    canLeaveWorkspace: context.actorWorkspaceRole !== 'owner' &&
      context.actorWorkspaceRole !== null,
    leaveWorkspaceBlockedReason:
      context.actorWorkspaceRole === 'owner' ? 'owner-cannot-leave' : null,
  };
}

export function evaluateWorkspaceMemberRemovalCapabilities(
  context: WorkspaceMemberRemovalContext
): WorkspaceMemberRemovalCapabilities {
  if (context.targetMemberIsSelf) {
    return {
      canRemoveMember: false,
      removeMemberBlockedReason: 'cannot-remove-self',
    };
  }

  if (context.targetMemberRole === 'owner') {
    return {
      canRemoveMember: false,
      removeMemberBlockedReason: 'cannot-remove-owner',
    };
  }

  return {
    canRemoveMember: true,
    removeMemberBlockedReason: null,
  };
}
