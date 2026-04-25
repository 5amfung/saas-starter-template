/** Hard caps — block actions when exceeded. */
export type LimitKey = 'members' | 'projects' | 'apiKeys';

/** Boolean gates — enable/disable capabilities. */
export type FeatureKey = 'sso' | 'auditLogs' | 'apiAccess' | 'prioritySupport';

/** Usage-metered quantities. */
export type QuotaKey = 'storageGb' | 'apiCallsMonthly';

/** Union of all numeric entitlement keys (limits + quotas). */
export type NumericEntitlementKey = LimitKey | QuotaKey;

export interface Entitlements {
  limits: Record<LimitKey, number>; // -1 = unlimited
  features: Record<FeatureKey, boolean>;
  quotas: Record<QuotaKey, number>; // -1 = unlimited
}

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
  apiKeys: { label: 'API Keys', unit: 'keys' },
};

export const QUOTA_METADATA: Record<QuotaKey, NumericEntitlementMeta> = {
  storageGb: { label: 'Storage', unit: 'GB' },
  apiCallsMonthly: { label: 'API Calls/Month', unit: 'calls' },
};

/** Value representing "unlimited" for numeric entitlements. */
export const UNLIMITED = -1;

export type EntitlementOverrides = {
  limits?: Partial<Record<LimitKey, number>> | null;
  features?: Partial<Record<FeatureKey, boolean>> | null;
  quotas?: Partial<Record<QuotaKey, number>> | null;
};

const sanitizeLimitOverrides = (
  limits?: EntitlementOverrides['limits'] | null
) =>
  limits
    ? Object.entries({
        members: limits.members,
        projects: limits.projects,
        apiKeys: limits.apiKeys,
      }).reduce(
        (acc, [key, value]) =>
          value === undefined ? acc : { ...acc, [key]: value },
        {} as Partial<Entitlements['limits']>
      )
    : undefined;

const sanitizeFeatureOverrides = (
  features?: EntitlementOverrides['features'] | null
) =>
  features
    ? Object.entries({
        sso: features.sso,
        auditLogs: features.auditLogs,
        apiAccess: features.apiAccess,
        prioritySupport: features.prioritySupport,
      }).reduce(
        (acc, [key, value]) =>
          value === undefined ? acc : { ...acc, [key]: value },
        {} as Partial<Entitlements['features']>
      )
    : undefined;

const sanitizeQuotaOverrides = (
  quotas?: EntitlementOverrides['quotas'] | null
) =>
  quotas
    ? Object.entries({
        storageGb: quotas.storageGb,
        apiCallsMonthly: quotas.apiCallsMonthly,
      }).reduce(
        (acc, [key, value]) =>
          value === undefined ? acc : { ...acc, [key]: value },
        {} as Partial<Entitlements['quotas']>
      )
    : undefined;

export function resolveEntitlements(
  base: Entitlements,
  overrides?: EntitlementOverrides | null
): Entitlements {
  if (!overrides) return base;
  return {
    limits: {
      ...base.limits,
      ...sanitizeLimitOverrides(overrides.limits),
    },
    features: {
      ...base.features,
      ...sanitizeFeatureOverrides(overrides.features),
    },
    quotas: {
      ...base.quotas,
      ...sanitizeQuotaOverrides(overrides.quotas),
    },
  };
}

export interface CheckLimitResult {
  allowed: boolean;
  limit: number;
  current: number;
}

export function checkLimit(
  entitlements: Entitlements,
  key: NumericEntitlementKey,
  currentUsage: number
): CheckLimitResult {
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

export function hasFeature(
  entitlements: Entitlements,
  key: FeatureKey
): boolean {
  return entitlements.features[key];
}

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

export function formatEntitlementValue(value: number): string {
  return value === UNLIMITED ? 'Unlimited' : String(value);
}

export function describeEntitlements(
  entitlements: Entitlements
): Array<string> {
  const bullets: Array<string> = [];

  for (const [key, meta] of Object.entries(LIMIT_METADATA) as Array<
    [LimitKey, NumericEntitlementMeta]
  >) {
    const value = entitlements.limits[key];
    if (value === 0) continue;
    bullets.push(
      value === UNLIMITED
        ? `Unlimited ${meta.unit}`
        : `Up to ${value.toLocaleString()} ${meta.unit}`
    );
  }

  for (const [key, meta] of Object.entries(FEATURE_METADATA) as Array<
    [FeatureKey, EntitlementMeta]
  >) {
    if (entitlements.features[key]) {
      bullets.push(meta.label);
    }
  }

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
