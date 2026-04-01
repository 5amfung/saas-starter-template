# Enterprise Entitlements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the member-count-only plan system with a full entitlements layer (limits, features, quotas), add enterprise tier with per-workspace overrides, and build admin panel workspace management.

**Architecture:** Static plan definitions with entitlement defaults → pure `resolveEntitlements()` function merges enterprise overrides from DB → `checkLimit()` / `hasFeature()` helpers enforce everywhere. Enterprise webhook mapping via $0 Stripe placeholder price. Admin panel provides workspace list + override form.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), Better Auth + Stripe plugin, TanStack Start/Router/Query, React 19, shadcn/ui, Vitest, Zod v4

**Spec:** `docs/superpowers/specs/2026-04-01-enterprise-entitlements-design.md`

---

## File Structure

### New Files

| File                                                                  | Responsibility                                                                                                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/auth/src/entitlements.ts`                                   | Entitlement types, key unions, metadata maps, `resolveEntitlements()`, `checkLimit()`, `hasFeature()`, `computeEntitlementDiff()`, `describeEntitlements()` |
| `packages/auth/test/unit/entitlements.test.ts`                        | Unit tests for all entitlement functions                                                                                                                    |
| `packages/db-schema/src/app.schema.ts`                                | Add `workspaceEntitlementOverrides` table (modify existing file)                                                                                            |
| `apps/admin/src/admin/workspaces.server.ts`                           | DB queries for workspace list, detail, override CRUD                                                                                                        |
| `apps/admin/src/admin/workspaces.functions.ts`                        | Server function wrappers with admin auth                                                                                                                    |
| `apps/admin/src/admin/workspaces.schemas.ts`                          | Zod schemas for override form input                                                                                                                         |
| `apps/admin/src/routes/_protected/workspaces/index.tsx`               | Workspace list page                                                                                                                                         |
| `apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx`        | Workspace detail + override form                                                                                                                            |
| `apps/admin/src/components/admin/admin-workspace-table.tsx`           | Workspace data table                                                                                                                                        |
| `apps/admin/src/components/admin/admin-entitlement-override-form.tsx` | Override form component                                                                                                                                     |
| `apps/admin/test/unit/admin/workspaces.server.test.ts`                | Admin workspace server tests                                                                                                                                |
| `apps/admin/test/unit/admin/workspaces.functions.test.ts`             | Admin workspace function tests                                                                                                                              |
| `apps/admin/test/unit/admin/workspaces.schemas.test.ts`               | Admin workspace schema tests                                                                                                                                |
| `ENTERPRISE_ONBOARDING.md`                                            | Ops onboarding workflow documentation                                                                                                                       |

### Modified Files

| File                                                                   | Change                                                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/auth/src/plans.ts`                                           | Rewrite: `PlanDefinition` type, entitlements on each plan, enterprise plan, `stripeEnabled`/`isEnterprise` flags |
| `packages/auth/src/plan-actions.ts`                                    | Add `contact_sales` action, replace `computePlanDiff` with entitlement-based diff                                |
| `packages/auth/src/billing.server.ts`                                  | Remove `getPlanIdByPriceId` (unused after entitlements), keep other helpers                                      |
| `packages/auth/src/auth.server.ts`                                     | Change `stripePlans` filter to `stripeEnabled`, add enterprise env var mapping                                   |
| `packages/auth/test/unit/plans.test.ts`                                | Update tests for new plan shape                                                                                  |
| `packages/auth/test/unit/plan-actions.test.ts`                         | Update tests for `contact_sales` and entitlement diff                                                            |
| `apps/web/src/billing/billing.server.ts`                               | Replace `getWorkspacePlanContext` with `getWorkspaceEntitlements`, replace `checkWorkspacePlanLimit`             |
| `apps/web/src/billing/billing.functions.ts`                            | Update function signatures                                                                                       |
| `apps/web/src/components/billing/billing-plan-cards.tsx`               | Derive features from metadata, add enterprise card                                                               |
| `apps/web/src/components/billing/billing-manage-plan-dialog.tsx`       | Add `contact_sales` action                                                                                       |
| `apps/web/src/components/billing/billing-downgrade-confirm-dialog.tsx` | Use `computeEntitlementDiff`                                                                                     |
| `apps/web/src/components/billing/upgrade-prompt-dialog.tsx`            | Use entitlement-derived features                                                                                 |
| `apps/web/src/hooks/use-upgrade-prompt.ts`                             | Accept any entitlement key                                                                                       |
| `apps/admin/src/components/app-sidebar.tsx`                            | Add Workspaces nav item                                                                                          |
| `apps/web/.env.example`                                                | Add `STRIPE_ENTERPRISE_PRICE_ID`                                                                                 |

---

## Task 1: Entitlement Type System & Plan Definitions

**Files:**

- Create: `packages/auth/src/entitlements.ts`
- Modify: `packages/auth/src/plans.ts`
- Test: `packages/auth/test/unit/entitlements.test.ts`
- Test: `packages/auth/test/unit/plans.test.ts`

This is the foundation. Everything else depends on these types.

- [ ] **Step 1: Create `entitlements.ts` with types, keys, metadata maps, and resolver**

```typescript
// packages/auth/src/entitlements.ts

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
 * Merges base plan entitlements with optional per-workspace overrides.
 * Pure function — no DB, no Stripe, no side effects.
 */
export function resolveEntitlements(
  base: Entitlements,
  overrides?: {
    limits?: Partial<Record<string, number>> | null;
    features?: Partial<Record<string, boolean>> | null;
    quotas?: Partial<Record<string, number>> | null;
  } | null
): Entitlements {
  if (!overrides) return base;
  return {
    limits: {
      ...base.limits,
      ...(overrides.limits as Partial<Record<LimitKey, number>>),
    },
    features: {
      ...base.features,
      ...(overrides.features as Partial<Record<FeatureKey, boolean>>),
    },
    quotas: {
      ...base.quotas,
      ...(overrides.quotas as Partial<Record<QuotaKey, number>>),
    },
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
  key: string;
  label: string;
  from: number;
  to: number;
}

export interface EntitlementDiff {
  gained: {
    features: FeatureKey[];
    increasedLimits: NumericChange[];
  };
  lost: {
    features: FeatureKey[];
    decreasedLimits: NumericChange[];
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
  const gainedFeatures: FeatureKey[] = [];
  const lostFeatures: FeatureKey[] = [];

  for (const key of Object.keys(FEATURE_METADATA) as FeatureKey[]) {
    if (!current.features[key] && target.features[key])
      gainedFeatures.push(key);
    if (current.features[key] && !target.features[key]) lostFeatures.push(key);
  }

  const increasedLimits: NumericChange[] = [];
  const decreasedLimits: NumericChange[] = [];

  const allNumericMeta = { ...LIMIT_METADATA, ...QUOTA_METADATA };
  const currentNumerics = { ...current.limits, ...current.quotas };
  const targetNumerics = { ...target.limits, ...target.quotas };

  for (const key of Object.keys(allNumericMeta) as NumericEntitlementKey[]) {
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

/** Formats a numeric entitlement value for display (e.g. -1 → "Unlimited"). */
export function formatEntitlementValue(value: number): string {
  return value === UNLIMITED ? 'Unlimited' : String(value);
}

/**
 * Generates human-readable feature bullets from a plan's entitlements.
 * Replaces the hardcoded `features: string[]` on the old Plan type.
 */
export function describeEntitlements(entitlements: Entitlements): string[] {
  const bullets: string[] = [];

  // Limits.
  for (const [key, meta] of Object.entries(LIMIT_METADATA) as [
    LimitKey,
    NumericEntitlementMeta,
  ][]) {
    const value = entitlements.limits[key];
    if (value === 0) continue; // Don't show "0 API Keys".
    bullets.push(
      value === UNLIMITED
        ? `Unlimited ${meta.unit}`
        : `Up to ${value} ${meta.unit}`
    );
  }

  // Features.
  for (const [key, meta] of Object.entries(FEATURE_METADATA) as [
    FeatureKey,
    EntitlementMeta,
  ][]) {
    if (entitlements.features[key]) {
      bullets.push(meta.label);
    }
  }

  // Quotas.
  for (const [key, meta] of Object.entries(QUOTA_METADATA) as [
    QuotaKey,
    NumericEntitlementMeta,
  ][]) {
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
```

- [ ] **Step 2: Write failing tests for entitlements**

```typescript
// packages/auth/test/unit/entitlements.test.ts

import {
  checkLimit,
  computeEntitlementDiff,
  describeEntitlements,
  formatEntitlementValue,
  hasFeature,
  resolveEntitlements,
  UNLIMITED,
} from '../../src/entitlements';
import type { Entitlements } from '../../src/entitlements';

const BASE: Entitlements = {
  limits: { members: 5, projects: 10, workspaces: 3, apiKeys: 0 },
  features: {
    sso: false,
    auditLogs: false,
    apiAccess: true,
    prioritySupport: false,
  },
  quotas: { storageGb: 10, apiCallsMonthly: 0 },
};

const ENTERPRISE: Entitlements = {
  limits: { members: -1, projects: -1, workspaces: -1, apiKeys: -1 },
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
    expect(result.limits.projects).toBe(-1); // unchanged
  });

  it('merges partial feature overrides', () => {
    const result = resolveEntitlements(ENTERPRISE, {
      features: { sso: false },
    });
    expect(result.features.sso).toBe(false);
    expect(result.features.auditLogs).toBe(true); // unchanged
  });

  it('merges partial quota overrides', () => {
    const result = resolveEntitlements(ENTERPRISE, {
      quotas: { storageGb: 1000 },
    });
    expect(result.quotas.storageGb).toBe(1000);
    expect(result.quotas.apiCallsMonthly).toBe(-1); // unchanged
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
    expect(diff.lost.features).not.toContain('apiAccess'); // both have it
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
    // apiKeys is 0, apiCallsMonthly is 0 — should not appear.
    expect(bullets.join(' ')).not.toContain('API Keys');
    expect(bullets.join(' ')).not.toContain('API Calls');
  });

  it('shows unlimited for enterprise', () => {
    const bullets = describeEntitlements(ENTERPRISE);
    expect(bullets).toContain('Unlimited members');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @workspace/auth test test/unit/entitlements.test.ts`
Expected: FAIL — `entitlements.ts` module doesn't exist yet (but we created it in Step 1, so these should pass).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @workspace/auth test test/unit/entitlements.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Rewrite `plans.ts` with new `PlanDefinition` type and enterprise plan**

Rewrite `packages/auth/src/plans.ts` completely. The new version uses `PlanDefinition` with `Entitlements`, `stripeEnabled`, `isEnterprise` flags. Remove `PlanLimits`, `features: string[]`, `annualBonusFeatures`. Keep all existing helper functions but update signatures to use new types. Add enterprise plan.

Key changes:

- `PlanId` union adds `'enterprise'`
- `Plan` interface becomes `PlanDefinition` with `entitlements: Entitlements` instead of `limits: PlanLimits` + `features: string[]`
- Add `stripeEnabled: boolean` and `isEnterprise: boolean` flags
- `PLANS` array gains the enterprise entry
- Remove `getPlanFeatures()` — replaced by `describeEntitlements()` from `entitlements.ts`
- Remove `getPlanLimitsForPlanId()` — replaced by entitlement resolution
- Keep `resolveWorkspacePlanId()`, `getHighestTierPlanId()`, `getPlanById()`, `getFreePlan()`, `getUpgradePlans()`, `getUpgradePlan()`, `formatPlanPrice()`
- Re-export entitlement types and functions from `entitlements.ts`

- [ ] **Step 6: Update `plans.test.ts` for new plan shape**

Update test assertions to match new `PlanDefinition` structure. Tests for removed functions (`getPlanFeatures`, `getPlanLimitsForPlanId`) should be removed. Add tests for enterprise plan, `stripeEnabled`/`isEnterprise` flags, and verify `resolveWorkspacePlanId` works with `'enterprise'` plan ID.

- [ ] **Step 7: Run all auth package tests**

Run: `pnpm --filter @workspace/auth test`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/auth/src/entitlements.ts packages/auth/src/plans.ts packages/auth/test/unit/entitlements.test.ts packages/auth/test/unit/plans.test.ts
git commit -m "feat: add entitlement type system and rewrite plan definitions

Introduce LimitKey, FeatureKey, QuotaKey unions with metadata maps.
Add resolveEntitlements(), checkLimit(), hasFeature(), computeEntitlementDiff().
Rewrite plans.ts with PlanDefinition type, entitlements per plan, enterprise tier."
```

---

## Task 2: Plan Actions — `contact_sales` and Entitlement Diff

**Files:**

- Modify: `packages/auth/src/plan-actions.ts`
- Test: `packages/auth/test/unit/plan-actions.test.ts`

- [ ] **Step 1: Update `plan-actions.ts`**

Changes:

- Add `'contact_sales'` to `PlanAction` union
- Update `getPlanAction()`: if `targetPlan.isEnterprise`, return `'contact_sales'`
- Add `contact_sales` entry to `PLAN_ACTION_CONFIG`
- Replace `computePlanDiff()` — delegate to `computeEntitlementDiff()` from `entitlements.ts`
- Remove `PlanDiff`, `LimitChange`, `LIMIT_LABELS` — replaced by `EntitlementDiff` from `entitlements.ts`
- Keep `getDowngradePlans()`

Updated `getPlanAction()`:

```typescript
export function getPlanAction(
  currentPlan: PlanDefinition,
  targetPlan: PlanDefinition
): PlanAction {
  if (targetPlan.tier === currentPlan.tier) return 'current';
  if (targetPlan.isEnterprise) return 'contact_sales';
  if (targetPlan.tier > currentPlan.tier) return 'upgrade';
  if (targetPlan.pricing === null) return 'cancel';
  return 'downgrade';
}
```

Updated `PLAN_ACTION_CONFIG`:

```typescript
export const PLAN_ACTION_CONFIG: Record<
  PlanAction,
  { label: string; variant: ButtonVariant }
> = {
  current: { label: 'Current plan', variant: 'ghost' },
  upgrade: { label: 'Upgrade', variant: 'default' },
  downgrade: { label: 'Downgrade', variant: 'outline' },
  cancel: { label: 'Downgrade', variant: 'outline' },
  contact_sales: { label: 'Contact Sales', variant: 'default' },
};
```

- [ ] **Step 2: Update `plan-actions.test.ts`**

Add tests for `contact_sales` action: any self-serve plan → enterprise = `contact_sales`. Update existing tests to use new `PlanDefinition` shape.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @workspace/auth test`
Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/plan-actions.ts packages/auth/test/unit/plan-actions.test.ts
git commit -m "feat: add contact_sales plan action and entitlement-based diff

Add contact_sales action for enterprise transitions.
Replace member-count-only PlanDiff with full EntitlementDiff."
```

---

## Task 3: Database Schema — Workspace Entitlement Overrides

**Files:**

- Modify: `packages/db-schema/src/app.schema.ts`

- [ ] **Step 1: Add `workspaceEntitlementOverrides` table to `app.schema.ts`**

Add to the existing file after the `notificationPreferences` table:

```typescript
import { jsonb } from 'drizzle-orm/pg-core';
import { organization } from './auth.schema';

export const workspaceEntitlementOverrides = pgTable(
  'workspace_entitlement_override',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: 'cascade' }),
    limits: jsonb('limits').$type<Partial<Record<string, number>>>(),
    features: jsonb('features').$type<Partial<Record<string, boolean>>>(),
    quotas: jsonb('quotas').$type<Partial<Record<string, number>>>(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }
);

export const workspaceEntitlementOverridesRelations = relations(
  workspaceEntitlementOverrides,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [workspaceEntitlementOverrides.workspaceId],
      references: [organization.id],
    }),
  })
);
```

Add `jsonb` to the existing `drizzle-orm/pg-core` import. Add `organization` to the `./auth.schema` import.

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/db-schema/src/app.schema.ts
git commit -m "feat: add workspace_entitlement_override table for enterprise overrides

JSONB columns store partial limits/features/quotas per workspace.
Only enterprise workspaces will have rows in this table."
```

- [ ] **Step 4: Notify developer to push schema to database**

Tell the developer: "Schema updated. Run `pnpm run db:push` to push the new table to the database."

---

## Task 4: Auth Server — Stripe Enterprise Price Mapping

**Files:**

- Modify: `packages/auth/src/auth.server.ts`
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Update `stripePlans` filter in `auth.server.ts`**

Change line 86 from:

```typescript
const stripePlans = PLANS.filter((p) => p.pricing !== null).map((p) => {
```

To:

```typescript
const stripePlans = PLANS.filter((p) => p.stripeEnabled).map((p) => {
```

Update the `map` callback to handle enterprise (single price ID, no annual variant):

```typescript
const stripePlans = PLANS.filter((p) => p.stripeEnabled).map((p) => {
  const key = p.id.toUpperCase();
  // Enterprise uses a single STRIPE_ENTERPRISE_PRICE_ID env var.
  // Self-serve plans use STRIPE_{PLAN}_MONTHLY_PRICE_ID and STRIPE_{PLAN}_ANNUAL_PRICE_ID.
  if (p.isEnterprise) {
    return {
      name: p.id,
      priceId: process.env[`STRIPE_${key}_PRICE_ID`]!,
    };
  }
  return {
    name: p.id,
    priceId: process.env[`STRIPE_${key}_MONTHLY_PRICE_ID`]!,
    annualDiscountPriceId: process.env[`STRIPE_${key}_ANNUAL_PRICE_ID`]!,
  };
});
```

- [ ] **Step 2: Update `beforeCreateInvitation` hook to use entitlements**

The existing hook in `auth.server.ts` (around line 300+) checks member limits. Update it to use the new entitlement system. Import `resolveEntitlements`, `checkLimit` from `./entitlements`. Import `getPlanById` from `./plans`. Use `resolveWorkspacePlanId` to get the plan, then `resolveEntitlements` to get entitlements, then `checkLimit` to enforce.

If the plan `isEnterprise`, query the `workspace_entitlement_overrides` table for overrides before resolving entitlements. For self-serve plans, skip the override query.

- [ ] **Step 3: Add `STRIPE_ENTERPRISE_PRICE_ID` to `.env.example`**

Add to `apps/web/.env.example`:

```
STRIPE_ENTERPRISE_PRICE_ID=
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm run typecheck`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/auth.server.ts apps/web/.env.example
git commit -m "feat: update stripe plugin to include enterprise price mapping

Change stripePlans filter from pricing !== null to stripeEnabled.
Add enterprise-specific env var mapping (single STRIPE_ENTERPRISE_PRICE_ID).
Update beforeCreateInvitation hook to use entitlement-based limit checks."
```

---

## Task 5: Web Billing Server — Entitlement-Based Resolution

**Files:**

- Modify: `apps/web/src/billing/billing.server.ts`
- Modify: `apps/web/src/billing/billing.functions.ts`
- Test: `apps/web/test/unit/billing/billing.server.test.ts`
- Test: `apps/web/test/unit/billing/billing.functions.test.ts`

- [ ] **Step 1: Replace `getWorkspacePlanContext` with `getWorkspaceEntitlements` in `billing.server.ts`**

Replace the `WorkspacePlanContext` interface and `getWorkspacePlanContext` function with:

```typescript
import {
  resolveEntitlements,
  checkLimit,
  describeEntitlements,
} from '@workspace/auth/entitlements';
import type { Entitlements } from '@workspace/auth/entitlements';
import { db } from '@workspace/db';
import { workspaceEntitlementOverrides } from '@workspace/db-schema';
import { eq } from 'drizzle-orm';

export interface WorkspaceEntitlementsContext {
  planId: PlanId;
  plan: PlanDefinition;
  entitlements: Entitlements;
  upgradePlan: PlanDefinition | null;
}

export async function getWorkspaceEntitlements(
  headers: Headers,
  workspaceId: string
): Promise<WorkspaceEntitlementsContext> {
  const planId = await getWorkspaceActivePlanId(headers, workspaceId);
  const plan = getPlanById(planId) ?? getFreePlan();
  const upgradePlan = getUpgradePlan(plan);

  const overrides = plan.isEnterprise
    ? await db.query.workspaceEntitlementOverrides.findFirst({
        where: eq(workspaceEntitlementOverrides.workspaceId, workspaceId),
      })
    : undefined;

  const entitlements = resolveEntitlements(plan.entitlements, overrides);
  return { planId, plan, entitlements, upgradePlan };
}
```

- [ ] **Step 2: Replace `checkWorkspacePlanLimit` with entitlement-based check**

Replace the existing function with:

```typescript
export interface CheckEntitlementResult {
  allowed: boolean;
  current: number;
  limit: number;
  planName: string;
  upgradePlan: PlanDefinition | null;
}

export async function checkWorkspaceEntitlement(
  headers: Headers,
  workspaceId: string,
  key: 'members'
): Promise<CheckEntitlementResult> {
  const ctx = await getWorkspaceEntitlements(headers, workspaceId);
  const entitlements = ctx.entitlements;
  const limit = entitlements.limits[key];

  if (limit === -1) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      planName: ctx.plan.name,
      upgradePlan: ctx.upgradePlan,
    };
  }

  const current = await auth.billing.countWorkspaceMembers(workspaceId);
  return {
    allowed: current < limit,
    current,
    limit,
    planName: ctx.plan.name,
    upgradePlan: ctx.upgradePlan,
  };
}
```

- [ ] **Step 3: Update `getWorkspaceBillingData` to use entitlements**

Update the function to use `getWorkspaceEntitlements` internally and return entitlements in its response.

- [ ] **Step 4: Update `billing.functions.ts` server function wrappers**

Update imports and function calls to use the new names. `checkWorkspacePlanLimit` server fn becomes `checkWorkspaceEntitlement`. Update the Zod schema for the input if needed.

- [ ] **Step 5: Update test files**

Update `billing.server.test.ts` and `billing.functions.test.ts` mocks and assertions to match the new function names, signatures, and return types.

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @workspace/web test test/unit/billing/`
Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/billing/ apps/web/test/unit/billing/
git commit -m "feat: replace plan context with entitlement-based resolution

Replace getWorkspacePlanContext with getWorkspaceEntitlements.
Replace checkWorkspacePlanLimit with checkWorkspaceEntitlement.
Enterprise workspaces query override table for custom limits."
```

---

## Task 6: Web Billing UI — Entitlement-Derived Features & Enterprise Card

**Files:**

- Modify: `apps/web/src/components/billing/billing-plan-cards.tsx`
- Modify: `apps/web/src/components/billing/billing-manage-plan-dialog.tsx`
- Modify: `apps/web/src/components/billing/billing-downgrade-confirm-dialog.tsx`
- Modify: `apps/web/src/components/billing/upgrade-prompt-dialog.tsx`
- Modify: `apps/web/src/hooks/use-upgrade-prompt.ts`

- [ ] **Step 1: Update `billing-plan-cards.tsx`**

Replace `getPlanFeatures(plan, isAnnual)` with `describeEntitlements(plan.entitlements)`. For enterprise upgrade cards, show "Custom pricing" and "Contact Sales" button with `mailto:` link instead of price and checkout button. The enterprise card should not have a monthly/annual toggle.

- [ ] **Step 2: Update `billing-manage-plan-dialog.tsx`**

Add `contact_sales` action handling. When `getPlanAction` returns `contact_sales`, render a "Contact Sales" button that opens a `mailto:` link. Use `PLAN_ACTION_CONFIG` for button label and variant.

- [ ] **Step 3: Update `billing-downgrade-confirm-dialog.tsx`**

Replace `computePlanDiff(currentPlan, targetPlan)` with `computeEntitlementDiff(currentPlan.entitlements, targetPlan.entitlements)`. Update rendering to use `EntitlementDiff` shape (`lost.features`, `lost.decreasedLimits`). Use `FEATURE_METADATA` for labels. Update member overage check to use `entitlements.limits.members` instead of `targetPlan.limits.maxMembers`.

- [ ] **Step 4: Update `upgrade-prompt-dialog.tsx`**

Replace `getPlanFeatures(upgradePlan, isAnnual)` with `describeEntitlements(upgradePlan.entitlements)`. Remove the `isAnnual` parameter dependency for feature display (entitlements don't change with billing interval). Keep the monthly/annual toggle for pricing display only.

- [ ] **Step 5: Update `use-upgrade-prompt.ts`**

No major changes needed — the hook manages dialog state and checkout mutation. The `Plan` type import becomes `PlanDefinition`. Verify the `upgradePlan` prop is typed correctly.

- [ ] **Step 6: Update component tests**

Update `billing-downgrade-confirm-dialog.test.tsx` and `billing-manage-plan-dialog.test.tsx` to use new plan shapes with entitlements.

- [ ] **Step 7: Run tests**

Run: `pnpm --filter @workspace/web test`
Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/billing/ apps/web/src/hooks/ apps/web/test/unit/billing/
git commit -m "feat: derive billing UI from entitlements and add enterprise card

Replace hardcoded feature strings with describeEntitlements().
Add enterprise plan card with Contact Sales mailto link.
Update downgrade dialog to use computeEntitlementDiff().
Add contact_sales action to manage plan dialog."
```

---

## Task 7: Admin Panel — Workspace List & Detail Pages

**Files:**

- Create: `apps/admin/src/admin/workspaces.schemas.ts`
- Create: `apps/admin/src/admin/workspaces.server.ts`
- Create: `apps/admin/src/admin/workspaces.functions.ts`
- Create: `apps/admin/src/components/admin/admin-workspace-table.tsx`
- Create: `apps/admin/src/components/admin/admin-entitlement-override-form.tsx`
- Create: `apps/admin/src/routes/_protected/workspaces/index.tsx`
- Create: `apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx`
- Modify: `apps/admin/src/components/app-sidebar.tsx`

- [ ] **Step 1: Create `workspaces.schemas.ts`**

Zod schemas for override form input. Follow pattern from `apps/admin/src/admin/schemas.ts`.

```typescript
// apps/admin/src/admin/workspaces.schemas.ts
import * as z from 'zod';

export const entitlementOverrideSchema = z.object({
  workspaceId: z.string(),
  limits: z
    .object({
      members: z.number().int().min(-1).optional(),
      projects: z.number().int().min(-1).optional(),
      workspaces: z.number().int().min(-1).optional(),
      apiKeys: z.number().int().min(-1).optional(),
    })
    .optional(),
  features: z
    .object({
      sso: z.boolean().optional(),
      auditLogs: z.boolean().optional(),
      apiAccess: z.boolean().optional(),
      prioritySupport: z.boolean().optional(),
    })
    .optional(),
  quotas: z
    .object({
      storageGb: z.number().int().min(-1).optional(),
      apiCallsMonthly: z.number().int().min(-1).optional(),
    })
    .optional(),
  notes: z.string().optional(),
});

export type EntitlementOverrideInput = z.infer<
  typeof entitlementOverrideSchema
>;
```

- [ ] **Step 2: Create `workspaces.server.ts`**

DB queries following the pattern from `apps/admin/src/admin/admin.server.ts`. Functions:

- `listWorkspacesWithPlan()` — joins organization + subscription + member count
- `getWorkspaceDetail()` — single workspace with subscription and override data
- `upsertEntitlementOverrides()` — insert or update override row
- `deleteEntitlementOverrides()` — remove override row

- [ ] **Step 3: Create `workspaces.functions.ts`**

Server function wrappers with `getVerifiedAdminSession()` auth. Follow pattern from `apps/admin/src/admin/admin.functions.ts`. Functions:

- `listWorkspaces` — calls `listWorkspacesWithPlan()`
- `getWorkspace` — calls `getWorkspaceDetail()`
- `saveEntitlementOverrides` — calls `upsertEntitlementOverrides()`
- `clearEntitlementOverrides` — calls `deleteEntitlementOverrides()`

- [ ] **Step 4: Create `admin-workspace-table.tsx`**

Data table following the pattern from `apps/admin/src/components/admin/admin-user-table.tsx`. Columns: Workspace name, Owner email, Plan badge, Status, Members, Created. Filter tabs: All / Self-serve / Enterprise. Search by workspace name or owner email.

- [ ] **Step 5: Create `admin-entitlement-override-form.tsx`**

Form component for editing overrides. Renders numeric inputs for each `LimitKey` and `QuotaKey` (iterating `LIMIT_METADATA` and `QUOTA_METADATA`), checkboxes for each `FeatureKey` (iterating `FEATURE_METADATA`), notes textarea, Save and Clear buttons.

- [ ] **Step 6: Create workspace list route `workspaces/index.tsx`**

Follow pattern from `apps/admin/src/routes/_protected/users/index.tsx`. Loader calls `listWorkspaces`. Renders `AdminWorkspaceTable`.

- [ ] **Step 7: Create workspace detail route `workspaces/$workspaceId.tsx`**

Follow pattern from `apps/admin/src/routes/_protected/users/$userId.tsx`. Loader calls `getWorkspace`. Renders info section, subscription section, and `AdminEntitlementOverrideForm` (only visible when plan is enterprise).

- [ ] **Step 8: Update `app-sidebar.tsx` — add Workspaces nav item**

Add to the `navItems` array in `apps/admin/src/components/app-sidebar.tsx`:

```typescript
import { IconBuilding } from '@tabler/icons-react';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: <IconDashboard /> },
  { title: 'Users', url: '/users', icon: <IconUsers /> },
  { title: 'Workspaces', url: '/workspaces', icon: <IconBuilding /> },
];
```

- [ ] **Step 9: Write tests for schemas, server, and functions**

Create `apps/admin/test/unit/admin/workspaces.schemas.test.ts`, `workspaces.server.test.ts`, `workspaces.functions.test.ts` following the patterns from the existing admin tests.

- [ ] **Step 10: Run tests**

Run: `pnpm --filter @workspace/admin-web test`
Expected: All PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/admin/src/admin/workspaces.* apps/admin/src/components/admin/admin-workspace-table.tsx apps/admin/src/components/admin/admin-entitlement-override-form.tsx apps/admin/src/routes/_protected/workspaces/ apps/admin/src/components/app-sidebar.tsx apps/admin/test/unit/admin/workspaces.*
git commit -m "feat: add admin workspace management with entitlement overrides

Add workspace list page with plan/status filtering.
Add workspace detail page with subscription info and override form.
Override form iterates entitlement metadata maps for auto UI generation."
```

---

## Task 8: Enterprise Onboarding Documentation

**Files:**

- Create: `ENTERPRISE_ONBOARDING.md`

- [ ] **Step 1: Write `ENTERPRISE_ONBOARDING.md`**

Document the ops workflow:

1. **Standard Enterprise Deal** — Create $0 Stripe subscription → done
2. **Custom Enterprise Deal** — Create subscription → set overrides in admin
3. **Self-Serve to Enterprise Upgrade** — Create enterprise subscription → cancel self-serve → optionally set overrides
4. **Enterprise Downgrade** — Cancel enterprise subscription → workspace falls to free
5. **Stripe Setup** — How to create the $0 enterprise product/price in Stripe Dashboard

- [ ] **Step 2: Commit**

```bash
git add ENTERPRISE_ONBOARDING.md
git commit -m "docs: add enterprise customer onboarding guide for ops

Step-by-step workflows for standard deals, custom deals,
self-serve upgrades, and Stripe configuration."
```

---

## Task 9: Cross-Cutting Verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm run typecheck`
Expected: No type errors across entire monorepo.

- [ ] **Step 2: Run full lint**

Run: `pnpm run lint`
Expected: No lint errors.

- [ ] **Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests pass across all packages.

- [ ] **Step 4: Run build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 5: Fix any issues found and commit**

If any failures, fix them and commit with appropriate message.
