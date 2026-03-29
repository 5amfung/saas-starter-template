import { ALL_PLANS } from './plans';
import type { Plan, PlanLimits } from './plans';

export type PlanAction = 'current' | 'upgrade' | 'downgrade' | 'cancel';

/**
 * Determines the action type for switching from one plan to another.
 * Uses tier comparison — adding new plans requires no changes here.
 */
export function getPlanAction(currentPlan: Plan, targetPlan: Plan): PlanAction {
  if (targetPlan.tier === currentPlan.tier) return 'current';
  if (targetPlan.tier > currentPlan.tier) return 'upgrade';
  if (targetPlan.pricing === null) return 'cancel';
  return 'downgrade';
}

type ButtonVariant = 'default' | 'outline' | 'ghost';

export const PLAN_ACTION_CONFIG: Record<
  PlanAction,
  { label: string; variant: ButtonVariant }
> = {
  current: { label: 'Current plan', variant: 'ghost' },
  upgrade: { label: 'Upgrade', variant: 'default' },
  downgrade: { label: 'Downgrade', variant: 'outline' },
  cancel: { label: 'Downgrade', variant: 'outline' },
};

/**
 * Returns all plans below the current plan's tier, sorted by tier descending.
 * The highest available downgrade option comes first.
 */
export function getDowngradePlans(currentPlan: Plan): Array<Plan> {
  return ALL_PLANS.filter((p) => p.tier < currentPlan.tier).sort(
    (a, b) => b.tier - a.tier
  );
}

export interface LimitChange {
  label: string;
  from: number | string;
  to: number | string;
}

export interface PlanDiff {
  lostFeatures: Array<string>;
  limitChanges: Array<LimitChange>;
}

const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  maxMembers: 'Member limit',
};

/**
 * Computes the difference between two plans — features lost and limits reduced.
 * Used by the downgrade confirmation dialog.
 */
export function computePlanDiff(currentPlan: Plan, targetPlan: Plan): PlanDiff {
  const lostFeatures = currentPlan.features.filter(
    (f) => !targetPlan.features.includes(f)
  );

  const limitChanges: Array<LimitChange> = [];
  for (const key of Object.keys(currentPlan.limits) as Array<
    keyof PlanLimits
  >) {
    const from = currentPlan.limits[key];
    const to = targetPlan.limits[key];
    if (from !== to && (from === -1 || to === -1 || to < from)) {
      limitChanges.push({
        label: LIMIT_LABELS[key],
        from: from === -1 ? 'Unlimited' : from,
        to: to === -1 ? 'Unlimited' : to,
      });
    }
  }

  return { lostFeatures, limitChanges };
}
