import { APIError } from 'better-auth/api';
import {
  evaluateWorkspaceCapabilities,
  hasWorkspaceCapability,
} from '@workspace/policy';
import type {
  WorkspaceCapabilities,
  WorkspaceCapability,
  WorkspaceRole,
} from '@workspace/policy';
import { getWorkspaceBillingData } from '@/billing/billing.server';
import {
  ensureWorkspaceMembership,
  getActiveMemberRole,
  listUserWorkspaces,
} from '@/workspace/workspace.server';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

function normalizeWorkspaceRole(role: string | null): WorkspaceRole | null {
  if (role === 'owner' || role === 'admin' || role === 'member') {
    return role;
  }
  return null;
}

export async function getWorkspaceAccessCapabilitiesForUser(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<WorkspaceCapabilities> {
  await ensureWorkspaceMembership(headers, workspaceId);
  const workspaceRole = await getActiveMemberRole(headers, workspaceId, userId);

  // Access-only checks should not depend on billing state. We force the
  // delete capability closed here so callers cannot accidentally use this
  // lightweight snapshot for delete decisions.
  return evaluateWorkspaceCapabilities({
    workspaceRole: normalizeWorkspaceRole(workspaceRole),
    isLastWorkspace: false,
    hasActiveSubscription: true,
  });
}

export async function getWorkspaceCapabilitiesForUser(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<WorkspaceCapabilities> {
  await ensureWorkspaceMembership(headers, workspaceId);
  const [workspaceRole, workspaces, billing] = await Promise.all([
    getActiveMemberRole(headers, workspaceId, userId),
    listUserWorkspaces(headers),
    getWorkspaceBillingData(headers, workspaceId),
  ]);

  return evaluateWorkspaceCapabilities({
    workspaceRole: normalizeWorkspaceRole(workspaceRole),
    isLastWorkspace: workspaces.length <= 1,
    hasActiveSubscription:
      billing.planId !== 'free' &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(billing.subscription?.status ?? ''),
  });
}

export async function requireWorkspaceCapabilityForUser(
  headers: Headers,
  workspaceId: string,
  userId: string,
  capability: WorkspaceCapability
) {
  const capabilities = await getWorkspaceCapabilitiesForUser(
    headers,
    workspaceId,
    userId
  );

  if (!hasWorkspaceCapability(capabilities, capability)) {
    throw new APIError('FORBIDDEN', {
      message: `forbidden: missing workspace capability ${capability}`,
    });
  }

  return capabilities;
}
