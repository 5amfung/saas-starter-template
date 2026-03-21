import { describe, expect, it } from 'vitest';
import {
  FREE_PLAN_ID,
  PLANS,
  formatPlanPrice,
  getFreePlan,
  getHighestTierPlanId,
  getPlanById,
  getPlanFeatures,
  getPlanLimitsForPlanId,
  getUpgradePlan,
  getUpgradePlans,
  resolveUserPlanId,
} from '../../src/plans';

describe('plans', () => {
  it('exports exactly three plans', () => {
    expect(PLANS).toHaveLength(3);
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

  it('getPlanLimitsForPlanId returns correct limits for starter', () => {
    const limits = getPlanLimitsForPlanId('starter');
    expect(limits.maxWorkspaces).toBe(5);
    expect(limits.maxMembersPerWorkspace).toBe(5);
  });

  it('getPlanLimitsForPlanId returns higher limits for pro', () => {
    const limits = getPlanLimitsForPlanId('pro');
    expect(limits.maxWorkspaces).toBeGreaterThan(1);
    expect(limits.maxMembersPerWorkspace).toBeGreaterThan(1);
  });

  it('getPlanLimitsForPlanId falls back to free plan for unknown plan', () => {
    const limits = getPlanLimitsForPlanId('nonexistent' as never);
    expect(limits.maxWorkspaces).toBe(1);
  });

  it('pro plan has a higher tier than starter', () => {
    const starter = getPlanById('starter')!;
    const pro = getPlanById('pro')!;
    expect(pro.tier).toBeGreaterThan(starter.tier);
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
});

describe('getUpgradePlan', () => {
  it('returns next tier plan for starter', () => {
    const starter = getPlanById('starter')!;
    const upgrade = getUpgradePlan(starter);
    expect(upgrade).toBeDefined();
    expect(upgrade!.id).toBe('pro');
  });

  it('returns null for highest tier plan', () => {
    const pro = getPlanById('pro')!;
    const upgrade = getUpgradePlan(pro);
    expect(upgrade).toBeNull();
  });
});

describe('getUpgradePlans', () => {
  it('returns all higher-tier plans for free plan', () => {
    const free = getPlanById('free')!;
    const upgrades = getUpgradePlans(free);
    expect(upgrades).toHaveLength(2);
    expect(upgrades[0].id).toBe('starter');
    expect(upgrades[1].id).toBe('pro');
  });

  it('returns only pro for starter plan', () => {
    const starter = getPlanById('starter')!;
    const upgrades = getUpgradePlans(starter);
    expect(upgrades).toHaveLength(1);
    expect(upgrades[0].id).toBe('pro');
  });

  it('returns empty array for highest tier plan', () => {
    const pro = getPlanById('pro')!;
    const upgrades = getUpgradePlans(pro);
    expect(upgrades).toHaveLength(0);
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
      ])
    ).toBe(FREE_PLAN_ID);
  });

  it('resolves active pro subscription', () => {
    expect(resolveUserPlanId([{ plan: 'pro', status: 'active' }])).toBe('pro');
  });

  it('returns the plan ID for a trialing subscription', () => {
    expect(resolveUserPlanId([{ plan: 'pro', status: 'trialing' }])).toBe(
      'pro'
    );
  });

  it('picks the highest tier when multiple active subscriptions exist', () => {
    expect(
      resolveUserPlanId([
        { plan: 'starter', status: 'active' },
        { plan: 'pro', status: 'active' },
      ])
    ).toBe('pro');
  });

  it('ignores non-active subscriptions when picking highest tier', () => {
    expect(
      resolveUserPlanId([
        { plan: 'pro', status: 'canceled' },
        { plan: 'starter', status: 'active' },
      ])
    ).toBe('starter');
  });

  it('falls back to free plan for unknown plan IDs', () => {
    expect(
      resolveUserPlanId([{ plan: 'unknown-plan', status: 'active' }])
    ).toBe(FREE_PLAN_ID);
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
});

describe('getPlanFeatures', () => {
  it('returns base features for monthly', () => {
    const pro = getPlanById('pro')!;
    const features = getPlanFeatures(pro, false);
    expect(features).toContain('10 workspaces');
    expect(features).not.toContain('2 months free');
  });

  it('returns base + bonus features for annual', () => {
    const pro = getPlanById('pro')!;
    const features = getPlanFeatures(pro, true);
    expect(features).toContain('10 workspaces');
    expect(features).toContain('2 months free');
  });
});
