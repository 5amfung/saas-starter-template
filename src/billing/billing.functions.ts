import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import * as z from 'zod';
import {
  checkUserPlanLimit,
  createCheckoutForPlan,
  createUserBillingPortal,
  getBillingData,
  getInvoicesForUser,
  reactivateUserSubscription,
  requireVerifiedSession,
} from '@/billing/billing.server';
import type { PlanId } from '@/billing/plans';
import { PLANS } from '@/billing/plans';

/**
 * Fetches the current user's invoices from Stripe (past 12 months).
 */
export const getInvoices = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();
  return getInvoicesForUser(session.user.id);
});

const VALID_PLAN_IDS = PLANS.map((p) => p.id) as [PlanId, ...Array<PlanId>];

const upgradeInput = z.object({
  planId: z.enum(VALID_PLAN_IDS),
  annual: z.boolean(),
});

/**
 * Creates a Stripe Checkout session to subscribe to a plan.
 */
export const createCheckoutSession = createServerFn()
  .inputValidator(upgradeInput)
  .handler(async ({ data }) => {
    await requireVerifiedSession();
    const headers = getRequestHeaders();
    return createCheckoutForPlan(headers, data.planId, data.annual);
  });

/**
 * Creates a Stripe Customer Portal session for managing the subscription.
 */
export const createPortalSession = createServerFn().handler(async () => {
  await requireVerifiedSession();
  const headers = getRequestHeaders();
  return createUserBillingPortal(headers);
});

/**
 * Returns the current user's billing state for the billing page.
 */
export const getUserBillingData = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();
  const headers = getRequestHeaders();
  return getBillingData(headers, session.user.id);
});

/**
 * Reactivates a subscription that was set to cancel at period end.
 */
export const reactivateSubscription = createServerFn().handler(async () => {
  const session = await requireVerifiedSession();
  const headers = getRequestHeaders();
  return reactivateUserSubscription(headers, session.user.id);
});

const checkPlanLimitInput = z.object({
  feature: z.enum(['workspace', 'member']),
  workspaceId: z.string().optional(),
});

/**
 * Checks whether the current user can perform a plan-limited action.
 */
export const checkPlanLimit = createServerFn()
  .inputValidator(checkPlanLimitInput)
  .handler(async ({ data }) => {
    const session = await requireVerifiedSession();
    const headers = getRequestHeaders();
    return checkUserPlanLimit(
      headers,
      session.user.id,
      data.feature,
      data.workspaceId,
    );
  });
