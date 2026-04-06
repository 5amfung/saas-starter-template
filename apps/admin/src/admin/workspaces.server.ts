import { getRequestHeaders } from '@tanstack/react-start/server';
import {
  clearAdminWorkspaceEntitlementOverrides,
  getAdminWorkspaceDetail,
  listAdminWorkspaces,
  setAdminWorkspaceEntitlementOverrides,
} from '@workspace/billing';
import type {
  AdminWorkspaceListParams,
  EntitlementOverrides,
  PlanId,
} from '@workspace/billing';
import type { EntitlementOverrideInput } from './workspaces.schemas';
import { getAuth, getDb } from '@/init';
import { getVerifiedAdminSession } from '@/auth/validators';

/** Verify the caller is an authenticated admin. Throws redirect otherwise. */
export async function requireAdmin() {
  const headers = getRequestHeaders();
  return getVerifiedAdminSession(headers, getAuth());
}

export type WorkspaceListParams = AdminWorkspaceListParams;

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  ownerEmail: string | null;
  ownerName: string | null;
  planId: PlanId;
  planStatus: string | null;
  memberCount: number;
}

export interface WorkspaceListResult {
  workspaces: Array<WorkspaceRow>;
  total: number;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
  ownerEmail: string | null;
  ownerName: string | null;
  ownerUserId: string | null;
  memberCount: number;
  planId: PlanId;
  subscription: {
    id: string;
    plan: string;
    status: string | null;
    stripeSubscriptionId: string | null;
    periodEnd: Date | null;
    cancelAtPeriodEnd: boolean | null;
  } | null;
  overrides: {
    id: string;
    limits: EntitlementOverrides['limits'];
    features: EntitlementOverrides['features'];
    quotas: EntitlementOverrides['quotas'];
    notes: string | null;
  } | null;
}

export async function listWorkspacesWithPlan(
  params: WorkspaceListParams
): Promise<WorkspaceListResult> {
  return listAdminWorkspaces({ db: getDb(), params });
}

export async function getWorkspaceDetail(
  workspaceId: string
): Promise<WorkspaceDetail | null> {
  return getAdminWorkspaceDetail({ db: getDb(), workspaceId });
}

export async function upsertEntitlementOverrides(
  input: EntitlementOverrideInput
): Promise<void> {
  await setAdminWorkspaceEntitlementOverrides({
    db: getDb(),
    workspaceId: input.workspaceId,
    limits: input.limits,
    features: input.features,
    quotas: input.quotas,
    notes: input.notes ?? null,
  });
}

export async function deleteEntitlementOverrides(
  workspaceId: string
): Promise<void> {
  await clearAdminWorkspaceEntitlementOverrides({
    db: getDb(),
    workspaceId,
  });
}
