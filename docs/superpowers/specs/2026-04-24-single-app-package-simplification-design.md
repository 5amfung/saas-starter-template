# Single App Package Simplification Design

**Date:** 2026-04-24
**Status:** Draft

## Goal

Simplify the package structure after the admin and web runtimes have been merged into one TanStack Start app. The work should remove package indirection that only existed because `apps/admin` and `apps/web` were separate applications, while preserving the domain packages that still provide useful runtime boundaries.

The desired outcome is a smaller monorepo surface with no regression in visible UI, auth flows, billing behavior, admin behavior, or test coverage.

## Non-Goals

- Do not move `packages/auth` into `apps/web`.
- Do not move `packages/policy` into `apps/web`.
- Do not move `packages/billing` into `apps/web`.
- Do not move `packages/db`, `packages/db-schema`, `packages/ui`, `packages/email`, or `packages/logging`.
- Do not change Better Auth configuration, session semantics, database schema ownership, billing rules, or policy evaluation behavior.
- Do not manually edit generated route tree files.
- Do not combine this simplification with unrelated UI redesign or feature work.

## Ownership Report

The Phase 7 scan was run from a fresh branch based on `origin/main`:

```bash
rg -n "@workspace/components|@workspace/auth|@workspace/policy|@workspace/billing" apps/web/src packages
```

### `@workspace/auth`

`@workspace/auth` is still a real runtime/domain package.

Current consumers include:

- `apps/web/src/init.ts`, which creates the app's Better Auth runtime.
- app route and component code using `authClient`, auth schemas, and slug helpers.
- `packages/components`, which imports `authClient` and auth schemas.
- `packages/auth` itself, which owns Better Auth server/client setup, validators, schemas, plan re-exports, and billing/auth glue.

Decision: keep `packages/auth`.

Why: moving auth into `apps/web` would mix app route composition with Better Auth setup, validators, email behavior, billing hooks, and database-backed session concerns. It would also increase the chance of reintroducing the blurry auth ownership problem the single-app migration was designed to remove.

### `@workspace/policy`

`@workspace/policy` is still a useful pure policy package.

Current consumers include:

- `apps/web/src/policy/admin-app-capabilities.*`
- `apps/web/src/policy/web-app-entry.shared.ts`
- `apps/web/src/policy/workspace-capabilities.server.ts`
- `apps/web/src/policy/workspace-lifecycle-capabilities.server.ts`
- route tests that import policy capability types.

Decision: keep `packages/policy`.

Why: the package contains pure capability contracts and evaluators. App-local modules load contextual facts and call these evaluators. That split remains useful even with one app because it keeps authorization rules testable and prevents UI or server functions from making ad hoc role decisions.

### `@workspace/billing`

`@workspace/billing` is still a real domain/application package.

Current consumers include:

- customer billing server functions and UI.
- admin workspace/billing server code.
- billing UI components and tests.
- `packages/auth`, where Better Auth invitation and plan behavior depends on billing policy.

Decision: keep `packages/billing`.

Why: billing has domain rules, application queries/commands, plan definitions, entitlement math, and persistence adapters. Flattening this into `apps/web` would weaken the existing billing architecture and blur app orchestration with billing business rules.

### `@workspace/components`

`@workspace/components` is now the only package with a strong flattening case.

Current consumers are effectively `apps/web` and tests under `apps/web`. The original reason for the package was to deduplicate UI, hooks, layout, auth, account, and utility code shared by two separate apps. After the merge, there is no tracked `apps/admin` source consumer.

The package currently exposes:

- `@workspace/components/account`
- `@workspace/components/auth`
- `@workspace/components/form`
- `@workspace/components/hooks`
- `@workspace/components/icons`
- `@workspace/components/layout`
- `@workspace/components/lib`

Decision: make `packages/components` the Phase 7 simplification target.

Why: this package is app-composition code. Keeping it as a package now adds import indirection, extra workspace dependencies, package exports, and test mocks without preserving a cross-app reuse boundary.

## Recommended Approach

Move `packages/components` into `apps/web` in small domain slices, then delete the package once all imports have moved.

Target app structure:

```txt
apps/web/src/account/
  account-profile-form.tsx
  active-sessions-list.tsx
  change-email-dialog.tsx
  change-password-dialog.tsx
  linked-accounts-card.tsx
  set-password-dialog.tsx
  account.schemas.ts

apps/web/src/auth/
  auth-layout.tsx
  check-email-card.tsx
  forgot-password-form.tsx
  google-sign-in-button.tsx
  reset-password-form.tsx
  signin-form.tsx
  signup-form.tsx

apps/web/src/components/form/
  form-error-display.tsx
  form-error.tsx
  form-submit-button.tsx
  validated-field.tsx

apps/web/src/components/layout/
  app-error-boundary.tsx
  dynamic-breadcrumb.tsx
  nav-admin.tsx
  nav-secondary.tsx
  nav-user.tsx
  not-found.tsx
  site-header.tsx
  sortable-header.tsx
  table-pagination.tsx
  theme-provider.tsx

apps/web/src/components/icons/
  google-icon.tsx

apps/web/src/hooks/
  use-column-sort.ts
  use-linked-accounts-query.ts
  use-session-query.ts
  use-sessions-query.ts

apps/web/src/lib/
  email-provider.ts
  form-utils.ts
  format.ts
  get-initials.ts
  table-constants.ts
  test-email-links.ts
```

This keeps app-owned composition inside `apps/web` while preserving the existing low-level design-system boundary in `packages/ui`.

## Alternatives Considered

### Alternative A: Keep All Packages

This is the lowest-risk short-term option. It avoids import churn and preserves the current passing merged-app state.

Downside: it does not complete the Phase 7 goal. `@workspace/components` would remain a package whose original cross-app purpose no longer exists.

### Alternative B: Move Only `auth`, `account`, And `layout`

This follows the narrow candidate list from the Phase 6 plan.

Downside: `form`, `hooks`, `icons`, and `lib` mostly support those same app-composition domains. Moving only three folders would likely leave a smaller but awkward `@workspace/components` package behind, still imported by only `apps/web`.

### Alternative C: Move All Of `packages/components`

This is the recommended option.

It is broader than Alternative B, but it removes the package cleanly and aligns ownership with the new single-app architecture. The risk is manageable if the move is done domain by domain with targeted tests after each slice.

## Migration Order

Use small commits with verification after each meaningful slice:

1. Move `lib`, `icons`, and `form`.
2. Move shared hooks.
3. Move layout components.
4. Move auth components.
5. Move account components and schemas.
6. Remove `packages/components` from workspace dependencies, `apps/web/package.json`, `apps/web/tsconfig.json`, package manifests, and lockfile.
7. Run full validation.

The order keeps low-dependency files first and moves higher-level components after their local dependencies exist in `apps/web`.

## Import Rules After Migration

App code should import moved files through the existing app alias:

```ts
import { SigninForm } from '@/auth/signin-form';
import { AccountProfileForm } from '@/account/account-profile-form';
import { useSessionQuery } from '@/hooks/use-session-query';
import { SiteHeader } from '@/components/layout/site-header';
import { formatDate } from '@/lib/format';
```

Barrel files may be kept only where they reduce real route/component noise. Avoid recreating `@workspace/components` as `@/components/index.ts` with the same broad package-style surface.

## Testing And No-Regression Strategy

This migration should be behavior-preserving. The tests should mostly change import paths, not assertions.

Per-slice verification:

```bash
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm --filter @workspace/web test
```

Boundary verification after package deletion:

```bash
pnpm run check:boundaries
```

Full final verification:

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm --filter @workspace/web test:e2e
pnpm run build
```

Targeted no-regression checks:

- Auth pages still render and submit: `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/verify`.
- Account page still loads and supports profile, email, password, linked account, active session, and notification preference UI.
- Customer shell still renders header, sidebar, breadcrumb, workspace switcher, and table pagination/sorting UI.
- Admin shell still renders `/admin`, `/admin/dashboard`, `/admin/users`, `/admin/users/:userId`, `/admin/workspaces`, and `/admin/workspaces/:workspaceId`.
- Test email link extraction still works for E2E mock email routes.

## Repository Hygiene

Phase 7 should also clean up transitional files created by the migration or left behind by the retired two-app setup.

Before calling the phase done, verify there are no remaining tracked imports, manifests, generated outputs, ignored build artifacts, or scratch files tied to the removed package boundary.

Required hygiene checks:

```bash
rg -n "@workspace/components" apps packages
git status --short --ignored apps/admin packages/components
git clean -ndX apps/admin packages/components
```

Expected:

- `rg` finds no source, test, config, or package references to `@workspace/components`.
- `apps/admin` does not contain leftover ignored artifacts such as `.output`, `.turbo`, `node_modules`, `playwright-report`, `test-results`, or `.env`.
- `packages/components` does not contain leftover ignored artifacts or migration scratch files after the package is deleted.
- `git clean -ndX` reports nothing that still needs to be intentionally removed for these retired paths.

If the dry-run reports ignored artifacts under retired paths, remove them deliberately before final verification. Do not leave cleanup to local developer state or CI cache behavior.

## Risks

### Import Churn

The main risk is mechanical import churn across many route, component, and test files. Keep each slice small and verify before continuing.

### Accidental Package Boundary Collapse

Moving `@workspace/components` should not become permission to move auth, billing, policy, or UI primitives. The simplification target is app composition only.

### Barrel Re-Creation

If the migration recreates a large app-local barrel that mirrors `@workspace/components`, the repo keeps most of the indirection under a different name. Prefer direct domain imports unless a local barrel clearly improves readability.

### Test Mock Drift

Many tests mock `@workspace/components/hooks`, `@workspace/components/auth`, or `@workspace/components/layout`. These mocks must move to the new app-local import paths in the same slice as production imports.

## Definition Of Done

- `packages/components` no longer exists as a workspace package.
- `apps/web` no longer depends on `@workspace/components`.
- No source or test imports reference `@workspace/components`.
- `packages/auth`, `packages/policy`, `packages/billing`, `packages/ui`, `packages/db`, and `packages/db-schema` remain packages.
- All moved UI, hooks, and utilities are app-local under `apps/web/src`.
- No transitional migration files, ignored build outputs, old app artifacts, package cache folders, or scratch files remain under retired paths such as `apps/admin` or `packages/components`.
- Repository hygiene checks pass, including the ignored-file dry-run for retired paths.
- Final verification commands pass.
- No regression is found in the targeted auth, account, customer shell, admin shell, and E2E mock-email flows.
