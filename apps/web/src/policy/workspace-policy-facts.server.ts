import type { WorkspaceRole } from '@/policy/core';
import type { getWorkspaceBillingData } from '@/billing/billing.server';
import { getActiveMemberRole } from '@/workspace/workspace.server';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

type WorkspaceBillingData = Awaited<ReturnType<typeof getWorkspaceBillingData>>;

export function normalizeWorkspaceRole(
  role: string | null
): WorkspaceRole | null {
  if (role === 'owner' || role === 'admin' || role === 'member') {
    return role;
  }

  return null;
}

export function hasActiveWorkspaceSubscription(
  billing: WorkspaceBillingData
): boolean {
  return (
    billing.planId !== 'free' &&
    ACTIVE_SUBSCRIPTION_STATUSES.has(billing.subscription?.status ?? '')
  );
}

export async function getNormalizedWorkspaceRole(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  return normalizeWorkspaceRole(
    await getActiveMemberRole(headers, workspaceId, userId)
  );
}
