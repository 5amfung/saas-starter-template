import { PLANS, describeEntitlements } from './plans';
import type { PlanDefinition } from './plans';
import {
  computeEntitlementDiff,
  LIMIT_METADATA,
  QUOTA_METADATA,
  UNLIMITED,
} from './entitlements';

export type PlanAction =
  | 'current'
  | 'upgrade'
  | 'downgrade'
  | 'cancel'
  | 'contact_sales';

/**
 * Determines the action type for switching from one plan to another.
 * Uses tier comparison — adding new plans requires no changes here.
 */
export function getPlanAction(
  currentPlan: PlanDefinition,
  targetPlan: PlanDefinition
): PlanAction {
  if (targetPlan.tier === currentPlan.tier) return 'current';
  if (targetPlan.isEnterprise) return 'contact_sales';
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
  contact_sales: { label: 'Contact Sales', variant: 'default' },
};

/**
 * Returns all plans below the current plan's tier, sorted by tier descending.
 * The highest available downgrade option comes first.
 */
export function getDowngradePlans(
  currentPlan: PlanDefinition
): Array<PlanDefinition> {
  return PLANS.filter((p) => p.tier < currentPlan.tier).sort(
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

/**
 * Computes the difference between two plans — features lost and limits reduced.
 * Used by the downgrade confirmation dialog.
 *
 * Delegates to entitlement-aware diffing under the hood, then maps results
 * back to the legacy PlanDiff shape for backward compatibility.
 */
export function computePlanDiff(
  currentPlan: PlanDefinition,
  targetPlan: PlanDefinition
): PlanDiff {
  const diff = computeEntitlementDiff(
    currentPlan.entitlements,
    targetPlan.entitlements
  );

  // Lost features: generate display bullets for current, check which are missing in target.
  const currentBullets = describeEntitlements(currentPlan.entitlements);
  const targetBullets = new Set(describeEntitlements(targetPlan.entitlements));
  const lostFeatures = currentBullets.filter((b) => !targetBullets.has(b));

  // Limit changes from the entitlement diff.
  const allNumericMeta = { ...LIMIT_METADATA, ...QUOTA_METADATA };
  const limitChanges: Array<LimitChange> = diff.lost.decreasedLimits.map(
    (change) => ({
      label: allNumericMeta[change.key].label,
      from: change.from === UNLIMITED ? 'Unlimited' : change.from,
      to: change.to === UNLIMITED ? 'Unlimited' : change.to,
    })
  );

  return { lostFeatures, limitChanges };
}
