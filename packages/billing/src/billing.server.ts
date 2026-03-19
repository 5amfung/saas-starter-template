import Stripe from "stripe"
import type { Database } from "@workspace/db"
import { and, count, eq } from "drizzle-orm"
import {
  member as memberTable,
  subscription as subscriptionTable,
  user as userTable,
} from "@workspace/db/schema"
import { APIError } from "better-auth/api"
import { getPlanLimitsForPlanId, resolveUserPlanId } from "./plans"
import type { PlanId } from "./plans"

/**
 * Creates a billing service with closed-over database and Stripe client.
 * Pure DB/Stripe operations only — no auth.api calls, no process.env reads.
 */
export function createBillingService(db: Database, stripeSecretKey: string) {
  const stripeClient = new Stripe(stripeSecretKey)

  /**
   * Resolves a user's plan ID by querying the subscription table directly.
   * Unlike getUserActivePlanId, this does not require an HTTP session context,
   * making it safe to call from database hooks where no request headers exist.
   */
  async function resolveUserPlanIdFromDb(userId: string): Promise<PlanId> {
    const rows = await db
      .select({
        plan: subscriptionTable.plan,
        status: subscriptionTable.status,
      })
      .from(subscriptionTable)
      .where(eq(subscriptionTable.referenceId, userId))
    return resolveUserPlanId(
      rows.filter(
        (r): r is { plan: string; status: string } => r.status !== null
      )
    )
  }

  /**
   * Counts the number of workspaces where the user is an owner.
   * Used by both the plan limit check and the org creation hook.
   */
  async function countOwnedWorkspaces(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(memberTable)
      .where(and(eq(memberTable.userId, userId), eq(memberTable.role, "owner")))
    return result.count
  }

  /**
   * Returns the owner's user ID for a workspace, or null if none found.
   * Used by the plan limit check to resolve the owner's plan for member limits.
   */
  async function getWorkspaceOwnerUserId(
    workspaceId: string
  ): Promise<string | null> {
    const rows = await db
      .select({ userId: memberTable.userId })
      .from(memberTable)
      .where(
        and(
          eq(memberTable.organizationId, workspaceId),
          eq(memberTable.role, "owner")
        )
      )
    if (rows.length === 0) return null
    return rows[0].userId
  }

  /**
   * Counts the number of members in a workspace.
   * Used by both the plan limit check and the invitation hook.
   */
  async function countWorkspaceMembers(workspaceId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(memberTable)
      .where(eq(memberTable.organizationId, workspaceId))
    return result.count
  }

  /**
   * Fetches a user's invoices from Stripe (past 12 months).
   */
  async function getInvoicesForUser(userId: string) {
    const [dbUser] = await db
      .select({ stripeCustomerId: userTable.stripeCustomerId })
      .from(userTable)
      .where(eq(userTable.id, userId))

    if (!dbUser.stripeCustomerId) return []

    const SECONDS_PER_YEAR = 365 * 24 * 60 * 60
    const twelveMonthsAgo = Math.floor(Date.now() / 1000) - SECONDS_PER_YEAR
    const invoices = await stripeClient.invoices.list({
      customer: dbUser.stripeCustomerId,
      limit: 100,
      created: { gte: twelveMonthsAgo },
    })

    return invoices.data.map((inv) => ({
      id: inv.id,
      date: inv.created,
      status: inv.status,
      amount: inv.amount_paid,
      currency: inv.currency,
      invoiceUrl: inv.hosted_invoice_url,
      invoicePdf: inv.invoice_pdf,
    }))
  }

  /**
   * Enforces the workspace creation limit for a user's plan.
   * Throws APIError FORBIDDEN if the limit is reached.
   */
  async function checkWorkspaceLimit(userId: string): Promise<void> {
    const planId = await resolveUserPlanIdFromDb(userId)
    const limits = getPlanLimitsForPlanId(planId)
    if (limits.maxWorkspaces === -1) return
    const workspaceCount = await countOwnedWorkspaces(userId)
    if (workspaceCount >= limits.maxWorkspaces) {
      throw new APIError("FORBIDDEN", {
        message: `Your plan allows a maximum of ${limits.maxWorkspaces} workspace(s). Please upgrade to create more.`,
      })
    }
  }

  /**
   * Enforces the member invitation limit for a workspace based on the owner's plan.
   * Throws APIError FORBIDDEN if the limit is reached.
   */
  async function checkMemberLimit(orgId: string): Promise<void> {
    const owner = await getWorkspaceOwnerUserId(orgId)
    if (!owner) return
    const planId = await resolveUserPlanIdFromDb(owner)
    const limits = getPlanLimitsForPlanId(planId)
    if (limits.maxMembersPerWorkspace === -1) return
    const memberCount = await countWorkspaceMembers(orgId)
    if (memberCount >= limits.maxMembersPerWorkspace) {
      throw new APIError("FORBIDDEN", {
        message: `This workspace has reached its member limit (${limits.maxMembersPerWorkspace}). The workspace owner needs to upgrade their plan.`,
      })
    }
  }

  return {
    resolveUserPlanIdFromDb,
    countOwnedWorkspaces,
    countWorkspaceMembers,
    getWorkspaceOwnerUserId,
    getInvoicesForUser,
    checkWorkspaceLimit,
    checkMemberLimit,
  }
}

export type BillingService = ReturnType<typeof createBillingService>

/**
 * Extracts subscription details from an in-memory subscription list.
 * Pure function — no DB or API calls. Used by getBillingData to avoid
 * a redundant round trip after listActiveSubscriptions already fetched
 * the same data.
 */
export function resolveSubscriptionDetails(
  subscriptions: ReadonlyArray<{
    plan: string
    status: string
    periodEnd?: Date | null
    cancelAtPeriodEnd?: boolean | null
    cancelAt?: Date | null
  }>,
  planId: PlanId
): {
  status: string
  periodEnd: Date | null
  cancelAtPeriodEnd: boolean
  cancelAt: Date | null
} | null {
  const active = subscriptions.find(
    (s) =>
      (s.status === "active" || s.status === "trialing") && s.plan === planId
  )
  if (!active) return null

  return {
    status: active.status,
    periodEnd: active.periodEnd ?? null,
    cancelAtPeriodEnd: active.cancelAtPeriodEnd ?? false,
    cancelAt: active.cancelAt ?? null,
  }
}
