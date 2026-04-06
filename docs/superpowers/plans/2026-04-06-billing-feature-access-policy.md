# Billing Feature-Access Policy Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Follow up on Section 14.3 of the shared policy capability design by centralizing billing-driven feature-access and upgrade behavior behind shared evaluated contracts, so apps stop re-deriving product policy from raw plan metadata and scattered booleans.

**Architecture:** Keep authorization capabilities in `@workspace/policy`, and add a parallel billing product-policy layer in `@workspace/billing`. `packages/billing` should evaluate product-facing billing decisions from plan, entitlements, subscription state, and overrides; `apps/web` and `apps/admin` should consume those evaluated contracts instead of branching on `planId`, `pricing`, `isEnterprise`, or direct entitlement fields for workflow behavior.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, TanStack Start, TanStack Router, TanStack Query, Better Auth, Stripe, Drizzle, Vitest.

---

## Scope and Gap Summary

Section 14.3 calls for the same facts-to-evaluation pattern to expand beyond page/action authorization into:

- feature access by plan or entitlement,
- upgrade prompts,
- enterprise override behavior,
- plan-dependent workflow branching.

Current repo state already provides the prerequisites, but not the shared app-facing contract:

- `packages/policy` centralizes workspace and admin authorization capabilities.
- `packages/billing` already owns plan definitions, entitlement math, snapshots, and admin billing operations.
- `apps/web` still derives product behavior from raw billing data in several places:
  - `apps/web/src/components/billing/billing-plan-cards.tsx`
  - `apps/web/src/components/billing/billing-manage-plan-dialog.tsx`
  - `apps/web/src/components/billing/billing-page.tsx`
  - `apps/web/src/hooks/use-upgrade-prompt.ts`
  - `apps/web/src/routes/_protected/ws/$workspaceId/members.tsx`
- `apps/admin` exposes billing facts and entitlement override data, but not a resolved billing access/product-policy view model.
- `packages/auth` still contains duplicate plan/entitlement modules that should not remain long-term owners of billing semantics.

This follow-up plan is intentionally scoped to billing product policy, not a full second authorization system.

## Ownership Rules

- `packages/policy`
  Owns authorization capabilities such as `canViewBilling`, `canManageBilling`, and admin access checks.
- `packages/billing`
  Owns plan semantics, entitlement resolution, billing snapshots, and the new evaluated billing feature-access/product-policy contracts.
- `apps/web`
  Owns route loaders, TanStack server functions, redirects, and UI rendering; it should consume evaluated billing policy results rather than infer product behavior from raw plan fields.
- `apps/admin`
  Owns admin route integration and admin-only actions; it should consume shared billing/admin detail contracts from `@workspace/billing`.
- `packages/auth`
  Should keep auth and organization integration concerns only; duplicate plan/entitlement definitions are migration debt to remove or deprecate.

## File Map

### New files

- `packages/billing/src/contracts/product-policy.ts`
- `packages/billing/src/application/workspace-product-policy.ts`
- `packages/billing/test/unit/workspace-product-policy.test.ts`
- `apps/web/test/unit/billing/workspace-product-policy-adapter.test.ts`

### Existing files expected to change

- `packages/billing/src/index.ts`
- `packages/billing/src/application/workspace-billing.ts`
- `packages/billing/src/application/admin-workspaces.ts`
- `apps/web/src/billing/billing.server.ts`
- `apps/web/src/billing/billing.functions.ts`
- `apps/web/src/components/billing/billing-plan-cards.tsx`
- `apps/web/src/components/billing/billing-manage-plan-dialog.tsx`
- `apps/web/src/components/billing/billing-page.tsx`
- `apps/web/src/hooks/use-upgrade-prompt.ts`
- `apps/web/src/routes/_protected/ws/$workspaceId/members.tsx`
- `apps/web/test/unit/components/billing/billing-page.test.tsx`
- `apps/web/test/unit/components/billing/billing-plan-cards.test.tsx`
- `apps/web/test/unit/components/billing/upgrade-prompt-dialog.test.tsx`
- `apps/web/test/unit/billing/billing.functions.test.ts`
- `apps/admin/src/admin/workspaces.server.ts`
- `apps/admin/src/admin/workspaces.functions.ts`
- `apps/admin/src/components/admin/admin-entitlement-override-form.tsx`
- `apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx`
- `packages/auth/src/plans.ts`
- `packages/auth/src/entitlements.ts`
- `packages/auth/src/auth.server.ts`

## Contract Direction

The new shared billing product-policy contract should answer app-facing questions like:

- which product features are effectively available for this workspace,
- whether a missing feature should offer self-serve upgrade, contact sales, or no action,
- whether billing portal access should be shown,
- which plan-change actions are allowed from the current state,
- which enterprise overrides affect feature-access messaging and admin detail views.

Candidate contract shape:

```ts
interface WorkspaceProductPolicy {
  currentPlanId: PlanId;
  featureAccess: Record<
    FeatureKey,
    {
      allowed: boolean;
      source: 'plan' | 'override';
      upgradeAction: 'checkout' | 'contact_sales' | 'none';
      upgradePlanId: PlanId | null;
    }
  >;
  billingPortal: {
    visible: boolean;
    allowed: boolean;
  };
  planChanges: Record<
    PlanId,
    {
      action:
        | 'current'
        | 'upgrade'
        | 'downgrade'
        | 'cancel'
        | 'contact_sales'
        | 'unavailable';
      via: 'checkout' | 'scheduled_change' | 'contact_sales' | 'blocked';
    }
  >;
}
```

The exact shape can be tightened during implementation, but the key requirement is that apps consume this contract rather than re-implement the same decisions locally.

## Task 1: Define the shared billing product-policy contract

**Files:**

- Create: `packages/billing/src/contracts/product-policy.ts`
- Modify: `packages/billing/src/index.ts`
- Create: `packages/billing/test/unit/workspace-product-policy.test.ts`

- [ ] **Step 1: Write failing tests for evaluated product-policy decisions**

Cover at least these scenarios:

- free workspace with a self-serve upgrade path,
- paid self-serve workspace with billing portal access,
- enterprise workspace with contact-sales-only upgrade behavior,
- enterprise workspace with override-enabled features,
- highest-tier workspace with no further upgrade path.

- [ ] **Step 2: Add shared types for billing product-policy outputs**

Define typed outputs for:

- per-feature access,
- upgrade action selection,
- billing portal visibility,
- plan-change action metadata.

- [ ] **Step 3: Export the contract from `@workspace/billing`**

Update `packages/billing/src/index.ts` so apps consume a stable public API instead of deep imports.

- [ ] **Step 4: Run focused verification**

Run: `pnpm --filter @workspace/billing test`

Expected: new product-policy tests fail first, then pass once the contract/evaluator exists.

- [ ] **Step 5: Commit**

```bash
git add packages/billing/src/contracts/product-policy.ts packages/billing/src/index.ts packages/billing/test/unit/workspace-product-policy.test.ts
git commit -m "feat(billing): add workspace product policy contract"
```

## Task 2: Implement shared evaluation in `packages/billing`

**Files:**

- Create: `packages/billing/src/application/workspace-product-policy.ts`
- Modify: `packages/billing/src/application/workspace-billing.ts`
- Modify: `packages/billing/src/application/admin-workspaces.ts`
- Modify: `packages/billing/src/index.ts`
- Modify: `packages/billing/test/unit/workspace-product-policy.test.ts`

- [ ] **Step 1: Build the evaluator from existing billing facts**

Use existing inputs already available from billing snapshot and entitlement resolution:

- current plan,
- resolved entitlements,
- subscription state,
- scheduled target plan,
- enterprise override state.

- [ ] **Step 2: Centralize current app-local decisions**

Move logic equivalent to the following into the evaluator:

- self-serve vs contact-sales branching,
- billing portal visibility for paid self-serve plans,
- upgrade availability when a feature or limit is blocked,
- plan-change availability under pending cancellation or scheduled downgrade state.

- [ ] **Step 3: Extend shared admin detail results**

Update the admin workspace detail flow to return effective billing policy metadata alongside raw plan and override data, so admin UI does not need to interpret plan facts on its own later.

- [ ] **Step 4: Export one stable application entrypoint**

Expose a small public surface such as:

- `getWorkspaceProductPolicy(...)`
- `getAdminWorkspaceBillingDetail(...)`

- [ ] **Step 5: Run package verification**

Run:

```bash
pnpm --filter @workspace/billing test
pnpm --filter @workspace/billing typecheck
```

Expected: billing package tests and typecheck pass with the new evaluator in place.

- [ ] **Step 6: Commit**

```bash
git add packages/billing/src/application/workspace-product-policy.ts packages/billing/src/application/workspace-billing.ts packages/billing/src/application/admin-workspaces.ts packages/billing/src/index.ts packages/billing/test/unit/workspace-product-policy.test.ts
git commit -m "feat(billing): evaluate shared workspace product policy"
```

## Task 3: Add app-layer adapters in `apps/web`

**Files:**

- Modify: `apps/web/src/billing/billing.server.ts`
- Modify: `apps/web/src/billing/billing.functions.ts`
- Create: `apps/web/test/unit/billing/workspace-product-policy-adapter.test.ts`
- Modify: `apps/web/test/unit/billing/billing.functions.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Verify that the web billing server layer returns the evaluated product-policy contract together with current billing data, without recomputing plan semantics locally.

- [ ] **Step 2: Update server orchestration**

Make `apps/web/src/billing/billing.server.ts` return shared billing product-policy data from `@workspace/billing` rather than assembling upgrade behavior in app code.

- [ ] **Step 3: Keep authorization and product policy separate**

Continue using `requireWorkspaceCapabilityForUser(...)` for authorization, but make product behavior decisions come from the new billing policy contract.

- [ ] **Step 4: Run focused web verification**

Run:

```bash
pnpm --filter @workspace/web test apps/web/test/unit/billing/billing.functions.test.ts
pnpm --filter @workspace/web test apps/web/test/unit/billing/workspace-product-policy-adapter.test.ts
```

Expected: adapter tests prove the web layer is a thin integration layer over shared billing policy.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/billing/billing.server.ts apps/web/src/billing/billing.functions.ts apps/web/test/unit/billing/workspace-product-policy-adapter.test.ts apps/web/test/unit/billing/billing.functions.test.ts
git commit -m "refactor(web): consume shared billing product policy"
```

## Task 4: Replace app-local product-policy branching in billing UI

**Files:**

- Modify: `apps/web/src/components/billing/billing-plan-cards.tsx`
- Modify: `apps/web/src/components/billing/billing-manage-plan-dialog.tsx`
- Modify: `apps/web/src/components/billing/billing-page.tsx`
- Modify: `apps/web/src/hooks/use-upgrade-prompt.ts`
- Modify: `apps/web/test/unit/components/billing/billing-plan-cards.test.tsx`
- Modify: `apps/web/test/unit/components/billing/billing-page.test.tsx`
- Modify: `apps/web/test/unit/components/billing/upgrade-prompt-dialog.test.tsx`

- [ ] **Step 1: Replace direct plan-field branching**

Remove UI decisions that currently depend on:

- `currentPlan.pricing !== null`,
- `currentPlan.isEnterprise`,
- ad hoc current/scheduled billing state branching,
- direct interpretation of upgrade plan objects for action choice.

- [ ] **Step 2: Make components consume the evaluated contract**

Pass product-policy data into billing page/cards/dialogs so UI renders actions rather than deriving them.

- [ ] **Step 3: Preserve descriptive plan rendering**

Keep raw plan metadata for copy and display only, not for behavior selection.

- [ ] **Step 4: Run focused UI verification**

Run:

```bash
pnpm --filter @workspace/web test apps/web/test/unit/components/billing/billing-plan-cards.test.tsx
pnpm --filter @workspace/web test apps/web/test/unit/components/billing/billing-page.test.tsx
pnpm --filter @workspace/web test apps/web/test/unit/components/billing/upgrade-prompt-dialog.test.tsx
```

Expected: tests assert UI behavior from shared product-policy outputs rather than local plan math.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/billing/billing-plan-cards.tsx apps/web/src/components/billing/billing-manage-plan-dialog.tsx apps/web/src/components/billing/billing-page.tsx apps/web/src/hooks/use-upgrade-prompt.ts apps/web/test/unit/components/billing/billing-plan-cards.test.tsx apps/web/test/unit/components/billing/billing-page.test.tsx apps/web/test/unit/components/billing/upgrade-prompt-dialog.test.tsx
git commit -m "refactor(web): drive billing ui from shared product policy"
```

## Task 5: Route one real feature-access workflow through the shared contract

**Files:**

- Modify: `apps/web/src/routes/_protected/ws/$workspaceId/members.tsx`
- Modify: `apps/web/src/billing/billing.server.ts`
- Modify: `apps/web/test/unit/components/workspace/workspace-invitations-table.test.tsx`
- Modify: `apps/web/test/unit/components/billing/billing-page.test.tsx`

- [ ] **Step 1: Use member-limit gating as the first migrated workflow**

Keep `assertWorkspaceLimit` and `checkWorkspaceEntitlement` for limit enforcement, but route the resulting user-facing upgrade action through the shared product-policy contract.

- [ ] **Step 2: Standardize upgrade-prompt payloads**

Return enough policy metadata so the members page can display upgrade messaging without deciding on checkout vs contact-sales itself.

- [ ] **Step 3: Add one boolean feature-access path**

Adopt a real entitlement-backed feature key from `@workspace/billing` and expose it through the shared contract in at least one route or component to prove the pattern works beyond numeric limits.

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm --filter @workspace/web test apps/web/test/unit/components/workspace/workspace-invitations-table.test.tsx
pnpm --filter @workspace/web test apps/web/test/unit/components/billing/billing-page.test.tsx
```

Expected: at least one workflow beyond the billing page now consumes evaluated feature-access decisions.

- [ ] **Step 5: Commit**

```bash
git add 'apps/web/src/routes/_protected/ws/$workspaceId/members.tsx' apps/web/src/billing/billing.server.ts apps/web/test/unit/components/workspace/workspace-invitations-table.test.tsx apps/web/test/unit/components/billing/billing-page.test.tsx
git commit -m "feat(web): route feature access through billing product policy"
```

## Task 6: Align admin detail views with the shared billing policy

**Files:**

- Modify: `apps/admin/src/admin/workspaces.server.ts`
- Modify: `apps/admin/src/admin/workspaces.functions.ts`
- Modify: `apps/admin/src/components/admin/admin-entitlement-override-form.tsx`
- Modify: `apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx`

- [ ] **Step 1: Return effective billing policy metadata in workspace detail**

Add evaluated fields that explain the effective result of current plan plus overrides, instead of leaving admin UI with only raw billing facts.

- [ ] **Step 2: Keep admin authorization under admin capabilities**

Do not merge admin authorization into billing policy; admin route/function access remains guarded by the admin capability layer.

- [ ] **Step 3: Use policy metadata for clearer override UX**

Use the resolved data to show whether a feature is inherited, enabled by override, or blocked by the current plan.

- [ ] **Step 4: Run focused admin verification**

Run:

```bash
pnpm --filter @workspace/admin-web test apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx
pnpm --filter @workspace/admin-web typecheck
```

Expected: admin views consume shared billing interpretation instead of inferring it locally.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/admin/workspaces.server.ts apps/admin/src/admin/workspaces.functions.ts apps/admin/src/components/admin/admin-entitlement-override-form.tsx apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx
git commit -m "refactor(admin): consume shared billing policy detail"
```

## Task 7: Remove duplicate billing semantics from `packages/auth`

**Files:**

- Modify: `packages/auth/src/plans.ts`
- Modify: `packages/auth/src/entitlements.ts`
- Modify: `packages/auth/src/auth.server.ts`
- Modify: `packages/auth/test/unit/billing.server.test.ts`

- [ ] **Step 1: Audit remaining imports of auth-owned billing modules**

Find all callers of `packages/auth/src/plans.ts` and `packages/auth/src/entitlements.ts`.

- [ ] **Step 2: Replace usage with `@workspace/billing` exports where feasible**

Treat `packages/billing` as the single owner of plan and entitlement semantics.

- [ ] **Step 3: Deprecate or delete duplicate modules**

If full removal is too large for this slice, leave thin compatibility re-exports and mark them as migration debt with follow-up cleanup.

- [ ] **Step 4: Run focused auth verification**

Run:

```bash
pnpm --filter @workspace/auth test
pnpm --filter @workspace/auth typecheck
```

Expected: auth package no longer owns divergent billing definitions.

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/plans.ts packages/auth/src/entitlements.ts packages/auth/src/auth.server.ts packages/auth/test/unit/billing.server.test.ts
git commit -m "refactor(auth): remove duplicate billing semantics"
```

## Task 8: Final verification and architecture checks

**Files:**

- Modify: any touched files above as needed from verification fixes

- [ ] **Step 1: Run cross-package tests**

```bash
pnpm --filter @workspace/billing test
pnpm --filter @workspace/web test
pnpm --filter @workspace/admin-web test
pnpm --filter @workspace/auth test
```

Expected: all affected package and app tests pass.

- [ ] **Step 2: Run repo-wide safety checks for shared boundaries**

```bash
pnpm run typecheck
pnpm run check:boundaries
```

Expected: typecheck and dependency boundaries pass with no new violations.

- [ ] **Step 3: Manual architecture review**

Confirm all of the following before calling the work complete:

- web UI no longer chooses checkout vs contact sales from raw plan metadata,
- billing portal visibility comes from shared evaluated policy,
- at least one feature-access workflow uses the new shared contract,
- admin workspace detail exposes effective billing policy metadata,
- `packages/auth` is no longer a competing owner of billing semantics.

- [ ] **Step 4: Commit verification fixes**

```bash
git add .
git commit -m "test: verify billing feature-access policy rollout"
```

## Risks and Tradeoffs

- Do not move billing product semantics into `packages/policy`; that would blur authorization and commercial behavior.
- Do not overfit the first contract to one screen. The shared output should cover billing page actions and at least one non-billing feature-access workflow.
- Keep raw plan definitions available for rendering and catalog display; only behavioral branching should move behind the evaluated contract.
- If `packages/auth` cleanup threatens this slice, land compatibility re-exports first and schedule deletion immediately after.

## Definition of Done

This follow-up is complete when all of the following are true:

1. `@workspace/billing` exposes a shared evaluated billing product-policy contract.
2. `apps/web` billing UI and upgrade prompts consume that contract instead of branching on raw plan metadata.
3. At least one feature-access workflow outside the billing page consumes the same contract.
4. `apps/admin` receives effective billing-policy detail rather than only raw plan and override facts.
5. `packages/auth` no longer acts as a competing owner of plan and entitlement semantics.
6. Affected tests, typecheck, and boundary checks pass.

## Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-06-billing-feature-access-policy.md`. Two execution options:

1. Subagent-Driven (recommended) - implement task-by-task with fresh worker context and review between tasks.
2. Inline Execution - implement directly in this session with checkpoints after each major task.
