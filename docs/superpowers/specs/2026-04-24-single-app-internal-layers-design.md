# Single App Internal Layers Design

**Date:** 2026-04-24
**Status:** Draft

## Goal

Restructure the repository around a single modular TanStack Start app after the admin runtime has been merged into `apps/web`.

The desired end state is a smaller monorepo where most product, domain, runtime, database, email, logging, integration, auth, billing, and policy code lives under `apps/web/src` as clean internal app layers. The repo should keep only packages that still provide clear shared tooling or reusable UI value outside the app.

This supersedes the narrower `2026-04-24-single-app-package-simplification-design.md` direction. That earlier design kept `packages/auth`, `packages/billing`, `packages/policy`, `packages/db`, `packages/db-schema`, `packages/email`, and `packages/logging`. The updated decision is that the merged web/admin app can preserve those same boundaries through directory layout and `.dependency-cruiser.cjs` path rules instead of workspace package boundaries.

## Non-Goals

- Do not change visible UI behavior.
- Do not change auth/session semantics.
- Do not change Better Auth plugin behavior.
- Do not change billing rules, entitlement behavior, plan definitions, or Stripe behavior.
- Do not change database table shape, migrations, seed semantics, or Drizzle-generated artifacts except for path/import relocation.
- Do not change policy decisions or capability semantics.
- Do not remove tests because imports became local.
- Do not manually edit generated route tree files.
- Do not combine this migration with unrelated redesign, feature work, or dependency upgrades.
- Do not change `apps/api-server` behavior as part of this migration. If `apps/api-server` depends on a package targeted for flattening, stop and either move the needed code into an explicitly kept shared package or document why the API server should also migrate to the app-local module.

## Keep As Packages

Keep these packages because their package boundary still communicates real external reuse or repo tooling value:

```txt
packages/eslint-config
  Shared lint configuration consumed by the repo.

packages/ui
  Low-level reusable UI primitives and design-system assets.

packages/test-utils
  Cross-test helpers that may be consumed by app tests, E2E setup, and future test-only tooling.
```

`packages/test-utils` may continue to depend on the app's database/schema test entrypoints during migration, but the final shape should make that dependency explicit and test-only. If it becomes awkward, split test-only database helpers under `apps/web/test/support` and keep `packages/test-utils` limited to framework-agnostic test helpers.

## Flatten Into `apps/web/src`

Move these packages into app-local layers:

```txt
packages/components   -> apps/web/src/{account,auth,components,hooks,lib}
packages/logging      -> apps/web/src/observability
packages/email        -> apps/web/src/email
packages/integrations -> apps/web/src/integrations/core + server helpers
packages/policy       -> apps/web/src/policy/core
packages/billing      -> apps/web/src/billing/core
packages/auth         -> apps/web/src/auth/core + client/server/schemas
packages/db           -> apps/web/src/db/client
packages/db-schema    -> apps/web/src/db/schema + seed
```

The migration is a move, not a rewrite. Assertions, behavior, naming, exports, and tests should remain as close as possible to the existing code until the package shells are gone.

## Target Source Layout

```txt
apps/web/src/
  account/
    *.tsx
    *.server.ts
    *.functions.ts

  admin/
    *.tsx
    *.server.ts
    *.functions.ts

  auth/
    client/
      auth-client.ts
    core/
      auth-utils.ts
      permissions.ts
      plans.ts
      plan-actions.ts
      entitlements.ts
      slug.ts
    schemas/
      schemas.ts
    server/
      auth.server.ts
      auth-emails.server.ts
      billing.server.ts
      validators.ts
    index.ts

  billing/
    core/
      contracts/
      domain/
      application/
      infrastructure/
      index.ts
    billing.functions.ts
    billing.server.ts

  components/
    admin/
    billing/
    form/
    icons/
    layout/
    workspace/

  db/
    client/
      index.ts
    schema/
      app.schema.ts
      auth.schema.ts
      schema.ts
      index.ts
    seed/
      e2e-fixtures.ts
      reset-e2e-state.ts
      seed-e2e-baseline.ts

  email/
    templates/
    mock-email-client.ts
    request-context.ts
    resend.server.ts
    index.ts

  integrations/
    core/
      crypto.ts
      definitions.ts
      repository.ts
      types.ts
      workspace-integrations.ts
      index.ts
    integration-crypto.server.ts
    integration-definitions.ts
    integration-secrets.server.ts
    integration-secrets.types.ts

  observability/
    client.ts
    server.ts
    request-logger.server.ts
    operations.ts
    observability.shared.ts

  policy/
    core/
      admin-app.ts
      auth-entry.ts
      workspace.ts
      workspace-lifecycle.ts
      index.ts
    *.server.ts
    *.shared.ts

  routes/
  router.tsx
  init.ts
```

The exact filenames can stay close to the current files. The important part is that the folder names communicate runtime ownership:

- `core/` is pure or domain-oriented code.
- `server/` and `*.server.ts` are server-only.
- `client/` is browser-safe.
- `infrastructure/` may talk to persistence or external services.
- route components and UI never reach into persistence or server-only modules directly.

## Import Rules

Use the app alias for internal imports:

```ts
import { authClient } from '@/auth/client/auth-client';
import { createAuth } from '@/auth/server/auth.server';
import { PLANS } from '@/billing/core';
import { createDb } from '@/db/client';
import * as schema from '@/db/schema';
import { requestLogger } from '@/observability/server';
```

Avoid recreating broad package-style barrels at the app root. Local barrels are allowed when they encode a real layer boundary, such as `@/billing/core`, `@/policy/core`, `@/db/schema`, or `@/email`.

Do not use relative imports to climb across major layers, such as `../../db/schema` from UI code. Cross-layer imports should use `@/` aliases so `.dependency-cruiser.cjs` can enforce them clearly.

## Boundary Model

Package boundaries will be replaced by path boundaries in `.dependency-cruiser.cjs`.

### App And UI Boundaries

- `apps/web/src/routes/**` may import UI, hooks, server functions, route-safe shared helpers, and client-safe auth/logging modules.
- `apps/web/src/components/**` may import UI primitives, hooks, client-safe auth, client-safe logging, and pure formatting helpers.
- `apps/web/src/components/**` must not import `*.server.ts`, `src/db/**`, `src/*/core/infrastructure/**`, or route modules.
- `apps/web/src/hooks/**` must not import server-only modules.

### Auth Boundaries

- `src/auth/client/**` must not import `src/auth/server/**`, `src/db/**`, Node-only modules, Stripe server SDKs, or email providers.
- `src/auth/server/**` may import `src/db/**`, `src/email/**`, `src/billing/core/**`, and server logging.
- `src/auth/core/**` should stay mostly pure. If a file needs DB, email, request, or framework runtime behavior, it belongs in `src/auth/server/**`.
- The app-level `src/auth/index.ts` must remain client-safe if it is imported by UI.

### Billing Boundaries

- `src/billing/core/contracts/**` and `src/billing/core/domain/**` must not import React, routes, server functions, DB schema, DB clients, auth server modules, logging, or email.
- `src/billing/core/application/**` may depend on contracts/domain and injected database types, but should not import route/component code.
- `src/billing/core/infrastructure/**` may import `src/db/**` and Drizzle schema.
- UI and route code should consume `src/billing/core/index.ts`, app-local server functions, or app-local server modules, not infrastructure internals.

### Policy Boundaries

- `src/policy/core/**` must stay pure and framework-independent.
- `src/policy/*.server.ts` may load contextual facts from DB/auth and call `src/policy/core/**`.
- UI should consume already-evaluated capabilities from loaders, server functions, or shared route-safe modules. UI should not make role decisions directly.

### Database Boundaries

- `src/db/schema/**` owns schema definitions, table exports, seed fixtures, and Drizzle schema exports.
- `src/db/client/**` owns connection and Drizzle client construction.
- App code should not import schema tables broadly. Keep direct schema imports limited to server modules, infrastructure adapters, seed code, and narrowly approved files.
- Client components and hooks must not import `src/db/**`.

### Email, Logging, And Integrations Boundaries

- `src/email/templates/**` are renderable React Email templates and may be imported by server email code and tests.
- `src/email/resend.server.ts` is server-only.
- `src/observability/client.ts` is browser-safe; `src/observability/server.ts` and request logging are server-only.
- `src/integrations/core/**` owns integration domain, encryption helpers, repository access, and types. UI should use app-level server functions or route-safe types, not repository internals.

## Dependency Cruiser Direction

The existing `.dependency-cruiser.cjs` already enforces path contracts such as "apps must not import billing infrastructure" and "no new app db-schema imports." The final design should expand that file so it becomes the main architecture contract for the modular app.

Add or update rules in phases:

```txt
no-client-imports-server
  from: routes/components/hooks/client-safe auth/logging paths
  to: *.server.ts, src/db/**, server-only observability/email modules

no-components-import-db
  from: src/components/** and src/routes/** route components
  to: src/db/**

no-components-import-infrastructure
  from: src/components/**
  to: src/**/core/infrastructure/**

no-billing-core-imports-runtime
  from: src/billing/core/{contracts,domain,application}/**
  to: routes, components, auth/server, db/schema where not allowed, observability, email

no-policy-core-imports-runtime
  from: src/policy/core/**
  to: routes, components, db, auth/server, observability, email

no-auth-client-imports-server
  from: src/auth/client/** and client-safe auth barrels
  to: src/auth/server/**, src/db/**, src/email/**, src/observability/server.ts

no-db-imports-app
  from: src/db/**
  to: routes, components, hooks, billing UI, admin UI, workspace UI

no-cross-layer-relative-climbs
  discourage relative imports that climb from one major layer into another
```

During migration, use temporary allow-lists for files that have not moved yet. The end state should have no references to removed `packages/*` code except kept packages.

## Package Removal Criteria

A package can be deleted only when all criteria are true:

- Its source files have moved under `apps/web/src`.
- Its tests have moved under `apps/web/test/unit` or `apps/web/test/integration`.
- All `@workspace/<package>` imports have been replaced with `@/` imports or kept-package imports.
- Its `package.json`, `tsconfig.json`, `eslint.config.ts`, `vitest.config.ts`, and ignored build artifacts are no longer needed.
- It is removed from dependent `package.json` files and `pnpm-lock.yaml`.
- `.dependency-cruiser.cjs` has equivalent or stronger path rules for the boundary that package used to provide.
- Targeted tests, typecheck, lint, boundary checks, and final build pass.

## Migration Principles

1. Move low-dependency packages first.
2. Preserve behavior before improving structure.
3. Keep each phase reviewable and independently verifiable.
4. Add boundary rules as soon as a layer exists in its new location.
5. Prefer copy-first moves only when needed to keep tests passing during a phase; delete old package files once imports are migrated.
6. Keep tests near the app behavior they verify, but preserve package-era test grouping under `apps/web/test/unit/<layer>`.
7. Do not weaken test coverage to make the move easy.

## Proposed Migration Order

1. `packages/components`
2. `packages/logging`
3. `packages/email`
4. `packages/integrations`
5. `packages/policy`
6. `packages/billing`
7. `packages/db` and `packages/db-schema`
8. `packages/auth`
9. workspace cleanup and final boundary hardening

This order starts with code that already behaves like app composition or app support. It leaves database and auth for last because those layers are the most likely to leak server/client or schema/runtime concerns if moved too early.

## Verification Strategy

Each phase should run the smallest meaningful validation first:

```bash
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm --filter @workspace/web test
pnpm run check:boundaries
```

When a package is still present, also run its package test before deletion:

```bash
pnpm --filter @workspace/<package> test
```

Final validation:

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run check:boundaries
pnpm --filter @workspace/web test:e2e
pnpm run build
```

Targeted no-regression checks:

- Auth pages and flows: signin, signup, verify, forgot password, reset password, email change, invite acceptance.
- Account settings: profile, password, email, linked accounts, active sessions, notification preferences.
- Workspace flows: creation, switching, membership, invitations, deletion, lifecycle policy.
- Billing flows: plan display, checkout handoff, downgrade confirmation, customer portal, admin entitlement override.
- Admin flows under `/admin`: dashboard, users, user detail, workspaces, workspace detail, dangerous actions.
- Integrations: definition loading, encryption/decryption, secret persistence.
- E2E seeding and test email routes.

## Risks And Mitigations

### Client/server leakage

Flattening removes package exports as a natural guardrail. Mitigate with strict `.dependency-cruiser.cjs` rules and client-safe barrels.

### Import churn hiding behavior changes

Keep phase diffs mechanical. Avoid opportunistic rewrites. Run targeted tests after each phase.

### Database ownership becoming muddy

Move DB late. Keep `src/db/schema` and `src/db/client` separate. Restrict schema imports with dependency rules.

### Auth becoming too broad

Move auth last. Preserve `client`, `server`, `schemas`, and `core` sublayers. Keep the public client-safe index explicit.

### Test utility coupling

Keep `packages/test-utils` initially. If it depends too heavily on app-local DB internals after migration, move those specific helpers to `apps/web/test/support` instead of making `packages/test-utils` an app backdoor.

## Done Means

- Only `packages/eslint-config`, `packages/ui`, and `packages/test-utils` remain from the simplification target set.
- `pnpm-workspace.yaml` no longer includes deleted package directories as active packages.
- `apps/web/package.json` owns dependencies previously held only by flattened packages.
- `@workspace/auth`, `@workspace/billing`, `@workspace/db`, `@workspace/db-schema`, `@workspace/email`, `@workspace/integrations`, `@workspace/logging`, `@workspace/policy`, and `@workspace/components` imports are gone from app source and tests.
- `.dependency-cruiser.cjs` enforces the internal app layer boundaries.
- Full validation passes or any gap is documented with the exact blocker.
