import { FEATURE_METADATA } from '../domain/entitlements';
import type { FeatureKey } from '../domain/entitlements';
import type { PlanAction, PlanId } from '../domain/plans';

export type ProductUpgradeAction = 'checkout' | 'contact_sales' | 'none';

export type ProductPolicySource = 'plan' | 'override';

export type ProductPlanChangeVia =
  | 'checkout'
  | 'scheduled_change'
  | 'contact_sales'
  | 'blocked';

export interface WorkspaceFeatureAccessPolicy {
  allowed: boolean;
  source: ProductPolicySource;
  upgradeAction: ProductUpgradeAction;
  upgradePlanId: PlanId | null;
}

export interface WorkspaceBillingPortalPolicy {
  visible: boolean;
  allowed: boolean;
}

export interface WorkspacePlanChangePolicy {
  action: PlanAction;
  via: ProductPlanChangeVia;
}

export interface WorkspaceCurrentPlanCtaPolicy {
  type: 'manage_plan' | 'contact_sales';
}

export interface WorkspaceBillingLifecyclePolicy {
  isPendingCancel: boolean;
  isPendingDowngrade: boolean;
  effectivePeriodEnd: Date | null;
  scheduledTargetPlanId: PlanId | null;
}

export interface WorkspaceProductPolicy {
  currentPlanCta: WorkspaceCurrentPlanCtaPolicy;
  billingPortal: WorkspaceBillingPortalPolicy;
  lifecycle: WorkspaceBillingLifecyclePolicy;
  featureAccess: Record<FeatureKey, WorkspaceFeatureAccessPolicy>;
  planChanges: Record<PlanId, WorkspacePlanChangePolicy>;
}

export const FEATURE_KEYS = Object.keys(FEATURE_METADATA) as Array<FeatureKey>;
