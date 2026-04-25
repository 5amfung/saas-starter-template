import { FEATURE_KEYS } from '../contracts/product-policy';
import { PLANS, getPlanAction, getUpgradePlan } from '../domain/plans';
import type { PlanDefinition, PlanId } from '../domain/plans';
import type {
  ProductPlanChangeVia,
  ProductUpgradeAction,
  WorkspaceProductPolicy,
} from '../contracts/product-policy';
import type { Entitlements } from '../domain/entitlements';
import type { WorkspaceBillingSnapshot } from '../contracts/snapshot';

export interface WorkspaceProductPolicyInput {
  currentPlan: PlanDefinition;
  resolvedEntitlements: Entitlements;
  subscriptionState: WorkspaceBillingSnapshot['subscriptionState'];
  scheduledTargetPlanId: PlanId | null;
}

export function getProductUpgradeActionForPlan(
  plan: PlanDefinition | null
): ProductUpgradeAction {
  if (!plan) return 'none';
  return plan.isEnterprise || !plan.stripeEnabled
    ? 'contact_sales'
    : 'checkout';
}

function toPlanChangeVia(
  targetPlan: PlanDefinition,
  action: ReturnType<typeof getPlanAction>
): ProductPlanChangeVia {
  if (action === 'contact_sales') return 'contact_sales';
  if (action === 'upgrade' && targetPlan.stripeEnabled) return 'checkout';
  if (action === 'downgrade' || action === 'cancel') return 'scheduled_change';
  return 'blocked';
}

export function evaluateWorkspaceProductPolicy(
  input: WorkspaceProductPolicyInput
): WorkspaceProductPolicy {
  const nextUpgradePlan = getUpgradePlan(input.currentPlan);
  const isPendingCancel =
    input.subscriptionState.cancelAtPeriodEnd ||
    !!input.subscriptionState.cancelAt;
  const isPendingDowngrade = !!input.subscriptionState.stripeScheduleId;

  return {
    currentPlanCta: {
      type: input.currentPlan.isEnterprise ? 'contact_sales' : 'manage_plan',
    },
    billingPortal: {
      visible:
        input.currentPlan.pricing !== null && !input.currentPlan.isEnterprise,
      allowed:
        input.currentPlan.pricing !== null && !input.currentPlan.isEnterprise,
    },
    lifecycle: {
      isPendingCancel,
      isPendingDowngrade,
      effectivePeriodEnd:
        input.subscriptionState.periodEnd ?? input.subscriptionState.cancelAt,
      scheduledTargetPlanId: input.scheduledTargetPlanId,
    },
    featureAccess: Object.fromEntries(
      FEATURE_KEYS.map((key) => {
        const allowed = input.resolvedEntitlements.features[key];
        const source =
          allowed === input.currentPlan.entitlements.features[key]
            ? 'plan'
            : 'override';

        return [
          key,
          {
            allowed,
            source,
            upgradeAction: allowed
              ? 'none'
              : getProductUpgradeActionForPlan(nextUpgradePlan),
            upgradePlanId: allowed ? null : (nextUpgradePlan?.id ?? null),
          },
        ];
      })
    ) as WorkspaceProductPolicy['featureAccess'],
    planChanges: Object.fromEntries(
      PLANS.map((targetPlan) => {
        const action = getPlanAction(input.currentPlan, targetPlan);
        return [
          targetPlan.id,
          {
            action,
            via: toPlanChangeVia(targetPlan, action),
          },
        ];
      })
    ) as WorkspaceProductPolicy['planChanges'],
  };
}
