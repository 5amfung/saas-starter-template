import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import * as z from 'zod';
import { PLANS } from '@workspace/billing';
import { BILLING_OPERATIONS } from '@workspace/logging/operations';
import type { PlanId } from '@workspace/billing';
import {
  cancelWorkspaceSubscription as cancelWorkspaceSubscriptionServer,
  checkWorkspaceEntitlement as checkWorkspaceEntitlementServer,
  createCheckoutForWorkspace,
  createWorkspaceBillingPortal,
  downgradeWorkspaceSubscription as downgradeWorkspaceSubscriptionServer,
  getOwnedWorkspacesBillingSummary,
  getWorkspaceBillingData as getWorkspaceBillingDataServer,
  reactivateWorkspaceSubscription as reactivateWorkspaceSubscriptionServer,
  requireVerifiedSession,
} from '@/billing/billing.server';
import { logger } from '@/lib/logger';
import { requireWorkspaceCapabilityForUser } from '@/policy/workspace-capabilities.server';
import { getAuth } from '@/init';

type BillingCapability = 'canViewBilling' | 'canManageBilling';

async function requireWorkspaceBillingCapability(
  workspaceId: string,
  capability: BillingCapability
) {
  const session = await requireVerifiedSession();
  const headers = getRequestHeaders();
  await requireWorkspaceCapabilityForUser(
    headers,
    workspaceId,
    session.user.id,
    capability
  );
  return headers;
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
    await requireWorkspaceBillingCapability(data.workspaceId, 'canViewBilling');
    return getAuth().billing.getInvoicesForWorkspace(data.workspaceId);
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
    const headers = await requireWorkspaceBillingCapability(
      data.workspaceId,
      'canManageBilling'
    );
    logger('info', 'billing checkout started', {
      operation: BILLING_OPERATIONS.checkoutStarted,
      workspaceId: data.workspaceId,
      planId: data.planId,
      annual: data.annual,
      subscriptionId: data.subscriptionId,
    });
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
    const headers = await requireWorkspaceBillingCapability(
      data.workspaceId,
      'canManageBilling'
    );
    return createWorkspaceBillingPortal(headers, data.workspaceId);
  });

/**
 * Returns the workspace's billing state for the billing page.
 */
export const getWorkspaceBillingData = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const headers = await requireWorkspaceBillingCapability(
      data.workspaceId,
      'canViewBilling'
    );
    return getWorkspaceBillingDataServer(headers, data.workspaceId);
  });

/**
 * Reactivates a workspace subscription that was set to cancel at period end.
 */
export const reactivateWorkspaceSubscription = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const headers = await requireWorkspaceBillingCapability(
      data.workspaceId,
      'canManageBilling'
    );
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
    const headers = await requireWorkspaceBillingCapability(
      data.workspaceId,
      'canManageBilling'
    );
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
    const headers = await requireWorkspaceBillingCapability(
      data.workspaceId,
      'canManageBilling'
    );
    return cancelWorkspaceSubscriptionServer(headers, data.workspaceId);
  });

const checkEntitlementInput = z.object({
  workspaceId: z.string(),
  key: z.enum(['members']),
});

/**
 * Checks whether the workspace can perform an entitlement-limited action.
 */
export const checkWorkspaceEntitlement = createServerFn()
  .inputValidator(checkEntitlementInput)
  .handler(async ({ data }) => {
    const headers = await requireWorkspaceBillingCapability(
      data.workspaceId,
      'canManageBilling'
    );
    return checkWorkspaceEntitlementServer(headers, data.workspaceId, data.key);
  });
