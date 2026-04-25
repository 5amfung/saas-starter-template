import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import * as Sentry from '@sentry/tanstackstart-react';
import * as z from 'zod';
import { PLANS } from '@workspace/billing';
import type { PlanId } from '@workspace/billing';
import { OPERATIONS, buildWorkflowAttributes } from '@/observability/server';
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
import { requireWorkspaceCapabilityForUser } from '@/policy/workspace-capabilities.server';
import { getAuth } from '@/init';

type BillingCapability = 'canViewBilling' | 'canManageBilling';
type BillingWorkflowOutcome = 'attempt' | 'success' | 'failure';

const BILLING_ROUTE = '/ws/$workspaceId/billing';

function buildBillingWorkflowAttributes(
  operation: (typeof OPERATIONS)[keyof typeof OPERATIONS],
  attributes: {
    workspaceId: string;
    planId?: PlanId;
    result: BillingWorkflowOutcome;
  }
) {
  return buildWorkflowAttributes(operation, {
    route: BILLING_ROUTE,
    ...attributes,
  });
}

function startBillingWorkflowSpan<T>(
  operation: (typeof OPERATIONS)[keyof typeof OPERATIONS],
  name: string,
  attributes: {
    workspaceId: string;
    planId?: PlanId;
    result: BillingWorkflowOutcome;
  },
  callback: () => Promise<T>
) {
  return Sentry.startSpan(
    {
      op: operation,
      name,
      attributes: buildBillingWorkflowAttributes(operation, attributes),
    },
    callback
  );
}

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
    return startBillingWorkflowSpan(
      OPERATIONS.BILLING_CHECKOUT_CREATE_SESSION,
      'Create billing checkout session',
      {
        workspaceId: data.workspaceId,
        planId: data.planId,
        result: 'attempt',
      },
      async () => {
        try {
          const headers = await requireWorkspaceBillingCapability(
            data.workspaceId,
            'canManageBilling'
          );
          const result = await createCheckoutForWorkspace(
            headers,
            data.workspaceId,
            data.planId,
            data.annual,
            data.subscriptionId
          );
          Sentry.logger.info(
            'Billing checkout session created',
            buildBillingWorkflowAttributes(
              OPERATIONS.BILLING_CHECKOUT_CREATE_SESSION,
              {
                workspaceId: data.workspaceId,
                planId: data.planId,
                result: 'success',
              }
            )
          );
          return result;
        } catch (error) {
          Sentry.logger.error(
            'Billing checkout session failed',
            buildBillingWorkflowAttributes(
              OPERATIONS.BILLING_CHECKOUT_CREATE_SESSION,
              {
                workspaceId: data.workspaceId,
                planId: data.planId,
                result: 'failure',
              }
            )
          );
          throw error;
        }
      }
    );
  });

/**
 * Creates a Stripe Customer Portal session for managing the workspace subscription.
 */
export const createWorkspacePortalSession = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    return startBillingWorkflowSpan(
      OPERATIONS.BILLING_PORTAL_CREATE_SESSION,
      'Create billing portal session',
      {
        workspaceId: data.workspaceId,
        result: 'attempt',
      },
      async () => {
        try {
          const headers = await requireWorkspaceBillingCapability(
            data.workspaceId,
            'canManageBilling'
          );
          const result = await createWorkspaceBillingPortal(
            headers,
            data.workspaceId
          );
          Sentry.logger.info(
            'Billing portal session created',
            buildBillingWorkflowAttributes(
              OPERATIONS.BILLING_PORTAL_CREATE_SESSION,
              {
                workspaceId: data.workspaceId,
                result: 'success',
              }
            )
          );
          return result;
        } catch (error) {
          Sentry.logger.error(
            'Billing portal session failed',
            buildBillingWorkflowAttributes(
              OPERATIONS.BILLING_PORTAL_CREATE_SESSION,
              {
                workspaceId: data.workspaceId,
                result: 'failure',
              }
            )
          );
          throw error;
        }
      }
    );
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
    return startBillingWorkflowSpan(
      OPERATIONS.BILLING_SUBSCRIPTION_REACTIVATE,
      'Reactivate billing subscription',
      {
        workspaceId: data.workspaceId,
        result: 'attempt',
      },
      async () => {
        try {
          const headers = await requireWorkspaceBillingCapability(
            data.workspaceId,
            'canManageBilling'
          );
          const result = await reactivateWorkspaceSubscriptionServer(
            headers,
            data.workspaceId
          );
          Sentry.logger.info(
            'Billing subscription reactivated',
            buildBillingWorkflowAttributes(
              OPERATIONS.BILLING_SUBSCRIPTION_REACTIVATE,
              {
                workspaceId: data.workspaceId,
                result: 'success',
              }
            )
          );
          return result;
        } catch (error) {
          Sentry.logger.error(
            'Billing subscription reactivation failed',
            buildBillingWorkflowAttributes(
              OPERATIONS.BILLING_SUBSCRIPTION_REACTIVATE,
              {
                workspaceId: data.workspaceId,
                result: 'failure',
              }
            )
          );
          throw error;
        }
      }
    );
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
    return startBillingWorkflowSpan(
      OPERATIONS.BILLING_SUBSCRIPTION_DOWNGRADE,
      'Schedule billing downgrade',
      {
        workspaceId: data.workspaceId,
        planId: data.planId,
        result: 'attempt',
      },
      async () => {
        try {
          const headers = await requireWorkspaceBillingCapability(
            data.workspaceId,
            'canManageBilling'
          );
          const result = await downgradeWorkspaceSubscriptionServer(
            headers,
            data.workspaceId,
            data.planId,
            data.annual,
            data.subscriptionId
          );
          Sentry.logger.info(
            'Billing subscription downgrade scheduled',
            buildBillingWorkflowAttributes(
              OPERATIONS.BILLING_SUBSCRIPTION_DOWNGRADE,
              {
                workspaceId: data.workspaceId,
                planId: data.planId,
                result: 'success',
              }
            )
          );
          return result;
        } catch (error) {
          Sentry.logger.error(
            'Billing subscription downgrade failed',
            buildBillingWorkflowAttributes(
              OPERATIONS.BILLING_SUBSCRIPTION_DOWNGRADE,
              {
                workspaceId: data.workspaceId,
                planId: data.planId,
                result: 'failure',
              }
            )
          );
          throw error;
        }
      }
    );
  });

/**
 * Cancels a workspace subscription at the end of the current billing period.
 */
export const cancelWorkspaceSubscription = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    return startBillingWorkflowSpan(
      OPERATIONS.BILLING_SUBSCRIPTION_CANCEL,
      'Cancel billing subscription',
      {
        workspaceId: data.workspaceId,
        result: 'attempt',
      },
      async () => {
        try {
          const headers = await requireWorkspaceBillingCapability(
            data.workspaceId,
            'canManageBilling'
          );
          const result = await cancelWorkspaceSubscriptionServer(
            headers,
            data.workspaceId
          );
          Sentry.logger.info(
            'Billing subscription cancellation scheduled',
            buildBillingWorkflowAttributes(
              OPERATIONS.BILLING_SUBSCRIPTION_CANCEL,
              {
                workspaceId: data.workspaceId,
                result: 'success',
              }
            )
          );
          return result;
        } catch (error) {
          Sentry.logger.error(
            'Billing subscription cancellation failed',
            buildBillingWorkflowAttributes(
              OPERATIONS.BILLING_SUBSCRIPTION_CANCEL,
              {
                workspaceId: data.workspaceId,
                result: 'failure',
              }
            )
          );
          throw error;
        }
      }
    );
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
