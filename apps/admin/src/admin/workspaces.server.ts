import { getRequestHeaders } from '@tanstack/react-start/server';
import type { AnyColumn } from 'drizzle-orm';
import { and, count, eq, ilike, or, sql } from 'drizzle-orm';
import {
  member as memberTable,
  organization as organizationTable,
  subscription as subscriptionTable,
  user as userTable,
  workspaceEntitlementOverrides as overrideTable,
} from '@workspace/db-schema';
import { resolveWorkspacePlanId } from '@workspace/auth/plans';
import type { EntitlementOverrides, PlanId } from '@workspace/auth/plans';
import { getVerifiedAdminSession } from '@/auth/validators';
import { auth, db } from '@/init';
import type { EntitlementOverrideInput } from './workspaces.schemas';

// --- Auth ---

/** Verify the caller is an authenticated admin. Throws redirect otherwise. */
export async function requireAdmin() {
  const headers = getRequestHeaders();
  return getVerifiedAdminSession(headers, auth);
}

// --- Types ---

export interface WorkspaceListParams {
  search?: string;
  filter?: 'all' | 'self-serve' | 'enterprise';
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

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

// --- Queries ---

const VALID_SORT_COLUMNS: Record<string, AnyColumn> = {
  name: organizationTable.name,
  createdAt: organizationTable.createdAt,
};

/**
 * List workspaces with plan info and member counts.
 * Supports search, filter, pagination, and sorting.
 */
export async function listWorkspacesWithPlan(
  params: WorkspaceListParams
): Promise<WorkspaceListResult> {
  const {
    search,
    filter = 'all',
    offset = 0,
    limit = 10,
    sortBy,
    sortDirection = 'asc',
  } = params;

  // Subquery: count members per organization.
  const memberCountSq = db
    .select({
      organizationId: memberTable.organizationId,
      memberCount: count().as('member_count'),
    })
    .from(memberTable)
    .groupBy(memberTable.organizationId)
    .as('member_counts');

  // Subquery: find the owner (first member with role 'owner') per organization.
  const ownerSq = db
    .select({
      organizationId: memberTable.organizationId,
      userId: sql<string>`min(${memberTable.userId})`.as('owner_user_id'),
    })
    .from(memberTable)
    .where(eq(memberTable.role, 'owner'))
    .groupBy(memberTable.organizationId)
    .as('owners');

  // Subquery: latest active/trialing subscription per organization.
  const subscriptionSq = db
    .select({
      referenceId: subscriptionTable.referenceId,
      plan: sql<string>`(array_agg(${subscriptionTable.plan} order by ${subscriptionTable.periodStart} desc nulls last))[1]`.as(
        'latest_plan'
      ),
      status:
        sql<string>`(array_agg(${subscriptionTable.status} order by ${subscriptionTable.periodStart} desc nulls last))[1]`.as(
          'latest_status'
        ),
    })
    .from(subscriptionTable)
    .where(
      or(
        eq(subscriptionTable.status, 'active'),
        eq(subscriptionTable.status, 'trialing')
      )
    )
    .groupBy(subscriptionTable.referenceId)
    .as('subs');

  // Build WHERE conditions.
  const conditions = [];
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(organizationTable.name, pattern),
        ilike(userTable.email, pattern)
      )
    );
  }
  if (filter === 'enterprise') {
    conditions.push(eq(subscriptionSq.plan, 'enterprise'));
  } else if (filter === 'self-serve') {
    conditions.push(
      or(
        sql`${subscriptionSq.plan} is null`,
        sql`${subscriptionSq.plan} != 'enterprise'`
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Determine sort column and direction.
  const sortColumn =
    (sortBy && VALID_SORT_COLUMNS[sortBy]) || organizationTable.createdAt;
  const orderExpr =
    sortDirection === 'desc' ? sql`${sortColumn} desc` : sql`${sortColumn} asc`;

  // Main query.
  const rows = await db
    .select({
      id: organizationTable.id,
      name: organizationTable.name,
      slug: organizationTable.slug,
      createdAt: organizationTable.createdAt,
      ownerEmail: userTable.email,
      ownerName: userTable.name,
      plan: subscriptionSq.plan,
      status: subscriptionSq.status,
      memberCount: sql<number>`coalesce(${memberCountSq.memberCount}, 0)::int`,
    })
    .from(organizationTable)
    .leftJoin(ownerSq, eq(ownerSq.organizationId, organizationTable.id))
    .leftJoin(userTable, eq(userTable.id, ownerSq.userId))
    .leftJoin(
      memberCountSq,
      eq(memberCountSq.organizationId, organizationTable.id)
    )
    .leftJoin(
      subscriptionSq,
      eq(subscriptionSq.referenceId, organizationTable.id)
    )
    .where(whereClause)
    .orderBy(orderExpr)
    .limit(limit)
    .offset(offset);

  // Count query.
  const countResult = await db
    .select({ total: count().as('total') })
    .from(organizationTable)
    .leftJoin(ownerSq, eq(ownerSq.organizationId, organizationTable.id))
    .leftJoin(userTable, eq(userTable.id, ownerSq.userId))
    .leftJoin(
      subscriptionSq,
      eq(subscriptionSq.referenceId, organizationTable.id)
    )
    .where(whereClause);

  const total = countResult[0]?.total ?? 0;

  const workspaces: Array<WorkspaceRow> = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.createdAt,
    ownerEmail: row.ownerEmail,
    ownerName: row.ownerName,
    planId: (row.plan ?? 'free') as PlanId,
    planStatus: row.status,
    memberCount: row.memberCount,
  }));

  return { workspaces, total };
}

/**
 * Get a single workspace with owner info, subscription data, member count,
 * and entitlement override row if it exists.
 */
export async function getWorkspaceDetail(
  workspaceId: string
): Promise<WorkspaceDetail | null> {
  // Fetch organization.
  const org = await db.query.organization.findFirst({
    where: eq(organizationTable.id, workspaceId),
  });
  if (!org) return null;

  // Find the owner member.
  const ownerMember = await db
    .select({
      userId: memberTable.userId,
      email: userTable.email,
      name: userTable.name,
    })
    .from(memberTable)
    .innerJoin(userTable, eq(userTable.id, memberTable.userId))
    .where(
      and(
        eq(memberTable.organizationId, workspaceId),
        eq(memberTable.role, 'owner')
      )
    )
    .limit(1);

  const owner = ownerMember[0] ?? null;

  // Count members.
  const memberCountResult = await db
    .select({ count: count() })
    .from(memberTable)
    .where(eq(memberTable.organizationId, workspaceId));
  const memberCount = memberCountResult[0]?.count ?? 0;

  // Get active subscription.
  const sub = await db
    .select()
    .from(subscriptionTable)
    .where(
      and(
        eq(subscriptionTable.referenceId, workspaceId),
        or(
          eq(subscriptionTable.status, 'active'),
          eq(subscriptionTable.status, 'trialing')
        )
      )
    )
    .limit(1);

  const subscription = sub[0] ?? null;

  // Resolve plan ID from subscriptions.
  const allSubs = await db
    .select({ plan: subscriptionTable.plan, status: subscriptionTable.status })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.referenceId, workspaceId));
  const planId = resolveWorkspacePlanId(
    allSubs.map((s) => ({ plan: s.plan, status: s.status ?? '' }))
  );

  // Fetch entitlement overrides.
  const overrideRow = await db.query.workspaceEntitlementOverrides.findFirst({
    where: eq(overrideTable.workspaceId, workspaceId),
  });

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    createdAt: org.createdAt,
    ownerEmail: owner?.email ?? null,
    ownerName: owner?.name ?? null,
    ownerUserId: owner?.userId ?? null,
    memberCount,
    planId,
    subscription: subscription
      ? {
          id: subscription.id,
          plan: subscription.plan,
          status: subscription.status,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          periodEnd: subscription.periodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
      : null,
    overrides: overrideRow
      ? {
          id: overrideRow.id,
          limits: overrideRow.limits as EntitlementOverrides['limits'],
          features: overrideRow.features as EntitlementOverrides['features'],
          quotas: overrideRow.quotas as EntitlementOverrides['quotas'],
          notes: overrideRow.notes,
        }
      : null,
  };
}

/**
 * Insert or update entitlement overrides for a workspace.
 * Uses Drizzle's onConflictDoUpdate on the workspaceId unique constraint.
 */
export async function upsertEntitlementOverrides(
  input: EntitlementOverrideInput
): Promise<void> {
  await db
    .insert(overrideTable)
    .values({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      limits: input.limits as Record<string, number>,
      features: input.features as Record<string, boolean>,
      quotas: input.quotas as Record<string, number>,
      notes: input.notes ?? null,
    })
    .onConflictDoUpdate({
      target: overrideTable.workspaceId,
      set: {
        limits: input.limits as Record<string, number>,
        features: input.features as Record<string, boolean>,
        quotas: input.quotas as Record<string, number>,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      },
    });
}

/** Delete all entitlement overrides for a workspace. */
export async function deleteEntitlementOverrides(
  workspaceId: string
): Promise<void> {
  await db
    .delete(overrideTable)
    .where(eq(overrideTable.workspaceId, workspaceId));
}
