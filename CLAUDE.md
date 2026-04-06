# AGENTS.md

Operational guide for AI coding agents working in this repository.

## 1. Instruction Priority

Resolve instruction conflicts in this order:

1. Direct user request in the current conversation.
2. This repository `AGENTS.md`.
3. Explicitly invoked skills and tool-specific instructions.
4. Default agent behavior.

If the task becomes unclear or the current approach stops making technical sense, stop and re-plan before continuing.

## 2. Execution Profile

### Plan First

- Use a plan-first workflow for any non-trivial task.
- Treat work as non-trivial if it has 3 or more meaningful steps, crosses package/app boundaries, changes behavior across layers, or has non-obvious tradeoffs.
- Use the repo planning/brainstorming workflow before implementing non-trivial changes.
- If something goes sideways, stop, restate the problem, and re-plan instead of stacking ad hoc fixes.

### Fix Root Causes

- Solve root causes, not symptoms.
- Avoid workaround-only patches unless the user explicitly asks for a temporary mitigation.
- Prefer framework/library-native solutions over compensating logic.
- Keep single sources of truth. Do not introduce parallel state or duplicate ownership casually.

### Verify Before Declaring Done

- Do not mark work complete without concrete verification.
- Start with the smallest meaningful verification for the changed area, then widen scope if needed.
- Compare expected behavior versus actual behavior; do not rely only on command exit status.
- If you cannot run verification, say exactly what was not verified and why.

### Keep Changes Tight

- Minimize blast radius.
- Follow existing boundaries, naming, and architecture.
- Avoid unrelated refactors unless they are required to make the requested change correct.
- Never revert user changes you did not make unless explicitly asked.

### Use Repository-Native Tooling

- Use `pnpm` only. Never use `npm`, `yarn`, `bun`, or `npx`.
- Prefer `rg` / `rg --files` for search.
- Anchor multi-step work to the repository root with `git rev-parse --show-toplevel`.
- Be consistent with CLI invocation patterns during a task.
- Use Conventional Commits when asked to commit.

### Use Subagents Deliberately

- Use subagents for independent research, exploration, or parallelizable analysis.
- Give each subagent one focused responsibility.
- Subagents must follow this same repository policy.
- Keep urgent blocking implementation work on the main path unless the delegated work is truly independent.

## 3. Start / Implement / Verify / Finish

### Start

- Confirm repository root and branch/worktree context.
- Inspect local changes before editing anything substantial.
- Identify the correct app or package before writing code.
- Preflight important CLIs when availability or permissions are uncertain.

### Implement

- Follow existing file/module boundaries.
- Keep client/server imports legal.
- Reuse existing helpers and package APIs before introducing new abstractions.
- Add comments only when they explain non-obvious intent or tradeoffs.

### Verify

- Run targeted tests/checks first.
- Run broader validation when the change affects shared or cross-cutting behavior.
- Run boundary checks when import relationships or architectural layering changed.
- Sanity-check generated files, route behavior, schema ownership, and server/client boundaries when relevant.

### Finish

- Summarize what changed and why.
- Call out residual risks, constraints, and follow-up work.
- State the exact verification performed.

## 4. Definition of Done

Work is complete only when all are true:

- The requested behavior or documentation change is implemented.
- Relevant validation ran successfully, or any verification gap is explicitly stated.
- The change is scoped, readable, and consistent with repository conventions.
- No known instruction conflicts remain unresolved.

## 5. Monorepo Overview

This repository is a multi-app Turborepo SaaS starter, not a single-app codebase.

### Apps

- `apps/web`: main customer-facing SaaS app
- `apps/admin`: separate admin web application
- `apps/api-server`: Hono-based API/server app

### Shared Packages

- `packages/auth`: Better Auth configuration, auth helpers, validators, billing/auth glue
- `packages/billing`: billing domain logic and public billing APIs
- `packages/components`: shared feature-level React components and app-facing composition
- `packages/db`: database client/runtime access
- `packages/db-schema`: schema source, auth schema generation, Drizzle config/scripts
- `packages/email`: email provider integration and React Email templates
- `packages/logging`: shared logger and server request logging
- `packages/policy`: shared authorization capability contracts and evaluators
- `packages/test-utils`: shared testing helpers
- `packages/ui`: low-level shared UI primitives, hooks, and styles
- `packages/eslint-config`: shared lint configuration

### Key Repo Facts

- Package manager: `pnpm@10`
- Node: `>=20`
- Build/task orchestration: Turborepo
- Framework: TanStack Start + TanStack Router + React 19 for `web` and `admin`
- API server: Hono in `apps/api-server`
- Database: Neon + Drizzle ORM
- Auth: Better Auth
- Payments: Stripe
- Email: Resend + React Email
- Styling: Tailwind CSS v4
- Testing: Vitest, Testing Library, Playwright

## 6. Where Changes Belong

This section exists to improve first-pass edit accuracy.

### `apps/web`

Use `apps/web` for:

- customer-facing product routes and pages
- workspace/member/project/account UX
- customer billing UI and customer-side billing flows
- web-specific middleware, route loaders, and server functions

Important live structure:

- `apps/web/src/routes/`
- `apps/web/src/middleware/auth.ts`
- `apps/web/src/init.ts`
- `apps/web/src/account/`
- `apps/web/src/workspace/`
- `apps/web/src/billing/`
- `apps/web/src/policy/`
- `apps/web/src/components/`
- `apps/web/src/hooks/`

### `apps/admin`

Use `apps/admin` for:

- admin-only routes and dashboards
- user/workspace administration UI
- admin-side metrics and workspace management
- admin-specific middleware, loaders, server functions, and policy wiring

Important live structure:

- `apps/admin/src/routes/`
- `apps/admin/src/middleware/auth.ts`
- `apps/admin/src/init.ts`
- `apps/admin/src/admin/`
- `apps/admin/src/auth/`
- `apps/admin/src/policy/`
- `apps/admin/src/components/`

### `apps/api-server`

Use `apps/api-server` for:

- standalone API/server concerns not owned by TanStack Start route handlers
- Hono routes and middleware
- request ID, error handling, and API-server-specific request logging

Important live structure:

- `apps/api-server/src/app.ts`
- `apps/api-server/src/index.ts`
- `apps/api-server/src/routes/`
- `apps/api-server/src/middleware/`
- `apps/api-server/src/lib/`

### `packages/auth`

Use `packages/auth` for:

- Better Auth server/client setup
- auth validators/schemas
- auth-related billing glue
- permission scaffolding and shared auth utilities

### `packages/billing`

Use `packages/billing` for:

- billing business rules
- plan definitions, entitlement logic, subscription logic
- public billing application APIs consumed by apps/auth
- infrastructure adapters that persist/fetch billing state

Live internal layering:

- `src/contracts/`
- `src/domain/`
- `src/application/`
- `src/infrastructure/`

### `packages/db` vs `packages/db-schema`

This split matters.

- `packages/db-schema`: schema source of truth, auth schema generation, Drizzle config/scripts
- `packages/db`: database client/runtime database access exports

If the task changes tables, schema shape, generated auth schema, or Drizzle generation flow, start in `packages/db-schema`.
If the task changes how code connects to or consumes the database at runtime, start in `packages/db`.

### `packages/components` vs `packages/ui`

This split also matters.

- `packages/ui`: low-level design-system primitives and shared styles
- `packages/components`: higher-level shared app components, layout pieces, forms, auth/account UI composition exposed through package subpaths such as `@workspace/components/account`, `@workspace/components/auth`, `@workspace/components/form`, and `@workspace/components/layout`

If a component is a reusable primitive, style primitive, or generic UI building block, it likely belongs in `packages/ui`.
If it is a product-level shared component that composes business-facing behavior, it likely belongs in `packages/components`.

### `packages/logging`

Use `packages/logging` for:

- shared logger implementation
- shared server-side request logging helpers

### `packages/policy`

Use `packages/policy` for:

- shared authorization capability types and policy evaluators
- workspace/admin capability contracts reused across apps
- pure policy logic that should not depend on app runtime concerns

Keep app-specific context loading, server lookups, and route-facing wrappers in each app's `src/policy/` directory.

## 7. Routing, Middleware, and Server Functions

### Authorization and Capability Rules

- UI does not authorize actions; UI renders capabilities derived from server-evaluated policy.
- Routes and middleware guard page-level access.
- Server functions guard action-level access.
- Roles are inputs to policy evaluation, not business decisions by themselves.
- Policy evaluation should be centralized, typed, and reusable across apps.
- `packages/policy` owns shared capability contracts and pure evaluators.
- App-local `src/policy/` modules own loading contextual facts and exposing app-facing wrappers/functions.
- New protected features should define required capabilities before UI implementation begins.
- Do not duplicate business semantics across packages; extend the existing owning package instead.

### File-Based Routing

Both `apps/web` and `apps/admin` use file-based routing under `src/routes/`.

- layout routes use `_` prefixes
- public auth routes live under `_auth/`
- protected routes live under `_protected/`
- API routes live under `routes/api/`

Generated route trees exist in both apps:

- `apps/web/src/routeTree.gen.ts`
- `apps/admin/src/routeTree.gen.ts`

Never edit generated route tree files manually.

### Middleware

Both web apps currently use auth middleware modules:

- `apps/web/src/middleware/auth.ts`
- `apps/admin/src/middleware/auth.ts`

Prefer enforcing access with middleware/server-side guards, not UI-only checks.

### Server Function Conventions

Current code uses `createServerFn()` wrappers in app-level `*.functions.ts` files and server-only helpers in `*.server.ts` files.

Examples that exist now:

- `apps/web/src/workspace/workspace.functions.ts`
- `apps/web/src/billing/billing.functions.ts`
- `apps/web/src/account/notification-preferences.functions.ts`
- `apps/admin/src/admin/admin.functions.ts`
- `apps/admin/src/admin/workspaces.functions.ts`

Use this split consistently:

- `*.functions.ts`: app-facing server function wrappers
- `*.server.ts`: server-only internals, privileged helpers, DB logic, secrets
- plain `*.ts` / `*.tsx`: shared or client-safe unless clearly server-only by context

Rules:

- Never import `*.server.ts` into client-safe modules or route components.
- Prefer calling server behavior through `*.functions.ts` from routes/components.
- Keep privileged logic on the server.

## 8. Auth, Workspace, and Billing Context

### Auth / Workspace Model

Current code shows:

- Better Auth organization support is active
- workspaces are modeled via organizations
- active workspace state is tracked through `activeOrganizationId`
- workspace-aware behavior spans `packages/auth`, `apps/web/src/workspace`, and admin workspace management code

Do not re-implement workspace ownership or membership rules in random app files if shared auth/workspace code already owns that behavior.

### Billing Context

Billing is no longer just app-local UI logic.

- customer billing UI/server functions exist in `apps/web/src/billing`
- admin billing/workspace controls exist in `apps/admin`
- billing domain logic lives in `packages/billing`
- auth and billing integration also touches `packages/auth`

Before changing billing behavior, decide whether the change is:

- UI only
- app orchestration
- shared billing domain logic
- persistence/schema

Put the change in the lowest correct layer.

## 9. Hard Architecture Constraints

These constraints are real and enforced by tooling or code structure.

### Generated / Managed Files

Do not manually edit:

- `apps/web/src/routeTree.gen.ts`
- `apps/admin/src/routeTree.gen.ts`
- generated schema output that should instead be regenerated by the proper script
- managed UI component files if the task should be handled through the component generator/workflow already used by the repo

### Dependency Cruiser Boundaries

The repo has boundary enforcement in `.dependency-cruiser.cjs`.

Important active rules:

- app code must not import `packages/billing/src/infrastructure` or other billing internals directly
- `packages/billing` domain/application/contracts must not depend on app code
- billing core layers must not depend directly on `packages/db-schema`
- new app imports from `packages/db-schema/src/` are forbidden outside a narrow allow-list
- components must not import app-local `src/policy/*.server.ts` modules directly
- apps must consume `@workspace/policy` through its public entry, not internal source files

Practical rule:

- apps should consume public package APIs, not package internals
- if you need new behavior, expose it through the package’s public surface instead of reaching into internals

### Database Ownership

- Schema source lives in `packages/db-schema`
- runtime DB exports live in `packages/db`
- avoid creating new direct app-to-`db-schema` coupling unless you have confirmed it is allowed

### Security / Server Ownership

- keep secrets, privileged auth logic, DB access, and request-sensitive operations on the server
- do not replace middleware or server checks with client-only checks

## 10. Testing and Verification Strategy

### Root Commands

Run from repo root unless there is a reason not to:

- `pnpm dev`
- `pnpm admin:dev`
- `pnpm api:dev`
- `pnpm web:dev`
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
- `pnpm run web:test:e2e:chromium`
- `pnpm run web:test:e2e:firefox`
- `pnpm run web:test:e2e:webkit`
- `pnpm run web:test:e2e:ui`
- `pnpm run web:test:e2e:report`

### App-Specific Commands

- `pnpm --filter @workspace/web <script>`
- `pnpm --filter @workspace/admin-web <script>`
- `pnpm --filter @workspace/api-server <script>`

Useful current examples:

- `pnpm --filter @workspace/web test test/unit/...`
- `pnpm --filter @workspace/web test:e2e test/e2e/...`
- `pnpm --filter @workspace/admin-web test`

### Database / Schema Commands

Schema generation commands currently live under `@workspace/db-schema`:

- `pnpm --filter @workspace/db-schema db:generate`
- `pnpm --filter @workspace/db-schema db:migrate`
- `pnpm --filter @workspace/db-schema db:push`
- `pnpm --filter @workspace/db-schema db:studio`
- `pnpm --filter @workspace/db-schema gen-schema`
- `pnpm --filter @workspace/db-schema gen-auth-schema`

### Verification Guidance

- Use the smallest relevant package/app command first.
- If imports or layering changed, run `pnpm run check:boundaries`.
- If shared types or package exports changed, run at least typecheck for affected packages/apps.
- If route behavior changed, run the most targeted route- or app-level tests available.
- If schema or auth generation changed, verify the generated artifacts and the consuming code path.

## 11. Testing Layout

Current test locations include:

- `apps/web/test/`
- `apps/admin/test/`
- `apps/api-server/test/`
- `packages/auth/test/`
- `packages/billing/test/`
- `packages/db-schema/test/`
- `packages/db/test/`
- `packages/email/test/`
- `packages/eslint-config/test/`
- `packages/policy/test/`
- `packages/ui/test/`

Prefer the smallest matching test scope before broad repo-wide runs.

## 12. Repository Conventions That Matter

### General

- Use path aliases and workspace imports consistently.
- Keep import ordering aligned with existing file style.
- Prefer meaningful names and extracted constants over magic values.
- Avoid `any`; narrow `unknown` properly.

### UI

- Reuse the existing UI stack before introducing new component patterns.
- Follow the repo’s Tailwind/shadcn/Base UI conventions.
- Put primitives in `packages/ui`, shared business-facing composition in `packages/components`, and app-specific UX inside the app unless genuine reuse exists.

### Architecture

- Respect package public APIs.
- Do not mix route logic, DB logic, and domain logic arbitrarily.
- Follow the existing layer split before adding new modules.

## 13. Do Not

- Do not use `npm`, `yarn`, `bun`, or `npx`.
- Do not manually edit generated route tree files.
- Do not assume `web` is the only app.
- Do not import server-only modules into client-safe code.
- Do not reach into package internals when a public API is the correct boundary.
- Do not bypass middleware/server checks with UI-only logic.
- Do not declare work complete without evidence.

## 14. Preferred Outcome

The best change in this repository is:

- correct
- minimal
- verified
- aligned with the current package/app boundaries
- explicit about tradeoffs when tradeoffs exist

If a solution is fast but brittle, keep working until it is both correct and structurally defensible.
