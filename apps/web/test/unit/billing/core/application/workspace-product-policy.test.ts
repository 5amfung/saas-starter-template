import { describe, expect, it } from 'vitest';
import type { WorkspaceProductPolicyInput } from '@/billing/core/application/workspace-product-policy';
import { evaluateWorkspaceProductPolicy } from '@/billing/core/application/workspace-product-policy';
import { getPlanById } from '@/billing/core/domain/plans';
import { resolveEntitlements } from '@/billing/core/domain/entitlements';

function buildInput(
  overrides: Partial<WorkspaceProductPolicyInput> = {}
): WorkspaceProductPolicyInput {
  const currentPlan = overrides.currentPlan ?? getPlanById('free');
  if (!currentPlan) {
    throw new Error('Expected free plan fixture.');
  }

  const resolvedEntitlements =
    overrides.resolvedEntitlements ?? currentPlan.entitlements;

  return {
    currentPlan,
    resolvedEntitlements,
    subscriptionState: {
      status: null,
      stripeSubscriptionId: null,
      stripeScheduleId: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
    },
    scheduledTargetPlanId: null,
    ...overrides,
  };
}

describe('evaluateWorkspaceProductPolicy', () => {
  it('offers self-serve upgrades and hides billing portal for the free tier', () => {
    const policy = evaluateWorkspaceProductPolicy(buildInput());

    expect(policy.billingPortal.visible).toBe(false);
    expect(policy.featureAccess.auditLogs.allowed).toBe(false);
    expect(policy.featureAccess.auditLogs.upgradeAction).toBe('checkout');
    expect(policy.featureAccess.auditLogs.upgradePlanId).toBe('starter');
    expect(policy.planChanges.starter.action).toBe('upgrade');
    expect(policy.planChanges.starter.via).toBe('checkout');
  });

  it('shows billing portal for paid self-serve plans', () => {
    const currentPlan = getPlanById('starter');
    if (!currentPlan) {
      throw new Error('Expected starter plan fixture.');
    }

    const policy = evaluateWorkspaceProductPolicy(
      buildInput({
        currentPlan,
        resolvedEntitlements: currentPlan.entitlements,
        subscriptionState: {
          status: 'active',
          stripeSubscriptionId: 'sub_123',
          stripeScheduleId: null,
          periodEnd: new Date('2026-04-30'),
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      })
    );

    expect(policy.billingPortal.visible).toBe(true);
    expect(policy.billingPortal.allowed).toBe(true);
    expect(policy.planChanges.pro.via).toBe('checkout');
  });

  it('routes enterprise-only upgrades through contact sales', () => {
    const currentPlan = getPlanById('pro');
    if (!currentPlan) {
      throw new Error('Expected pro plan fixture.');
    }

    const policy = evaluateWorkspaceProductPolicy(
      buildInput({
        currentPlan,
        resolvedEntitlements: currentPlan.entitlements,
      })
    );

    expect(policy.planChanges.enterprise.action).toBe('contact_sales');
    expect(policy.planChanges.enterprise.via).toBe('contact_sales');
    expect(policy.featureAccess.sso.upgradeAction).toBe('contact_sales');
    expect(policy.featureAccess.sso.upgradePlanId).toBe('enterprise');
  });

  it('marks override-enabled features as allowed from override source', () => {
    const currentPlan = getPlanById('enterprise');
    if (!currentPlan) {
      throw new Error('Expected enterprise plan fixture.');
    }

    const resolvedEntitlements = resolveEntitlements(currentPlan.entitlements, {
      features: { sso: false, prioritySupport: false, apiAccess: false },
      limits: { members: 200 },
    });

    const policy = evaluateWorkspaceProductPolicy(
      buildInput({
        currentPlan,
        resolvedEntitlements,
      })
    );

    expect(policy.featureAccess.auditLogs.allowed).toBe(true);
    expect(policy.featureAccess.auditLogs.source).toBe('plan');
    expect(policy.featureAccess.sso.allowed).toBe(false);
    expect(policy.featureAccess.sso.source).toBe('override');
    expect(policy.featureAccess.sso.upgradeAction).toBe('none');
  });

  it('tracks pending cancellation and scheduled downgrade lifecycle state', () => {
    const currentPlan = getPlanById('pro');
    if (!currentPlan) {
      throw new Error('Expected pro plan fixture.');
    }

    const policy = evaluateWorkspaceProductPolicy(
      buildInput({
        currentPlan,
        resolvedEntitlements: currentPlan.entitlements,
        subscriptionState: {
          status: 'active',
          stripeSubscriptionId: 'sub_123',
          stripeScheduleId: 'sched_123',
          periodEnd: new Date('2026-05-31'),
          cancelAtPeriodEnd: true,
          cancelAt: null,
        },
        scheduledTargetPlanId: 'starter',
      })
    );

    expect(policy.lifecycle.isPendingCancel).toBe(true);
    expect(policy.lifecycle.isPendingDowngrade).toBe(true);
    expect(policy.lifecycle.scheduledTargetPlanId).toBe('starter');
    expect(policy.lifecycle.effectivePeriodEnd).toEqual(new Date('2026-05-31'));
  });
});
