import { APIError } from 'better-auth/api';
import {
  getNormalizedWorkspaceRole,
  hasActiveWorkspaceSubscription,
} from './workspace-policy-facts.server';
import type {
  WorkspaceCapabilities,
  WorkspaceCapability,
  WorkspaceRoleOnlyCapabilities,
} from '@/policy/core';
import {
  evaluateWorkspaceCapabilities,
  evaluateWorkspaceRoleOnlyCapabilities,
  hasWorkspaceCapability,
} from '@/policy/core';
import { getWorkspaceBillingData } from '@/billing/billing.server';
import {
  ensureWorkspaceMembership,
  listUserWorkspaces,
} from '@/workspace/workspace.server';

/**
 * Returns the role-only workspace permission set.
 * This path checks membership and normalized role without loading billing,
 * workspace-count, or other richer workspace facts.
 */
export async function getWorkspaceRoleOnlyCapabilitiesForUser(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRoleOnlyCapabilities> {
  await ensureWorkspaceMembership(headers, workspaceId);
  const workspaceRole = await getNormalizedWorkspaceRole(
    headers,
    workspaceId,
    userId
  );

  return evaluateWorkspaceRoleOnlyCapabilities(workspaceRole);
}

/**
 * Returns the full workspace capability snapshot.
 * This path combines role permissions with richer facts like billing state
 * and last-workspace rules.
 */
export async function getWorkspaceCapabilitiesForUser(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<WorkspaceCapabilities> {
  await ensureWorkspaceMembership(headers, workspaceId);
  const [workspaceRole, workspaces, billing] = await Promise.all([
    getNormalizedWorkspaceRole(headers, workspaceId, userId),
    listUserWorkspaces(headers),
    getWorkspaceBillingData(headers, workspaceId),
  ]);

  return evaluateWorkspaceCapabilities({
    workspaceRole,
    isLastWorkspace: workspaces.length <= 1,
    hasActiveSubscription: hasActiveWorkspaceSubscription(billing),
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
