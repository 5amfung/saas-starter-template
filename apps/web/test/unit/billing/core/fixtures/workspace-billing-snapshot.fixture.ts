import type { WorkspaceBillingSnapshot } from '@/billing/core/contracts/snapshot';
import { PLANS } from '@/billing/core/domain/plans';

type SnapshotOverrides = Partial<WorkspaceBillingSnapshot>;

export function buildWorkspaceBillingSnapshotFixture(
  overrides: SnapshotOverrides = {}
): WorkspaceBillingSnapshot {
  const freePlan = PLANS.find((plan) => plan.id === 'free');
  if (!freePlan) {
    throw new Error('Missing free plan fixture baseline.');
  }

  return {
    workspaceId: 'ws_fixture',
    currentPlanId: 'free',
    currentEntitlements: freePlan.entitlements,
    subscriptionState: {
      status: null,
      stripeSubscriptionId: null,
      stripeScheduleId: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
    },
    catalogPlans: [...PLANS],
    targetActionsByPlan: {
      free: 'current',
      starter: 'upgrade',
      pro: 'upgrade',
      enterprise: 'contact_sales',
    },
    scheduledTargetPlanId: null,
    memberCount: 0,
    ...overrides,
  };
}
