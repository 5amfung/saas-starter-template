# Enterprise Entitlements & Plan System Redesign

## Problem

The billing system supports three self-serve tiers (Free, Starter, Pro) with member count as the only enforced limit. Features displayed in plan cards are hardcoded strings that don't map to actual enforcement. There is no support for enterprise customers who have custom pricing negotiated by sales, per-workspace limits and feature sets, and require ops-managed onboarding.

## Solution

Introduce an **entitlements layer** that decouples "what a workspace can do" from "how they pay." Every plan defines default entitlements (boolean feature flags, numeric limits, numeric quotas). A single pure function resolves entitlements for any workspace. Enterprise workspaces can have per-workspace overrides stored in a new database table, managed by ops via the admin panel.

## Design Decisions

- **Entitlements as a first-class layer.** Every permission check flows through `resolveEntitlements()`. No scattered ad-hoc checks. No checking plan IDs directly.
- **Three entitlement dimensions.** Limits (hard caps that block actions), features (boolean gates), quotas (usage-metered quantities). Each has its own typed key union.
- **Static plan definitions with enterprise overrides.** Self-serve plans remain static in code. Enterprise customization is stored as partial JSONB overrides in the database, merged over enterprise plan defaults at resolution time.
- **Metadata maps for UI rendering.** `FEATURE_METADATA`, `LIMIT_METADATA`, and `QUOTA_METADATA` records keyed by their respective key types provide human-readable labels and descriptions. TypeScript's `Record<K, V>` enforces exhaustive coverage — adding a new key without metadata is a compile error. All UI (billing page, admin panel, upgrade prompts) iterates these maps. No hardcoded feature strings.
- **Enterprise webhook mapping via $0 Stripe placeholder.** A $0 Stripe product/price for enterprise provides a stable price ID that Better Auth can map via `priceToPlanMap`. Ops creates the Stripe subscription using this price ID for plan identity; actual contract billing is handled via separate manual Stripe invoices. This avoids dynamic price IDs that Better Auth cannot resolve (which causes silent webhook drops — confirmed in Better Auth source: unknown price IDs trigger an early return with no subscription row written).
- **Override table stores only custom entitlement values.** Plan identity comes from Better Auth's subscription table for all tiers. The `workspace_entitlement_overrides` table stores only custom limits/features/quotas — no `planId` field. This keeps plan identity in one place.
- **`PlanDefinition` flags are independent concerns.** `pricing` (what price to display in UI), `stripeEnabled` (participates in Stripe webhook mapping), and `isEnterprise` (ops-managed, not self-serve) are three independent boolean/nullable fields. None is derived from the others.
- **Self-serve path is unchanged.** Checkout, downgrade scheduling, cancel/reactivate, and invoice retrieval flows are untouched. The entitlement system replaces the internals (how limits are checked) but preserves the external behavior.
- **Admin panel is plan assignment only.** Ops assigns enterprise overrides in the admin panel. Stripe subscription creation happens in Stripe Dashboard directly. The admin panel does not replicate Stripe's UI.

## Entitlement Type System

### Key Registries

```typescript
// Hard caps — block actions when exceeded.
type LimitKey = 'members' | 'projects' | 'workspaces' | 'apiKeys';

// Boolean gates — enable/disable capabilities.
type FeatureKey = 'sso' | 'auditLogs' | 'apiAccess' | 'prioritySupport';

// Usage-metered quantities.
type QuotaKey = 'storageGb' | 'apiCallsMonthly';
```

Adding a new capability means adding a key to the appropriate union. TypeScript enforces all plan definitions and metadata maps are updated.

### Entitlements Shape

```typescript
type Entitlements = {
  limits: Record<LimitKey, number>; // -1 = unlimited
  features: Record<FeatureKey, boolean>;
  quotas: Record<QuotaKey, number>; // -1 = unlimited
};
```

### Metadata Maps

One per dimension. Used by all UI surfaces — billing page plan cards, downgrade confirmation dialogs, admin panel override forms, upgrade prompts.

```typescript
const FEATURE_METADATA: Record<
  FeatureKey,
  { label: string; description: string }
> = {
  sso: { label: 'SSO', description: 'Single sign-on via SAML/OIDC' },
  auditLogs: { label: 'Audit Logs', description: 'Full activity audit trail' },
  apiAccess: { label: 'API Access', description: 'Programmatic API access' },
  prioritySupport: {
    label: 'Priority Support',
    description: 'Dedicated support channel',
  },
};

const LIMIT_METADATA: Record<LimitKey, { label: string; unit: string }> = {
  members: { label: 'Members', unit: 'members' },
  projects: { label: 'Projects', unit: 'projects' },
  workspaces: { label: 'Workspaces', unit: 'workspaces' },
  apiKeys: { label: 'API Keys', unit: 'keys' },
};

const QUOTA_METADATA: Record<QuotaKey, { label: string; unit: string }> = {
  storageGb: { label: 'Storage', unit: 'GB' },
  apiCallsMonthly: { label: 'API Calls/Month', unit: 'calls' },
};
```

## Plan Definitions

Replaces the current `PLANS` array. Each plan defines default entitlements instead of just `maxMembers` and display strings.

```typescript
type PlanDefinition = {
  id: PlanId;
  tier: number;
  name: string;
  pricing: PlanPricing | null; // null = no public price displayed in UI
  stripeEnabled: boolean; // true = has a Stripe price ID, participates in webhook mapping
  isEnterprise: boolean; // true = ops-managed, not self-serve checkout
  entitlements: Entitlements;
};
```

Flag semantics (independent, not derived from each other):

| Flag            | Question it answers                               |
| --------------- | ------------------------------------------------- |
| `pricing`       | What price do we show users in the UI?            |
| `stripeEnabled` | Does Better Auth's webhook mapper need this plan? |
| `isEnterprise`  | Is this plan ops-managed rather than self-serve?  |

Plan matrix:

| Plan       | tier | pricing                          | stripeEnabled | isEnterprise |
| ---------- | ---- | -------------------------------- | ------------- | ------------ |
| Free       | 0    | null                             | false         | false        |
| Starter    | 1    | { monthly: 500, annual: 5000 }   | true          | false        |
| Pro        | 2    | { monthly: 4900, annual: 49000 } | true          | false        |
| Enterprise | 3    | null                             | true          | true         |

Entitlement defaults per plan:

|                 | Free  | Starter | Pro   | Enterprise     |
| --------------- | ----- | ------- | ----- | -------------- |
| **Limits**      |       |         |       |                |
| members         | 1     | 5       | 25    | -1 (unlimited) |
| projects        | 1     | 5       | 100   | -1             |
| workspaces      | 1     | 5       | 10    | -1             |
| apiKeys         | 0     | 0       | 5     | -1             |
| **Features**    |       |         |       |                |
| sso             | false | false   | false | true           |
| auditLogs       | false | false   | true  | true           |
| apiAccess       | false | false   | true  | true           |
| prioritySupport | false | false   | true  | true           |
| **Quotas**      |       |         |       |                |
| storageGb       | 1     | 10      | 50    | -1             |
| apiCallsMonthly | 0     | 0       | 1000  | -1             |

## Entitlement Resolution

A single pure function. No DB, no Stripe, no side effects.

```typescript
function resolveEntitlements(
  planId: PlanId,
  overrides?: Partial<Entitlements>
): Entitlements {
  const plan = getPlanById(planId);
  const base = plan.entitlements;
  if (!overrides) return base;
  return {
    limits: { ...base.limits, ...overrides.limits },
    features: { ...base.features, ...overrides.features },
    quotas: { ...base.quotas, ...overrides.quotas },
  };
}
```

### Enforcement Helpers

```typescript
function checkLimit(
  entitlements: Entitlements,
  key: LimitKey | QuotaKey,
  currentUsage: number
): { allowed: boolean; limit: number; current: number } {
  const limit =
    key in entitlements.limits
      ? entitlements.limits[key as LimitKey]
      : entitlements.quotas[key as QuotaKey];
  return {
    allowed: limit === -1 || currentUsage < limit,
    limit,
    current: currentUsage,
  };
}

function hasFeature(entitlements: Entitlements, key: FeatureKey): boolean {
  return entitlements.features[key];
}
```

### Server-Side Resolution

Resolution happens at the server function boundary. The `isEnterprise` flag short-circuits the override table query for self-serve workspaces (zero performance cost for existing customers).

```typescript
async function getWorkspaceEntitlements(workspaceId: string): Promise<{
  planId: PlanId;
  entitlements: Entitlements;
  plan: PlanDefinition;
}> {
  const planId = await auth.billing.resolveWorkspacePlanIdFromDb(workspaceId);
  const plan = getPlanById(planId);

  const overrides = plan.isEnterprise
    ? await db.query.workspaceEntitlementOverrides.findFirst({
        where: eq(workspaceEntitlementOverrides.workspaceId, workspaceId),
      })
    : undefined;

  const entitlements = resolveEntitlements(planId, overrides ?? undefined);
  return { planId, entitlements, plan };
}
```

### What This Replaces

| Current                                       | New                                                  |
| --------------------------------------------- | ---------------------------------------------------- |
| `getPlanLimitsForPlanId()` → `{ maxMembers }` | `resolveEntitlements()` → full `Entitlements`        |
| `checkWorkspacePlanLimit(wsId, 'member')`     | `checkLimit(entitlements, 'members', count)`         |
| `getPlanFeatures()` → `string[]`              | Derived from `FEATURE_METADATA` + entitlement values |
| `getWorkspacePlanContext()`                   | `getWorkspaceEntitlements()`                         |

## Database Schema

### New Table: `workspace_entitlement_overrides`

Added to `packages/db-schema/src/app.schema.ts`. Only enterprise workspaces will have rows.

```typescript
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
```

- One row per workspace (`workspaceId` unique constraint).
- JSONB columns store only keys that differ from enterprise plan defaults. Blank = use default.
- `onDelete: cascade` — if workspace is deleted, overrides go with it.
- `notes` — free-text field for ops to record deal context (e.g. "Acme Corp — Contract #1234").
- No `planId` field — plan identity lives in Better Auth's `subscription` table.

### Migration

Single `CREATE TABLE`. No changes to existing tables. No data migration. Schema push to database is handled manually by the developer (`pnpm run db:push`) — not part of the automated implementation.

## Stripe Integration

### Enterprise Price Mapping

Enterprise plan has `stripeEnabled: true`. The `stripePlans` filter changes from `PLANS.filter((p) => p.pricing !== null)` to `PLANS.filter((p) => p.stripeEnabled)`.

One new environment variable:

```bash
STRIPE_ENTERPRISE_PRICE_ID=price_xxx
```

This maps to a $0 placeholder product in Stripe. Better Auth maps this price ID to `'enterprise'` via the existing `priceToPlanMap` mechanism. No webhook customization needed.

Enterprise has a single price ID — no monthly/annual distinction (billing is custom). The `stripePlans` mapping code in `auth.server.ts` currently reads `STRIPE_${key}_MONTHLY_PRICE_ID` and `STRIPE_${key}_ANNUAL_PRICE_ID`. For enterprise, the mapping should read `STRIPE_ENTERPRISE_PRICE_ID` (single env var). The existing guard `if (sp.annualDiscountPriceId)` already handles missing annual variants gracefully, but the env var naming convention needs adjustment for enterprise specifically.

### Why $0 Placeholder

Better Auth's Stripe plugin resolves plan names by matching price IDs against the configured `plans` array. Enterprise deals have custom pricing, which in Stripe creates dynamic price IDs. These dynamic IDs are not in the mapping and cause Better Auth to silently drop the webhook (confirmed in source: `index.mjs` line 258-260 — logs a warning and returns early, no subscription row written).

The $0 placeholder provides a stable, known price ID. Ops creates all enterprise subscriptions using this price ID. The actual contract amount is billed via separate manual Stripe invoices. The subscription exists for plan identity and status tracking; the invoices handle payment.

### Webhook Flow (Enterprise)

1. Ops creates subscription in Stripe Dashboard using `STRIPE_ENTERPRISE_PRICE_ID`.
2. Stripe fires `customer.subscription.created` webhook.
3. Better Auth matches price ID → `'enterprise'`.
4. Subscription row written: `plan: 'enterprise'`, `status: 'active'`, `referenceId: workspaceId`.
5. `resolveWorkspacePlanId()` returns `'enterprise'` for this workspace.
6. `getWorkspaceEntitlements()` sees `isEnterprise: true`, queries override table, resolves final entitlements.

### Webhook Flow (Self-Serve) — Unchanged

No changes to checkout, downgrade scheduling, cancel/reactivate, or invoice webhook handling.

## Plan Actions & Transitions

### Action Types

```typescript
type PlanAction =
  | 'current'
  | 'upgrade'
  | 'downgrade'
  | 'cancel'
  | 'contact_sales';
```

### Resolution Matrix

| From \ To  | Free    | Starter   | Pro     | Enterprise    |
| ---------- | ------- | --------- | ------- | ------------- |
| Free       | current | upgrade   | upgrade | contact_sales |
| Starter    | cancel  | current   | upgrade | contact_sales |
| Pro        | cancel  | downgrade | current | contact_sales |
| Enterprise | —       | —         | —       | current       |

- Any plan → Enterprise = `contact_sales` (never self-serve).
- Enterprise → lower tiers = not exposed in UI. Handled externally by ops.
- Existing `upgrade`, `downgrade`, `cancel` actions unchanged for self-serve.

### Entitlement Diff

Replaces the current member-count-only diff with a full entitlement comparison:

```typescript
type EntitlementDiff = {
  gained: {
    features: FeatureKey[];
    increasedLimits: { key: string; from: number; to: number }[];
  };
  lost: {
    features: FeatureKey[];
    decreasedLimits: { key: string; from: number; to: number }[];
  };
};

function computeEntitlementDiff(
  currentEntitlements: Entitlements,
  targetEntitlements: Entitlements
): EntitlementDiff;
```

Powers the downgrade confirmation dialog with real feature/limit loss information derived from entitlement values, not hardcoded strings.

### Contact Sales Flow

1. User sees Enterprise plan card on billing page with "Contact Sales" button.
2. Button opens `mailto:` link pre-filled with workspace name and ID.
3. Sales handles negotiation externally.
4. Ops provisions in Stripe + optionally sets overrides in admin panel.

### Enterprise Downgrade (Enterprise → Self-Serve)

Handled externally by ops:

1. Ops cancels the enterprise Stripe subscription.
2. Webhook updates subscription status → `resolveWorkspacePlanId()` falls back to next active subscription or `'free'`.
3. Override row becomes inert (only consulted when plan is enterprise).
4. If workspace exceeds the new plan's member cap, existing members stay but new invites are blocked until resolved.

## Admin Panel (apps/admin)

### New Routes

```
apps/admin/src/routes/_protected/
├── workspaces/
│   ├── index.tsx          # Workspace list
│   └── $workspaceId.tsx   # Workspace detail with override form
```

### Workspace List Page

Data table with columns: Workspace, Owner, Plan, Status, Members, Created, Actions.

- Filter tabs: All · Self-serve · Enterprise.
- Search by workspace name or owner email.
- Plan badge color-coded per tier.
- "View" action links to workspace detail page.

### Workspace Detail Page

Three sections:

1. **Info** — workspace name, slug, owner, member count, created date. Read-only.
2. **Subscription** — plan badge, Stripe subscription ID (links to Stripe Dashboard), status, period end. Read-only. From Better Auth's subscription table.
3. **Entitlement Overrides** — only visible when workspace is on enterprise plan. Form with:
   - Numeric inputs for each `LimitKey` and `QuotaKey` (blank = unlimited, use plan default).
   - Checkboxes for each `FeatureKey` (derived from `FEATURE_METADATA`).
   - Notes text field.
   - "Save Overrides" button writes/updates the override row.
   - "Clear All Overrides" button removes the row, restoring enterprise defaults.

### Server Function Split

| File                            | Responsibility                                                                |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `admin/workspaces.server.ts`    | DB queries — list workspaces with plan info, get detail, read/write overrides |
| `admin/workspaces.functions.ts` | `createServerFn` wrappers with `requireAdminSession()`                        |
| `admin/workspaces.schemas.ts`   | Zod schemas for override form validation                                      |

### Sidebar

One new entry: Dashboard, Users, **Workspaces**.

## Self-Serve Billing UI Changes

### Plan Cards

Feature bullets derived from `FEATURE_METADATA` + plan entitlements instead of hardcoded string arrays. Enterprise card shows "Custom pricing" label and "Contact Sales" button (`mailto:` link).

### Downgrade Confirmation Dialog

Uses `computeEntitlementDiff()` to show real feature/limit losses with labels from metadata maps.

### Upgrade Prompt Dialog

Generalized to accept any `LimitKey`, `QuotaKey`, or `FeatureKey`. Title and description derived from the corresponding metadata map. Same checkout flow.

### Plan Limit Enforcement

`checkWorkspacePlanLimit(workspaceId, 'member')` replaced by a server-side wrapper that fetches entitlements and delegates to the pure `checkLimit()` helper. The `beforeCreateInvitation` hook and all enforcement points call this single function. The wrapper handles fetching current usage (e.g. member count) and resolving entitlements, then delegates to `checkLimit(entitlements, key, currentUsage)`.

### Unchanged Flows

- Stripe checkout for self-serve upgrades.
- Downgrade scheduling via Stripe Subscription Schedules.
- Cancel / reactivate flows.
- Invoice table.
- Account-level billing overview (gains enterprise plan badge).

## Ops Onboarding Workflow Summary

### Standard Enterprise Deal (No Custom Limits)

1. Ops creates Stripe subscription using `STRIPE_ENTERPRISE_PRICE_ID` ($0 placeholder).
2. Webhook fires → Better Auth writes `subscription.plan = 'enterprise'`.
3. Done. Enterprise defaults (unlimited everything) apply automatically.

### Custom Enterprise Deal

1. Ops creates Stripe subscription using `STRIPE_ENTERPRISE_PRICE_ID`.
2. Webhook fires → `subscription.plan = 'enterprise'`.
3. Ops opens admin panel → Workspaces → finds workspace → sets custom limits/features/quotas.
4. Done. Custom entitlements apply on next resolution.

### Self-Serve to Enterprise Upgrade

1. Customer contacts sales via "Contact Sales" CTA on billing page.
2. Sales negotiates contract.
3. Ops creates enterprise Stripe subscription using `STRIPE_ENTERPRISE_PRICE_ID`.
4. Workspace immediately resolves to enterprise — `resolveWorkspacePlanId()` picks the highest tier, so the enterprise subscription (tier 3) wins even if the self-serve subscription is still active.
5. Ops cancels the existing self-serve Stripe subscription (can happen any time after step 3 — no strict ordering required).
6. Optionally sets custom overrides in admin panel.
7. Customer's workspace now resolves to enterprise entitlements.

## File Changes Summary

### New Files

| File                                                                  | Purpose                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ENTERPRISE_ONBOARDING.md`                                            | Ops onboarding workflow documentation — step-by-step guide for provisioning enterprise customers |
| `packages/auth/src/entitlements.ts`                                   | `Entitlements` types, `resolveEntitlements()`, `checkLimit()`, `hasFeature()`, metadata maps     |
| `packages/db-schema/src/app.schema.ts`                                | `workspaceEntitlementOverrides` table (addition to existing file)                                |
| `apps/admin/src/routes/_protected/workspaces/index.tsx`               | Workspace list page                                                                              |
| `apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx`        | Workspace detail page                                                                            |
| `apps/admin/src/admin/workspaces.server.ts`                           | Admin workspace DB queries                                                                       |
| `apps/admin/src/admin/workspaces.functions.ts`                        | Admin workspace server functions                                                                 |
| `apps/admin/src/admin/workspaces.schemas.ts`                          | Admin workspace Zod schemas                                                                      |
| `apps/admin/src/components/admin/admin-workspace-table.tsx`           | Workspace data table                                                                             |
| `apps/admin/src/components/admin/admin-entitlement-override-form.tsx` | Override form                                                                                    |
| DB migration file                                                     | `CREATE TABLE workspace_entitlement_override`                                                    |

### Modified Files

| File                                                                   | Change                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/auth/src/plans.ts`                                           | Rewrite: plans define `Entitlements`, add enterprise plan, add `PlanDefinition` type            |
| `packages/auth/src/plan-actions.ts`                                    | Add `contact_sales` action, `computeEntitlementDiff()` replaces member-only diff                |
| `packages/auth/src/billing.server.ts`                                  | Replace `getPlanLimitsForPlanId` / `checkWorkspacePlanLimit` with entitlement-based equivalents |
| `packages/auth/src/auth.server.ts`                                     | Change `stripePlans` filter from `pricing !== null` to `stripeEnabled`, add enterprise env var  |
| `apps/web/src/billing/billing.server.ts`                               | Replace `getWorkspacePlanContext` with `getWorkspaceEntitlements`, update limit checks          |
| `apps/web/src/billing/billing.functions.ts`                            | Update function signatures to use entitlements                                                  |
| `apps/web/src/components/billing/billing-plan-cards.tsx`               | Derive features from metadata maps instead of hardcoded strings, add enterprise card            |
| `apps/web/src/components/billing/billing-manage-plan-dialog.tsx`       | Add `contact_sales` action, entitlement-derived diffs                                           |
| `apps/web/src/components/billing/billing-downgrade-confirm-dialog.tsx` | Use `computeEntitlementDiff()`                                                                  |
| `apps/web/src/components/billing/upgrade-prompt-dialog.tsx`            | Generalize to any entitlement key                                                               |
| `apps/web/src/hooks/use-upgrade-prompt.ts`                             | Accept any entitlement key                                                                      |
| `apps/admin/src/components/app-sidebar.tsx`                            | Add "Workspaces" nav item                                                                       |
| `.env.example`                                                         | Add `STRIPE_ENTERPRISE_PRICE_ID`                                                                |

### Unchanged

- `packages/db-schema/src/auth.schema.ts` — Better Auth managed, not touched.
- `apps/web/src/routes/` — route files unchanged (data changes flow through server functions).
- Stripe checkout, downgrade scheduling, cancel/reactivate, invoice flows.
- Auth middleware, workspace model, session handling.
