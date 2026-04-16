# Admin E2E Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stable first wave of read-only Playwright coverage for `apps/admin` that validates seeded admin sign-in, protected-shell navigation, users list/detail flows, and workspaces list/detail flows.

**Architecture:** Build on the existing admin Playwright harness and baseline DB seeding. Keep authentication rooted in seeded fixture users and real Better Auth session cookies, then layer small admin-specific Playwright helpers plus focused specs for each admin surface. Avoid mutation coverage in this plan so failures point to auth, routing, policy, query, or rendering regressions rather than write-path instability.

**Tech Stack:** Playwright, TanStack Start admin app, Better Auth, seeded Postgres fixtures from `@workspace/db-schema`, shared E2E helpers in `@workspace/test-utils`

---

## File Structure

### Existing files to modify

- `apps/admin/test/e2e/global-setup.ts`
  - Keep baseline seeding behavior aligned with the new spec set if any additional seed preconditions are needed.
- `apps/admin/test/e2e/auth/signin.spec.ts`
  - Keep as the seeded sign-in smoke test and tighten assertions only if needed to align with the shared helper strategy.
- `packages/db-schema/src/seed/e2e-fixtures.ts`
  - Extend only if wave 1 needs additional deterministic fixture exports for known seeded users or workspaces.
- `packages/db-schema/src/seed/seed-e2e-baseline.ts`
  - Keep the baseline seeder aligned with any new named workspace fixtures used by wave 1 assertions.

### New admin-only test files

- `apps/admin/test/e2e/fixtures/admin-auth.ts`
  - Admin Playwright helper for obtaining a seeded platform-admin browser session.
- `apps/admin/test/e2e/fixtures/admin-fixtures.ts`
  - Admin-facing references to seeded users/workspaces used by assertions.
- `apps/admin/test/e2e/navigation/admin-shell.spec.ts`
  - Read-only navigation coverage for protected-shell links and route transitions.
- `apps/admin/test/e2e/users/users-list.spec.ts`
  - Read-only users index coverage.
- `apps/admin/test/e2e/users/user-detail.spec.ts`
  - Read-only seeded user detail coverage.
- `apps/admin/test/e2e/workspaces/workspaces-list.spec.ts`
  - Read-only workspaces index coverage.
- `apps/admin/test/e2e/workspaces/workspace-detail.spec.ts`
  - Read-only seeded workspace detail coverage.

### Optional shared helper extension

- `packages/test-utils/src/e2e-auth.ts`
  - Extend only if the existing seeded sign-in primitive needs a small reusable addition that belongs at the shared layer.

Shared-package rule for this plan:

- keep `@workspace/test-utils` and `@workspace/db-schema` changes additive
- do not change the behavior of existing web-consumed helpers unless a cross-app migration is explicitly intended
- prefer new admin-only wrappers in `apps/admin/test/e2e/fixtures/**` over modifying shared helper semantics

## Task 1: Confirm And Expose Deterministic Admin Fixtures

**Files:**

- Inspect: `packages/db-schema/src/seed/e2e-fixtures.ts`
- Modify if needed: `packages/db-schema/src/seed/e2e-fixtures.ts`
- Test indirectly: `apps/admin/test/e2e/auth/signin.spec.ts`

- [ ] **Step 1: Read the current seeded fixture exports and choose the exact records wave 1 will assert**

Verify that the plan will consistently assert against:

```ts
E2E_PLATFORM_ADMIN;
E2E_BASELINE_USERS.owner;
E2E_BASELINE_USERS.admin;
E2E_BASELINE_USERS.member;
E2E_BASELINE_USERS.proOwner;
```

Also confirm which workspace records are already seeded and whether they are exported under stable names. If workspace fixture exports are missing or ambiguous, add named exports that describe the target read-only records plainly.

Wave 1 should make this explicit instead of conditional. The workspace specs later in the plan assume `adminFixtures.workspaces.*` exists, so named workspace fixture exports need to be established before those specs are written.

- [ ] **Step 2: Write the smallest failing admin spec that depends on one chosen seeded record**

Use the existing sign-in spec as the first safety check. Tighten or add one expectation that depends on a known fixture-owned value already exported from `@workspace/db-schema`.

Example target assertion:

```ts
await expect(page.getByText(E2E_PLATFORM_ADMIN.email)).toBeVisible();
```

- [ ] **Step 3: Run the targeted sign-in spec to validate fixture assumptions**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/auth/signin.spec.ts
```

Expected:

- the Playwright-managed admin server starts on port `3001`
- baseline seeding succeeds
- the sign-in spec passes using fixture-backed credentials

- [ ] **Step 4: If fixture exports are unclear, implement the minimal export cleanup**

If needed, add explicit named fixture exports in `packages/db-schema/src/seed/e2e-fixtures.ts` rather than embedding magic values in specs, and update `packages/db-schema/src/seed/seed-e2e-baseline.ts` so those exported records are actually seeded.

Example shape:

```ts
export const E2E_ADMIN_WORKSPACES = {
  owner: {
    organizationId: 'e2e_org_owner',
    name: 'E2E Owner Workspace',
    slug: 'e2e-owner',
  },
  proOwner: {
    organizationId: 'e2e_org_pro_owner',
    name: 'E2E Pro Workspace',
    slug: 'e2e-pro-owner',
  },
  enterprise: {
    organizationId: 'e2e_org_enterprise_owner',
    name: 'E2E Enterprise Workspace',
    slug: 'e2e-enterprise-owner',
  },
};
```

- [ ] **Step 5: Re-run the same targeted sign-in spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/auth/signin.spec.ts
```

Expected: PASS with no changes to the behavior of the existing sign-in flow.

## Task 2: Add Admin Playwright Auth Helpers

**Files:**

- Create: `apps/admin/test/e2e/fixtures/admin-auth.ts`
- Optionally modify: `packages/test-utils/src/e2e-auth.ts`
- Test: `apps/admin/test/e2e/navigation/admin-shell.spec.ts`

- [ ] **Step 1: Write the failing navigation spec using a not-yet-created admin session helper**

Create the new spec with the intended helper usage first.

Example test skeleton:

```ts
import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';

test('platform admin can navigate between protected shell routes', async ({
  page,
}) => {
  await signInAsPlatformAdmin(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
});
```

- [ ] **Step 2: Run the new navigation spec to confirm it fails for the right reason**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/navigation/admin-shell.spec.ts
```

Expected: FAIL because `../fixtures/admin-auth` or `signInAsPlatformAdmin` does not exist yet.

- [ ] **Step 3: Implement the minimal admin auth helper**

Create `apps/admin/test/e2e/fixtures/admin-auth.ts` with a thin wrapper around seeded auth.

Suggested implementation shape:

```ts
import type { Page } from '@playwright/test';
import { E2E_PASSWORD, E2E_PLATFORM_ADMIN } from '@workspace/db-schema';
import { signInSeededUser } from '@workspace/test-utils/e2e-auth';

function getBaseUrl() {
  return process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';
}

export async function signInAsPlatformAdmin(page: Page): Promise<void> {
  const baseUrl = getBaseUrl();
  const { cookie } = await signInSeededUser(baseUrl, {
    email: E2E_PLATFORM_ADMIN.email,
    password: E2E_PASSWORD,
  });

  const [cookiePair] = cookie.split(';');
  const [name, value] = cookiePair.split('=');

  await page.context().addCookies([
    {
      name,
      value,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}
```

If cookie parsing already exists elsewhere in the repo, reuse it instead of duplicating it.

- [ ] **Step 4: Re-run the navigation spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/navigation/admin-shell.spec.ts
```

Expected: FAIL only on the missing navigation assertions, not on authentication setup.

- [ ] **Step 5: Tighten the helper only as needed**

If route visits still require a convenience helper, add a tiny companion helper rather than expanding auth setup too far.

Example:

```ts
export async function gotoAdminPath(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}
```

## Task 3: Add Protected-Shell Navigation Coverage

**Files:**

- Create: `apps/admin/test/e2e/navigation/admin-shell.spec.ts`
- Test: `apps/admin/test/e2e/navigation/admin-shell.spec.ts`

- [ ] **Step 1: Write the full failing navigation assertions**

Cover:

- successful access to `/dashboard`
- visible `Dashboard`, `Users`, and `Workspaces` links
- transitions to `/users` and `/workspaces`

Suggested core assertions:

```ts
await signInAsPlatformAdmin(page);

await page.goto('/dashboard');
await expect(page.getByRole('button', { name: /Admin Portal/i })).toBeVisible();
await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
await expect(page.getByRole('link', { name: 'Workspaces' })).toBeVisible();

await page.getByRole('link', { name: 'Users' }).click();
await page.waitForURL(/\/users$/);

await page.getByRole('link', { name: 'Workspaces' }).click();
await page.waitForURL(/\/workspaces$/);
```

- [ ] **Step 2: Run the navigation spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/navigation/admin-shell.spec.ts
```

Expected: FAIL only on assertions that reveal real selector or route-shape mismatches.

- [ ] **Step 3: Implement the minimal spec fixes**

Adjust selectors or waiting strategy to match the real UI semantics. Prefer role-based selectors and URL assertions over brittle DOM traversal.

- [ ] **Step 4: Re-run the navigation spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/navigation/admin-shell.spec.ts
```

Expected: PASS.

## Task 4: Add Stable Admin Fixture References For Specs

**Files:**

- Create: `apps/admin/test/e2e/fixtures/admin-fixtures.ts`
- Read: `packages/db-schema/src/seed/e2e-fixtures.ts`
- Test: `apps/admin/test/e2e/users/users-list.spec.ts`

- [ ] **Step 1: Write a failing users-list spec that imports admin fixture references**

Example import usage:

```ts
import { adminFixtures } from '../fixtures/admin-fixtures';
```

- [ ] **Step 2: Run the users-list spec to confirm the missing fixture helper failure**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/users-list.spec.ts
```

Expected: FAIL because `admin-fixtures.ts` does not exist yet.

- [ ] **Step 3: Implement `admin-fixtures.ts` as a thin mapping layer**

Suggested shape:

```ts
import {
  E2E_ADMIN_WORKSPACES,
  E2E_BASELINE_USERS,
  E2E_PLATFORM_ADMIN,
} from '@workspace/db-schema';

export const adminFixtures = {
  platformAdmin: E2E_PLATFORM_ADMIN,
  users: {
    owner: E2E_BASELINE_USERS.owner,
    admin: E2E_BASELINE_USERS.admin,
    member: E2E_BASELINE_USERS.member,
    proOwner: E2E_BASELINE_USERS.proOwner,
  },
  workspaces: E2E_ADMIN_WORKSPACES,
};
```

- [ ] **Step 4: Re-run the users-list spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/users-list.spec.ts
```

Expected: FAIL only on missing page assertions, not fixture imports.

## Task 5: Add Users List Read-Only Coverage

**Files:**

- Create: `apps/admin/test/e2e/users/users-list.spec.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-auth.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-fixtures.ts`
- Test: `apps/admin/test/e2e/users/users-list.spec.ts`

- [ ] **Step 1: Write the failing users-list spec**

Cover:

- visiting `/users` after seeded sign-in
- seeing at least one deterministic seeded user
- searching for a seeded email
- deep-linking through the row link to `/users/$userId`

Suggested test skeleton:

```ts
import { expect, test } from '@playwright/test';
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';

test('users list renders seeded users and supports read-only navigation', async ({
  page,
}) => {
  await signInAsPlatformAdmin(page);
  await page.goto('/users');

  await expect(
    page.getByRole('link', { name: adminFixtures.users.owner.email })
  ).toBeVisible();

  await page.getByPlaceholder(/search/i).fill(adminFixtures.users.member.email);
  await page.keyboard.press('Enter');

  await expect(
    page.getByRole('link', { name: adminFixtures.users.member.email })
  ).toBeVisible();
});
```

- [ ] **Step 2: Run the users-list spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/users-list.spec.ts
```

Expected: FAIL on real selector, debounce, or filter behavior differences.

- [ ] **Step 3: Implement the minimal selector and waiting strategy corrections**

Use the actual accessible controls exposed by `AdminUserTable`, such as:

- filter tabs like `All`, `Verified`, `Unverified`, `Banned`
- link text based on seeded name or email
- action menu where row-link navigation is not sufficient

Prefer explicit waits tied to result visibility rather than arbitrary timeouts.

- [ ] **Step 4: Add one deterministic filter assertion**

Only if seeded fixtures support it, add a read-only filter assertion such as:

```ts
await page.getByRole('tab', { name: 'Unverified' }).click();
await expect(
  page.getByRole('link', { name: adminFixtures.users.member.email })
).toBeVisible();
```

If the seeded users do not provide predictable filter coverage, skip filter assertions rather than making the test flaky.

- [ ] **Step 5: Re-run the users-list spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/users-list.spec.ts
```

Expected: PASS.

## Task 6: Add User Detail Read-Only Coverage

**Files:**

- Create: `apps/admin/test/e2e/users/user-detail.spec.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-auth.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-fixtures.ts`
- Test: `apps/admin/test/e2e/users/user-detail.spec.ts`

- [ ] **Step 1: Write the failing user-detail spec**

Cover direct detail navigation and read-only rendering only.

Suggested core assertions:

```ts
await signInAsPlatformAdmin(page);
await page.goto(`/users/${adminFixtures.users.owner.userId}`);

await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
await expect(
  page.getByDisplayValue(adminFixtures.users.owner.email)
).toBeVisible();
await expect(
  page.getByDisplayValue(adminFixtures.users.owner.name)
).toBeVisible();
await expect(page.getByText('Danger Zone')).toBeVisible();
```

- [ ] **Step 2: Run the user-detail spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-detail.spec.ts
```

Expected: FAIL on any mismatch between fixture IDs, form semantics, or page affordances.

- [ ] **Step 3: Implement the minimal assertion corrections**

Adjust assertions to the actual semantics of `AdminUserForm`. Keep coverage read-only:

- no form submissions
- no delete confirmation completion
- no write-path assertions

- [ ] **Step 4: Re-run the user-detail spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-detail.spec.ts
```

Expected: PASS.

## Task 7: Add Workspaces List Read-Only Coverage

**Files:**

- Create: `apps/admin/test/e2e/workspaces/workspaces-list.spec.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-auth.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-fixtures.ts`
- Test: `apps/admin/test/e2e/workspaces/workspaces-list.spec.ts`

- [ ] **Step 1: Write the failing workspaces-list spec**

Cover:

- visiting `/workspaces`
- seeing deterministic seeded workspace rows
- search by seeded workspace name
- navigation to `/workspaces/$workspaceId`

Suggested skeleton:

```ts
await signInAsPlatformAdmin(page);
await page.goto('/workspaces');

await expect(
  page.getByRole('link', { name: adminFixtures.workspaces.owner.name })
).toBeVisible();
```

- [ ] **Step 2: Run the workspaces-list spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/workspaces/workspaces-list.spec.ts
```

Expected: FAIL until workspace fixture mapping and selectors are aligned.

- [ ] **Step 3: Implement the minimal fixture or selector support**

By this point workspace fixture mappings should already exist from Task 1 and Task 4. Assert on:

- seeded workspace name
- plan badge text such as `free`, `pro`, or `enterprise`
- status badge text when deterministic

- [ ] **Step 4: Add one deterministic filter assertion**

Only if seeded plans support it, verify `Self-serve` or `Enterprise` tabs narrow the list correctly.

Example:

```ts
await page.getByRole('tab', { name: 'Enterprise' }).click();
await expect(
  page.getByRole('link', { name: adminFixtures.workspaces.enterprise.name })
).toBeVisible();
```

- [ ] **Step 5: Re-run the workspaces-list spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/workspaces/workspaces-list.spec.ts
```

Expected: PASS.

## Task 8: Add Workspace Detail Read-Only Coverage

**Files:**

- Create: `apps/admin/test/e2e/workspaces/workspace-detail.spec.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-auth.ts`
- Use: `apps/admin/test/e2e/fixtures/admin-fixtures.ts`
- Test: `apps/admin/test/e2e/workspaces/workspace-detail.spec.ts`

- [ ] **Step 1: Write the failing workspace-detail spec**

Cover direct detail navigation and seeded field rendering only.

Suggested assertions:

```ts
await signInAsPlatformAdmin(page);
await page.goto(`/workspaces/${adminFixtures.workspaces.owner.organizationId}`);

await expect(page.getByText('Workspace Info')).toBeVisible();
await expect(
  page.getByDisplayValue(adminFixtures.workspaces.owner.name)
).toBeVisible();
await expect(
  page.getByDisplayValue(adminFixtures.workspaces.owner.slug)
).toBeVisible();
```

- [ ] **Step 2: Run the workspace-detail spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/workspaces/workspace-detail.spec.ts
```

Expected: FAIL on any mismatch in fixture wiring or section visibility assumptions.

- [ ] **Step 3: Implement the minimal assertion corrections**

Add read-only assertions for the deterministic sections that actually render for the seeded fixture:

- `Workspace Info`
- subscription card, if present for the seeded plan
- visible owner/member metadata

Do not submit entitlement overrides or support actions.

- [ ] **Step 4: Re-run the workspace-detail spec**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/workspaces/workspace-detail.spec.ts
```

Expected: PASS.

## Task 9: Run The Admin E2E Wave As A Whole

**Files:**

- Verify: `apps/admin/test/e2e/**`

- [ ] **Step 1: Run each new spec individually**

Run:

```bash
pnpm --filter @workspace/admin-web playwright test test/e2e/navigation/admin-shell.spec.ts
pnpm --filter @workspace/admin-web playwright test test/e2e/users/users-list.spec.ts
pnpm --filter @workspace/admin-web playwright test test/e2e/users/user-detail.spec.ts
pnpm --filter @workspace/admin-web playwright test test/e2e/workspaces/workspaces-list.spec.ts
pnpm --filter @workspace/admin-web playwright test test/e2e/workspaces/workspace-detail.spec.ts
```

Expected: PASS for every individual spec.

- [ ] **Step 2: Run the full admin Chromium E2E suite**

Run:

```bash
pnpm admin:test:e2e:chromium
```

Expected:

- Playwright builds the admin app for E2E
- global setup validates the mock email client and seeds the baseline
- all admin E2E specs pass in Chromium

- [ ] **Step 3: Run the smallest relevant static verification**

Run:

```bash
pnpm --filter @workspace/admin-web test:e2e -- --list
pnpm --filter @workspace/admin-web typecheck
```

Expected:

- Playwright lists the expected admin specs
- admin typecheck passes

- [ ] **Step 4: If shared packages changed, run the smallest relevant `apps/web` E2E regression checks**

Only run this step if the implementation touched `packages/db-schema/**` or `packages/test-utils/**`.

Run:

```bash
pnpm --filter @workspace/web playwright test test/e2e/auth/signin.spec.ts --workers=1
pnpm --filter @workspace/web playwright test test/e2e/seed.spec.ts --workers=1
```

Expected:

- the existing web seeded-auth flow still passes
- the existing web baseline seed assumptions still hold

- [ ] **Step 5: Document any cross-app verification outcome**

If shared-package edits were made, record whether the web regression checks passed cleanly or required follow-up. If no shared-package edits were made, note that the blast radius stayed admin-local.

- [ ] **Step 4: Document any deferred wave 2 gaps**

Record remaining mutation candidates in the implementation summary or follow-up issue:

- user edit and delete flows
- workspace entitlement override flows
- support-action flows

## Self-Review

### Spec coverage check

The plan covers the spec's wave 1 goals:

- seeded platform-admin sign-in
- protected-shell navigation
- users list/detail read-only coverage
- workspaces list/detail read-only coverage
- helper strategy rooted in seeded auth and deterministic fixtures
- explicit named workspace fixtures that the later workspace specs depend on
- cross-app verification expectations when shared seed/auth helpers change

Wave 2 mutation workflows are intentionally deferred and called out explicitly.

### Placeholder scan

No task relies on `TODO`, `TBD`, or unspecified “appropriate” behavior. Optional assertions are explicitly conditional on deterministic fixture support so implementation can stay honest without inventing unstable coverage.

### Type consistency check

The plan consistently uses:

- `signInAsPlatformAdmin` for the admin sign-in helper
- `adminFixtures` for seeded assertion references
- `/users/$userId` and `/workspaces/$workspaceId` as the route patterns under test

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-admin-e2e-wave-1.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
