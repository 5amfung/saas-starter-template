import { APIError } from 'better-auth/api';
import {
  evaluateWorkspaceLifecycleCapabilities,
  evaluateWorkspaceMemberRemovalCapabilities,
  evaluateWorkspaceOwnershipTransferCapabilities,
} from '@workspace/policy';
import type {
  WorkspaceLifecycleCapabilities,
  WorkspaceLifecycleContext,
  WorkspaceMemberRemovalCapabilities,
  WorkspaceOwnershipTransferCapabilities,
  WorkspaceRole,
} from '@workspace/policy';
import { getWorkspaceBillingData } from '@/billing/billing.server';
import {
  countOwnedWorkspaces,
  ensureWorkspaceMembership,
  getActiveMemberRole,
  getWorkspaceMemberById,
} from '@/workspace/workspace.server';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

function normalizeWorkspaceRole(role: string | null): WorkspaceRole | null {
  if (role === 'owner' || role === 'admin' || role === 'member') {
    return role;
  }
  return null;
}

async function getWorkspaceLifecycleContext(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<WorkspaceLifecycleContext> {
  await ensureWorkspaceMembership(headers, workspaceId);

  const [workspaceRole, ownedWorkspaceCount, billing] = await Promise.all([
    getActiveMemberRole(headers, workspaceId, userId),
    countOwnedWorkspaces(headers, userId),
    getWorkspaceBillingData(headers, workspaceId),
  ]);

  return {
    actorWorkspaceRole: normalizeWorkspaceRole(workspaceRole),
    ownedWorkspaceCount,
    hasActiveSubscription:
      billing.planId !== 'free' &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(billing.subscription?.status ?? ''),
  };
}

export async function getWorkspaceLifecycleCapabilitiesForUser(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<WorkspaceLifecycleCapabilities> {
  return evaluateWorkspaceLifecycleCapabilities(
    await getWorkspaceLifecycleContext(headers, workspaceId, userId)
  );
}

export async function requireWorkspaceDeleteAllowedForUser(
  headers: Headers,
  workspaceId: string,
  userId: string
) {
  const capabilities = await getWorkspaceLifecycleCapabilitiesForUser(
    headers,
    workspaceId,
    userId
  );

  if (!capabilities.canDeleteWorkspace) {
    throw new APIError('FORBIDDEN', {
      message: `forbidden: delete workspace blocked (${capabilities.deleteWorkspaceBlockedReason ?? 'unknown'})`,
    });
  }

  return capabilities;
}

export async function requireWorkspaceLeaveAllowedForUser(
  headers: Headers,
  workspaceId: string,
  userId: string
) {
  const capabilities = await getWorkspaceLifecycleCapabilitiesForUser(
    headers,
    workspaceId,
    userId
  );

  if (!capabilities.canLeaveWorkspace) {
    throw new APIError('FORBIDDEN', {
      message: `forbidden: leave workspace blocked (${capabilities.leaveWorkspaceBlockedReason ?? 'unknown'})`,
    });
  }

  return capabilities;
}

export async function getWorkspaceMemberRemovalCapabilitiesForUser(
  headers: Headers,
  workspaceId: string,
  userId: string,
  memberId: string
): Promise<WorkspaceMemberRemovalCapabilities> {
  await ensureWorkspaceMembership(headers, workspaceId);

  const [workspaceRole, targetMember] = await Promise.all([
    getActiveMemberRole(headers, workspaceId, userId),
    getWorkspaceMemberById(headers, workspaceId, memberId),
  ]);

  if (!targetMember) {
    throw new APIError('NOT_FOUND', {
      message: 'Workspace member not found.',
    });
  }

  return evaluateWorkspaceMemberRemovalCapabilities({
    actorWorkspaceRole: normalizeWorkspaceRole(workspaceRole),
    ownedWorkspaceCount: 0,
    hasActiveSubscription: false,
    targetMemberRole: normalizeWorkspaceRole(targetMember.role),
    targetMemberIsSelf: targetMember.userId === userId,
  });
}

export async function requireWorkspaceMemberRemovalAllowedForUser(
  headers: Headers,
  workspaceId: string,
  userId: string,
  memberId: string
) {
  const capabilities = await getWorkspaceMemberRemovalCapabilitiesForUser(
    headers,
    workspaceId,
    userId,
    memberId
  );

  if (!capabilities.canRemoveMember) {
    throw new APIError('FORBIDDEN', {
      message: `forbidden: remove member blocked (${capabilities.removeMemberBlockedReason ?? 'unknown'})`,
    });
  }

  return capabilities;
}

export async function getWorkspaceOwnershipTransferCapabilitiesForUser(
  headers: Headers,
  workspaceId: string,
  userId: string,
  memberId: string
): Promise<WorkspaceOwnershipTransferCapabilities> {
  await ensureWorkspaceMembership(headers, workspaceId);

  const [workspaceRole, targetMember] = await Promise.all([
    getActiveMemberRole(headers, workspaceId, userId),
    getWorkspaceMemberById(headers, workspaceId, memberId),
  ]);

  if (!targetMember) {
    throw new APIError('NOT_FOUND', {
      message: 'Workspace member not found.',
    });
  }

  const targetMemberRole = normalizeWorkspaceRole(targetMember.role);
  if (!targetMemberRole) {
    throw new APIError('INTERNAL_SERVER_ERROR', {
      message: 'Workspace member has an unknown role.',
    });
  }

  return evaluateWorkspaceOwnershipTransferCapabilities({
    actorWorkspaceRole: normalizeWorkspaceRole(workspaceRole),
    targetMember: {
      targetMemberExists: true,
      targetMemberRole,
      targetMemberIsSelf: targetMember.userId === userId,
    },
  });
}

export async function requireWorkspaceOwnershipTransferAllowedForUser(
  headers: Headers,
  workspaceId: string,
  userId: string,
  memberId: string
) {
  const capabilities = await getWorkspaceOwnershipTransferCapabilitiesForUser(
    headers,
    workspaceId,
    userId,
    memberId
  );

  if (!capabilities.canTransferWorkspaceOwnership) {
    throw new APIError('FORBIDDEN', {
      message: `forbidden: transfer ownership blocked (${capabilities.transferWorkspaceOwnershipBlockedReason ?? 'unknown'})`,
    });
  }

  return capabilities;
}
