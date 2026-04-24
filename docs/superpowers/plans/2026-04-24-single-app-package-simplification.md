# Single App Package Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the now web-only `@workspace/components` package into `apps/web`, remove the package, and prove no package references or transitional artifacts remain.

**Architecture:** Use a copy-first migration so `packages/components` stays intact while each app-local slice is introduced and verified. Once all app imports use local paths, delete `packages/components`, remove package metadata, update the lockfile, and run hygiene plus no-regression verification.

**Tech Stack:** TypeScript, React 19, TanStack Start, Vitest, Playwright, pnpm workspaces, Turborepo, ESLint, Prettier.

---

## Implementation Notes

This is a behavior-preserving refactor. Do not change component behavior, text, routes, auth semantics, policy logic, billing logic, or UI styling.

Use local domain barrels to keep the migration mechanical and readable:

```txt
@workspace/components/lib     -> @/lib
@workspace/components/form    -> @/components/form
@workspace/components/icons   -> @/components/icons
@workspace/components/hooks   -> @/hooks
@workspace/components/layout  -> @/components/layout
@workspace/components/auth    -> @/auth
@workspace/components/account -> @/account
```

These barrels are app-local domain entrypoints, not a new shared package surface. Do not create a broad `@/components/index.ts` barrel.

Run commands from the repository root:

```bash
git rev-parse --show-toplevel
```

Expected:

```txt
/Users/sfung/.codex/worktrees/9718/sass-starter-template
```

## Task 1: Baseline And Migration Guardrails

**Files:**

- Read: `docs/superpowers/specs/2026-04-24-single-app-package-simplification-design.md`
- Read: `packages/components/src/**`
- Read: `apps/web/src/**`
- Read: `apps/web/test/**`

- [x] **Step 1: Confirm branch and clean tracked state**

Run:

```bash
git status --short --branch
```

Expected:

```txt
## codex/phase-7-package-simplification...origin/main
```

The exact ahead count may vary as plan/spec commits are added. There should be no tracked or untracked source changes before the implementation begins.

- [x] **Step 2: Capture current `@workspace/components` references**

Run:

```bash
rg -n "@workspace/components/(lib|icons|form|hooks|layout|auth|account)" apps/web/src apps/web/test
```

Expected: matches in `apps/web/src` and `apps/web/test`. These are the references the later tasks must eliminate.

- [x] **Step 3: Capture current retired-path ignored artifacts**

Run:

```bash
git status --short --ignored apps/admin packages/components
```

Expected before cleanup: ignored `apps/admin/` artifacts may be present from the retired app. Track the output so the final hygiene task can prove they were removed.

- [x] **Step 4: Run baseline package checks**

Run:

```bash
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm --filter @workspace/web test
```

Expected: all pass before package movement begins.

- [x] **Step 5: Commit only if a baseline artifact was intentionally added**

No commit is expected for this task unless an evidence file is intentionally created. If no files changed, continue to Task 2.

## Task 2: Copy Low-Level Utilities, Icons, And Form Components

**Files:**

- Create: `apps/web/src/lib/**`
- Create: `apps/web/src/components/icons/**`
- Create: `apps/web/src/components/form/**`
- Modify imports in: `apps/web/src/**`
- Modify imports in: `apps/web/test/**`

- [x] **Step 1: Copy low-level package folders into `apps/web`**

Run:

```bash
mkdir -p apps/web/src/components
cp -R packages/components/src/lib apps/web/src/lib
cp -R packages/components/src/icons apps/web/src/components/icons
cp -R packages/components/src/form apps/web/src/components/form
```

Expected: these files now exist:

```txt
apps/web/src/lib/index.ts
apps/web/src/lib/email-provider.ts
apps/web/src/lib/form-utils.ts
apps/web/src/lib/format.ts
apps/web/src/lib/get-initials.ts
apps/web/src/lib/table-constants.ts
apps/web/src/lib/test-email-links.ts
apps/web/src/components/icons/index.ts
apps/web/src/components/icons/google-icon.tsx
apps/web/src/components/form/index.ts
apps/web/src/components/form/form-error.tsx
apps/web/src/components/form/form-error-display.tsx
apps/web/src/components/form/form-submit-button.tsx
apps/web/src/components/form/validated-field.tsx
```

- [x] **Step 2: Fix copied form component import paths**

Update `apps/web/src/components/form/validated-field.tsx`:

```diff
-import { toFieldErrorItem } from '../lib/form-utils';
+import { toFieldErrorItem } from '@/lib/form-utils';
```

No other copied `form` or `icons` files should need app-local import changes.

- [x] **Step 3: Update app/test imports for moved low-level domains**

Run:

```bash
perl -pi -e 's#@workspace/components/lib#@/lib#g' $(rg -l "@workspace/components/lib" apps/web/src apps/web/test)
perl -pi -e 's#@workspace/components/form#@/components/form#g' $(rg -l "@workspace/components/form" apps/web/src apps/web/test)
perl -pi -e 's#@workspace/components/icons#@/components/icons#g' $(rg -l "@workspace/components/icons" apps/web/src apps/web/test)
```

Expected:

```bash
rg -n "@workspace/components/(lib|form|icons)" apps/web/src apps/web/test
```

prints no matches.

- [x] **Step 4: Verify low-level slice**

Run:

```bash
pnpm --filter @workspace/web test test/unit/lib test/unit/components/form test/unit/components/auth/google-sign-in-button.test.tsx
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
```

Expected: all pass.

- [x] **Step 5: Commit low-level slice**

Run:

```bash
git add apps/web/src apps/web/test
git commit -m "refactor(web): move component utilities into app"
```

Expected: commit succeeds with only low-level copy and import changes.

## Task 3: Copy Shared Hooks

**Files:**

- Create: `apps/web/src/hooks/index.ts`
- Create: `apps/web/src/hooks/use-column-sort.ts`
- Create: `apps/web/src/hooks/use-linked-accounts-query.ts`
- Create: `apps/web/src/hooks/use-session-query.ts`
- Create: `apps/web/src/hooks/use-sessions-query.ts`
- Modify imports in: `apps/web/src/**`
- Modify imports in: `apps/web/test/**`

- [x] **Step 1: Copy hook files into existing app hooks folder**

Run:

```bash
cp packages/components/src/hooks/index.ts apps/web/src/hooks/index.ts
cp packages/components/src/hooks/use-column-sort.ts apps/web/src/hooks/use-column-sort.ts
cp packages/components/src/hooks/use-linked-accounts-query.ts apps/web/src/hooks/use-linked-accounts-query.ts
cp packages/components/src/hooks/use-session-query.ts apps/web/src/hooks/use-session-query.ts
cp packages/components/src/hooks/use-sessions-query.ts apps/web/src/hooks/use-sessions-query.ts
```

Expected: `apps/web/src/hooks` now contains the existing app hooks plus the copied session/table hooks.

- [x] **Step 2: Update app/test imports for hooks**

Run:

```bash
perl -pi -e 's#@workspace/components/hooks#@/hooks#g' $(rg -l "@workspace/components/hooks" apps/web/src apps/web/test --glob '!apps/web/test/unit/components/account/active-sessions-list.test.tsx' --glob '!apps/web/test/unit/components/account/linked-accounts-card.test.tsx')
```

Expected:

```bash
rg -n "@workspace/components/hooks" apps/web/src
rg -n "@workspace/components/hooks" apps/web/test --glob '!apps/web/test/unit/components/account/active-sessions-list.test.tsx' --glob '!apps/web/test/unit/components/account/linked-accounts-card.test.tsx'
```

prints no matches. Tests that still import account components from `@workspace/components/account` keep mocking `@workspace/components/hooks` until Task 6 moves account components into `apps/web`.

- [x] **Step 3: Verify hook slice**

Run:

```bash
pnpm --filter @workspace/web test test/unit/hooks test/unit/workspace/use-members-table.test.ts test/integration/components/workspace/workspace-members-page.integration.test.tsx
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
```

Expected: all pass.

- [x] **Step 4: Commit hook slice**

Run:

```bash
git add apps/web/src apps/web/test
git commit -m "refactor(web): move shared hooks into app"
```

Expected: commit succeeds with only hook copy and import changes.

## Task 4: Copy Layout Components

**Files:**

- Create: `apps/web/src/components/layout/**`
- Modify imports in: `apps/web/src/**`
- Modify imports in: `apps/web/test/**`

- [x] **Step 1: Copy layout package folder into app components**

Run:

```bash
cp -R packages/components/src/layout apps/web/src/components/layout
```

Expected: these files now exist:

```txt
apps/web/src/components/layout/index.ts
apps/web/src/components/layout/app-error-boundary.tsx
apps/web/src/components/layout/dynamic-breadcrumb.tsx
apps/web/src/components/layout/nav-admin.tsx
apps/web/src/components/layout/nav-secondary.tsx
apps/web/src/components/layout/nav-user.tsx
apps/web/src/components/layout/not-found.tsx
apps/web/src/components/layout/site-header.tsx
apps/web/src/components/layout/sortable-header.tsx
apps/web/src/components/layout/table-pagination.tsx
apps/web/src/components/layout/theme-provider.tsx
```

- [x] **Step 2: Update app/test imports for layout**

Run:

```bash
perl -pi -e 's#@workspace/components/layout#@/components/layout#g' $(rg -l "@workspace/components/layout" apps/web/src apps/web/test)
```

Expected:

```bash
rg -n "@workspace/components/layout" apps/web/src apps/web/test
```

prints no matches.

- [x] **Step 3: Verify layout slice**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/dynamic-breadcrumb.test.tsx test/unit/components/nav-secondary.test.tsx test/unit/components/nav-user.test.tsx test/unit/components/not-found.test.tsx test/unit/components/site-header.test.tsx test/unit/components/theme-provider.test.tsx test/unit/routes/admin-route-shell.test.tsx test/unit/routes/app-entry-routing.test.tsx
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
```

Expected: all pass.

- [x] **Step 4: Commit layout slice**

Run:

```bash
git add apps/web/src apps/web/test
git commit -m "refactor(web): move layout components into app"
```

Expected: commit succeeds with only layout copy and import changes.

## Task 5: Copy Auth Components

**Files:**

- Create: `apps/web/src/auth/**`
- Modify imports in: `apps/web/src/auth/*.tsx`
- Modify imports in: `apps/web/src/**`
- Modify imports in: `apps/web/test/**`

- [x] **Step 1: Copy auth package folder into app auth folder**

Run:

```bash
cp -R packages/components/src/auth apps/web/src/auth
```

Expected: these files now exist:

```txt
apps/web/src/auth/index.ts
apps/web/src/auth/auth-layout.tsx
apps/web/src/auth/check-email-card.tsx
apps/web/src/auth/forgot-password-form.tsx
apps/web/src/auth/google-sign-in-button.tsx
apps/web/src/auth/reset-password-form.tsx
apps/web/src/auth/signin-form.tsx
apps/web/src/auth/signup-form.tsx
```

- [x] **Step 2: Fix copied auth component import paths**

Run:

```bash
perl -pi -e 's#../form/#@/components/form/#g; s#../icons/google-icon#@/components/icons/google-icon#g' apps/web/src/auth/*.tsx
```

Expected import examples:

```ts
import { FormErrorDisplay } from '@/components/form/form-error-display';
import { FormSubmitButton } from '@/components/form/form-submit-button';
import { ValidatedField } from '@/components/form/validated-field';
import { GoogleIcon } from '@/components/icons/google-icon';
```

- [x] **Step 3: Update app/test imports for auth**

Run:

```bash
perl -pi -e 's#@workspace/components/auth#@/auth#g' $(rg -l "@workspace/components/auth" apps/web/src apps/web/test)
```

Expected:

```bash
rg -n "@workspace/components/auth" apps/web/src apps/web/test
```

prints no matches.

- [x] **Step 4: Verify auth slice**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/auth test/integration/components/auth/signin-form.integration.test.tsx test/integration/components/auth/signup-form.integration.test.tsx test/unit/routes/app-entry-routing.test.tsx
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
```

Expected: all pass.

- [x] **Step 5: Commit auth slice**

Run:

```bash
git add apps/web/src apps/web/test
git commit -m "refactor(web): move auth components into app"
```

Expected: commit succeeds with only auth copy and import changes.

## Task 6: Copy Account Components And Schemas

**Files:**

- Create: `apps/web/src/account/account-profile-form.tsx`
- Create: `apps/web/src/account/active-sessions-list.tsx`
- Create: `apps/web/src/account/change-email-dialog.tsx`
- Create: `apps/web/src/account/change-password-dialog.tsx`
- Create: `apps/web/src/account/linked-accounts-card.tsx`
- Create: `apps/web/src/account/set-password-dialog.tsx`
- Create: `apps/web/src/account/account.schemas.ts`
- Create: `apps/web/src/account/index.ts`
- Modify imports in: `apps/web/src/account/*.tsx`
- Modify imports in: `apps/web/src/**`
- Modify imports in: `apps/web/test/**`

- [x] **Step 1: Copy account package files into existing app account folder**

Run:

```bash
cp packages/components/src/account/account-profile-form.tsx apps/web/src/account/account-profile-form.tsx
cp packages/components/src/account/active-sessions-list.tsx apps/web/src/account/active-sessions-list.tsx
cp packages/components/src/account/change-email-dialog.tsx apps/web/src/account/change-email-dialog.tsx
cp packages/components/src/account/change-password-dialog.tsx apps/web/src/account/change-password-dialog.tsx
cp packages/components/src/account/linked-accounts-card.tsx apps/web/src/account/linked-accounts-card.tsx
cp packages/components/src/account/set-password-dialog.tsx apps/web/src/account/set-password-dialog.tsx
cp packages/components/src/account/schemas.ts apps/web/src/account/account.schemas.ts
cp packages/components/src/account/index.ts apps/web/src/account/index.ts
```

Expected: copied account UI lives beside the existing notification-preferences account modules.

- [x] **Step 2: Fix copied account barrel and schema imports**

Update `apps/web/src/account/index.ts`:

```diff
-export * from './schemas';
+export * from './account.schemas';
 export * from './account-profile-form';
 export * from './active-sessions-list';
 export * from './change-email-dialog';
 export * from './change-password-dialog';
 export * from './linked-accounts-card';
 export * from './set-password-dialog';
```

Run:

```bash
perl -pi -e 's#./schemas#./account.schemas#g' apps/web/src/account/*.tsx
```

Expected:

```bash
rg -n "\\./schemas" apps/web/src/account
```

prints no matches.

- [x] **Step 3: Fix copied account imports for app-local utilities**

Run:

```bash
perl -pi -e 's#../lib/form-utils#@/lib/form-utils#g; s#../lib/get-initials#@/lib/get-initials#g; s#../lib#@/lib#g; s#../hooks/use-session-query#@/hooks/use-session-query#g; s#../hooks#@/hooks#g; s#../icons#@/components/icons#g' apps/web/src/account/*.tsx
```

Expected import examples:

```ts
import { toFieldErrorItem } from '@/lib/form-utils';
import { getInitials } from '@/lib/get-initials';
import { SESSION_QUERY_KEY } from '@/hooks/use-session-query';
import { LINKED_ACCOUNTS_QUERY_KEY, useLinkedAccountsQuery } from '@/hooks';
import { GoogleIcon } from '@/components/icons';
```

- [x] **Step 4: Update app/test imports for account**

Run:

```bash
perl -pi -e 's#@workspace/components/account#@/account#g' $(rg -l "@workspace/components/account" apps/web/src apps/web/test)
```

Expected:

```bash
rg -n "@workspace/components/account" apps/web/src apps/web/test
```

prints no matches.

- [x] **Step 5: Verify account slice**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/account test/unit/account/schemas.test.ts test/integration/components/account/account-settings-flow.integration.test.tsx
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
```

Expected: all pass.

- [x] **Step 6: Commit account slice**

Run:

```bash
git add apps/web/src apps/web/test
git commit -m "refactor(web): move account components into app"
```

Expected: commit succeeds with only account copy and import changes.

## Task 7: Remove `packages/components` Package Boundary

**Files:**

- Delete: `packages/components/**`
- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`
- Modify: `pnpm-lock.yaml`

- [x] **Step 1: Confirm all app imports now use local paths**

Run:

```bash
rg -n "@workspace/components" apps/web/src apps/web/test
```

Expected: no matches.

- [x] **Step 2: Remove web package dependency**

Update `apps/web/package.json` dependencies:

```diff
-    "@workspace/components": "workspace:*",
```

Expected: `apps/web/package.json` no longer contains `@workspace/components`.

- [x] **Step 3: Remove web TypeScript path alias**

Update `apps/web/tsconfig.json` paths:

```diff
-      "@workspace/components/*": ["../../packages/components/src/*/index.ts"],
```

Expected: `apps/web/tsconfig.json` no longer contains `@workspace/components`.

- [x] **Step 4: Delete package source and manifest**

Run:

```bash
git rm -r packages/components
```

Expected: all tracked `packages/components` files are staged for deletion.

- [x] **Step 5: Refresh lockfile**

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` removes the `packages/components` importer and removes `@workspace/components` from `apps/web` dependencies.

- [x] **Step 6: Verify package-boundary removal**

Run:

```bash
rg -n "@workspace/components" apps packages package.json pnpm-lock.yaml pnpm-workspace.yaml
pnpm run check:boundaries
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm --filter @workspace/web test
```

Expected:

- `rg` prints no matches.
- boundary check passes.
- web typecheck, lint, and tests pass.

- [x] **Step 7: Commit package removal**

Run:

```bash
git add apps/web/package.json apps/web/tsconfig.json pnpm-lock.yaml
git commit -m "refactor(web): remove shared components package"
```

Expected: commit includes package deletion, dependency removal, alias removal, and lockfile update.

## Task 8: Clean Retired Transitional Artifacts

**Files:**

- Remove ignored artifacts under: `apps/admin/`
- Remove ignored artifacts under: `packages/components/`

- [x] **Step 1: Dry-run ignored artifact cleanup**

Run:

```bash
git status --short --ignored apps/admin packages/components
git clean -ndX apps/admin packages/components
```

Expected: output lists ignored artifacts such as `apps/admin/.output/`, `apps/admin/.turbo/`, `apps/admin/node_modules/`, `apps/admin/playwright-report/`, `apps/admin/test-results/`, or `apps/admin/.env` if they are present.

- [x] **Step 2: Remove ignored retired-path artifacts deliberately**

Run:

```bash
git clean -fdX apps/admin packages/components
```

Expected: ignored artifacts under `apps/admin` and `packages/components` are removed. This command is intentionally destructive for ignored files in retired paths only.

- [x] **Step 3: Verify no retired-path artifacts remain**

Run:

```bash
git status --short --ignored apps/admin packages/components
git clean -ndX apps/admin packages/components
```

Expected:
Both commands should produce no output for these paths.

- [x] **Step 4: Commit cleanup only if tracked files changed**

Run:

```bash
git status --short
```

Expected: no tracked changes from ignored-file cleanup. If tracked cleanup was needed, commit it with:

```bash
git add apps/admin packages/components
git commit -m "chore: remove retired package artifacts"
```

## Task 9: Final No-Regression Verification

**Files:**

- Read: `apps/web/test/e2e/**`
- Read: `apps/web/playwright.config.ts`
- Read: `apps/web/test/e2e/start-e2e-server.sh`

- [x] **Step 1: Run final static and unit/integration verification**

Run:

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run check:boundaries
pnpm run build
```

Expected: all pass.

- [x] **Step 2: Run final web E2E verification**

Run outside the sandbox when executing this plan:

```bash
pnpm --filter @workspace/web test:e2e
```

Expected: all Playwright tests pass. If this fails because the browser/server cannot run inside the sandbox, rerun with elevated execution rather than skipping the check.

- [x] **Step 3: Re-run final import and hygiene gates**

Run:

```bash
rg -n "@workspace/components" apps packages package.json pnpm-lock.yaml pnpm-workspace.yaml
git status --short --ignored apps/admin packages/components
git clean -ndX apps/admin packages/components
git status --short --branch
```

Expected:

- `rg` prints no matches.
- retired-path status prints no ignored or tracked leftovers.
- ignored-file dry-run prints no cleanup candidates.
- branch status shows a clean worktree.

- [x] **Step 4: Record verification evidence in final response**

Final response must include:

- commits created,
- all verification commands run,
- pass/fail result for each command,
- any skipped check with the exact reason,
- confirmation that no `@workspace/components` references remain,
- confirmation that no retired-path ignored artifacts remain.

## Self-Review Checklist

- [x] Every requirement in the design spec maps to a task above.
- [x] `packages/auth`, `packages/policy`, `packages/billing`, `packages/ui`, `packages/db`, and `packages/db-schema` remain untouched except for imports that already existed outside this migration.
- [x] No task moves domain/runtime code into `apps/web`.
- [x] No task creates a broad `@/components/index.ts` barrel.
- [x] Final verification includes lint, typecheck, tests, boundary checks, E2E, build, import search, and ignored-artifact cleanup.
- [x] Definition of Done includes no transitional files under retired paths.
