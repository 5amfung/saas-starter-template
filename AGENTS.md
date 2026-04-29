# AGENTS.md

Operational guide for AI coding agents working in this repository.

## 1. Instruction Priority

Resolve conflicts in this order:

1. Direct user request in the current conversation.
2. This repository `AGENTS.md`.
3. Explicitly invoked skills and tool-specific instructions.
4. Default agent behavior.

If the task becomes unclear or the current approach stops making technical
sense, stop and re-plan before continuing.

## 2. Operating Loop

### Start

- Anchor at the repository root with `git rev-parse --show-toplevel`.
- Inspect `git status --short --branch` before editing.
- Identify the owning app, package, and layer before changing files.
- Prefer `rg` and `rg --files` for search.
- Use `pnpm` only. Do not use `npm`, `yarn`, `bun`, or `npx`.

### Plan

- Use a plan-first workflow for non-trivial work.
- Treat work as non-trivial when it has 3 or more meaningful steps, crosses app
  or package boundaries, changes behavior across layers, or has unclear
  tradeoffs.
- If something goes sideways, stop, restate the problem, and re-plan instead of
  stacking ad hoc fixes.

### Implement

- Fix root causes, not symptoms.
- Keep changes tight and avoid unrelated refactors.
- Follow existing file names, imports, package boundaries, and route patterns.
- Prefer framework-native and repo-native helpers over new abstractions.
- Never revert user changes you did not make unless explicitly asked.

### Verify

- Run the smallest meaningful verification first, then widen scope when the
  change touches shared behavior.
- Compare expected behavior with actual behavior; do not rely only on command
  exit status.
- Run `pnpm run check:boundaries` when imports, layers, policy, billing, DB,
  integration, or server/client boundaries change.
- Run Playwright outside the Codex sandbox when browser-based E2E verification
  is required. If sandbox limits block the run, request escalation instead of
  downgrading the check.
- If verification cannot run, state exactly what was not verified and why.

### Finish

- Summarize what changed and why.
- State the exact verification performed.
- Call out residual risks or follow-up work.
- Use Conventional Commits when asked to commit.

## 3. Current Repository Shape

This is a pnpm + Turborepo workspace.

### Apps

- `apps/web`: main TanStack Start SaaS app. It owns customer routes, workspace
  routes, admin routes, auth endpoints, billing flows, database schema, email
  templates, policy wrappers, observability, and most product-domain logic.
- `apps/api-server`: optional standalone Hono API/server app.

There is no separate `apps/admin` app in this checkout. Admin UX and admin
server functions live inside `apps/web`.

### Packages

- `packages/ui`: low-level shared UI primitives, hooks, and global styles.
- `packages/test-utils`: shared Vitest, Testing Library, database, auth, and E2E
  test helpers.
- `packages/eslint-config`: shared ESLint configuration and custom rules.

There are no separate `packages/auth`, `packages/billing`, `packages/db`,
`packages/db-schema`, `packages/email`, `packages/policy`, or
`packages/components` packages in this checkout. Those concerns are currently
app-owned under `apps/web/src/`.

### Key Facts

- Package manager: `pnpm@10.33.1`
- Node: `>=20`
- App framework: TanStack Start + TanStack Router + React 19
- API server: Hono in `apps/api-server`
- Database: Neon Postgres + Drizzle ORM
- Auth: Better Auth
- Billing: Stripe
- Email: Resend + React Email
- Styling: Tailwind CSS v4 + shadcn/ui + Base UI
- Testing: Vitest, Testing Library, Playwright

## 4. Where Changes Belong

### `apps/web`

Use `apps/web` for almost all product behavior.

Important directories:

- `src/routes/`: TanStack Router file routes.
- `src/account/`: account settings schemas, UI helpers, and server functions.
- `src/admin/`: admin queries, schemas, server functions, and privileged logic.
- `src/api/`: app-owned API service helpers and middleware.
- `src/auth/`: Better Auth client/server setup, validators, email hooks, billing
  glue, permissions, and auth plans.
- `src/billing/`: billing UI, server functions, and billing core contracts,
  domain, application, and infrastructure logic.
- `src/components/`: app-specific product components.
- `src/db/`: Drizzle client, schema source, seed helpers, and local DB scripts.
- `src/email/`: Resend adapter, mock email client, request context, and React
  Email templates.
- `src/integrations/`: workspace integration definitions, encrypted secrets,
  server functions, and repository logic.
- `src/observability/`: Sentry and request logging helpers.
- `src/policy/`: capability evaluators, app-facing policy functions, and
  server-only policy fact loaders.
- `src/workspace/`: workspace queries, mutations, selectors, server functions,
  and membership flows.
- `test/`: web unit, integration, and Playwright E2E tests.

### `apps/api-server`

Use `apps/api-server` for standalone Hono service concerns that should not be
TanStack Start route handlers:

- `src/app.ts`: Hono app composition.
- `src/index.ts`: server entrypoint.
- `src/routes/`: Hono routes.
- `src/middleware/`: Hono middleware.
- `src/lib/`: API-server utilities.

### `packages/ui`

Use `packages/ui` for generic UI primitives, design-system components, shared
hooks, and global styles. Product-specific components should usually stay in
`apps/web/src/components/`.

### `packages/test-utils`

Use `packages/test-utils` for reusable test factories, auth helpers, E2E DB
helpers, seeded users, isolated workspaces, and shared render helpers.

### `packages/eslint-config`

Use `packages/eslint-config` for shared lint presets and custom lint rules.

## 5. Routing, Server Functions, and Boundaries

### File-Based Routing

`apps/web/src/routes/` uses TanStack Router file routing.

- Layout routes use `_` prefixes.
- Public auth routes live under `_auth/`.
- Customer protected routes live under `_protected/`.
- Admin routes live under `admin/`.
- API routes live under `routes/api/`.

Never edit `apps/web/src/routeTree.gen.ts` manually.

### Server Function Conventions

Current code uses these conventions:

- `*.functions.ts`: app-facing server function wrappers.
- `*.server.ts`: server-only internals, privileged helpers, DB logic, secrets,
  and request-sensitive behavior.
- Plain `*.ts` / `*.tsx`: client-safe or shared code unless the surrounding
  module clearly marks it server-only.

Do not import `*.server.ts` modules into route components, client components, or
other client-safe modules. Prefer calling server behavior through
`*.functions.ts`.

### Authorization and Policy

- UI does not authorize actions. It renders capabilities derived from
  server-evaluated policy.
- Routes and middleware guard page-level access.
- Server functions guard action-level access.
- Roles are inputs to policy evaluation, not business decisions by themselves.
- Shared pure policy logic lives under `apps/web/src/policy/core/`.
- App-facing policy wrappers and server fact loading live under
  `apps/web/src/policy/`.

### Database

- Schema source lives in `apps/web/src/db/schema/`.
- Migration output lives in `apps/web/drizzle/`.
- Runtime DB access lives under `apps/web/src/db/client/` and server-only app
  modules.
- UI and client-safe code must use server functions or app-safe query APIs, not
  DB clients or schema modules.

`apps/web/src/db/schema/auth.schema.ts` is repo-owned. Do not blindly overwrite
it with generated Better Auth output; use generated output as a temporary
reference during upgrades and manually port intended changes.

### Billing

Billing is app-owned but internally layered:

- `apps/web/src/billing/core/contracts/`
- `apps/web/src/billing/core/domain/`
- `apps/web/src/billing/core/application/`
- `apps/web/src/billing/core/infrastructure/`

Routes, components, hooks, admin modules, and workspace modules must not import
billing infrastructure internals directly. Use public billing core exports or
app server wrappers.

### Integrations

Integration UI should use integration server functions and route-safe types. Do
not import repository internals or `*.server.ts` integration modules directly
from components, routes, or hooks.

### Observability and Email

- Browser-safe code can use client observability helpers.
- Server workflow logging belongs in server observability modules.
- UI and client-safe code must not import the Resend server adapter.
- Keep secrets, tokens, DB access, and request-sensitive operations on the
  server.

## 6. Dependency-Cruiser Rules

`.dependency-cruiser.cjs` currently enforces the most important architecture
boundaries under `apps/web/src/`.

Important active rules include:

- UI/route code cannot import billing infrastructure.
- Billing contracts, domain, and application layers cannot import DB schema.
- Billing core cannot depend on app route, component, admin, workspace, auth,
  policy, email, or observability layers.
- UI and client-safe code cannot import `src/db/`.
- DB code cannot import route, component, or hook code.
- Components cannot import server-only policy modules.
- Pure policy core cannot import app runtime, persistence, UI, auth-server,
  observability, or email layers.
- Integration UI cannot import integration repository or server-only modules.
- The auth barrel must remain client-safe.
- UI and client-safe code cannot import server observability or Resend server
  modules.

If you need new behavior across one of these boundaries, expose a small public
server function, route-safe type, or application-layer API instead of reaching
through the boundary.

## 7. Commands

Run from the repository root unless using a package filter.

### Root Commands

- `pnpm dev`
- `pnpm dev:api`
- `pnpm run build`
- `pnpm run lint`
- `pnpm run lint:fix`
- `pnpm run format`
- `pnpm run typecheck`
- `pnpm run check`
- `pnpm run check:boundaries`
- `pnpm test`
- `pnpm run test:unit`
- `pnpm run test:integration`
- `pnpm run coverage`
- `pnpm test:e2e`

### Web Commands

- `pnpm --filter @workspace/web dev`
- `pnpm --filter @workspace/web dev:email`
- `pnpm --filter @workspace/web dev:stripe-webhook`
- `pnpm --filter @workspace/web build`
- `pnpm --filter @workspace/web start`
- `pnpm --filter @workspace/web test`
- `pnpm --filter @workspace/web test:unit`
- `pnpm --filter @workspace/web test:integration`
- `pnpm --filter @workspace/web test:e2e`
- `pnpm --filter @workspace/web test:e2e:ui`
- `pnpm --filter @workspace/web test:e2e:report`

### Database Commands

- `pnpm run db:generate`
- `pnpm run db:migrate`
- `pnpm run db:push`
- `pnpm run db:studio`

These delegate to `@workspace/web`.

### API Server Commands

- `pnpm --filter @workspace/api-server dev`
- `pnpm --filter @workspace/api-server build`
- `pnpm --filter @workspace/api-server start`
- `pnpm --filter @workspace/api-server test`

## 8. Verification Strategy

- Documentation-only changes: inspect rendered Markdown-sensitive structure and
  run a focused stale-reference search.
- Import or layering changes: run `pnpm run check:boundaries`.
- Shared types or package exports: run affected package typechecks and consider
  root `pnpm run typecheck`.
- Route behavior: run targeted route/component tests, then the relevant E2E
  slice when user-facing behavior changes.
- DB schema changes: run the relevant Drizzle command and verify consuming code.
- Auth changes: verify server auth behavior and relevant UI flows.
- Billing changes: verify unit/integration coverage around plans, entitlements,
  checkout, portal, and webhook behavior.

Do not declare work complete without evidence.

## 9. Testing Layout

Current test locations include:

- `apps/web/test/unit/`
- `apps/web/test/integration/`
- `apps/web/test/e2e/`
- `apps/api-server/test/`
- `packages/eslint-config/test/`
- `packages/test-utils/test/`
- `packages/ui/test/`

Prefer the smallest matching test scope before broad repo-wide runs.

## 10. Repository Conventions

- Use path aliases and workspace imports consistently.
- Keep import ordering aligned with existing file style.
- Prefer meaningful names and extracted constants over magic values.
- Avoid `any`; narrow `unknown` properly.
- Add comments only for non-obvious intent or tradeoffs.
- Keep generated files generated; do not hand-edit route trees or generated
  artifacts that should be produced by a repo command.
- Put generic UI primitives in `packages/ui`; keep product-specific UI in
  `apps/web/src/components/` unless there is clear reuse.
- Keep server-only modules server-only.
- Keep deployment and migration guidance anchored to current scripts and
  platform configuration.

## 11. Do Not

- Do not use `npm`, `yarn`, `bun`, or `npx`.
- Do not manually edit `apps/web/src/routeTree.gen.ts`.
- Do not assume there is a separate admin app.
- Do not assume auth, billing, DB schema, email, or policy live in separate
  workspace packages.
- Do not import server-only modules into client-safe code.
- Do not import DB modules from UI or client-safe code.
- Do not bypass middleware, route guards, server functions, or server policy
  checks with UI-only logic.
- Do not reach through dependency-cruiser boundaries to make a quick fix.
- Do not declare work complete without verification.

## 12. Definition of Done

Work is complete only when all are true:

- The requested behavior or documentation change is implemented.
- The change is scoped, readable, and aligned with current boundaries.
- Relevant validation ran successfully, or any verification gap is explicitly
  stated.
- No known instruction conflicts remain unresolved.

The best change in this repository is correct, minimal, verified, and
structurally defensible.
