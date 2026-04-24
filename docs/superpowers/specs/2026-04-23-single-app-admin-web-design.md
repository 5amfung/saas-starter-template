# Single App Admin And Web Design

## Goal

Merge the current `apps/web` and `apps/admin` TanStack Start applications into one deployable application, with `apps/web` as the surviving runtime. The merged app keeps two distinct product intents:

- Customer/product workspace UX under the existing web routes such as `/`, `/signin`, `/ws/:workspaceId/*`, and `/account`.
- Platform administration UX under `/admin/*`, such as `/admin`, `/admin/dashboard`, `/admin/users`, and `/admin/workspaces`.

The primary reason for this pivot is to remove duplicated Better Auth runtimes, duplicated deployment surfaces, duplicated E2E startup, and duplicated `init.ts` bootstrap logic without introducing a separate auth backend.

## Non-Goals

- Do not extract Better Auth into a standalone auth service in this migration.
- Do not support simultaneous login as different users for web and admin in the same browser profile.
- Do not flatten all packages back into `apps/web` during the first migration.
- Do not manually edit generated route tree files.
- Do not change the underlying Better Auth schema ownership in this phase.

## Current Problem Summary

The current repository shares auth code through `packages/auth`, but it runs that shared code twice:

- `apps/web/src/init.ts` creates a Better Auth instance without a cookie prefix.
- `apps/admin/src/init.ts` creates a second Better Auth instance with `cookiePrefix: 'admin'`.
- Both apps mount `/api/auth/$`.
- Both apps carry their own `.env`, Playwright config, route tree, deployment surface, and app bootstrap.

This creates operational ambiguity: two apps appear to own the same auth tables and Better Auth plugin behavior. The separate admin cookie currently allows a browser to be signed into web as one user and admin as another user, but that behavior is not required for the target product model.

## Target Architecture

`apps/web` becomes the single TanStack Start app:

```txt
apps/web
  src/init.ts                 one DB singleton, one email singleton, one Better Auth singleton
  src/routes/api/auth/$.ts    one Better Auth handler
  src/routes/_auth/*          customer auth intent
  src/routes/_protected/*     customer protected intent
  src/routes/admin/*          admin intent
  src/admin/*                 admin server functions and admin domain orchestration
  src/policy/admin-*          admin entry and capability gates
  src/components/admin/*      admin UI

apps/admin
  removed after merged app tests pass
```

The merged app still has two route-level entry policies:

- Web entry policy: a verified session must have an active/accessible workspace.
- Admin entry policy: a verified session must have platform role `admin`.

These are policy gates over one session, not two separate session systems. Platform admins are regular web users with additional platform-admin access. There is no separate admin account type, login realm, signup flow, verification flow, or cookie.

## Route Model

Customer routes remain mostly unchanged:

| Current web route    | Target route         |
| -------------------- | -------------------- |
| `/`                  | `/`                  |
| `/signin`            | `/signin`            |
| `/signup`            | `/signup`            |
| `/verify`            | `/verify`            |
| `/reset-password`    | `/reset-password`    |
| `/accept-invite`     | `/accept-invite`     |
| `/ws`                | `/ws`                |
| `/ws/:workspaceId/*` | `/ws/:workspaceId/*` |
| `/account`           | `/account`           |
| `/billing`           | `/billing`           |
| `/notifications`     | `/notifications`     |

Admin routes move under `/admin`:

| Current admin route                | Target route                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/`                                | `/admin`                                                                                         |
| `/signin`                          | shared `/signin?redirect=/admin/dashboard`                                                       |
| `/signup`                          | no admin-specific route; admin users are provisioned by role/permission, not public admin signup |
| `/verify`                          | shared `/verify?redirect=/admin/dashboard`                                                       |
| `/forgot-password`                 | shared `/forgot-password`                                                                        |
| `/reset-password`                  | shared `/reset-password`                                                                         |
| `/verify-email-change/:emailToken` | shared `/verify-email-change/:emailToken`                                                        |
| `/dashboard`                       | `/admin/dashboard`                                                                               |
| `/users`                           | `/admin/users`                                                                                   |
| `/users/:userId`                   | `/admin/users/:userId`                                                                           |
| `/workspaces`                      | `/admin/workspaces`                                                                              |
| `/workspaces/:workspaceId`         | `/admin/workspaces/:workspaceId`                                                                 |
| `/account`                         | shared `/account`                                                                                |

Health and ping routes should be unified instead of duplicated. The target app only needs one `/health` and one `/ping`.

## Authentication And Session Semantics

The merged app uses one Better Auth session cookie. The admin cookie prefix is removed from the target runtime.

This changes browser behavior:

- Before: one browser could be signed into web and admin as separate users because cookies had different names.
- After: one browser profile has one active app identity. That identity can enter web, admin, both, or neither depending on server-evaluated entry policy.

This is the desired simpler model. If a user needs two identities at the same time, he should use a separate browser profile, private window, or sign out and switch accounts.

## Admin Access Denied Behavior

If a signed-in, email-verified, non-admin user visits `/admin` or any `/admin/*` protected route, the app renders an admin access denied page.

Requirements:

- Do not silently redirect the user into the customer web app.
- Do not send a signed-in non-admin user back through a normal sign-in loop.
- The denied page should make it clear that the current account lacks admin access.
- The page should provide safe actions:
  - go to the customer app home/workspace,
  - sign out,
  - or switch account by signing out and going to `/signin?redirect=/admin`.

Unauthenticated users visiting admin routes should be redirected to the shared sign-in route with an admin redirect target. Signed-in users with unverified email should be redirected to the shared verification route with an admin redirect target.

## Route Gating Rules

Admin gate:

```txt
no session                         -> /signin?redirect=/admin/dashboard
session, email not verified        -> /verify?redirect=/admin/dashboard
session, verified, role !== admin  -> /admin/access-denied
session, verified, role === admin  -> allow admin route
```

Web gate:

```txt
no session                         -> /signin
session, email not verified        -> /verify
session, verified, no workspace    -> blocked or workspace resolution flow
session, verified, workspace ok    -> allow web route
```

Admin and web policy logic should remain server-evaluated. UI can hide controls based on capabilities, but server functions and route middleware remain authoritative.

## File Organization

The first migration should preserve package boundaries and move only the app runtime boundary.

Recommended target structure:

```txt
apps/web/src/admin/
  admin.functions.ts
  admin.server.ts
  users.functions.ts
  users.server.ts
  users.schemas.ts
  workspaces.functions.ts
  workspaces.server.ts
  workspaces.schemas.ts
  workspaces.queries.ts

apps/web/src/policy/
  web-app-entry.*
  admin-app-capabilities.*
  workspace-capabilities.*

apps/web/src/components/admin/
  admin-* components moved from apps/admin

apps/web/src/components/
  app-sidebar.tsx                 customer sidebar
  admin-app-sidebar.tsx           admin sidebar

apps/web/src/routes/admin/
  index.tsx
  _protected.tsx
  _protected/dashboard.tsx
  _protected/users.tsx
  _protected/users/index.tsx
  _protected/users/$userId.tsx
  _protected/workspaces.tsx
  _protected/workspaces/index.tsx
  _protected/workspaces/$workspaceId.tsx
  access-denied.tsx
```

Route file names may need small adjustments to match TanStack Router file-route conventions for visible `/admin/*` paths. Generated route trees must be regenerated by the normal TanStack Start/Vite workflow, not edited manually.

## Package Boundary Policy

Keep these packages for the first migration:

- `packages/auth`: shared Better Auth config, client, schemas, validators, plans.
- `packages/db-schema`: schema source of truth.
- `packages/db`: runtime DB access.
- `packages/policy`: pure capability evaluators.
- `packages/billing`: billing domain/application logic.
- `packages/ui`: shared primitives.
- `packages/components`: shared layout/auth/account components already used by web and admin.

Optional later cleanup may move some app-specific shared composition from `packages/components` into `apps/web`, but only after the merged app is stable. Do not combine package flattening with runtime merge.

## Testing Strategy

The merged app needs one Playwright config that covers both customer and admin flows.

### Test Ownership Model

The target repository should have one application test surface for the merged app:

```txt
apps/web/test/unit/
  admin/                     admin server functions, queries, schemas
  policy/                    web and admin entry/capability policies
  routes/                    web and admin route-level helpers
  components/admin/          admin UI components
  components/...             existing customer UI components

apps/web/test/integration/
  components/admin/          admin feature flows that do not need a browser server
  components/...             existing customer flows

apps/web/test/e2e/
  admin/                     admin browser flows under /admin/*
  auth/                      customer auth browser flows
  workspace/                 customer workspace browser flows
  account/                   shared account/session browser flows
```

`apps/admin/test/*` should be treated as the source to migrate from, not as a permanent parallel test suite. During migration, copied tests may temporarily exist in both apps. After merged admin coverage passes in `apps/web`, the `apps/admin` copies can be deleted with the app.

### Unit Test Migration

Admin unit tests should move by responsibility, not by preserving the old app boundary:

| Current test location                                  | Target test location                                       |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `apps/admin/test/unit/admin/*`                         | `apps/web/test/unit/admin/*`                               |
| `apps/admin/test/unit/policy/*`                        | `apps/web/test/unit/policy/*`                              |
| `apps/admin/test/unit/components/admin/*`              | `apps/web/test/unit/components/admin/*`                    |
| `apps/admin/test/unit/components/app-sidebar.test.tsx` | `apps/web/test/unit/components/admin-app-sidebar.test.tsx` |
| `apps/admin/test/unit/routes/*`                        | `apps/web/test/unit/routes/admin-*.test.tsx`               |
| `apps/admin/test/unit/init/init.test.ts`               | do not move; replace with web single-runtime assertions    |
| duplicated shared component tests                      | keep the existing web copies and delete admin duplicates   |

The duplicated account/auth/layout primitive tests should not all be copied. Many of those already exist under `apps/web/test/unit/components/*`; copying them wholesale would preserve noise from the old app split. Only move tests that prove admin-specific behavior, admin-specific links, or admin-specific route guards.

### Integration Test Migration

Admin integration tests should move only when they cover admin-specific flows:

| Current test location                                                                          | Target test location                                                                         |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx` | `apps/web/test/integration/components/admin/admin-user-management-flow.integration.test.tsx` |
| `apps/admin/test/integration/components/account/account-settings-flow.integration.test.tsx`    | usually do not move; web already owns shared account settings                                |
| `apps/admin/test/integration/components/auth/*`                                                | move only if `/admin/*` callback or denied behavior needs component-level coverage           |

The integration layer should not duplicate E2E. Use integration tests for mocked server-function/component behavior. Use E2E for real routing, cookies, seeded users, and Playwright browser navigation.

### E2E Migration

Admin E2E currently lives under `apps/admin/test/e2e/*` and assumes:

- `baseURL` is `http://localhost:3001`,
- admin routes are root-relative, such as `/users`, `/workspaces`, and `/dashboard`,
- `apps/admin/test/e2e/fixtures/admin-auth.ts` signs in the seeded platform admin against the admin app base URL,
- global setup probes `/api/test/emails` and runs `seedE2EBaseline()`.

In the merged app:

- `apps/web/playwright.config.ts` remains the only Playwright config for app E2E.
- `baseURL` is the web app origin, such as `http://localhost:3000` locally.
- admin specs move to `apps/web/test/e2e/admin/*`.
- admin navigation helpers must prefix paths with `/admin`.
- admin E2E sign-in helpers should use the shared `@workspace/test-utils` `signInSeededUser(baseUrl, ...)` helper against the web base URL.
- the existing web global setup continues to probe `/api/test/emails` and seed baseline data once for both customer and admin tests.
- Stripe webhook forwarding remains tied to the single Better Auth handler at `/api/auth/stripe/webhook`.

Admin E2E path mapping:

| Current admin E2E path     | Target path                                |
| -------------------------- | ------------------------------------------ |
| `/signin`                  | shared `/signin?redirect=/admin/dashboard` |
| `/dashboard`               | `/admin/dashboard`                         |
| `/users`                   | `/admin/users`                             |
| `/users/:userId`           | `/admin/users/:userId`                     |
| `/workspaces`              | `/admin/workspaces`                        |
| `/workspaces/:workspaceId` | `/admin/workspaces/:workspaceId`           |
| `/account`                 | shared `/account`                          |

### New E2E Coverage Required By The Merge

The merge changes product semantics from two cookies to one cookie, so it needs new regression coverage beyond moving existing admin specs:

1. **Unauthenticated admin route**: visiting `/admin/dashboard` redirects to `/signin?redirect=/admin/dashboard`.
2. **Verified non-admin admin route**: a signed-in non-admin visiting `/admin` or `/admin/dashboard` sees `/admin/access-denied`.
3. **Verified admin route**: a seeded platform admin visiting `/admin` reaches `/admin/dashboard`.
4. **Single cookie sign-out**: signing out from either intent removes access to both `/ws/*` and `/admin/*`.
5. **No admin cookie prefix dependency**: E2E helpers must parse and install the actual single Better Auth session cookie returned by `/api/auth/sign-in/email`; tests must not expect an `admin.*` cookie name.
6. **Customer route unaffected**: normal customer signup/signin/workspace entry still works after admin routes are mounted.

### Test Execution Strategy

Run tests in widening rings:

1. Admin policy unit tests.
2. Admin route/component unit tests in `apps/web`.
3. Admin server-function unit tests in `apps/web`.
4. Web existing unit/integration tests.
5. Targeted admin E2E under `apps/web/test/e2e/admin`.
6. Full `apps/web` E2E.
7. Root repo checks after `apps/admin` is retired.

This keeps failures attributable. If a route move breaks type generation, fix that before running browser tests. If a cookie/session semantic breaks, fix targeted admin auth E2E before broad E2E.

Minimum E2E scenarios:

- customer signup/signin/verification still works,
- customer workspace entry still resolves active workspace,
- shared signin as a platform admin reaches `/admin/dashboard` when the redirect target is admin,
- signed-in non-admin visiting `/admin` sees `/admin/access-denied`,
- unauthenticated visiting `/admin/dashboard` redirects to shared `/signin` with admin redirect intent,
- admin user/workspace pages load,
- sign out clears the single cookie for both intents.

Minimum unit/integration scenarios:

- admin entry evaluator returns access denied for verified non-admin users,
- admin protected layout renders denied state or redirects correctly,
- admin entry redirects use shared auth routes with `/admin/*` redirect intent,
- web entry evaluator behavior remains unchanged.

Verification should start targeted and widen:

```bash
pnpm --filter @workspace/web test test/unit/policy
pnpm --filter @workspace/web test test/unit/routes
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm run check:boundaries
pnpm --filter @workspace/web test:e2e
```

After `apps/admin` is removed, root `pnpm run check`, `pnpm test`, and affected E2E should be run.

## Definition Of Done

This migration is done only when there is no regression in visible UI or existing functionality, except for the intentional product changes documented in this spec.

### Allowed Intentional Changes

- Admin routes move from the admin app root to `/admin/*` inside the web app.
- The browser has one Better Auth session cookie instead of separate web and admin cookies.
- A user can no longer be signed into web and admin as two different identities in the same browser profile.
- Admin auth intent uses shared auth pages, such as `/signin?redirect=/admin/dashboard`.
- Signed-in non-admin users visiting `/admin` see `/admin/access-denied`.
- Account settings stay at shared `/account`.

### UI Regression Gates

Customer UI must keep the same behavior and visual structure for:

- public landing/root entry,
- signup, signin, verification, password reset, and invitation flows,
- workspace shell, sidebar, navigation, overview, members, settings, and billing,
- shared account settings and notification preferences.

Admin UI must preserve the existing admin experience after the URL move:

- admin dashboard cards and layout,
- admin sidebar/navigation,
- users table, filters, detail pages, and actions,
- workspaces table, filters, detail pages, billing/API key controls, and actions,
- admin access-denied page with a clear non-admin state,
- sign-out affordance and post-sign-out routing.

The route prefix change is acceptable; missing controls, broken layout, lost table behavior, broken forms, unreadable states, or changed customer flows are regressions.

### Functional Regression Gates

The merged app must preserve:

- Better Auth email/password signup, signin, verification, password reset, session refresh, and sign-out.
- E2E mock email/test helper behavior used by current web/admin E2E.
- Workspace organization membership, active workspace resolution, and customer route protection.
- Shared account update flows.
- Customer billing and Stripe webhook handling through the single `/api/auth/*` handler.
- Platform-admin authorization for dashboard, users, and workspaces.
- Non-admin denial for `/admin` and `/admin/*` protected routes.
- Existing server-function guards for customer and admin actions.
- Existing production health behavior through one `/health` and one `/ping`.

### Required Evidence

Before deleting `apps/admin`, the migration must have:

- targeted unit tests for admin entry policy, admin routes, and migrated admin server functions,
- migrated admin E2E coverage under `apps/web/test/e2e/admin`,
- existing customer auth/workspace/account/billing smoke coverage still passing,
- visual or screenshot-backed Playwright checks for the main customer shell and admin shell,
- manual smoke verification for the most important customer and admin paths,
- root `check:boundaries`, lint, typecheck, test, E2E, and build passing.

Regression status must be proven by explicit tasks, not inferred from code review. The implementation plan must capture pre-migration baseline results, add or preserve customer and admin regression tests, and record final evidence before `apps/admin` is deleted.

### Admin App Retirement Criteria

Do not delete `apps/admin` until all of these are true:

- `apps/web/test/unit/admin` passes.
- `apps/web/test/unit/policy` includes admin entry tests and passes.
- `apps/web/test/unit/components/admin` passes.
- `apps/web/test/e2e/admin` passes.
- existing customer `apps/web` E2E auth/workspace smoke tests pass.
- root scripts no longer need `@workspace/admin-web`.
- deployment configuration points only to the merged web app for customer and admin routes.

## Migration Risks

### Cookie/session behavior

One cookie means one current identity. This simplifies deployment but removes simultaneous web/admin identity testing in one browser profile.

Mitigation: document this as intentional. Add E2E for non-admin admin denial and admin access.

### Route redirect loops

The old admin app had its own auth routes that assumed `/signin`, `/verify`, and `/dashboard`. In the merged model those routes should not be recreated under `/admin`; admin intent is carried through the shared auth pages with a safe relative `redirect` value.

Mitigation: introduce admin route constants for admin destinations and use shared auth routes for sign-in, verification, password reset, and email-change flows.

### Import alias collisions

Both apps use `@/components/app-sidebar`, `@/policy/*`, and `@/admin/*` style imports. Moving admin files into web can accidentally point an import at a customer module.

Mitigation: rename admin shell components where needed, such as `admin-app-sidebar.tsx`, and keep admin modules under `src/admin`.

### Generated route tree churn

Route tree files are generated and must not be manually edited.

Mitigation: rely on the normal TanStack Start/Vite generation path, then inspect the generated route tree only as verification.

### Deleting `apps/admin` too early

Deleting the admin app before merged admin E2E passes removes the easiest comparison target.

Mitigation: move and verify first. Retire `apps/admin` only at the end.

## Recommended Execution Phases

1. **Decision record and constants**: lock route map, access-denied behavior, and admin route constants.
2. **Admin policy in web**: move/adapt admin entry and capability logic into `apps/web`.
3. **Admin route skeleton in web**: add `/admin` index, protected admin shell, and access-denied route while reusing shared auth pages.
4. **Admin feature migration**: move dashboard, users, workspaces, admin functions, admin server helpers, and admin components.
5. **Single auth runtime verification**: validate one cookie and one `/api/auth/*` serve both intents.
6. **Unified E2E and deployment scripts**: move admin E2E coverage to the web app and update root scripts.
7. **Retire `apps/admin`**: remove app package, config, env examples, deployment references, and stale scripts.
8. **Optional package simplification**: evaluate whether any app-only code should move from packages into `apps/web`.

## Open Decisions

Resolved:

- Non-admin signed-in users visiting `/admin` should see an access denied page.
- `apps/web` should be the surviving app.
- Use one Better Auth cookie in the merged app.
- Platform admins are regular web users with platform-admin access; do not create separate admin signup, signin, or verification pages.
- Account settings remain at shared `/account`; do not create `/admin/account` unless future admin-specific account settings are introduced.
- Use one shared `/health` route and one shared `/ping` route; do not create `/admin/health`.
