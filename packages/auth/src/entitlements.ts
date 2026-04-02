// ────────────────────────────────────────────────────────────────────────────
// Entitlement type system — defines what each plan grants and how to
// resolve, check, diff, and display entitlements.
//
// Three entitlement categories:
//   Limits   — hard caps that block actions when exceeded.
//   Features — boolean gates that enable/disable capabilities.
//   Quotas   — usage-metered quantities.
//
// All numeric values use -1 as the sentinel for "unlimited".
// ────────────────────────────────────────────────────────────────────────────

// ── Key registries ───────────────────────────────────────────────────────

/** Hard caps — block actions when exceeded. */
export type LimitKey = 'members' | 'projects' | 'workspaces' | 'apiKeys';

/** Boolean gates — enable/disable capabilities. */
export type FeatureKey = 'sso' | 'auditLogs' | 'apiAccess' | 'prioritySupport';

/** Usage-metered quantities. */
export type QuotaKey = 'storageGb' | 'apiCallsMonthly';

/** Union of all numeric entitlement keys (limits + quotas). */
export type NumericEntitlementKey = LimitKey | QuotaKey;

// ── Entitlements shape ───────────────────────────────────────────────────

export interface Entitlements {
  limits: Record<LimitKey, number>; // -1 = unlimited
  features: Record<FeatureKey, boolean>;
  quotas: Record<QuotaKey, number>; // -1 = unlimited
}

// ── Metadata maps ────────────────────────────────────────────────────────

export interface EntitlementMeta {
  label: string;
  description: string;
}

export interface NumericEntitlementMeta {
  label: string;
  unit: string;
}

export const FEATURE_METADATA: Record<FeatureKey, EntitlementMeta> = {
  sso: { label: 'SSO', description: 'Single sign-on via SAML/OIDC' },
  auditLogs: {
    label: 'Audit Logs',
    description: 'Full activity audit trail',
  },
  apiAccess: {
    label: 'API Access',
    description: 'Programmatic API access',
  },
  prioritySupport: {
    label: 'Priority Support',
    description: 'Dedicated support channel',
  },
};

export const LIMIT_METADATA: Record<LimitKey, NumericEntitlementMeta> = {
  members: { label: 'Members', unit: 'members' },
  projects: { label: 'Projects', unit: 'projects' },
  workspaces: { label: 'Workspaces', unit: 'workspaces' },
  apiKeys: { label: 'API Keys', unit: 'keys' },
};

export const QUOTA_METADATA: Record<QuotaKey, NumericEntitlementMeta> = {
  storageGb: { label: 'Storage', unit: 'GB' },
  apiCallsMonthly: { label: 'API Calls/Month', unit: 'calls' },
};

// ── Sentinel ─────────────────────────────────────────────────────────────

/** Value representing "unlimited" for numeric entitlements. */
export const UNLIMITED = -1;

// ── Resolution ───────────────────────────────────────────────────────────

/**
 * Typed override shape — used by the resolver and all callers.
 * The DB stores JSONB as Record<string, ...> (schemaless), so callers
 * must cast through this type at the DB read boundary.
 */
export type EntitlementOverrides = {
  limits?: Partial<Record<LimitKey, number>> | null;
  features?: Partial<Record<FeatureKey, boolean>> | null;
  quotas?: Partial<Record<QuotaKey, number>> | null;
};

/**
 * Merges base plan entitlements with optional per-workspace overrides.
 * Pure function — no DB, no Stripe, no side effects.
 */
export function resolveEntitlements(
  base: Entitlements,
  overrides?: EntitlementOverrides | null
): Entitlements {
  if (!overrides) return base;
  return {
    limits: { ...base.limits, ...overrides.limits },
    features: { ...base.features, ...overrides.features },
    quotas: { ...base.quotas, ...overrides.quotas },
  };
}

// ── Enforcement helpers ──────────────────────────────────────────────────

export interface CheckLimitResult {
  allowed: boolean;
  limit: number;
  current: number;
}

/**
 * Checks whether current usage is within a numeric entitlement cap.
 * Works for both limits and quotas.
 */
export function checkLimit(
  entitlements: Entitlements,
  key: NumericEntitlementKey,
  currentUsage: number
): CheckLimitResult {
  // LimitKey and QuotaKey are non-overlapping by design. If a key exists in
  // limits, use that; otherwise fall back to quotas.
  const limit =
    key in entitlements.limits
      ? entitlements.limits[key as LimitKey]
      : entitlements.quotas[key as QuotaKey];
  return {
    allowed: limit === UNLIMITED || currentUsage < limit,
    limit,
    current: currentUsage,
  };
}

/** Checks whether a boolean feature is enabled. */
export function hasFeature(
  entitlements: Entitlements,
  key: FeatureKey
): boolean {
  return entitlements.features[key];
}

// ── Diff ─────────────────────────────────────────────────────────────────

export interface NumericChange {
  key: NumericEntitlementKey;
  label: string;
  from: number;
  to: number;
}

export interface EntitlementDiff {
  gained: {
    features: Array<FeatureKey>;
    increasedLimits: Array<NumericChange>;
  };
  lost: {
    features: Array<FeatureKey>;
    decreasedLimits: Array<NumericChange>;
  };
}

/**
 * Computes the difference between two entitlement sets.
 * Used by the downgrade confirmation dialog.
 */
export function computeEntitlementDiff(
  current: Entitlements,
  target: Entitlements
): EntitlementDiff {
  const gainedFeatures: Array<FeatureKey> = [];
  const lostFeatures: Array<FeatureKey> = [];

  for (const key of Object.keys(FEATURE_METADATA) as Array<FeatureKey>) {
    if (!current.features[key] && target.features[key])
      gainedFeatures.push(key);
    if (current.features[key] && !target.features[key]) lostFeatures.push(key);
  }

  const increasedLimits: Array<NumericChange> = [];
  const decreasedLimits: Array<NumericChange> = [];

  const allNumericMeta = { ...LIMIT_METADATA, ...QUOTA_METADATA };
  const currentNumerics = { ...current.limits, ...current.quotas };
  const targetNumerics = { ...target.limits, ...target.quotas };

  for (const key of Object.keys(
    allNumericMeta
  ) as Array<NumericEntitlementKey>) {
    const from = currentNumerics[key];
    const to = targetNumerics[key];
    if (from === to) continue;

    const meta = allNumericMeta[key];
    const change: NumericChange = { key, label: meta.label, from, to };

    // An increase is: going from a finite value to unlimited, or to a higher value.
    const isIncrease =
      (to === UNLIMITED && from !== UNLIMITED) ||
      (from !== UNLIMITED && to !== UNLIMITED && to > from);

    if (isIncrease) {
      increasedLimits.push(change);
    } else {
      decreasedLimits.push(change);
    }
  }

  return {
    gained: { features: gainedFeatures, increasedLimits },
    lost: { features: lostFeatures, decreasedLimits },
  };
}

// ── Display helpers ──────────────────────────────────────────────────────

/** Formats a numeric entitlement value for display (e.g. -1 -> "Unlimited"). */
export function formatEntitlementValue(value: number): string {
  return value === UNLIMITED ? 'Unlimited' : String(value);
}

/**
 * Generates human-readable feature bullets from a plan's entitlements.
 * Replaces the hardcoded `features: string[]` on the old Plan type.
 */
export function describeEntitlements(
  entitlements: Entitlements
): Array<string> {
  const bullets: Array<string> = [];

  // Limits.
  for (const [key, meta] of Object.entries(LIMIT_METADATA) as Array<
    [LimitKey, NumericEntitlementMeta]
  >) {
    const value = entitlements.limits[key];
    if (value === 0) continue; // Don't show "0 API Keys".
    bullets.push(
      value === UNLIMITED
        ? `Unlimited ${meta.unit}`
        : `Up to ${value.toLocaleString()} ${meta.unit}`
    );
  }

  // Features.
  for (const [key, meta] of Object.entries(FEATURE_METADATA) as Array<
    [FeatureKey, EntitlementMeta]
  >) {
    if (entitlements.features[key]) {
      bullets.push(meta.label);
    }
  }

  // Quotas.
  for (const [key, meta] of Object.entries(QUOTA_METADATA) as Array<
    [QuotaKey, NumericEntitlementMeta]
  >) {
    const value = entitlements.quotas[key];
    if (value === 0) continue;
    bullets.push(
      value === UNLIMITED
        ? `Unlimited ${meta.unit.toLowerCase()}`
        : `${value.toLocaleString()} ${meta.unit}`
    );
  }

  return bullets;
}
