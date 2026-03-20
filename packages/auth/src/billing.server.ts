import { and, count, eq } from 'drizzle-orm';
import Stripe from 'stripe';
import {
  member as memberTable,
  subscription as subscriptionTable,
  user as userTable,
} from '@workspace/db/schema';
import { resolveUserPlanId } from './plans';
import type { Database } from '@workspace/db';
import type { PlanId } from './plans';

/**
 * Creates billing query helpers with closed-over database and Stripe client.
 * Returned by createAuth as auth.billing.
 */
export function createBillingHelpers(db: Database, stripeSecretKey: string) {
  const stripeClient = new Stripe(stripeSecretKey);

  /** Resolves a user's plan ID by querying the subscription table directly. */
  async function resolveUserPlanIdFromDb(userId: string): Promise<PlanId> {
    const rows = await db
      .select({
        plan: subscriptionTable.plan,
        status: subscriptionTable.status,
      })
      .from(subscriptionTable)
      .where(eq(subscriptionTable.referenceId, userId));
    return resolveUserPlanId(
      rows.filter(
        (r): r is { plan: string; status: string } => r.status !== null
      )
    );
  }

  /** Counts the number of workspaces where the user is an owner. */
  async function countOwnedWorkspaces(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(memberTable)
      .where(
        and(eq(memberTable.userId, userId), eq(memberTable.role, 'owner'))
      );
    return result.count;
  }

  /** Returns the owner's user ID for a workspace, or null if none found. */
  async function getWorkspaceOwnerUserId(
    workspaceId: string
  ): Promise<string | null> {
    const rows = await db
      .select({ userId: memberTable.userId })
      .from(memberTable)
      .where(
        and(
          eq(memberTable.organizationId, workspaceId),
          eq(memberTable.role, 'owner')
        )
      );
    if (rows.length === 0) return null;
    return rows[0].userId;
  }

  /** Counts the number of members in a workspace. */
  async function countWorkspaceMembers(workspaceId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(memberTable)
      .where(eq(memberTable.organizationId, workspaceId));
    return result.count;
  }

  /** Fetches a user's invoices from Stripe (past 12 months). */
  async function getInvoicesForUser(userId: string) {
    const [dbUser] = await db
      .select({ stripeCustomerId: userTable.stripeCustomerId })
      .from(userTable)
      .where(eq(userTable.id, userId));

    if (!dbUser.stripeCustomerId) return [];

    const TWELVE_MONTHS_IN_SECONDS = 365 * 24 * 60 * 60;
    const twelveMonthsAgo =
      Math.floor(Date.now() / 1000) - TWELVE_MONTHS_IN_SECONDS;
    const invoices = await stripeClient.invoices.list({
      customer: dbUser.stripeCustomerId,
      limit: 100,
      created: { gte: twelveMonthsAgo },
    });

    return invoices.data.map((inv) => ({
      id: inv.id,
      date: inv.created,
      status: inv.status,
      amount: inv.amount_paid,
      currency: inv.currency,
      invoiceUrl: inv.hosted_invoice_url,
      invoicePdf: inv.invoice_pdf,
    }));
  }

  return {
    resolveUserPlanIdFromDb,
    countOwnedWorkspaces,
    getWorkspaceOwnerUserId,
    countWorkspaceMembers,
    getInvoicesForUser,
  };
}

export type AuthBilling = ReturnType<typeof createBillingHelpers>;

/**
 * Extracts subscription details from an in-memory subscription list.
 * Pure function — no DB or API calls.
 */
export function resolveSubscriptionDetails(
  subscriptions: ReadonlyArray<{
    plan: string;
    status: string;
    periodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean | null;
    cancelAt?: Date | null;
  }>,
  planId: PlanId
): {
  status: string;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: Date | null;
} | null {
  const active = subscriptions.find(
    (s) =>
      (s.status === 'active' || s.status === 'trialing') && s.plan === planId
  );
  if (!active) return null;

  return {
    status: active.status,
    periodEnd: active.periodEnd ?? null,
    cancelAtPeriodEnd: active.cancelAtPeriodEnd ?? false,
    cancelAt: active.cancelAt ?? null,
  };
}
