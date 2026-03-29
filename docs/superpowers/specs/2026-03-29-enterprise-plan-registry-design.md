# Enterprise Plan Registry Design

**Date:** 2026-03-29
**Status:** Draft
**Scope:** Support fully custom enterprise plans alongside existing self-serve tiers

## Problem

The current plan system (`free | starter | pro`) is hardcoded with a static `PlanId` union in `packages/auth/src/plans.ts`. Each plan has fixed limits, features, and Stripe pricing. Enterprise customers need fully custom plans — different limits, features, pricing, and billing terms per customer. Adding each enterprise customer as a new entry to the existing `PlanId` union pollutes the self-serve tier list and makes the billing UI progressively harder to maintain.

## Decision

**Approach A: Enterprise Plan Registry** — a separate registry file for enterprise plans that merges with the existing `PLANS` array at runtime. Self-serve plans remain untouched. Enterprise plans are hidden from the public billing UI and assigned manually via Stripe.

### Alternatives Considered

- **Parameterized Enterprise Tier:** Single `'enterprise'` PlanId with per-workspace DB overrides. Rejected because it creates two sources of truth for limits (code defaults + DB overrides) and Stripe still needs separate products per customer, creating a mismatch.
- **Fully Dynamic Plans (DB-Driven):** All plans in the database. Rejected because it requires a massive refactor of every billing component, loses TypeScript compile-time safety, and introduces complex two-way Stripe sync — over-engineered for current scale.

## Design

### 1. Plan Type System

The `PlanId` type splits into two categories:

```ts
/** Self-serve plan IDs — exhaustive, static union. */
type SelfServePlanId = 'free' | 'starter' | 'pro';

/** Enterprise plan IDs — prefixed convention, validated at runtime. */
type EnterprisePlanId = `enterprise-${string}`;

/** Combined type used everywhere plans are referenced. */
type PlanId = SelfServePlanId | EnterprisePlanId;
```

The `enterprise-` prefix enables a trivial runtime check:

```ts
function isEnterprisePlan(planId: string): boolean {
  return planId.startsWith('enterprise-');
}
```

### 2. Plan Visibility

The `Plan` interface gains one new field:

```ts
interface Plan {
  // ... all existing fields ...

  /** Controls where this plan appears. 'public' = billing UI. 'hidden' = enterprise-only. */
  visibility: 'public' | 'hidden';
}
```

- Existing self-serve plans: `visibility: 'public'`
- Enterprise plans: `visibility: 'hidden'`

### 3. Enterprise Plan Registry

A new file `packages/auth/src/enterprise-plans.ts` defines enterprise plans using the same `Plan` interface:

```ts
export const ENTERPRISE_PLANS: ReadonlyArray<Plan> = [
  {
    id: 'enterprise-acme',
    name: 'Acme Corp Enterprise',
    tier: 10,
    visibility: 'hidden',
    pricing: { monthly: { price: 500_00 }, annual: { price: 5000_00 } },
    limits: { maxMembers: 200 },
    features: ['Up to 200 members', 'Dedicated support', 'SSO'],
    annualBonusFeatures: [],
  },
];
```

### 4. Unified Plan Resolution

`plans.ts` merges both sources into a single array:

```ts
export const ALL_PLANS: ReadonlyArray<Plan> = [...PLANS, ...ENTERPRISE_PLANS];
```

All existing helper functions switch from `PLANS` to `ALL_PLANS`:
- `getPlanById(id)` — searches `ALL_PLANS`
- `getHighestTierPlanId(planIds)` — searches `ALL_PLANS`
- `resolveWorkspacePlanId(subscriptions)` — searches `ALL_PLANS` (via `getHighestTierPlanId`)
- `getPlanLimitsForPlanId(planId)` — searches `ALL_PLANS`
- `getUpgradePlans(currentPlan)` — searches `ALL_PLANS` (filtered by visibility in the UI layer)

The existing `PLANS` constant is retained and exported for cases where only self-serve plans are needed (e.g., seeding, admin tools).

### 5. Tier Ranking Convention

| Range | Category |
|-------|----------|
| 0–9   | Self-serve tiers (free=0, starter=1, pro=2) |
| 10+   | Enterprise tiers |

Enterprise plans with different tier values allow ranking between enterprise customers if needed (e.g., `enterprise-acme` at tier 10, `enterprise-globex` at tier 15).

### 6. Stripe Integration

Enterprise plans follow the same env-var convention:

```
STRIPE_ENTERPRISE_ACME_MONTHLY_PRICE_ID=price_xxx
STRIPE_ENTERPRISE_ACME_ANNUAL_PRICE_ID=price_yyy
```

Derivation rule: plan ID uppercased, hyphens replaced with underscores.
- `enterprise-acme` → `STRIPE_ENTERPRISE_ACME_*`

The Stripe plugin configuration in `auth.server.ts` (which builds `stripePlans` and `priceToPlanMap` from the plan array) iterates `ALL_PLANS` instead of `PLANS`. No changes to the mapping logic — it already derives env-var names from plan IDs.

### 7. Limit Enforcement

No changes to the enforcement mechanism. The `beforeCreateInvitation` hook in `auth.server.ts` already:
1. Resolves `planId` via `resolveWorkspacePlanIdFromDb()`
2. Calls `getPlanLimitsForPlanId(planId)` — now searches `ALL_PLANS`
3. Checks current member count against `maxMembers`

Enterprise plan limits are enforced automatically. Future limit dimensions (e.g., `maxProjects`, `maxStorage`) work identically — add the field to `PlanLimits`, populate for all plans (including enterprise), add enforcement hook.

### 8. Billing UI

#### Self-Serve Users (No Change)

Plan picker and manage dialog filter to public plans:

```ts
const publicPlans = ALL_PLANS.filter(p => p.visibility === 'public');
```

Self-serve experience is identical to today.

#### Enterprise Workspace Billing Page

When `isEnterprisePlan(currentPlanId)` is true, the billing page renders a new `BillingEnterprisePlanCard` component instead of the standard plan cards and manage dialog:

- Plan name and tier badge
- Feature list from plan definition
- Current limits with usage (e.g., "142 / 200 members")
- Subscription status and renewal date
- "Contact your account manager to modify your plan" message
- **No plan picker, no upgrade/downgrade buttons, no billing interval toggle**

#### Upgrade Prompt for Enterprise

If an enterprise workspace hits a limit, the `UpgradePromptDialog` shows "Contact your account manager to increase your plan limits" instead of the upgrade plan picker. This is a conditional branch in `use-upgrade-prompt.ts`.

#### Invoice Table

No changes — enterprise workspaces have standard Stripe subscriptions.

### 9. Enterprise Plan Assignment Workflow

1. Sales negotiates plan terms with the customer.
2. Developer adds the enterprise plan entry to `enterprise-plans.ts`.
3. Developer creates matching Stripe product + prices in Stripe Dashboard.
4. Developer adds env vars for the Stripe price IDs.
5. Code is deployed.
6. Admin creates a Stripe subscription for the enterprise workspace (via Stripe Dashboard or direct checkout link).

No in-app admin UI for assignment. At the scale of one-at-a-time enterprise onboarding, manual Stripe workflow is appropriate. An admin UI can be added later if volume warrants it.

### 10. Plan Modification & Removal

**Modification:** Update the entry in `enterprise-plans.ts`, adjust Stripe pricing if needed, deploy. Enforcement picks up new limits immediately. Existing members above the new limit are grandfathered (consistent with current downgrade behavior).

**Removal:** Enterprise plan entries can remain in the registry after churn (hidden, zero cost) or be removed after confirming no active subscriptions reference the plan ID.

## Files Changed

| File | Change |
|------|--------|
| `packages/auth/src/plans.ts` | Split `PlanId` type, add `visibility` to `Plan`, export `ALL_PLANS`, add `isEnterprisePlan()`, update helpers to use `ALL_PLANS` |
| `packages/auth/src/enterprise-plans.ts` | **New file.** Enterprise plan registry |
| `packages/auth/src/plan-actions.ts` | Update to use `ALL_PLANS` if it references `PLANS` directly |
| `packages/auth/src/auth.server.ts` | `buildStripePlans()` iterates `ALL_PLANS`, env-var mapping unchanged |
| `apps/web/src/components/billing/billing-page.tsx` | Conditional render: enterprise → `BillingEnterprisePlanCard`, self-serve → existing UI |
| `apps/web/src/components/billing/billing-enterprise-plan-card.tsx` | **New file.** Simplified enterprise billing card |
| `apps/web/src/components/billing/billing-plan-cards.tsx` | Filter to `visibility: 'public'` plans |
| `apps/web/src/components/billing/billing-manage-plan-dialog.tsx` | Filter to `visibility: 'public'` plans |
| `apps/web/src/components/billing/upgrade-prompt-dialog.tsx` | Enterprise branch: "Contact account manager" |
| `apps/web/src/hooks/use-upgrade-prompt.ts` | Pass enterprise flag to dialog |

## Testing

| Type | Coverage |
|------|----------|
| Unit | `isEnterprisePlan()` returns correct results for all plan ID shapes |
| Unit | `ALL_PLANS` contains both self-serve and enterprise plans |
| Unit | `getPlanById()` resolves enterprise plan IDs |
| Unit | `getHighestTierPlanId()` correctly ranks enterprise above self-serve |
| Unit | `getPlanLimitsForPlanId()` returns enterprise-specific limits |
| Unit | `getUpgradePlans()` includes enterprise plans (filtered by UI) |
| Integration | `beforeCreateInvitation` enforces enterprise plan member limits |
| UI | Enterprise billing page renders `BillingEnterprisePlanCard` |
| UI | Self-serve billing page does not show hidden enterprise plans |
| UI | Upgrade prompt shows "contact account manager" for enterprise |

## Out of Scope

- Admin UI for enterprise plan creation/assignment (manual Stripe workflow for now)
- Enterprise-specific billing portal integration
- Custom billing cycles (Stripe handles non-standard intervals natively)
- Enterprise trial periods (can be added to the plan entry later)
- SSO, audit logs, or other enterprise features (separate feature work, not billing)
