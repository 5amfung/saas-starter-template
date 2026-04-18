import { APIError } from 'better-auth/api';
import {
  evaluateWorkspaceCapabilities,
  hasWorkspaceCapability,
} from '@workspace/policy';
import {
  getNormalizedWorkspaceRole,
  hasActiveWorkspaceSubscription,
} from './workspace-policy-facts.server';
import type {
  WorkspaceCapabilities,
  WorkspaceCapability,
} from '@workspace/policy';
import { getWorkspaceBillingData } from '@/billing/billing.server';
import {
  ensureWorkspaceMembership,
  listUserWorkspaces,
} from '@/workspace/workspace.server';

export async function getWorkspaceAccessCapabilitiesForUser(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<WorkspaceCapabilities> {
  await ensureWorkspaceMembership(headers, workspaceId);
  const workspaceRole = await getNormalizedWorkspaceRole(
    headers,
    workspaceId,
    userId
  );

  // Access-only checks should not depend on billing state. We force the
  // delete capability closed here so callers cannot accidentally use this
  // lightweight snapshot for delete decisions.
  return evaluateWorkspaceCapabilities({
    workspaceRole,
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
