import { and, count, eq, ilike, or, sql } from 'drizzle-orm';
import {
  member as memberTable,
  organization as organizationTable,
  workspaceEntitlementOverrides as overrideTable,
  subscription as subscriptionTable,
  user as userTable,
} from '@workspace/db-schema';
import type { AnyColumn } from 'drizzle-orm';
import type { Database } from '@workspace/db';
import type { EntitlementOverrides } from '../domain/entitlements';
import type { PlanId } from '../domain/plans';

export async function listSubscriptionsForWorkspace(
  db: Database,
  workspaceId: string
) {
  return db
    .select()
    .from(subscriptionTable)
    .where(eq(subscriptionTable.referenceId, workspaceId));
}

export async function countWorkspaceMembersFromDb(
  db: Database,
  workspaceId: string
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(memberTable)
    .where(eq(memberTable.organizationId, workspaceId));
  return result.count;
}

export async function getWorkspaceEntitlementOverridesRow(
  db: Database,
  workspaceId: string
): Promise<{
  id: string;
  limits: EntitlementOverrides['limits'] | null;
  features: EntitlementOverrides['features'] | null;
  quotas: EntitlementOverrides['quotas'] | null;
  notes: string | null;
} | null> {
  const rows = await db
    .select()
    .from(overrideTable)
    .where(eq(overrideTable.workspaceId, workspaceId))
    .limit(1);
  return (
    (rows[0] as
      | {
          id: string;
          limits: EntitlementOverrides['limits'] | null;
          features: EntitlementOverrides['features'] | null;
          quotas: EntitlementOverrides['quotas'] | null;
          notes: string | null;
        }
      | undefined) ?? null
  );
}

export async function setWorkspaceEntitlementOverridesRow(
  db: Database,
  input: {
    workspaceId: string;
    limits?: EntitlementOverrides['limits'];
    features?: EntitlementOverrides['features'];
    quotas?: EntitlementOverrides['quotas'];
    notes?: string | null;
  }
) {
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

export async function clearWorkspaceEntitlementOverridesRow(
  db: Database,
  workspaceId: string
) {
  await db
    .delete(overrideTable)
    .where(eq(overrideTable.workspaceId, workspaceId));
}

export interface AdminWorkspaceListParams {
  search?: string;
  filter?: 'all' | 'self-serve' | 'enterprise';
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface AdminWorkspaceRow {
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

export interface AdminWorkspaceListResult {
  workspaces: Array<AdminWorkspaceRow>;
  total: number;
}

const VALID_SORT_COLUMNS: Record<string, AnyColumn | undefined> = {
  name: organizationTable.name,
  createdAt: organizationTable.createdAt,
};

export async function listAdminWorkspacesFromDb(
  db: Database,
  params: AdminWorkspaceListParams
): Promise<AdminWorkspaceListResult> {
  const {
    search,
    filter = 'all',
    offset = 0,
    limit = 10,
    sortBy,
    sortDirection = 'asc',
  } = params;

  const memberCountSq = db
    .select({
      organizationId: memberTable.organizationId,
      memberCount: count().as('member_count'),
    })
    .from(memberTable)
    .groupBy(memberTable.organizationId)
    .as('member_counts');

  const ownerSq = db
    .select({
      organizationId: memberTable.organizationId,
      userId: sql<string>`min(${memberTable.userId})`.as('owner_user_id'),
    })
    .from(memberTable)
    .where(eq(memberTable.role, 'owner'))
    .groupBy(memberTable.organizationId)
    .as('owners');

  const subscriptionSq = db
    .select({
      referenceId: subscriptionTable.referenceId,
      plan: sql<
        string | null
      >`(array_agg(${subscriptionTable.plan} order by ${subscriptionTable.periodStart} desc nulls last))[1]`.as(
        'latest_plan'
      ),
      status: sql<
        string | null
      >`(array_agg(${subscriptionTable.status} order by ${subscriptionTable.periodStart} desc nulls last))[1]`.as(
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

  const sortColumn =
    (sortBy && VALID_SORT_COLUMNS[sortBy]) || organizationTable.createdAt;
  const orderExpr =
    sortDirection === 'desc' ? sql`${sortColumn} desc` : sql`${sortColumn} asc`;

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

  const workspaces: Array<AdminWorkspaceRow> = rows.map((row) => ({
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

export async function getAdminWorkspaceDetailFromDb(
  db: Database,
  workspaceId: string
) {
  const orgRows = await db
    .select()
    .from(organizationTable)
    .where(eq(organizationTable.id, workspaceId))
    .limit(1);
  const org =
    (orgRows[0] as typeof organizationTable.$inferSelect | undefined) ?? null;
  if (org === null) return null;

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

  const owner = ownerMember.length > 0 ? ownerMember[0] : null;
  const memberCount = await countWorkspaceMembersFromDb(db, workspaceId);

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
  const subscription = sub.length > 0 ? sub[0] : null;

  const allSubs = await db
    .select({ plan: subscriptionTable.plan, status: subscriptionTable.status })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.referenceId, workspaceId));

  const overrideRow = await getWorkspaceEntitlementOverridesRow(
    db,
    workspaceId
  );

  return {
    org,
    owner,
    memberCount,
    subscription,
    subscriptions: allSubs,
    overrides: overrideRow
      ? {
          id: overrideRow.id,
          limits: overrideRow.limits,
          features: overrideRow.features,
          quotas: overrideRow.quotas,
          notes: overrideRow.notes,
        }
      : null,
  };
}
