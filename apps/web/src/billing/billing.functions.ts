import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import * as z from 'zod';
import { PLANS } from '@workspace/auth/plans';
import type { PlanId } from '@workspace/auth/plans';
import {
  cancelWorkspaceSubscription as cancelWorkspaceSubscriptionServer,
  checkWorkspacePlanLimit as checkWorkspacePlanLimitServer,
  createCheckoutForWorkspace,
  createWorkspaceBillingPortal,
  downgradeWorkspaceSubscription as downgradeWorkspaceSubscriptionServer,
  getOwnedWorkspacesBillingSummary,
  getWorkspaceBillingData as getWorkspaceBillingDataServer,
  reactivateWorkspaceSubscription as reactivateWorkspaceSubscriptionServer,
  requireVerifiedSession,
} from '@/billing/billing.server';
import { auth } from '@/init';

/**
 * Verifies the current user is the owner of the given workspace.
 * Throws if the user is not the owner.
 */
async function requireWorkspaceOwner(
  session: { user: { id: string } },
  workspaceId: string
) {
  const ownerId = await auth.billing.getWorkspaceOwnerUserId(workspaceId);
  if (!ownerId || ownerId !== session.user.id) {
    throw new Error('Only the workspace owner can manage billing.');
  }
}

/**
 * Returns billing summaries for all workspaces the current user owns.
 */
export const getBillingSummary = createServerFn().handler(async () => {
  await requireVerifiedSession();
  const headers = getRequestHeaders();
  return getOwnedWorkspacesBillingSummary(headers);
});

/**
 * Fetches the workspace's invoices from Stripe (past 12 months).
 */
export const getWorkspaceInvoices = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    await requireWorkspaceOwner(session, data.workspaceId);
    return auth.billing.getInvoicesForWorkspace(data.workspaceId);
  });

const VALID_PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...Array<PlanId>];

const upgradeInput = z.object({
  workspaceId: z.string(),
  planId: z.enum(VALID_PLAN_IDS),
  annual: z.boolean(),
  subscriptionId: z.string().optional(),
});

/**
 * Creates a Stripe Checkout session to subscribe a workspace to a plan.
 * Pass subscriptionId when upgrading an existing subscription to switch plans.
 */
export const createWorkspaceCheckoutSession = createServerFn()
  .inputValidator(upgradeInput)
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    await requireWorkspaceOwner(session, data.workspaceId);
    const headers = getRequestHeaders();
    return createCheckoutForWorkspace(
      headers,
      data.workspaceId,
      data.planId,
      data.annual,
      data.subscriptionId
    );
  });

/**
 * Creates a Stripe Customer Portal session for managing the workspace subscription.
 */
export const createWorkspacePortalSession = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    await requireWorkspaceOwner(session, data.workspaceId);
    const headers = getRequestHeaders();
    return createWorkspaceBillingPortal(headers, data.workspaceId);
  });

/**
 * Returns the workspace's billing state for the billing page.
 */
export const getWorkspaceBillingData = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    await requireWorkspaceOwner(session, data.workspaceId);
    const headers = getRequestHeaders();
    return getWorkspaceBillingDataServer(headers, data.workspaceId);
  });

/**
 * Reactivates a workspace subscription that was set to cancel at period end.
 */
export const reactivateWorkspaceSubscription = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    await requireWorkspaceOwner(session, data.workspaceId);
    const headers = getRequestHeaders();
    return reactivateWorkspaceSubscriptionServer(headers, data.workspaceId);
  });

const downgradeInput = z.object({
  workspaceId: z.string(),
  planId: z.enum(VALID_PLAN_IDS),
  annual: z.boolean(),
  subscriptionId: z.string(),
});

/**
 * Schedules a workspace subscription downgrade at the end of the current billing period.
 */
export const downgradeWorkspaceSubscription = createServerFn()
  .inputValidator(downgradeInput)
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    await requireWorkspaceOwner(session, data.workspaceId);
    const headers = getRequestHeaders();
    return downgradeWorkspaceSubscriptionServer(
      headers,
      data.workspaceId,
      data.planId,
      data.annual,
      data.subscriptionId
    );
  });

/**
 * Cancels a workspace subscription at the end of the current billing period.
 */
export const cancelWorkspaceSubscription = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    await requireWorkspaceOwner(session, data.workspaceId);
    const headers = getRequestHeaders();
    return cancelWorkspaceSubscriptionServer(headers, data.workspaceId);
  });

const checkPlanLimitInput = z.object({
  workspaceId: z.string(),
  feature: z.enum(['member']),
});

/**
 * Checks whether the workspace can perform a plan-limited action.
 */
export const checkWorkspacePlanLimit = createServerFn()
  .inputValidator(checkPlanLimitInput)
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    await requireWorkspaceOwner(session, data.workspaceId);
    const headers = getRequestHeaders();
    return checkWorkspacePlanLimitServer(
      headers,
      data.workspaceId,
      data.feature
    );
  });
