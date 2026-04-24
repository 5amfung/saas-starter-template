# Single App Internal Layers Execution Plan

> **For agentic workers:** implement this plan phase-by-phase. Do not skip verification gates. Use `pnpm` only. Run commands from the repository root discovered by `git rev-parse --show-toplevel`.

**Goal:** flatten app-owned packages into `apps/web/src` while preserving strict internal boundaries with directory structure and `.dependency-cruiser.cjs`.

**Design:** `docs/superpowers/specs/2026-04-24-single-app-internal-layers-design.md`

**Keep as packages:** `packages/eslint-config`, `packages/ui`, `packages/test-utils`

**Flatten:** `packages/components`, `packages/logging`, `packages/email`, `packages/integrations`, `packages/policy`, `packages/billing`, `packages/db`, `packages/db-schema`, `packages/auth`

**Architecture:** use a modular-monolith layout under `apps/web/src`. Preserve package-era sublayers as app-internal folders. Add `.dependency-cruiser.cjs` rules before or during each deletion so package boundaries are replaced by path boundaries.

---

## Global Rules

- Use `pnpm`, never `npm`, `yarn`, `bun`, or `npx`.
- Anchor all commands at the repo root:

```bash
git rev-parse --show-toplevel
```

- Keep each phase behavior-preserving.
- Prefer mechanical import moves over rewrites.
- Do not manually edit generated route tree files.
- Do not delete a package until all imports, tests, package references, and equivalent boundary rules are handled.
- If a phase starts failing in a way that suggests the migration order is wrong, stop and re-plan instead of stacking workaround patches.

## Task 1: Baseline Inventory And Guardrails

**Files:**

- Read: `docs/superpowers/specs/2026-04-24-single-app-internal-layers-design.md`
- Read: `.dependency-cruiser.cjs`
- Read: `pnpm-workspace.yaml`
- Read: root `package.json`
- Read: `apps/web/package.json`
- Read: package manifests under `packages/*/package.json`

- [x] **Step 1: Confirm repo and branch state**

Run:

```bash
git rev-parse --show-toplevel
git status --short --branch
```

Expected: repo root is the active checkout. Record any existing user changes and do not overwrite them.

- [x] **Step 2: Capture package import baseline**

Run:

```bash
rg -n "@workspace/(components|logging|email|integrations|policy|billing|db|db-schema|auth)" apps packages --glob '!**/node_modules/**' --glob '!**/.turbo/**' --glob '!**/coverage/**'
```

Expected: output identifies all imports to eliminate or relocate. If `apps/api-server` imports a package targeted for flattening, stop before deleting that package and decide whether the API server should consume a kept shared package or whether that behavior also belongs in `apps/web`.

- [x] **Step 3: Capture package manifests and scripts**

Run:

```bash
find packages -maxdepth 2 -name package.json -print | sort
```

For each package being flattened, record:

- `exports`
- `scripts`
- runtime dependencies
- dev dependencies needed only by that package
- tests and fixtures

- [x] **Step 4: Run baseline validation**

Run:

```bash
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm --filter @workspace/web test
pnpm run check:boundaries
```

Expected: all pass before migration begins. If not, document the failing baseline before changing code.

- [x] **Step 5: Add initial app-layer boundary placeholders**

Update `.dependency-cruiser.cjs` with rules that can coexist with the current packages and future app-local paths. Start with rules that are immediately useful and do not fail the current code:

- block `apps/web/src/components/**` from importing `apps/web/src/db/**`
- block `apps/web/src/components/**` from importing `apps/web/src/**/core/infrastructure/**`
- block `apps/web/src/policy/core/**` from importing runtime layers
- block `apps/web/src/billing/core/domain/**` from importing runtime layers
- block `apps/web/src/auth/client/**` from importing server-only layers

Temporary absence of those folders is acceptable. These rules become active as layers are moved.

- [x] **Step 6: Verify guardrails**

Run:

```bash
pnpm run check:boundaries
```

Expected: boundary check passes.

## Task 2: Move `packages/components`

> Current baseline note: already complete in the starting branch. `packages/components` does not exist, active source/config imports of `@workspace/components` are gone, and the Task 1 baseline validation passed with components already app-local.

**Files:**

- Move: `packages/components/src/**`
- Create/modify: `apps/web/src/account/**`
- Create/modify: `apps/web/src/auth/**`
- Create/modify: `apps/web/src/components/{form,icons,layout}/**`
- Create/modify: `apps/web/src/hooks/**`
- Create/modify: `apps/web/src/lib/**`
- Modify: app/test imports

- [x] **Step 1: Follow existing components simplification plan**

Use `docs/superpowers/plans/2026-04-24-single-app-package-simplification.md` as the detailed sub-plan for this phase, unless it conflicts with the broader internal-layers design.

- [x] **Step 2: Replace package imports**

Replace:

```txt
@workspace/components/account -> @/account
@workspace/components/auth    -> @/auth
@workspace/components/form    -> @/components/form
@workspace/components/hooks   -> @/hooks
@workspace/components/icons   -> @/components/icons
@workspace/components/layout  -> @/components/layout
@workspace/components/lib     -> @/lib
```

- [x] **Step 3: Move tests**

Move package-specific component tests, if any remain in `packages/components`, into matching `apps/web/test/unit` or `apps/web/test/integration` locations.

- [x] **Step 4: Delete package shell**

Delete `packages/components` only after:

```bash
rg -n "@workspace/components" apps packages package.json pnpm-lock.yaml pnpm-workspace.yaml
```

prints no source/config references except intentional historical docs.

- [x] **Step 5: Verify**

Run:

```bash
pnpm --filter @workspace/web test
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm run check:boundaries
```

Expected: all pass.

## Task 3: Move `packages/logging`

> Deferred after dependency audit: `packages/auth` still imports `@workspace/logging/server`, so deleting `packages/logging` now would force a package-to-app dependency or break auth. Move a leaf package first, then return once package consumers are removed.

**Files:**

- Move: `packages/logging/src/**` -> `apps/web/src/observability/**`
- Move: `packages/logging/test/**` -> `apps/web/test/unit/observability/**`
- Modify: imports from `@workspace/logging`, `@workspace/logging/client`, `@workspace/logging/server`
- Modify: `apps/web/package.json`
- Modify: `.dependency-cruiser.cjs`

- [ ] **Step 1: Create observability layer**

Target mapping:

```txt
packages/logging/src/client.ts                -> apps/web/src/observability/client.ts
packages/logging/src/server.ts                -> apps/web/src/observability/server.ts
packages/logging/src/request-logger.server.ts -> apps/web/src/observability/request-logger.server.ts
packages/logging/src/operations.ts            -> apps/web/src/observability/operations.ts
packages/logging/src/observability.shared.ts  -> apps/web/src/observability/observability.shared.ts
```

- [ ] **Step 2: Replace imports**

Use:

```txt
@workspace/logging/client -> @/observability/client
@workspace/logging/server -> @/observability/server
@workspace/logging        -> @/observability/server
```

- [ ] **Step 3: Enforce client/server logging boundary**

Update `.dependency-cruiser.cjs` so browser-safe code can import `@/observability/client` but not `@/observability/server` or `request-logger.server.ts`.

- [ ] **Step 4: Move tests and delete package**

Move logging tests into `apps/web/test/unit/observability`.

Remove `packages/logging` after:

```bash
rg -n "@workspace/logging" apps packages package.json pnpm-lock.yaml
```

has no active references.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter @workspace/web test test/unit/observability
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm run check:boundaries
```

Expected: all pass.

## Task 4: Move `packages/email`

**Files:**

- Move: `packages/email/src/**` -> `apps/web/src/email/**`
- Move: `packages/email/test/**` -> `apps/web/test/unit/email/**`
- Modify: imports from `@workspace/email` and `@workspace/email/templates/*`
- Modify: package scripts for React Email preview if still needed
- Modify: `.dependency-cruiser.cjs`

- [ ] **Step 1: Create email layer**

Target mapping:

```txt
packages/email/src/index.ts                 -> apps/web/src/email/index.ts
packages/email/src/mock-email-client.ts     -> apps/web/src/email/mock-email-client.ts
packages/email/src/request-context.ts       -> apps/web/src/email/request-context.ts
packages/email/src/resend.server.ts         -> apps/web/src/email/resend.server.ts
packages/email/src/templates/*.tsx          -> apps/web/src/email/templates/*.tsx
```

- [ ] **Step 2: Replace imports**

Use:

```txt
@workspace/email                             -> @/email
@workspace/email/templates/<template-name>   -> @/email/templates/<template-name>
```

- [ ] **Step 3: Preserve email preview workflow**

If `dev:email` is still wanted, move the command from the package into `apps/web/package.json` or the root:

```bash
react-email dev --dir apps/web/src/email/templates --port 3001
```

Keep invocation through `pnpm` scripts.

- [ ] **Step 4: Enforce email server boundary**

Update `.dependency-cruiser.cjs` so client/UI code cannot import `resend.server.ts`.

- [ ] **Step 5: Move tests and delete package**

Move tests to `apps/web/test/unit/email`.

Remove `packages/email` after:

```bash
rg -n "@workspace/email" apps packages package.json pnpm-lock.yaml
```

has no active references.

- [ ] **Step 6: Verify**

Run:

```bash
pnpm --filter @workspace/web test test/unit/email
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm run check:boundaries
```

Expected: all pass.

## Task 5: Move `packages/integrations`

**Files:**

- Move: `packages/integrations/src/**` -> `apps/web/src/integrations/core/**`
- Move: `packages/integrations/test/**` -> `apps/web/test/unit/integrations/**`
- Modify: existing `apps/web/src/integrations/**`
- Modify: imports from `@workspace/integrations`
- Modify: `.dependency-cruiser.cjs`

- [x] **Step 1: Create integration core layer**

Target mapping:

```txt
packages/integrations/src/crypto.ts                 -> apps/web/src/integrations/core/crypto.ts
packages/integrations/src/definitions.ts            -> apps/web/src/integrations/core/definitions.ts
packages/integrations/src/repository.ts             -> apps/web/src/integrations/core/repository.ts
packages/integrations/src/types.ts                  -> apps/web/src/integrations/core/types.ts
packages/integrations/src/workspace-integrations.ts -> apps/web/src/integrations/core/workspace-integrations.ts
packages/integrations/src/index.ts                  -> apps/web/src/integrations/core/index.ts
```

- [x] **Step 2: Replace imports**

Use:

```txt
@workspace/integrations -> @/integrations/core
```

Server wrappers under `apps/web/src/integrations/*.server.ts` should import from core. UI should not import repository internals.

- [x] **Step 3: Enforce integration boundary**

Update `.dependency-cruiser.cjs` so UI cannot import `@/integrations/core/repository` and cannot import integration server modules directly.

- [x] **Step 4: Move tests and delete package**

Move tests to `apps/web/test/unit/integrations`.

Remove `packages/integrations` after:

```bash
rg -n "@workspace/integrations" apps packages package.json pnpm-lock.yaml
```

has no active references.

- [x] **Step 5: Verify**

Run:

```bash
pnpm --filter @workspace/web test test/unit/integrations
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm run check:boundaries
```

Expected: all pass.

## Task 6: Move `packages/policy`

**Files:**

- Move: `packages/policy/src/**` -> `apps/web/src/policy/core/**`
- Move: `packages/policy/test/**` -> `apps/web/test/unit/policy/**`
- Modify: existing app policy imports
- Modify: `.dependency-cruiser.cjs`

- [x] **Step 1: Move pure policy evaluators**

Target mapping:

```txt
packages/policy/src/admin-app.ts            -> apps/web/src/policy/core/admin-app.ts
packages/policy/src/auth-entry.ts           -> apps/web/src/policy/core/auth-entry.ts
packages/policy/src/workspace.ts            -> apps/web/src/policy/core/workspace.ts
packages/policy/src/workspace-lifecycle.ts  -> apps/web/src/policy/core/workspace-lifecycle.ts
packages/policy/src/index.ts                -> apps/web/src/policy/core/index.ts
```

- [x] **Step 2: Replace imports**

Use:

```txt
@workspace/policy -> @/policy/core
```

Existing app-local policy server/shared files should continue to load contextual facts and call pure evaluators.

- [x] **Step 3: Enforce pure policy boundary**

Update `.dependency-cruiser.cjs` so `apps/web/src/policy/core/**` cannot import:

- `apps/web/src/routes/**`
- `apps/web/src/components/**`
- `apps/web/src/db/**`
- `apps/web/src/auth/server/**`
- `apps/web/src/observability/**`
- `apps/web/src/email/**`

- [x] **Step 4: Move tests and delete package**

Move tests to `apps/web/test/unit/policy`.

Remove `packages/policy` after:

```bash
rg -n "@workspace/policy" apps packages package.json pnpm-lock.yaml
```

has no active references.

- [x] **Step 5: Verify**

Run:

```bash
pnpm --filter @workspace/web test test/unit/policy
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm run check:boundaries
```

Expected: all pass.

## Task 7: Move `packages/billing`

**Files:**

- Move: `packages/billing/src/**` -> `apps/web/src/billing/core/**`
- Move: `packages/billing/test/**` -> `apps/web/test/unit/billing/core/**`
- Modify: app billing imports
- Modify: auth imports that depend on billing
- Modify: `.dependency-cruiser.cjs`

- [ ] **Step 1: Move billing core**

Target mapping:

```txt
packages/billing/src/contracts/**      -> apps/web/src/billing/core/contracts/**
packages/billing/src/domain/**         -> apps/web/src/billing/core/domain/**
packages/billing/src/application/**    -> apps/web/src/billing/core/application/**
packages/billing/src/infrastructure/** -> apps/web/src/billing/core/infrastructure/**
packages/billing/src/index.ts          -> apps/web/src/billing/core/index.ts
```

- [ ] **Step 2: Replace imports**

Use:

```txt
@workspace/billing -> @/billing/core
```

App UI and server code should import public billing core exports, not infrastructure internals.

- [ ] **Step 3: Enforce billing boundaries**

Update `.dependency-cruiser.cjs` so:

- contracts/domain do not import runtime layers
- application does not import routes/components
- infrastructure may import DB but is not imported by UI/routes directly
- app components import `@/billing/core`, app server wrappers, or types only

- [ ] **Step 4: Move tests and delete package**

Move billing package tests to `apps/web/test/unit/billing/core`.

Remove `packages/billing` after:

```bash
rg -n "@workspace/billing" apps packages package.json pnpm-lock.yaml
```

has no active references.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter @workspace/web test test/unit/billing
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm run check:boundaries
```

Expected: all pass.

## Task 8: Move `packages/db` And `packages/db-schema`

**Files:**

- Move: `packages/db/src/**` -> `apps/web/src/db/client/**`
- Move: `packages/db-schema/src/**` -> `apps/web/src/db/schema/**` and `apps/web/src/db/seed/**`
- Move/update: `packages/db-schema/drizzle.config.ts`
- Move: db-schema tests -> `apps/web/test/unit/db/**`
- Modify: imports from `@workspace/db` and `@workspace/db-schema`
- Modify: DB scripts
- Modify: `.dependency-cruiser.cjs`

- [ ] **Step 1: Create DB layer**

Target mapping:

```txt
packages/db/src/index.ts                         -> apps/web/src/db/client/index.ts
packages/db-schema/src/app.schema.ts             -> apps/web/src/db/schema/app.schema.ts
packages/db-schema/src/auth.schema.ts            -> apps/web/src/db/schema/auth.schema.ts
packages/db-schema/src/schema.ts                 -> apps/web/src/db/schema/schema.ts
packages/db-schema/src/index.ts                  -> apps/web/src/db/schema/index.ts
packages/db-schema/src/seed/e2e-fixtures.ts      -> apps/web/src/db/seed/e2e-fixtures.ts
packages/db-schema/src/seed/reset-e2e-state.ts   -> apps/web/src/db/seed/reset-e2e-state.ts
packages/db-schema/src/seed/seed-e2e-baseline.ts -> apps/web/src/db/seed/seed-e2e-baseline.ts
```

- [ ] **Step 2: Decide Drizzle config location**

Preferred target:

```txt
apps/web/drizzle.config.ts
```

Update scripts so schema operations run through `@workspace/web`, for example:

```txt
pnpm --filter @workspace/web db:generate
pnpm --filter @workspace/web db:migrate
pnpm --filter @workspace/web db:push
pnpm --filter @workspace/web db:studio
```

If Vercel build commands currently call `@workspace/db-schema`, update them to the new `@workspace/web` scripts in the same phase.

- [ ] **Step 3: Replace imports**

Use:

```txt
@workspace/db                     -> @/db/client
@workspace/db-schema              -> @/db/schema
@workspace/db-schema/schema       -> @/db/schema/schema
@workspace/db-schema/seed/e2e-fixtures -> @/db/seed/e2e-fixtures
```

- [ ] **Step 4: Enforce database boundaries**

Update `.dependency-cruiser.cjs` so:

- client/components/hooks cannot import `@/db/**`
- `@/db/**` cannot import routes/components/hooks
- direct schema table imports are limited to server modules, infrastructure adapters, seed code, and approved tests

- [ ] **Step 5: Update test utilities intentionally**

Review `packages/test-utils` imports from `@workspace/db` and `@workspace/db-schema`.

Choose one:

- keep test DB helpers in `packages/test-utils` but import app DB test entrypoints explicitly, or
- move DB-coupled helpers to `apps/web/test/support/db/**` and keep `packages/test-utils` framework-agnostic.

Prefer the second option if keeping `packages/test-utils` would create a production app dependency cycle.

- [ ] **Step 6: Move tests and delete packages**

Move db/db-schema tests to `apps/web/test/unit/db`.

Remove `packages/db` and `packages/db-schema` after:

```bash
rg -n "@workspace/(db|db-schema)" apps packages package.json pnpm-lock.yaml pnpm-workspace.yaml
```

has no active references, except any intentionally retained test-utils bridge documented in the same commit.

- [ ] **Step 7: Verify**

Run:

```bash
pnpm --filter @workspace/web test test/unit/db
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm run check:boundaries
pnpm --filter @workspace/web db:generate
```

Expected: tests pass, boundary check passes, and Drizzle can read the new schema location.

## Task 9: Move `packages/auth`

**Files:**

- Move: `packages/auth/src/**` -> `apps/web/src/auth/**`
- Move: `packages/auth/test/**` -> `apps/web/test/unit/auth/core/**` or matching auth test folders
- Modify: imports from `@workspace/auth`, `@workspace/auth/client`, `@workspace/auth/server`, `@workspace/auth/validators`, `@workspace/auth/schemas`, `@workspace/auth/plans`, `@workspace/auth/billing`
- Modify: `.dependency-cruiser.cjs`

- [ ] **Step 1: Create auth internal layers**

Target mapping:

```txt
packages/auth/src/auth-client.ts         -> apps/web/src/auth/client/auth-client.ts
packages/auth/src/auth.server.ts         -> apps/web/src/auth/server/auth.server.ts
packages/auth/src/auth-emails.server.ts  -> apps/web/src/auth/server/auth-emails.server.ts
packages/auth/src/billing.server.ts      -> apps/web/src/auth/server/billing.server.ts
packages/auth/src/validators.ts          -> apps/web/src/auth/server/validators.ts
packages/auth/src/schemas.ts             -> apps/web/src/auth/schemas/schemas.ts
packages/auth/src/auth-utils.ts          -> apps/web/src/auth/core/auth-utils.ts
packages/auth/src/permissions.ts         -> apps/web/src/auth/core/permissions.ts
packages/auth/src/plans.ts               -> apps/web/src/auth/core/plans.ts
packages/auth/src/plan-actions.ts        -> apps/web/src/auth/core/plan-actions.ts
packages/auth/src/entitlements.ts        -> apps/web/src/auth/core/entitlements.ts
packages/auth/src/slug.ts                -> apps/web/src/auth/core/slug.ts
packages/auth/src/index.ts               -> apps/web/src/auth/index.ts
```

Review `auth.cli.ts` separately. If still useful, move it to a server/script-only app path and wire it through a `pnpm --filter @workspace/web` script.

- [ ] **Step 2: Replace imports**

Use:

```txt
@workspace/auth            -> @/auth
@workspace/auth/client     -> @/auth/client/auth-client
@workspace/auth/server     -> @/auth/server/auth.server
@workspace/auth/validators -> @/auth/server/validators
@workspace/auth/schemas    -> @/auth/schemas/schemas
@workspace/auth/plans      -> @/auth/core/plans
@workspace/auth/billing    -> @/auth/server/billing.server
```

- [ ] **Step 3: Preserve client-safe barrel behavior**

Keep `apps/web/src/auth/index.ts` client-safe. It must not export server-only modules or import DB/email/logging server code.

- [ ] **Step 4: Enforce auth boundaries**

Update `.dependency-cruiser.cjs` so:

- `src/auth/client/**` cannot import `src/auth/server/**`, `src/db/**`, `src/email/**`, server logging, or Node-only modules
- `src/auth/index.ts` stays client-safe
- `src/auth/server/**` can import DB, email, billing core, and server observability

- [ ] **Step 5: Move tests and delete package**

Move auth tests to app test folders.

Remove `packages/auth` after:

```bash
rg -n "@workspace/auth" apps packages package.json pnpm-lock.yaml
```

has no active references.

- [ ] **Step 6: Verify**

Run:

```bash
pnpm --filter @workspace/web test test/unit/auth
pnpm --filter @workspace/web test test/unit/init
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm run check:boundaries
```

Expected: all pass.

## Task 10: Workspace Cleanup

**Files:**

- Modify: `pnpm-workspace.yaml`
- Modify: root `package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`
- Modify: root `tsconfig.json` if package path aliases exist
- Modify: `turbo.json` if package tasks become stale
- Modify: `pnpm-lock.yaml`
- Modify: `.dependency-cruiser.cjs`
- Delete: obsolete package directories

- [ ] **Step 1: Remove deleted packages from workspace metadata**

Update workspace/package metadata so only kept packages remain active:

```txt
packages/eslint-config
packages/ui
packages/test-utils
```

If `pnpm-workspace.yaml` continues to use `packages/*`, ensure deleted directories are actually gone so they are not included.

- [ ] **Step 2: Move dependencies to `apps/web/package.json`**

Any runtime dependency that was only present in flattened package manifests but is still used by app-local code must be declared by `apps/web`.

Examples to check:

- Better Auth packages
- Drizzle/Neon packages
- Resend/React Email packages
- Stripe
- Sentry/TanStack Start observability packages
- random-word-slugs
- zod

- [ ] **Step 3: Remove stale aliases and mocks**

Run:

```bash
rg -n "@workspace/(components|logging|email|integrations|policy|billing|db|db-schema|auth)" apps packages package.json pnpm-lock.yaml tsconfig.json turbo.json .dependency-cruiser.cjs
```

Expected: no active source, test, config, or lockfile references to flattened packages.

- [ ] **Step 4: Clean ignored artifacts**

Run:

```bash
git status --short --ignored packages
git clean -ndX packages
```

Review output carefully. Remove only obsolete ignored artifacts for deleted packages.

- [ ] **Step 5: Refresh lockfile**

Run:

```bash
pnpm install --lockfile-only
```

Expected: `pnpm-lock.yaml` reflects removed workspace packages and moved app dependencies.

## Task 11: Final Verification

- [ ] **Step 1: Run full static validation**

Run:

```bash
pnpm run lint
pnpm run typecheck
pnpm run check:boundaries
```

Expected: all pass.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 3: Run E2E**

Run:

```bash
pnpm --filter @workspace/web test:e2e
```

Expected: all pass. If sandbox restrictions block browser execution, request approval to run outside the sandbox instead of skipping.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm run build
```

Expected: build passes, including DB migration/build command changes.

- [ ] **Step 5: Final hygiene checks**

Run:

```bash
rg -n "@workspace/(components|logging|email|integrations|policy|billing|db|db-schema|auth)" apps packages package.json pnpm-lock.yaml tsconfig.json turbo.json .dependency-cruiser.cjs
find packages -maxdepth 2 -name package.json -print | sort
pnpm list --depth -1
```

Expected:

- no active references to flattened package names
- only kept packages remain under `packages/`
- app-local dependency declarations are complete

## Definition Of Done

- `apps/web/src` contains the internal layers described in the design doc.
- Only `packages/eslint-config`, `packages/ui`, and `packages/test-utils` remain as packages.
- `.dependency-cruiser.cjs` enforces app-layer, client/server, database, billing, policy, auth, email, logging, and integration boundaries.
- All flattened package imports are gone from active source/test/config.
- The lockfile and package manifests are consistent.
- Targeted and full verification passed, or any gap is recorded with exact command output and blocker.
