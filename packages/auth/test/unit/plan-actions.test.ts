import { describe, expect, it } from 'vitest';
import { getPlanById } from '../../src/plans';
import {
  computePlanDiff,
  getDowngradePlans,
  getPlanAction,
} from '../../src/plan-actions';

describe('getPlanAction', () => {
  const free = getPlanById('free')!;
  const starter = getPlanById('starter')!;
  const pro = getPlanById('pro')!;

  it('returns "current" for same plan', () => {
    expect(getPlanAction(pro, pro)).toBe('current');
  });

  it('returns "upgrade" when target tier is higher', () => {
    expect(getPlanAction(free, starter)).toBe('upgrade');
    expect(getPlanAction(free, pro)).toBe('upgrade');
    expect(getPlanAction(starter, pro)).toBe('upgrade');
  });

  it('returns "cancel" when target is free (no pricing)', () => {
    expect(getPlanAction(pro, free)).toBe('cancel');
    expect(getPlanAction(starter, free)).toBe('cancel');
  });

  it('returns "downgrade" when target is lower tier with pricing', () => {
    expect(getPlanAction(pro, starter)).toBe('downgrade');
  });
});

describe('getDowngradePlans', () => {
  const free = getPlanById('free')!;
  const starter = getPlanById('starter')!;
  const pro = getPlanById('pro')!;

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
});

describe('computePlanDiff', () => {
  const free = getPlanById('free')!;
  const starter = getPlanById('starter')!;
  const pro = getPlanById('pro')!;

  it('returns lost features and limit changes for pro → starter', () => {
    const diff = computePlanDiff(pro, starter);
    expect(diff.lostFeatures).toContain('Email customer support');
    expect(diff.limitChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Member limit', from: 25, to: 5 }),
      ])
    );
  });

  it('returns lost features and limit changes for pro → free', () => {
    const diff = computePlanDiff(pro, free);
    expect(diff.lostFeatures).toContain('Email customer support');
    expect(diff.limitChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Member limit', from: 25, to: 1 }),
      ])
    );
  });

  it('returns empty diff for same plan', () => {
    const diff = computePlanDiff(pro, pro);
    expect(diff.lostFeatures).toHaveLength(0);
    expect(diff.limitChanges).toHaveLength(0);
  });

  it('returns limit change for starter → free', () => {
    const diff = computePlanDiff(starter, free);
    expect(diff.limitChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Member limit', from: 5, to: 1 }),
      ])
    );
  });
});
