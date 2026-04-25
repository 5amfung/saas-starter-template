import type { PlanId } from './plans';

/**
 * Extracts subscription details from an in-memory subscription list.
 * Pure function — no DB or API calls.
 */
export function resolveSubscriptionDetails(
  subscriptions: ReadonlyArray<{
    plan: string;
    status: string;
    stripeSubscriptionId?: string | null;
    stripeScheduleId?: string | null;
    periodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean | null;
    cancelAt?: Date | null;
  }>,
  planId: PlanId
): {
  status: string;
  stripeSubscriptionId: string | null;
  stripeScheduleId: string | null;
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
    stripeSubscriptionId: active.stripeSubscriptionId ?? null,
    stripeScheduleId: active.stripeScheduleId ?? null,
    periodEnd: active.periodEnd ?? null,
    cancelAtPeriodEnd: active.cancelAtPeriodEnd ?? false,
    cancelAt: active.cancelAt ?? null,
  };
}
