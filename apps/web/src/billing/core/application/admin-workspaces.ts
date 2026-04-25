import {
  getAdminWorkspaceDetailFromDb,
  listAdminWorkspacesFromDb,
} from '../infrastructure/workspace-repository';
import {
  getFreePlan,
  getPlanById,
  resolveEntitlements,
  resolveWorkspacePlanId,
} from '../domain/plans';
import {
  clearWorkspaceEntitlementOverrides,
  getWorkspaceEntitlementOverrides,
  setWorkspaceEntitlementOverrides,
} from './workspace-billing';
import { evaluateWorkspaceProductPolicy } from './workspace-product-policy';
import type { PlanId } from '../domain/plans';
import type { AdminWorkspaceListParams } from '../infrastructure/workspace-repository';
import type { Database } from '@/db/client';
import type {
  EntitlementOverrides,
  Entitlements,
} from '../domain/entitlements';
import type { WorkspaceProductPolicy } from '../contracts/product-policy';

export type { AdminWorkspaceListParams } from '../infrastructure/workspace-repository';

export interface AdminWorkspaceDetail {
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
  entitlements: Entitlements;
  productPolicy: WorkspaceProductPolicy;
  overrides: {
    id: string;
    limits: EntitlementOverrides['limits'];
    features: EntitlementOverrides['features'];
    quotas: EntitlementOverrides['quotas'];
    notes: string | null;
  } | null;
}

export async function listAdminWorkspaces(input: {
  db: Database;
  params: AdminWorkspaceListParams;
}) {
  return listAdminWorkspacesFromDb(input.db, input.params);
}

export async function getAdminWorkspaceDetail(input: {
  db: Database;
  workspaceId: string;
}): Promise<AdminWorkspaceDetail | null> {
  const detail = await getAdminWorkspaceDetailFromDb(
    input.db,
    input.workspaceId
  );
  if (!detail) return null;

  const planId = resolveWorkspacePlanId(
    detail.subscriptions.map((s) => ({ plan: s.plan, status: s.status ?? '' }))
  );
  const plan = getPlanById(planId) ?? getFreePlan();
  const overrides = await getWorkspaceEntitlementOverrides({
    db: input.db,
    workspaceId: input.workspaceId,
  });
  const entitlements = resolveEntitlements(plan.entitlements, overrides);

  return {
    id: detail.org.id,
    name: detail.org.name,
    slug: detail.org.slug,
    logo: detail.org.logo,
    createdAt: detail.org.createdAt,
    ownerEmail: detail.owner?.email ?? null,
    ownerName: detail.owner?.name ?? null,
    ownerUserId: detail.owner?.userId ?? null,
    memberCount: detail.memberCount,
    planId,
    entitlements,
    productPolicy: evaluateWorkspaceProductPolicy({
      currentPlan: plan,
      resolvedEntitlements: entitlements,
      subscriptionState: {
        status: detail.subscription?.status ?? null,
        stripeSubscriptionId: detail.subscription?.stripeSubscriptionId ?? null,
        stripeScheduleId: null,
        periodEnd: detail.subscription?.periodEnd ?? null,
        cancelAtPeriodEnd: detail.subscription?.cancelAtPeriodEnd ?? false,
        cancelAt: null,
      },
      scheduledTargetPlanId: null,
    }),
    subscription: detail.subscription
      ? {
          id: detail.subscription.id,
          plan: detail.subscription.plan,
          status: detail.subscription.status,
          stripeSubscriptionId: detail.subscription.stripeSubscriptionId,
          periodEnd: detail.subscription.periodEnd,
          cancelAtPeriodEnd: detail.subscription.cancelAtPeriodEnd,
        }
      : null,
    overrides,
  };
}

export async function setAdminWorkspaceEntitlementOverrides(input: {
  db: Database;
  workspaceId: string;
  limits?: EntitlementOverrides['limits'];
  features?: EntitlementOverrides['features'];
  quotas?: EntitlementOverrides['quotas'];
  notes?: string | null;
}) {
  return setWorkspaceEntitlementOverrides(input);
}

export async function clearAdminWorkspaceEntitlementOverrides(input: {
  db: Database;
  workspaceId: string;
}) {
  return clearWorkspaceEntitlementOverrides(input);
}
