import { describe, expect, it } from 'vitest';
import { getPlanById } from '@/auth/core/plans';
import {
  computePlanDiff,
  getDowngradePlans,
  getPlanAction,
} from '@/auth/core/plan-actions';

describe('getPlanAction', () => {
  const free = getPlanById('free')!;
  const starter = getPlanById('starter')!;
  const pro = getPlanById('pro')!;
  const enterprise = getPlanById('enterprise')!;

  it('returns "current" for same plan', () => {
    expect(getPlanAction(pro, pro)).toBe('current');
  });

  it('returns "upgrade" when target tier is higher (non-enterprise)', () => {
    expect(getPlanAction(free, starter)).toBe('upgrade');
    expect(getPlanAction(free, pro)).toBe('upgrade');
    expect(getPlanAction(starter, pro)).toBe('upgrade');
  });

  it('returns "contact_sales" when target plan is enterprise', () => {
    expect(getPlanAction(free, enterprise)).toBe('contact_sales');
    expect(getPlanAction(starter, enterprise)).toBe('contact_sales');
    expect(getPlanAction(pro, enterprise)).toBe('contact_sales');
  });

  it('returns "cancel" when target is free (no pricing, not enterprise)', () => {
    expect(getPlanAction(pro, free)).toBe('cancel');
    expect(getPlanAction(starter, free)).toBe('cancel');
  });

  it('returns "downgrade" when target is lower tier with pricing', () => {
    expect(getPlanAction(pro, starter)).toBe('downgrade');
  });

  it('returns "downgrade" from enterprise to pro', () => {
    expect(getPlanAction(enterprise, pro)).toBe('downgrade');
  });

  it('returns "downgrade" from enterprise to starter', () => {
    expect(getPlanAction(enterprise, starter)).toBe('downgrade');
  });
});

describe('getDowngradePlans', () => {
  const free = getPlanById('free')!;
  const starter = getPlanById('starter')!;
  const pro = getPlanById('pro')!;
  const enterprise = getPlanById('enterprise')!;

  it('returns empty array for free plan', () => {
    expect(getDowngradePlans(free)).toHaveLength(0);
  });

  it('returns only free for starter', () => {
    const downgrades = getDowngradePlans(starter);
    expect(downgrades).toHaveLength(1);
    expect(downgrades[0].id).toBe('free');
  });

  it('returns starter and free for pro (descending tier)', () => {
    const downgrades = getDowngradePlans(pro);
    expect(downgrades).toHaveLength(2);
    expect(downgrades[0].id).toBe('starter');
    expect(downgrades[1].id).toBe('free');
  });

  it('returns pro, starter, and free for enterprise (descending tier)', () => {
    const downgrades = getDowngradePlans(enterprise);
    expect(downgrades).toHaveLength(3);
    expect(downgrades[0].id).toBe('pro');
    expect(downgrades[1].id).toBe('starter');
    expect(downgrades[2].id).toBe('free');
  });
});

describe('computePlanDiff', () => {
  const free = getPlanById('free')!;
  const starter = getPlanById('starter')!;
  const pro = getPlanById('pro')!;

  it('returns lost features for pro -> starter', () => {
    const diff = computePlanDiff(pro, starter);
    // Pro has features like audit logs, API access, priority support that starter lacks.
    expect(diff.lostFeatures.length).toBeGreaterThan(0);
  });

  it('returns limit changes for pro -> starter', () => {
    const diff = computePlanDiff(pro, starter);
    expect(diff.limitChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Members', from: 25, to: 5 }),
      ])
    );
  });

  it('returns limit changes for pro -> free', () => {
    const diff = computePlanDiff(pro, free);
    expect(diff.limitChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Members', from: 25, to: 1 }),
      ])
    );
  });

  it('returns empty diff for same plan', () => {
    const diff = computePlanDiff(pro, pro);
    expect(diff.lostFeatures).toHaveLength(0);
    expect(diff.limitChanges).toHaveLength(0);
  });

  it('returns limit change for starter -> free', () => {
    const diff = computePlanDiff(starter, free);
    expect(diff.limitChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Members', from: 5, to: 1 }),
      ])
    );
  });
});
