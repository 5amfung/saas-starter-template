import { describe, expect, it } from 'vitest';
import {
  FREE_PLAN_ID,
  PLANS,
  formatPlanPrice,
  getFreePlan,
  getHighestTierPlanId,
  getPlanById,
  getUpgradePlan,
  getUpgradePlans,
  resolveWorkspacePlanId,
} from '@/auth/core/plans';

describe('plans', () => {
  it('exports exactly four plans', () => {
    expect(PLANS).toHaveLength(4);
  });

  it('has exactly one free-tier plan (tier 0)', () => {
    const freePlans = PLANS.filter((p) => p.tier === 0);
    expect(freePlans).toHaveLength(1);
    expect(freePlans[0].id).toBe(FREE_PLAN_ID);
    expect(freePlans[0].pricing).toBeNull();
  });

  it('getPlanById returns the correct plan', () => {
    const plan = getPlanById('starter');
    expect(plan).toBeDefined();
    expect(plan!.name).toBe('Starter');
  });

  it('getPlanById returns undefined for unknown id', () => {
    expect(getPlanById('nonexistent' as never)).toBeUndefined();
  });

  it('getFreePlan returns the free plan', () => {
    const free = getFreePlan();
    expect(free.id).toBe(FREE_PLAN_ID);
    expect(free.pricing).toBeNull();
  });

  it('pro plan has a higher tier than starter', () => {
    const starter = getPlanById('starter')!;
    const pro = getPlanById('pro')!;
    expect(pro.tier).toBeGreaterThan(starter.tier);
  });

  it('enterprise plan has the highest tier', () => {
    const enterprise = getPlanById('enterprise')!;
    const pro = getPlanById('pro')!;
    expect(enterprise.tier).toBeGreaterThan(pro.tier);
  });

  it('getHighestTierPlanId picks the highest tier', () => {
    expect(getHighestTierPlanId(['starter', 'pro'])).toBe('pro');
  });

  it('getHighestTierPlanId falls back to free for empty list', () => {
    expect(getHighestTierPlanId([])).toBe(FREE_PLAN_ID);
  });

  it('getHighestTierPlanId falls back to free for unknown IDs', () => {
    expect(getHighestTierPlanId(['unknown'])).toBe(FREE_PLAN_ID);
  });

  it('getHighestTierPlanId picks enterprise over pro', () => {
    expect(getHighestTierPlanId(['pro', 'enterprise'])).toBe('enterprise');
  });
});

describe('plan entitlements', () => {
  it('free plan has correct member limit', () => {
    const free = getFreePlan();
    expect(free.entitlements.limits.members).toBe(1);
  });

  it('starter plan has correct member limit', () => {
    const starter = getPlanById('starter')!;
    expect(starter.entitlements.limits.members).toBe(5);
  });

  it('pro plan has correct member limit', () => {
    const pro = getPlanById('pro')!;
    expect(pro.entitlements.limits.members).toBe(25);
  });

  it('enterprise plan has unlimited members', () => {
    const enterprise = getPlanById('enterprise')!;
    expect(enterprise.entitlements.limits.members).toBe(-1);
  });

  it('only enterprise has SSO enabled', () => {
    for (const plan of PLANS) {
      if (plan.id === 'enterprise') {
        expect(plan.entitlements.features.sso).toBe(true);
      } else {
        expect(plan.entitlements.features.sso).toBe(false);
      }
    }
  });

  it('pro and enterprise have audit logs enabled', () => {
    expect(getPlanById('free')!.entitlements.features.auditLogs).toBe(false);
    expect(getPlanById('starter')!.entitlements.features.auditLogs).toBe(false);
    expect(getPlanById('pro')!.entitlements.features.auditLogs).toBe(true);
    expect(getPlanById('enterprise')!.entitlements.features.auditLogs).toBe(
      true
    );
  });
});

describe('plan flags', () => {
  it('free plan is not stripe enabled and not enterprise', () => {
    const free = getFreePlan();
    expect(free.stripeEnabled).toBe(false);
    expect(free.isEnterprise).toBe(false);
  });

  it('starter plan is stripe enabled and not enterprise', () => {
    const starter = getPlanById('starter')!;
    expect(starter.stripeEnabled).toBe(true);
    expect(starter.isEnterprise).toBe(false);
  });

  it('enterprise plan is stripe enabled and is enterprise', () => {
    const enterprise = getPlanById('enterprise')!;
    expect(enterprise.stripeEnabled).toBe(true);
    expect(enterprise.isEnterprise).toBe(true);
  });
});

describe('getUpgradePlan', () => {
  it('returns next tier plan for starter', () => {
    const starter = getPlanById('starter')!;
    const upgrade = getUpgradePlan(starter);
    expect(upgrade).toBeDefined();
    expect(upgrade!.id).toBe('pro');
  });

  it('returns null for highest tier plan', () => {
    const enterprise = getPlanById('enterprise')!;
    const upgrade = getUpgradePlan(enterprise);
    expect(upgrade).toBeNull();
  });
});

describe('getUpgradePlans', () => {
  it('returns all higher-tier plans for free plan', () => {
    const free = getPlanById('free')!;
    const upgrades = getUpgradePlans(free);
    expect(upgrades).toHaveLength(3);
    expect(upgrades[0].id).toBe('starter');
    expect(upgrades[1].id).toBe('pro');
    expect(upgrades[2].id).toBe('enterprise');
  });

  it('returns pro and enterprise for starter plan', () => {
    const starter = getPlanById('starter')!;
    const upgrades = getUpgradePlans(starter);
    expect(upgrades).toHaveLength(2);
    expect(upgrades[0].id).toBe('pro');
    expect(upgrades[1].id).toBe('enterprise');
  });

  it('returns only enterprise for pro plan', () => {
    const pro = getPlanById('pro')!;
    const upgrades = getUpgradePlans(pro);
    expect(upgrades).toHaveLength(1);
    expect(upgrades[0].id).toBe('enterprise');
  });

  it('returns empty array for enterprise plan', () => {
    const enterprise = getPlanById('enterprise')!;
    const upgrades = getUpgradePlans(enterprise);
    expect(upgrades).toHaveLength(0);
  });
});

describe('resolveWorkspacePlanId', () => {
  it('returns free plan for empty subscriptions', () => {
    expect(resolveWorkspacePlanId([])).toBe(FREE_PLAN_ID);
  });

  it('returns free plan when no subscriptions are active or trialing', () => {
    expect(
      resolveWorkspacePlanId([
        { plan: 'pro', status: 'canceled' },
        { plan: 'pro', status: 'past_due' },
      ])
    ).toBe(FREE_PLAN_ID);
  });

  it('resolves active pro subscription', () => {
    expect(resolveWorkspacePlanId([{ plan: 'pro', status: 'active' }])).toBe(
      'pro'
    );
  });

  it('returns the plan ID for a trialing subscription', () => {
    expect(resolveWorkspacePlanId([{ plan: 'pro', status: 'trialing' }])).toBe(
      'pro'
    );
  });

  it('picks the highest tier when multiple active subscriptions exist', () => {
    expect(
      resolveWorkspacePlanId([
        { plan: 'starter', status: 'active' },
        { plan: 'pro', status: 'active' },
      ])
    ).toBe('pro');
  });

  it('ignores non-active subscriptions when picking highest tier', () => {
    expect(
      resolveWorkspacePlanId([
        { plan: 'pro', status: 'canceled' },
        { plan: 'starter', status: 'active' },
      ])
    ).toBe('starter');
  });

  it('falls back to free plan for unknown plan IDs', () => {
    expect(
      resolveWorkspacePlanId([{ plan: 'unknown-plan', status: 'active' }])
    ).toBe(FREE_PLAN_ID);
  });

  it('resolves active enterprise subscription', () => {
    expect(
      resolveWorkspacePlanId([{ plan: 'enterprise', status: 'active' }])
    ).toBe('enterprise');
  });

  it('picks enterprise over pro when both active', () => {
    expect(
      resolveWorkspacePlanId([
        { plan: 'pro', status: 'active' },
        { plan: 'enterprise', status: 'active' },
      ])
    ).toBe('enterprise');
  });
});

describe('formatPlanPrice', () => {
  it('returns empty string for free plans', () => {
    const freePlan = getPlanById('free')!;
    expect(formatPlanPrice(freePlan, false)).toBe('');
  });

  it('formats monthly price', () => {
    const pro = getPlanById('pro')!;
    const price = formatPlanPrice(pro, false);
    expect(price).toMatch(/\$49\/mo$/);
  });

  it('formats annual price as monthly equivalent', () => {
    const pro = getPlanById('pro')!;
    const price = formatPlanPrice(pro, true);
    expect(price).toMatch(/\/mo$/);
    expect(price).toContain('$');
  });

  it('returns empty string for enterprise (no pricing)', () => {
    const enterprise = getPlanById('enterprise')!;
    expect(formatPlanPrice(enterprise, false)).toBe('');
  });
});
