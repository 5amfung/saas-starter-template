# Admin E2E Wave 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a selective second wave of `apps/admin` Playwright coverage for mutation workflows, centered on high-value user-management and workspace-management write paths that can be executed safely against deterministic E2E fixtures.

**Architecture:** Build on the wave 1 seeded-auth and fixture helpers, then introduce mutation-target fixtures and narrowly scoped browser specs for admin writes. Each mutation spec should validate the complete browser workflow, visible success or error feedback, and persisted state after reload, while minimizing cross-test interference and external side effects.

**Tech Stack:** Playwright, TanStack Start admin app, Better Auth, seeded Postgres fixtures from `@workspace/db-schema`, shared E2E helpers in `@workspace/test-utils`

---

## File Structure

### Existing files to modify

- `packages/db-schema/src/seed/e2e-fixtures.ts`
  - Add explicit mutation-target fixture exports for users and workspaces when the current seeded records are not isolated enough for write-path tests.
- `packages/db-schema/src/seed/seed-e2e-baseline.ts`
  - Insert the mutation-target rows that are exported from `e2e-fixtures.ts` so the fixtures actually exist at runtime.
- `apps/admin/test/e2e/fixtures/admin-auth.ts`
  - Reuse the wave 1 auth helper and extend only if a tiny mutation-focused convenience is justified.
- `apps/admin/test/e2e/fixtures/admin-fixtures.ts`
  - Add mutation-target fixture references for the browser specs.

### New mutation specs

- `apps/admin/test/e2e/users/user-edit.spec.ts`
  - Non-destructive admin user edit workflow.
- `apps/admin/test/e2e/users/user-dangerous-actions.spec.ts`
  - High-risk user actions, such as delete-self protection or other destructive-action guardrails.
- `apps/admin/test/e2e/workspaces/workspace-entitlements.spec.ts`
  - Enterprise workspace entitlement override flow.

### Optional additional helpers

- `apps/admin/test/e2e/fixtures/admin-mutations.ts`
  - Thin helpers for repetitive save-and-wait flows and deterministic reseeding only if duplication becomes meaningful.

Shared-package rule for this plan:

- mutation-specific behavior should stay in admin-local helpers whenever possible
- changes to `@workspace/db-schema` and `@workspace/test-utils` must be additive and must preserve the semantics used by existing `apps/web` E2E flows
- if a shared-package change is unavoidable, verify both admin mutation coverage and the existing web seeded-auth seed flows before considering the work complete

## Task 1: Define Isolated Mutation Fixtures

**Files:**

- Modify: `packages/db-schema/src/seed/e2e-fixtures.ts`
- Modify: `apps/admin/test/e2e/fixtures/admin-fixtures.ts`
- Test indirectly: `apps/admin/test/e2e/users/user-edit.spec.ts`

- [ ] **Step 1: Inspect the current seeded records and choose dedicated mutation targets**

Pick fixtures that can be mutated safely without undermining wave 1 read-only specs.

At minimum, identify:

```ts
mutation user for edit coverage
mutation user for dangerous-action coverage
mutation enterprise workspace for entitlement coverage
```

If the current baseline users and workspaces are too shared or semantically overloaded, add new named fixture exports rather than reusing ambiguous records.

- [ ] **Step 2: Write the smallest failing mutation spec that imports the intended fixture**

Start with the user-edit workflow so fixture gaps show up immediately.

Example usage:

```ts
import { adminFixtures } from '../fixtures/admin-fixtures';

const targetUser = adminFixtures.mutations.editableUser;
```

- [ ] **Step 3: Run the new mutation spec to confirm fixture gaps**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-edit.spec.ts
```

Expected: FAIL because the mutation fixture reference does not exist yet or is incomplete.

- [ ] **Step 4: Add explicit mutation-target fixture exports**

Add clear exports in `packages/db-schema/src/seed/e2e-fixtures.ts`.

Example shape:

```ts
export const E2E_ADMIN_MUTATION_FIXTURES = {
  editableUser: {
    userId: 'e2e_user_admin_editable',
    accountId: 'e2e_account_admin_editable',
    email: 'admin-editable@e2e.local',
    name: 'E2E Editable User',
  },
  dangerousActionUser: {
    userId: 'e2e_user_admin_danger',
    accountId: 'e2e_account_admin_danger',
    email: 'admin-danger@e2e.local',
    name: 'E2E Danger User',
  },
  enterpriseWorkspace: {
    organizationId: 'e2e_org_admin_enterprise',
    name: 'E2E Enterprise Workspace',
    slug: 'e2e-admin-enterprise',
  },
};
```

Ensure these exports correspond to actual seeded rows created by the E2E seed flow by updating `packages/db-schema/src/seed/seed-e2e-baseline.ts` alongside the exported fixture definitions.

- [ ] **Step 5: Reflect those exports in `admin-fixtures.ts`**

Map them into the admin Playwright layer.

Example:

```ts
import {
  E2E_ADMIN_MUTATION_FIXTURES,
  E2E_BASELINE_USERS,
  E2E_PLATFORM_ADMIN,
} from '@workspace/db-schema';

export const adminFixtures = {
  platformAdmin: E2E_PLATFORM_ADMIN,
  users: E2E_BASELINE_USERS,
  mutations: E2E_ADMIN_MUTATION_FIXTURES,
};
```

- [ ] **Step 6: Re-run the targeted mutation spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-edit.spec.ts
```

Expected: FAIL only on missing browser assertions, not on missing fixture definitions.

## Task 2: Add Deterministic Mutation Reset Strategy

**Files:**

- Create or modify: `apps/admin/test/e2e/fixtures/admin-mutations.ts`
- Optionally use: `packages/db-schema/src/seed/seed-e2e-baseline.ts`
- Test: mutation specs

- [ ] **Step 1: Write the failing import for a mutation reset helper**

Use a shared helper so every mutation spec starts from known seeded state.

Example:

```ts
import { resetAdminMutationState } from '../fixtures/admin-mutations';
```

- [ ] **Step 2: Implement the minimal reseed helper**

Wrap the existing baseline seed path instead of inventing a second mutation-only reset flow unless the baseline becomes too expensive.

Example shape:

```ts
import { seedE2EBaseline } from '@workspace/db-schema';

export async function resetAdminMutationState(): Promise<void> {
  await seedE2EBaseline();
}
```

- [ ] **Step 3: Call the reseed helper at the start of each mutation spec file**

Use a `beforeEach` or `beforeAll` hook that matches the granularity of the mutation-target fixtures. Prefer `beforeEach` if a spec mutates the same record repeatedly; prefer `beforeAll` only when every test in the file uses disjoint fixtures.

- [ ] **Step 4: Run the first mutation spec in serialized worker mode**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-edit.spec.ts --workers=1
```

Expected: the mutation spec starts from a known seeded baseline every run.

## Task 3: Add User Edit Mutation Coverage

**Files:**

- Create: `apps/admin/test/e2e/users/user-edit.spec.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-auth.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-mutations.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-fixtures.ts`
- Test: `apps/admin/test/e2e/users/user-edit.spec.ts`

- [ ] **Step 1: Write the failing user-edit spec**

Cover a non-destructive update through the real admin user form.

Suggested skeleton:

```ts
import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';

test('platform admin can edit a seeded user and see persisted changes after reload', async ({
  page,
}) => {
  const user = adminFixtures.mutations.editableUser;
  const updatedName = 'E2E Editable User Updated';

  await signInAsPlatformAdmin(page);
  await page.goto(`/users/${user.userId}`);

  await page.getByLabel(/name/i).fill(updatedName);
  await page.getByRole('button', { name: /save/i }).click();
});
```

- [ ] **Step 2: Run the user-edit spec to confirm real failure behavior**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-edit.spec.ts
```

Expected: FAIL on actual form semantics, labels, save-button naming, or success-state timing.

- [ ] **Step 3: Implement the minimal stable assertions**

Complete the browser flow with assertions for:

- visible success feedback, if the UI provides it
- persisted updated value after reload

Suggested completion shape:

```ts
await expect(page.getByDisplayValue(updatedName)).toBeVisible();
await page.reload();
await expect(page.getByDisplayValue(updatedName)).toBeVisible();
```

If the UI requires waiting on navigation, query refetch, or toast feedback, use those real semantics instead of sleep-based timing.

- [ ] **Step 4: Re-run the user-edit spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-edit.spec.ts
```

Expected: PASS.

## Task 4: Add User Dangerous-Action Guardrail Coverage

**Files:**

- Create: `apps/admin/test/e2e/users/user-dangerous-actions.spec.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-auth.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-mutations.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-fixtures.ts`
- Test: `apps/admin/test/e2e/users/user-dangerous-actions.spec.ts`

- [ ] **Step 1: Write the failing dangerous-actions spec**

Start with the most stable guardrail already visible in the UI: self-delete protection.

Suggested skeleton:

```ts
import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';

test('platform admin cannot delete his own account from the danger zone', async ({
  page,
}) => {
  await signInAsPlatformAdmin(page);
  await page.goto(`/users/${adminFixtures.platformAdmin.userId}`);

  await expect(page.getByText('Danger Zone')).toBeVisible();
  await expect(page.getByText(/cannot delete your own account/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the dangerous-actions spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-dangerous-actions.spec.ts
```

Expected: FAIL only if the route, fixture ID, or guardrail assertion is mismatched.

- [ ] **Step 3: Expand to one additional dangerous action only if it is deterministic**

If the admin UI supports a stable destructive or semi-destructive flow that can be safely reset, add one more focused test. Examples:

- deleting a dedicated danger-user fixture
- banning a dedicated danger-user fixture

Keep it in a separate test block so self-delete guardrails remain isolated.

- [ ] **Step 4: Re-run the dangerous-actions spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-dangerous-actions.spec.ts
```

Expected: PASS.

## Task 5: Add Workspace Entitlement Mutation Coverage

**Files:**

- Create: `apps/admin/test/e2e/workspaces/workspace-entitlements.spec.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-auth.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-mutations.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-fixtures.ts`
- Test: `apps/admin/test/e2e/workspaces/workspace-entitlements.spec.ts`

- [ ] **Step 1: Write the failing entitlement-mutation spec**

Target the seeded enterprise workspace and cover the actual entitlement override flow exposed in the admin workspace detail UI.

Suggested skeleton:

```ts
import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';

test('platform admin can update enterprise entitlement overrides and see persisted state after reload', async ({
  page,
}) => {
  const workspace = adminFixtures.mutations.enterpriseWorkspace;

  await signInAsPlatformAdmin(page);
  await page.goto(`/workspaces/${workspace.organizationId}`);

  await expect(page.getByText(/entitlement/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the entitlement spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/workspaces/workspace-entitlements.spec.ts
```

Expected: FAIL on actual section naming, control labels, or fixture eligibility.

- [ ] **Step 3: Implement the minimal stable entitlement flow**

Complete the spec using the real form controls and assert:

- the override change is submitted successfully
- the updated override value remains visible after reload

If the entitlement form uses toggles, selects, or numeric inputs, interact with the real accessible controls rather than targeting implementation details.

- [ ] **Step 4: Re-run the entitlement spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/workspaces/workspace-entitlements.spec.ts
```

Expected: PASS.

## Task 6: Add Small Mutation Helpers Only If Repetition Justifies It

**Files:**

- Optionally create: `apps/admin/test/e2e/fixtures/admin-mutations.ts`
- Test: affected mutation specs

- [ ] **Step 1: Inspect the mutation specs for repeated browser steps**

Only extract helpers if the same save-and-wait sequence or success assertion appears in more than one spec.

- [ ] **Step 2: If justified, write the failing import in one spec first**

Example:

```ts
import { saveAndWaitForSuccess } from '../fixtures/admin-mutations';
```

- [ ] **Step 3: Implement the minimal helper**

Example shape:

```ts
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function saveAndWaitForSuccess(page: Page): Promise<void> {
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText(/saved|updated|success/i)).toBeVisible();
}
```

Only keep this helper if it genuinely improves clarity.

- [ ] **Step 4: Re-run the affected mutation specs**

Run the smallest relevant spec command for each spec using the helper.

Expected: PASS.

## Task 7: Run The Mutation Suite And Targeted Static Verification

**Files:**

- Verify: `apps/admin/test/e2e/users/*.spec.ts`
- Verify: `apps/admin/test/e2e/workspaces/*.spec.ts`

- [ ] **Step 1: Run each mutation spec individually**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-edit.spec.ts --workers=1
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-dangerous-actions.spec.ts --workers=1
pnpm --filter @workspace/admin-web playwright test test/e2e/workspaces/workspace-entitlements.spec.ts --workers=1
```

Expected: PASS for every individual mutation spec.

- [ ] **Step 2: Run the full admin Chromium suite**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-edit.spec.ts test/e2e/users/user-dangerous-actions.spec.ts test/e2e/workspaces/workspace-entitlements.spec.ts --workers=1
```

Expected:

- the mutation specs pass without cross-spec interference
- reseeding and mutation-target fixtures remain stable
- any later combined admin-suite run has an explicit worker/isolation strategy rather than relying on default full parallelism

- [ ] **Step 3: Run the smallest relevant static verification**

Run:

```bash
pnpm --filter @workspace/admin-web typecheck
```

If shared fixture or helper packages changed, also run:

```bash
pnpm --filter @workspace/db-schema typecheck
pnpm --filter @workspace/test-utils typecheck
```

Expected: PASS for every changed package/app that exposes TypeScript checks.

- [ ] **Step 4: If shared packages changed, run the smallest relevant `apps/web` E2E regression checks**

Only run this step if implementation touched `packages/db-schema/**` or `packages/test-utils/**`.

Run:

```bash
pnpm --filter @workspace/web playwright test test/e2e/auth/signin.spec.ts --workers=1
pnpm --filter @workspace/web playwright test test/e2e/seed.spec.ts --workers=1
```

Expected:

- the web seeded-auth flow still passes
- the web baseline seed contract still holds after the shared-package change

- [ ] **Step 5: Document any deferred mutation flows**

If support actions, API-key actions, or other destructive flows are still unsafe or insufficiently deterministic, record them explicitly as deferred rather than silently omitting them.

## Self-Review

### Spec coverage check

This plan covers the documented wave 2 areas:

- isolated mutation fixtures
- actual seeded-row creation for those fixtures
- deterministic reseeding before mutation flows
- user edit workflow
- dangerous-action guardrails
- workspace entitlement override workflow
- selective helper extraction and broader suite verification

### Placeholder scan

The plan avoids generic “test mutations” placeholders and names the concrete mutation categories the engineer should implement. Optional expansion is explicitly gated on deterministic fixture support and safe reset behavior.

### Type consistency check

The plan consistently uses:

- `adminFixtures.mutations.*` for mutation-target records
- `signInAsPlatformAdmin` for seeded admin auth
- dedicated spec files per mutation surface

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-admin-e2e-wave-2.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
