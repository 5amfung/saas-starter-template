import { describe, expect, it } from 'vitest';
import type {
  EntitlementOverrides,
  Entitlements,
} from '@/auth/core/entitlements';
import {
  UNLIMITED,
  checkLimit,
  computeEntitlementDiff,
  describeEntitlements,
  formatEntitlementValue,
  hasFeature,
  resolveEntitlements,
} from '@/auth/core/entitlements';

const BASE: Entitlements = {
  limits: { members: 5, projects: 10, apiKeys: 0 },
  features: {
    sso: false,
    auditLogs: false,
    apiAccess: true,
    prioritySupport: false,
  },
  quotas: { storageGb: 10, apiCallsMonthly: 0 },
};

const ENTERPRISE: Entitlements = {
  limits: { members: -1, projects: -1, apiKeys: -1 },
  features: {
    sso: true,
    auditLogs: true,
    apiAccess: true,
    prioritySupport: true,
  },
  quotas: { storageGb: -1, apiCallsMonthly: -1 },
};

describe('resolveEntitlements', () => {
  it('returns base when no overrides', () => {
    expect(resolveEntitlements(BASE)).toEqual(BASE);
  });

  it('returns base when overrides is null', () => {
    expect(resolveEntitlements(BASE, null)).toEqual(BASE);
  });

  it('merges partial limit overrides', () => {
    const result = resolveEntitlements(ENTERPRISE, {
      limits: { members: 500 },
    });
    expect(result.limits.members).toBe(500);
    expect(result.limits.projects).toBe(-1);
  });

  it('merges partial feature overrides', () => {
    const result = resolveEntitlements(ENTERPRISE, {
      features: { sso: false },
    });
    expect(result.features.sso).toBe(false);
    expect(result.features.auditLogs).toBe(true);
  });

  it('handles null individual categories in overrides', () => {
    const result = resolveEntitlements(ENTERPRISE, {
      limits: null,
      features: undefined,
      quotas: { storageGb: 500 },
    });
    // null/undefined categories don't override base values.
    expect(result.limits).toEqual(ENTERPRISE.limits);
    expect(result.features).toEqual(ENTERPRISE.features);
    expect(result.quotas.storageGb).toBe(500);
    expect(result.quotas.apiCallsMonthly).toBe(-1);
  });

  it('handles all null override categories safely', () => {
    const result = resolveEntitlements(ENTERPRISE, {
      limits: null,
      features: null,
      quotas: null,
    });
    expect(result).toEqual(ENTERPRISE);
  });

  it('drops unknown override keys', () => {
    const overrides = {
      limits: { members: 50, workspaces: 10 },
    } as unknown as EntitlementOverrides;

    const result = resolveEntitlements(ENTERPRISE, overrides);

    expect(result).toEqual({
      ...ENTERPRISE,
      limits: { ...ENTERPRISE.limits, members: 50 },
    });
  });

  it('merges partial quota overrides', () => {
    const result = resolveEntitlements(ENTERPRISE, {
      quotas: { storageGb: 1000 },
    });
    expect(result.quotas.storageGb).toBe(1000);
    expect(result.quotas.apiCallsMonthly).toBe(-1);
  });
});

describe('checkLimit', () => {
  it('allows when under limit', () => {
    const result = checkLimit(BASE, 'members', 3);
    expect(result).toEqual({ allowed: true, limit: 5, current: 3 });
  });

  it('blocks when at limit', () => {
    const result = checkLimit(BASE, 'members', 5);
    expect(result).toEqual({ allowed: false, limit: 5, current: 5 });
  });

  it('always allows unlimited', () => {
    const result = checkLimit(ENTERPRISE, 'members', 9999);
    expect(result).toEqual({ allowed: true, limit: -1, current: 9999 });
  });

  it('works with quota keys', () => {
    const result = checkLimit(BASE, 'storageGb', 8);
    expect(result).toEqual({ allowed: true, limit: 10, current: 8 });
  });
});

describe('hasFeature', () => {
  it('returns true when enabled', () => {
    expect(hasFeature(BASE, 'apiAccess')).toBe(true);
  });

  it('returns false when disabled', () => {
    expect(hasFeature(BASE, 'sso')).toBe(false);
  });
});

describe('computeEntitlementDiff', () => {
  it('detects lost features on downgrade', () => {
    const diff = computeEntitlementDiff(ENTERPRISE, BASE);
    expect(diff.lost.features).toContain('sso');
    expect(diff.lost.features).toContain('auditLogs');
    expect(diff.lost.features).toContain('prioritySupport');
    expect(diff.lost.features).not.toContain('apiAccess');
  });

  it('detects decreased limits on downgrade', () => {
    const diff = computeEntitlementDiff(ENTERPRISE, BASE);
    expect(diff.lost.decreasedLimits).toContainEqual(
      expect.objectContaining({ key: 'members', from: -1, to: 5 })
    );
  });

  it('detects gained features on upgrade', () => {
    const diff = computeEntitlementDiff(BASE, ENTERPRISE);
    expect(diff.gained.features).toContain('sso');
  });

  it('returns empty diff for identical entitlements', () => {
    const diff = computeEntitlementDiff(BASE, BASE);
    expect(diff.gained.features).toHaveLength(0);
    expect(diff.lost.features).toHaveLength(0);
    expect(diff.gained.increasedLimits).toHaveLength(0);
    expect(diff.lost.decreasedLimits).toHaveLength(0);
  });
});

describe('formatEntitlementValue', () => {
  it('formats unlimited', () => {
    expect(formatEntitlementValue(UNLIMITED)).toBe('Unlimited');
  });

  it('formats numeric', () => {
    expect(formatEntitlementValue(25)).toBe('25');
  });
});

describe('describeEntitlements', () => {
  it('generates feature bullets from entitlements', () => {
    const bullets = describeEntitlements(BASE);
    expect(bullets).toContain('Up to 5 members');
    expect(bullets).toContain('Up to 10 projects');
    expect(bullets).toContain('API Access');
  });

  it('skips zero-value limits and quotas', () => {
    const bullets = describeEntitlements(BASE);
    expect(bullets.join(' ')).not.toContain('API Keys');
    expect(bullets.join(' ')).not.toContain('API Calls');
  });

  it('shows unlimited for enterprise', () => {
    const bullets = describeEntitlements(ENTERPRISE);
    expect(bullets).toContain('Unlimited members');
  });
});
