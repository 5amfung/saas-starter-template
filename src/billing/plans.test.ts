import { describe, expect, it } from 'vitest';
import {
  FREE_PLAN_ID,
  PLANS,
  getFreePlan,
  getHighestTierPlanId,
  getPlanById,
  getPlanByStripePriceId,
  getPlanLimitsForPlanId,
  getUpgradePlan,
  normalizePlanId,
  resolveUserPlanId,
} from '@/billing/plans';

describe('plans', () => {
  it('exports at least two plans', () => {
    expect(PLANS.length).toBeGreaterThanOrEqual(2);
  });

  it('has exactly one free-tier plan (tier 0)', () => {
    const freePlans = PLANS.filter((p) => p.tier === 0);
    expect(freePlans).toHaveLength(1);
    expect(freePlans[0].id).toBe(FREE_PLAN_ID);
    expect(freePlans[0].price).toBe(0);
    expect(freePlans[0].stripePriceId).toBeNull();
  });

  it('getPlanById returns the correct plan', () => {
    const plan = getPlanById('starter');
    expect(plan).toBeDefined();
    expect(plan!.name).toBe('Starter');
  });

  it('getPlanById returns undefined for unknown id', () => {
    expect(getPlanById('nonexistent' as never)).toBeUndefined();
  });

  it('getPlanByStripePriceId returns the correct plan', () => {
    const paidPlan = PLANS.find((p) => p.stripePriceId !== null);
    if (!paidPlan) return; // No paid plan configured with real price IDs yet.
    const found = getPlanByStripePriceId(paidPlan.stripePriceId!);
    expect(found).toBeDefined();
    expect(found!.id).toBe(paidPlan.id);
  });

  it('getFreePlan returns the starter plan', () => {
    const free = getFreePlan();
    expect(free.id).toBe(FREE_PLAN_ID);
    expect(free.price).toBe(0);
  });

  it('getPlanLimitsForPlanId returns correct limits for starter', () => {
    const limits = getPlanLimitsForPlanId('starter');
    expect(limits.maxWorkspaces).toBe(1);
    expect(limits.maxMembersPerWorkspace).toBe(1);
  });

  it('getPlanLimitsForPlanId returns higher limits for pro', () => {
    const limits = getPlanLimitsForPlanId('pro-monthly');
    expect(limits.maxWorkspaces).toBeGreaterThan(1);
    expect(limits.maxMembersPerWorkspace).toBeGreaterThan(1);
  });

  it('getPlanLimitsForPlanId falls back to starter for unknown plan', () => {
    const limits = getPlanLimitsForPlanId('nonexistent' as never);
    expect(limits.maxWorkspaces).toBe(1);
  });

  it('pro plans have a higher tier than starter', () => {
    const starter = getPlanById('starter')!;
    const proMonthly = getPlanById('pro-monthly')!;
    const proAnnual = getPlanById('pro-annual')!;
    expect(proMonthly.tier).toBeGreaterThan(starter.tier);
    expect(proAnnual.tier).toBeGreaterThan(starter.tier);
  });

  it('getHighestTierPlanId picks the highest tier', () => {
    expect(getHighestTierPlanId(['starter', 'pro-monthly'])).toBe(
      'pro-monthly',
    );
  });

  it('getHighestTierPlanId falls back to free for empty list', () => {
    expect(getHighestTierPlanId([])).toBe(FREE_PLAN_ID);
  });

  it('getHighestTierPlanId falls back to free for unknown IDs', () => {
    expect(getHighestTierPlanId(['unknown'])).toBe(FREE_PLAN_ID);
  });
});

describe('normalizePlanId', () => {
  it('maps Better Auth "pro" to "pro-monthly"', () => {
    expect(normalizePlanId('pro')).toBe('pro-monthly');
  });

  it('passes through known plan IDs unchanged', () => {
    expect(normalizePlanId('starter')).toBe('starter');
    expect(normalizePlanId('pro-monthly')).toBe('pro-monthly');
    expect(normalizePlanId('pro-annual')).toBe('pro-annual');
  });
});

describe('getUpgradePlan', () => {
  it('returns next tier plan for starter (monthly)', () => {
    const starter = getPlanById('starter')!;
    const upgrade = getUpgradePlan(starter, false);
    expect(upgrade).toBeDefined();
    expect(upgrade!.id).toBe('pro-monthly');
  });

  it('returns next tier plan for starter (annual)', () => {
    const starter = getPlanById('starter')!;
    const upgrade = getUpgradePlan(starter, true);
    expect(upgrade).toBeDefined();
    expect(upgrade!.id).toBe('pro-annual');
  });

  it('returns null for highest tier plan', () => {
    const pro = getPlanById('pro-monthly')!;
    const upgrade = getUpgradePlan(pro, false);
    expect(upgrade).toBeNull();
  });

  it('returns null for highest tier plan (annual variant)', () => {
    const pro = getPlanById('pro-annual')!;
    const upgrade = getUpgradePlan(pro, true);
    expect(upgrade).toBeNull();
  });
});

describe('resolveUserPlanId', () => {
  it('returns free plan for empty subscriptions', () => {
    expect(resolveUserPlanId([])).toBe(FREE_PLAN_ID);
  });

  it('returns free plan when no subscriptions are active or trialing', () => {
    expect(
      resolveUserPlanId([
        { plan: 'pro', status: 'canceled' },
        { plan: 'pro', status: 'past_due' },
      ]),
    ).toBe(FREE_PLAN_ID);
  });

  it('resolves Better Auth "pro" plan name to pro-monthly', () => {
    expect(resolveUserPlanId([{ plan: 'pro', status: 'active' }])).toBe(
      'pro-monthly',
    );
  });

  it('returns the plan ID for a trialing subscription', () => {
    expect(resolveUserPlanId([{ plan: 'pro', status: 'trialing' }])).toBe(
      'pro-monthly',
    );
  });

  it('picks the highest tier when multiple active subscriptions exist', () => {
    expect(
      resolveUserPlanId([
        { plan: 'starter', status: 'active' },
        { plan: 'pro', status: 'active' },
      ]),
    ).toBe('pro-monthly');
  });

  it('ignores non-active subscriptions when picking highest tier', () => {
    expect(
      resolveUserPlanId([
        { plan: 'pro', status: 'canceled' },
        { plan: 'starter', status: 'active' },
      ]),
    ).toBe('starter');
  });

  it('falls back to free plan for unknown plan IDs', () => {
    expect(
      resolveUserPlanId([{ plan: 'unknown-plan', status: 'active' }]),
    ).toBe(FREE_PLAN_ID);
  });
});
