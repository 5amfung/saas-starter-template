# Single App Admin And Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `apps/admin` into `apps/web` as `/admin/*`, leaving one TanStack Start runtime, one Better Auth handler, one session cookie, and route-level gates for customer versus admin intent.

**Architecture:** `apps/web` becomes the surviving app. Admin modules move into web-owned admin folders and retain server-side capability gates. `apps/admin` remains in place until the merged admin routes, tests, and deployment scripts are verified, then it is retired.

**Tech Stack:** TanStack Start, TanStack Router file routes, Better Auth, Drizzle/Postgres, Turborepo, Vitest, Playwright, pnpm.

---

## Design Reference

Use `docs/superpowers/specs/2026-04-23-single-app-admin-web-design.md` as the source of truth for route semantics, access-denied behavior, package-boundary decisions, and migration risks.

## Regression Evidence Rule

No phase may infer "no regression" from a successful refactor alone. The worker must capture baseline behavior before moving routes, add or preserve automated regression checks while migrating, and record final evidence before deleting `apps/admin`.

Use this evidence file throughout the migration:

- Create/update: `docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md`

Each regression task below must append the command, result, and any artifact path, such as Playwright screenshots, traces, or reports. If any regression check fails, stop the migration and fix that regression before continuing to the next phase.

## File Structure Map

### Surviving Runtime

- Modify: `apps/web/src/init.ts`
  - Keep as the only app bootstrap for DB, email, and Better Auth.
  - Do not add `cookiePrefix: 'admin'`.
- Keep: `apps/web/src/routes/api/auth/$.ts`
  - Remains the single Better Auth handler.
- Keep: `apps/web/src/routes/api/test/emails.ts`
  - Remains the E2E mock email route.

### Admin Policy In Web

- Create or move into: `apps/web/src/policy/admin-app-capabilities.shared.ts`
- Create or move into: `apps/web/src/policy/admin-app-capabilities.server.ts`
- Create or move into: `apps/web/src/policy/admin-app-capabilities.functions.ts`
- Create or move into: `apps/web/src/policy/admin-app-capabilities.ts`
- Keep package policy evaluator semantics unchanged; app-local admin entry wrappers represent access denied.

### Admin Route Constants

- Create: `apps/web/src/admin/admin-routes.ts`
  - Exports target path constants:
    - `ADMIN_ROOT = '/admin'`
    - `ADMIN_ACCESS_DENIED = '/admin/access-denied'`
    - `ADMIN_DASHBOARD = '/admin/dashboard'`
    - `ADMIN_USERS = '/admin/users'`
    - `ADMIN_WORKSPACES = '/admin/workspaces'`

### Admin App Modules In Web

- Move into: `apps/web/src/admin/`
  - `apps/admin/src/admin/admin.functions.ts`
  - `apps/admin/src/admin/admin.server.ts`
  - `apps/admin/src/admin/users.functions.ts`
  - `apps/admin/src/admin/users.server.ts`
  - `apps/admin/src/admin/schemas.ts`
  - `apps/admin/src/admin/users.schemas.ts`
  - `apps/admin/src/admin/workspaces.functions.ts`
  - `apps/admin/src/admin/workspaces-query.functions.ts`
  - `apps/admin/src/admin/workspaces.queries.ts`
  - `apps/admin/src/admin/workspaces.schemas.ts`
  - `apps/admin/src/admin/workspaces.server.ts`

### Admin Components In Web

- Move into: `apps/web/src/components/admin/`
  - all `apps/admin/src/components/admin/*`
- Create or move to: `apps/web/src/components/admin-app-sidebar.tsx`
  - Based on `apps/admin/src/components/app-sidebar.tsx`.
  - Use `/admin/*` links.

### Admin Routes In Web

Create route files under `apps/web/src/routes/admin/` using TanStack Router conventions:

- `index.tsx`
- `_protected.tsx`
- `_protected/dashboard.tsx`
- `_protected/users.tsx`
- `_protected/users/index.tsx`
- `_protected/users/$userId.tsx`
- `_protected/workspaces.tsx`
- `_protected/workspaces/index.tsx`
- `_protected/workspaces/$workspaceId.tsx`
- `access-denied.tsx`

If TanStack Start generates different route IDs for this folder layout, adjust file names to match its documented file-route conventions. Never edit `apps/web/src/routeTree.gen.ts` by hand.

### Tests

- Move/adapt admin unit tests into `apps/web/test/unit/admin/`, `apps/web/test/unit/policy/`, `apps/web/test/unit/routes/`, and `apps/web/test/unit/components/admin/`.
- Move/adapt admin E2E tests into `apps/web/test/e2e/admin/`.
- Modify: `apps/web/playwright.config.ts`
  - Keep one web server.
  - Cover admin specs from the same app.
- Remove later: `apps/admin/playwright.config.ts` only after merged admin E2E passes.

### Test Migration Matrix

| Source                                                 | Target                                                     | Rule                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------- |
| `apps/admin/test/unit/admin/*`                         | `apps/web/test/unit/admin/*`                               | move and update imports                                 |
| `apps/admin/test/unit/policy/*`                        | `apps/web/test/unit/policy/*`                              | move admin-specific policy tests                        |
| `apps/admin/test/unit/components/admin/*`              | `apps/web/test/unit/components/admin/*`                    | move and update `/admin/*` links                        |
| `apps/admin/test/unit/components/app-sidebar.test.tsx` | `apps/web/test/unit/components/admin-app-sidebar.test.tsx` | rename to avoid customer sidebar collision              |
| `apps/admin/test/unit/routes/*`                        | `apps/web/test/unit/routes/admin-*.test.tsx`               | move route helper tests and update route expectations   |
| `apps/admin/test/integration/components/admin/*`       | `apps/web/test/integration/components/admin/*`             | move admin-specific integration flows                   |
| `apps/admin/test/e2e/*`                                | `apps/web/test/e2e/admin/*`                                | move and prefix paths with `/admin`                     |
| `apps/admin/test/unit/init/init.test.ts`               | none                                                       | replace with web single-runtime tests                   |
| duplicated account/auth/layout primitive tests         | existing web tests                                         | do not duplicate unless admin-specific behavior differs |

### E2E Helper Strategy

Keep the web global setup as the shared guard:

- `apps/web/test/e2e/global-setup.ts` continues probing `/api/test/emails`.
- The same setup seeds baseline data for both customer and admin E2E.
- Admin E2E helpers should use `@workspace/test-utils` against the web `baseURL`.

Create web-local admin E2E helpers:

- `apps/web/test/e2e/admin/fixtures/admin-auth.ts`
- `apps/web/test/e2e/admin/fixtures/admin-fixtures.ts`
- `apps/web/test/e2e/admin/fixtures/admin-navigation.ts`

The merged admin E2E auth helper must default to `http://localhost:3000`, not `http://localhost:3001`, and must install the returned single session cookie without assuming an admin cookie prefix.

---

## Phase 0: Decision Record And Baseline

### Task 0.1: Confirm Clean Starting Point

**Files:**

- Read: repository status only

- [x] **Step 1: Confirm repository root**

Run:

```bash
git rev-parse --show-toplevel
```

Expected:

```txt
/Users/sfung/.codex/worktrees/9718/sass-starter-template
```

- [x] **Step 2: Confirm current worktree status**

Run:

```bash
git status --short --branch
```

Expected: note any existing user changes. Do not revert unrelated changes.

- [x] **Step 3: Run current targeted baselines**

Run:

```bash
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/admin-web typecheck
pnpm --filter @workspace/web test test/unit/policy
pnpm --filter @workspace/admin-web test test/unit/policy
```

Expected: PASS, or record pre-existing failures before changing code.

### Task 0.2: Capture Pre-Migration Regression Baseline

**Files:**

- Create: `docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md`
- Read/run only: current `apps/web` and `apps/admin` tests

- [x] **Step 1: Create the regression evidence file**

Create `docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md` with this structure:

```md
# Single App Admin And Web Regression Evidence

## Baseline Before Migration

| Area | Command or check | Result | Artifact |
| ---- | ---------------- | ------ | -------- |

## During Migration Gates

| Phase | Command or check | Result | Artifact |
| ----- | ---------------- | ------ | -------- |

## Final No-Regression Gate

| Area | Command or check | Result | Artifact |
| ---- | ---------------- | ------ | -------- |
```

- [x] **Step 2: Run current customer E2E smoke baseline**

Run:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/auth/signin.spec.ts test/e2e/auth/signup.spec.ts
pnpm --filter @workspace/web test:e2e test/e2e/workspace/settings.spec.ts
```

Expected: PASS, or record the exact pre-existing failure in the evidence file before changing code.

- [x] **Step 3: Run current admin E2E smoke baseline**

Run:

```bash
pnpm --filter @workspace/admin-web test:e2e test/e2e
```

Expected: PASS, or record the exact pre-existing failure in the evidence file before changing code.

- [x] **Step 4: Capture baseline UI screenshots**

First check whether screenshot assertions already exist:

```bash
rg -n "toHaveScreenshot|screenshot|snapshot" apps/web/test/e2e apps/admin/test/e2e
```

If screenshot assertions exist, run the current customer/admin E2E suites with Playwright screenshots enabled for the shell pages that must not regress:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/workspace/settings.spec.ts --update-snapshots
pnpm --filter @workspace/admin-web test:e2e test/e2e --update-snapshots
```

If no screenshot assertions exist, do not treat a plain E2E pass as visual evidence. Add baseline screenshot specs before continuing:

- `apps/web/test/e2e/regression/baseline-ui.spec.ts`
- `apps/admin/test/e2e/regression/baseline-ui.spec.ts`

Those specs must use `expect(page).toHaveScreenshot(...)` for the customer signin shell, customer workspace shell, admin dashboard shell, admin users table, and admin workspaces table. Run each spec once with `--update-snapshots`, then run again without `--update-snapshots` and record the committed snapshot paths in the evidence file.

- [x] **Step 5: Commit**

Run:

```bash
git add docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md
git commit -m "docs: capture admin web migration regression baseline"
```

### Task 0.3: Add Admin Route Constants

**Files:**

- Create: `apps/web/src/admin/admin-routes.ts`
- Test: `apps/web/test/unit/admin/admin-routes.test.ts`

- [ ] **Step 1: Write route constant tests**

Create `apps/web/test/unit/admin/admin-routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ADMIN_ACCESS_DENIED,
  ADMIN_DASHBOARD,
  ADMIN_ROOT,
  ADMIN_USERS,
  ADMIN_WORKSPACES,
} from '@/admin/admin-routes';

describe('admin route constants', () => {
  it('keeps all admin intent routes under /admin', () => {
    expect(ADMIN_ROOT).toBe('/admin');
    expect(ADMIN_ACCESS_DENIED).toBe('/admin/access-denied');
    expect(ADMIN_DASHBOARD).toBe('/admin/dashboard');
    expect(ADMIN_USERS).toBe('/admin/users');
    expect(ADMIN_WORKSPACES).toBe('/admin/workspaces');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @workspace/web test test/unit/admin/admin-routes.test.ts
```

Expected: FAIL because `@/admin/admin-routes` does not exist.

- [ ] **Step 3: Add route constants**

Create `apps/web/src/admin/admin-routes.ts`:

```ts
export const ADMIN_ROOT = '/admin' as const;
export const ADMIN_ACCESS_DENIED = '/admin/access-denied' as const;
export const ADMIN_DASHBOARD = '/admin/dashboard' as const;
export const ADMIN_USERS = '/admin/users' as const;
export const ADMIN_WORKSPACES = '/admin/workspaces' as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @workspace/web test test/unit/admin/admin-routes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/admin/admin-routes.ts apps/web/test/unit/admin/admin-routes.test.ts
git commit -m "feat(web): add admin route constants"
```

---

## Phase 1: Admin Policy Inside Web

### Task 1.1: Move Admin Entry Policy To Web

**Files:**

- Create: `apps/web/src/policy/admin-app-capabilities.shared.ts`
- Create: `apps/web/src/policy/admin-app-capabilities.server.ts`
- Create: `apps/web/src/policy/admin-app-capabilities.functions.ts`
- Create: `apps/web/src/policy/admin-app-capabilities.ts`
- Test: `apps/web/test/unit/policy/admin-app-capabilities.shared.test.ts`

- [ ] **Step 1: Copy existing admin policy files into web**

Copy the content of these files into the matching web paths:

```txt
apps/admin/src/policy/admin-app-capabilities.shared.ts
apps/admin/src/policy/admin-app-capabilities.server.ts
apps/admin/src/policy/admin-app-capabilities.functions.ts
apps/admin/src/policy/admin-app-capabilities.ts
```

When copying, update imports that point to admin-local aliases so they point to web-local modules.

- [ ] **Step 2: Add access-denied behavior to shared policy**

In `apps/web/src/policy/admin-app-capabilities.shared.ts`, represent verified non-admin users as an access-denied entry instead of a sign-in redirect:

```ts
export interface AdminAppEntryAccessDenied {
  kind: 'accessDenied';
  facts: AdminAppEntryFacts;
  capabilities: AdminAppEntryCapabilities;
}

export type AdminAppEntry =
  | AdminAppEntryRedirect
  | AdminAppEntryAccessDenied
  | AdminAppEntryAllowed;
```

Update `getAdminAppEntryForSession` so `capabilities.isAdminOnlyDenied` returns:

```ts
return {
  kind: 'accessDenied',
  facts,
  capabilities,
};
```

- [ ] **Step 3: Update redirect helper for admin paths**

Update `getAdminAppEntryRedirect` in `apps/web/src/policy/admin-app-capabilities.shared.ts` to use `apps/web/src/admin/admin-routes.ts` constants. Access denied entries should redirect to `ADMIN_ACCESS_DENIED` only when a protected route needs a redirect response.

Expected core behavior:

```ts
if (entry.kind === 'canEnterAdminApp') {
  return context === 'guest' ? { to: ADMIN_DASHBOARD } : null;
}

if (entry.kind === 'accessDenied') {
  return context === 'protected' || context === 'root'
    ? { to: ADMIN_ACCESS_DENIED }
    : null;
}
```

Unauthenticated redirects use the shared `/signin` route with `{ redirect: ADMIN_DASHBOARD }`. Unverified redirects use the shared `/verify` route with `{ redirect: ADMIN_DASHBOARD }`.

- [ ] **Step 4: Write tests for non-admin denial**

Create `apps/web/test/unit/policy/admin-app-capabilities.shared.test.ts` with cases for:

```ts
import { describe, expect, it } from 'vitest';
import {
  getAdminAppEntryForSession,
  getAdminAppEntryRedirect,
} from '@/policy/admin-app-capabilities.shared';

describe('admin app entry policy', () => {
  it('requires sign-in without a session', () => {
    const entry = getAdminAppEntryForSession(null);

    expect(entry.kind).toBe('redirect');
    expect(getAdminAppEntryRedirect(entry, 'protected')).toEqual({
      to: '/signin',
      search: { redirect: '/admin/dashboard' },
    });
  });

  it('requires email verification for unverified users', () => {
    const entry = getAdminAppEntryForSession({
      user: { id: 'u1', emailVerified: false, role: 'admin' },
      session: { id: 's1' },
    });

    expect(entry.kind).toBe('redirect');
    expect(getAdminAppEntryRedirect(entry, 'protected')).toEqual({
      to: '/verify',
      search: { redirect: '/admin/dashboard' },
    });
  });

  it('denies verified non-admin users without sending them through sign-in', () => {
    const entry = getAdminAppEntryForSession({
      user: { id: 'u1', emailVerified: true, role: 'user' },
      session: { id: 's1' },
    });

    expect(entry.kind).toBe('accessDenied');
    expect(getAdminAppEntryRedirect(entry, 'protected')).toEqual({
      to: '/admin/access-denied',
    });
  });

  it('allows verified admin users', () => {
    const entry = getAdminAppEntryForSession({
      user: { id: 'u1', emailVerified: true, role: 'admin' },
      session: { id: 's1' },
    });

    expect(entry.kind).toBe('canEnterAdminApp');
    expect(getAdminAppEntryRedirect(entry, 'protected')).toBeNull();
  });
});
```

- [ ] **Step 5: Run admin policy tests**

Run:

```bash
pnpm --filter @workspace/web test test/unit/policy/admin-app-capabilities.shared.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/policy/admin-app-capabilities* apps/web/test/unit/policy/admin-app-capabilities.shared.test.ts
git commit -m "feat(web): add admin entry policy"
```

---

## Phase 2: Admin Route Skeleton In Web

### Task 2.1: Add Admin Access Denied Route

**Files:**

- Create: `apps/web/src/routes/admin/access-denied.tsx`
- Test: `apps/web/test/unit/routes/admin-access-denied-route.test.tsx`

- [ ] **Step 1: Write route component test**

Create `apps/web/test/unit/routes/admin-access-denied-route.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Route } from '@/routes/admin/access-denied';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

describe('admin access denied route', () => {
  it('explains the current account is not allowed into admin', () => {
    render(<Route.options.component />);

    expect(
      screen.getByRole('heading', { name: /access denied/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/current account does not have admin access/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to app/i })).toHaveAttribute(
      'href',
      '/'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @workspace/web test test/unit/routes/admin-access-denied-route.test.tsx
```

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement route**

Create `apps/web/src/routes/admin/access-denied.tsx`:

```tsx
import { Link, createFileRoute } from '@tanstack/react-router';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';

export const Route = createFileRoute('/admin/access-denied')({
  component: AdminAccessDeniedPage,
});

function AdminAccessDeniedPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>
            The current account does not have admin access.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild>
            <Link to="/">Go to app</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/signin" search={{ redirect: '/admin' }}>
              Switch account
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @workspace/web test test/unit/routes/admin-access-denied-route.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/routes/admin/access-denied.tsx apps/web/test/unit/routes/admin-access-denied-route.test.tsx
git commit -m "feat(web): add admin access denied page"
```

### Task 2.2: Add Admin Entry And Protected Layout Routes

**Files:**

- Create: `apps/web/src/routes/admin/index.tsx`
- Create: `apps/web/src/routes/admin/_protected.tsx`
- Create: `apps/web/src/components/admin-app-sidebar.tsx`
- Test: moved/adapted route unit tests from `apps/admin/test/unit/routes`

- [ ] **Step 1: Reuse shared auth routes for admin intent**

Do not create `/admin/signin`, `/admin/signup`, `/admin/verify`, `/admin/forgot-password`, or `/admin/reset-password`. A platform admin is a regular web user with platform-admin access, so admin routes should use the existing shared auth pages:

```txt
/signin?redirect=/admin/dashboard
/verify?redirect=/admin/dashboard
/forgot-password
/reset-password
```

Admin self-signup is not part of this migration. If a user needs platform admin access, he must sign into an existing user account that has the platform admin role/capability.

- [ ] **Step 2: Move admin protected layout**

Copy `apps/admin/src/routes/_protected.tsx` to `apps/web/src/routes/admin/_protected.tsx`.

Update:

```ts
createFileRoute('/admin/_protected');
```

Use the web-local `admin-app-capabilities` modules and `AdminAppSidebar`.

- [ ] **Step 3: Move admin sidebar**

Copy `apps/admin/src/components/app-sidebar.tsx` to `apps/web/src/components/admin-app-sidebar.tsx`.

Update links:

```txt
/dashboard  -> /admin/dashboard
/users      -> /admin/users
/workspaces -> /admin/workspaces
/account    -> /account
```

- [ ] **Step 4: Add admin index redirect**

Copy `apps/admin/src/routes/index.tsx` to `apps/web/src/routes/admin/index.tsx`.

Update behavior:

```txt
admin allowed      -> /admin/dashboard
admin denied       -> /admin/access-denied
unauthenticated    -> /signin?redirect=/admin/dashboard
unverified         -> /verify?redirect=/admin/dashboard
```

- [ ] **Step 5: Run route generation/typecheck**

Run:

```bash
pnpm --filter @workspace/web typecheck
```

Expected: PASS and `apps/web/src/routeTree.gen.ts` is regenerated if the toolchain performs generation during typecheck/build. If route tree generation requires a Vite dev/build command, run:

```bash
pnpm --filter @workspace/web build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/routes/admin apps/web/src/components/admin-app-sidebar.tsx apps/web/src/routeTree.gen.ts
git commit -m "feat(web): add admin route shell"
```

---

## Phase 3: Admin Feature Migration

### Task 3.1: Move Admin Server Functions And Queries

**Files:**

- Create/modify: `apps/web/src/admin/*`
- Test: move/adapt `apps/admin/test/unit/admin/*` into `apps/web/test/unit/admin/*`

- [ ] **Step 1: Copy admin application modules**

Copy these files into `apps/web/src/admin/`:

```txt
apps/admin/src/admin/admin.functions.ts
apps/admin/src/admin/admin.server.ts
apps/admin/src/admin/users.functions.ts
apps/admin/src/admin/users.server.ts
apps/admin/src/admin/users.schemas.ts
apps/admin/src/admin/workspaces.functions.ts
apps/admin/src/admin/workspaces-query.functions.ts
apps/admin/src/admin/workspaces.queries.ts
apps/admin/src/admin/workspaces.schemas.ts
apps/admin/src/admin/workspaces.server.ts
```

- [ ] **Step 2: Update imports**

Replace admin-local imports with web-local imports:

```txt
@/auth/validators -> remove if replaced by admin-app-capabilities.server
@/init            -> @/init
@/policy/...      -> @/policy/...
@/admin/...       -> @/admin/...
```

Use `requireCurrentAdminAppCapability` from `apps/web/src/policy/admin-app-capabilities.server.ts` for admin authorization.

- [ ] **Step 3: Move unit tests**

Copy admin unit tests from:

```txt
apps/admin/test/unit/admin/
```

to:

```txt
apps/web/test/unit/admin/
```

Update imports to `@/admin/*`.

- [ ] **Step 4: Run admin unit tests in web**

Run:

```bash
pnpm --filter @workspace/web test test/unit/admin
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/admin apps/web/test/unit/admin
git commit -m "feat(web): move admin server modules"
```

### Task 3.2: Move Admin Components And Pages

**Files:**

- Create/modify: `apps/web/src/components/admin/*`
- Create/modify: `apps/web/src/routes/admin/_protected/*`
- Test: move/adapt component and route tests

- [ ] **Step 1: Copy admin components**

Copy:

```txt
apps/admin/src/components/admin/*
```

to:

```txt
apps/web/src/components/admin/
```

- [ ] **Step 2: Copy admin protected feature routes**

Copy current admin routes:

```txt
apps/admin/src/routes/_protected/dashboard.tsx
apps/admin/src/routes/_protected/users.tsx
apps/admin/src/routes/_protected/users/index.tsx
apps/admin/src/routes/_protected/users/$userId.tsx
apps/admin/src/routes/_protected/workspaces.tsx
apps/admin/src/routes/_protected/workspaces/index.tsx
apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx
```

into:

```txt
apps/web/src/routes/admin/_protected/
```

Update route IDs to the `/admin/_protected/...` route namespace and visible links to `/admin/*`.

- [ ] **Step 3: Update component imports and links**

Replace imports such as:

```txt
@/admin/workspaces.functions
@/components/admin/...
@/policy/admin-app-capabilities
```

with the matching web-local paths. Update navigation URLs:

```txt
/dashboard              -> /admin/dashboard
/users                  -> /admin/users
/users/$userId          -> /admin/users/$userId
/workspaces             -> /admin/workspaces
/workspaces/$workspaceId -> /admin/workspaces/$workspaceId
```

- [ ] **Step 4: Move component tests**

Copy:

```txt
apps/admin/test/unit/components/admin/
```

to:

```txt
apps/web/test/unit/components/admin/
```

Update imports and expected links to `/admin/*`.

- [ ] **Step 5: Run admin component and route tests**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/admin test/unit/routes
pnpm --filter @workspace/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/components/admin apps/web/src/routes/admin/_protected apps/web/test/unit/components/admin apps/web/test/unit/routes apps/web/src/routeTree.gen.ts
git commit -m "feat(web): move admin pages"
```

---

## Phase 4: Single Auth Runtime And Cookie Semantics

### Task 4.1: Verify One Better Auth Runtime

**Files:**

- Modify: `apps/web/src/init.ts`
- Keep: `apps/web/src/routes/api/auth/$.ts`
- Do not modify: `apps/admin/src/init.ts` until retirement phase
- Test: `apps/web/test/unit/init/init.test.ts`

- [ ] **Step 1: Confirm web init has no admin cookie prefix**

Inspect `apps/web/src/init.ts`. Expected Better Auth config has no `cookiePrefix`:

```ts
authSingleton = createAuth({
  db: getDb(),
  emailClient: getEmailClient(),
  baseUrl: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
  getRequestHeaders,
});
```

- [ ] **Step 2: Keep or update init tests**

Ensure `apps/web/test/unit/init/init.test.ts` asserts `cookiePrefix` is not passed.

Expected assertion:

```ts
expect(createAuthMock).toHaveBeenCalledWith(
  expect.not.objectContaining({ cookiePrefix: expect.any(String) })
);
```

- [ ] **Step 3: Run init tests**

Run:

```bash
pnpm --filter @workspace/web test test/unit/init/init.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit if tests or init changed**

Run:

```bash
git add apps/web/src/init.ts apps/web/test/unit/init/init.test.ts
git commit -m "test(web): lock single auth cookie runtime"
```

If no files changed, record this task as verified with no commit.

### Task 4.2: Add Single-Cookie E2E Coverage

**Files:**

- Create: `apps/web/test/e2e/admin/access-denied.spec.ts`
- Create or modify: `apps/web/test/e2e/admin/admin-auth.spec.ts`

- [ ] **Step 1: Add non-admin access denied E2E**

Create `apps/web/test/e2e/admin/access-denied.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { signUpAndLogin } from '../utils/auth';

test('verified non-admin sees access denied at /admin', async ({
  page,
  baseURL,
}) => {
  await signUpAndLogin(page, baseURL!);

  await page.goto('/admin');

  await expect(
    page.getByRole('heading', { name: /access denied/i })
  ).toBeVisible();
  await expect(
    page.getByText(/current account does not have admin access/i)
  ).toBeVisible();
});
```

If the existing E2E helpers do not expose `signUpAndLogin` from `../utils/auth`, adapt this test to use the repo’s current `packages/test-utils` helpers.

- [ ] **Step 2: Add unauthenticated admin redirect E2E**

In `apps/web/test/e2e/admin/admin-auth.spec.ts`, add:

```ts
import { expect, test } from '@playwright/test';

test('unauthenticated admin protected route redirects to shared signin with admin intent', async ({
  page,
}) => {
  await page.goto('/admin/dashboard');

  await expect(page).toHaveURL(/\/signin/);
  await expect(page).toHaveURL(/redirect=%2Fadmin%2Fdashboard/);
});
```

- [ ] **Step 3: Run targeted E2E**

Run:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/admin/access-denied.spec.ts test/e2e/admin/admin-auth.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/web/test/e2e/admin
git commit -m "test(web): cover admin entry with single session"
```

### Task 4.3: Add Single-Cookie Sign-Out E2E

**Files:**

- Create or modify: `apps/web/test/e2e/admin/session-cookie.spec.ts`

- [ ] **Step 1: Add admin sign-out invalidates shared session test**

Create `apps/web/test/e2e/admin/session-cookie.spec.ts`:

```ts
import { E2E_PASSWORD, E2E_PLATFORM_ADMIN } from '@workspace/db-schema';
import { expect, test } from '@playwright/test';
import { signInSeededUser } from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';

test('signing out clears access to both admin and customer routes', async ({
  page,
  baseURL,
}) => {
  const { cookie } = await signInSeededUser(baseURL!, {
    email: E2E_PLATFORM_ADMIN.email,
    password: E2E_PASSWORD,
  });

  await page
    .context()
    .addCookies([parseCookieHeader(cookie, new URL(baseURL!).hostname)]);

  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/admin\/dashboard/);

  await page.getByRole('button', { name: /user menu/i }).click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();

  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/signin/);
  await expect(page).toHaveURL(/redirect=%2Fadmin%2Fdashboard/);

  await page.goto('/ws');
  await expect(page).toHaveURL(/\/signin/);
});
```

If the user menu controls have different accessible names, inspect `packages/components/src/layout/nav-user.tsx` and update the selectors to match the existing UI.

- [ ] **Step 2: Run targeted E2E**

Run:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/admin/session-cookie.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

Run:

```bash
git add apps/web/test/e2e/admin/session-cookie.spec.ts
git commit -m "test(web): verify shared session sign out"
```

---

## Phase 5: Unified Testing And Deployment Surface

### Task 5.1: Move Admin E2E Helpers Into Web

**Files:**

- Create: `apps/web/test/e2e/admin/fixtures/admin-auth.ts`
- Create: `apps/web/test/e2e/admin/fixtures/admin-fixtures.ts`
- Create: `apps/web/test/e2e/admin/fixtures/admin-navigation.ts`

- [ ] **Step 1: Copy admin fixtures**

Copy:

```txt
apps/admin/test/e2e/fixtures/admin-auth.ts
apps/admin/test/e2e/fixtures/admin-fixtures.ts
apps/admin/test/e2e/fixtures/admin-navigation.ts
```

to:

```txt
apps/web/test/e2e/admin/fixtures/
```

- [ ] **Step 2: Update admin auth fixture base URL**

In `apps/web/test/e2e/admin/fixtures/admin-auth.ts`, use the merged app base URL:

```ts
function getBaseUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
}
```

Keep `signInSeededUser(getBaseUrl(), ...)`.

- [ ] **Step 3: Update admin navigation helper paths**

In `apps/web/test/e2e/admin/fixtures/admin-navigation.ts`, prefix paths:

```ts
await page.goto(`/admin/users/${userId}`);
await page.waitForURL(new RegExp(`/admin/users/${userId}$`));
await page.goto('/admin/users');
await page.waitForURL(/\/admin\/users\/.+$/);
await page.goto(`/admin/workspaces/${workspaceId}`);
await page.waitForURL(new RegExp(`/admin/workspaces/${workspaceId}$`));
```

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
pnpm --filter @workspace/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/test/e2e/admin/fixtures
git commit -m "test(web): add admin e2e fixtures"
```

### Task 5.2: Move Admin E2E Specs Into Web Playwright

**Files:**

- Modify: `apps/web/playwright.config.ts`
- Move/copy: `apps/admin/test/e2e/*` to `apps/web/test/e2e/admin/*`
- Modify: `packages/test-utils/*` only if helpers need base URL or path updates

- [ ] **Step 1: Copy admin E2E specs**

Copy admin E2E specs into:

```txt
apps/web/test/e2e/admin/
```

Keep subfolders:

```txt
admin/auth/admin-entry.spec.ts
admin/navigation/admin-shell.spec.ts
admin/users/users-list.spec.ts
admin/users/user-detail.spec.ts
admin/users/user-edit.spec.ts
admin/users/user-dangerous-actions.spec.ts
admin/workspaces/workspaces-list.spec.ts
admin/workspaces/workspace-detail.spec.ts
admin/workspaces/workspace-entitlements.spec.ts
admin/workspaces/workspace-api-keys.spec.ts
```

- [ ] **Step 2: Update admin E2E paths**

Replace page navigations:

```txt
/dashboard  -> /admin/dashboard
/users      -> /admin/users
/workspaces -> /admin/workspaces
/signin     -> /signin?redirect=/admin/dashboard
```

- [ ] **Step 3: Update imports to web-local admin fixtures**

Replace imports from old fixture paths with:

```ts
import { signInAsPlatformAdmin } from '../fixtures/admin-auth';
import { adminFixtures } from '../fixtures/admin-fixtures';
import {
  openAdminUserDetail,
  openAdminUserDetailByEmail,
  openAdminWorkspaceDetail,
} from '../fixtures/admin-navigation';
```

Adjust relative paths according to the spec file folder depth.

- [ ] **Step 4: Update web Playwright config if needed**

`apps/web/playwright.config.ts` should continue to use:

```ts
testDir: './test/e2e';
```

No second web server should be added for admin. Admin specs run against the same base URL.

- [ ] **Step 5: Run merged admin E2E subset**

Run:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/admin
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/playwright.config.ts apps/web/test/e2e/admin packages/test-utils
git commit -m "test(web): run admin e2e in web app"
```

### Task 5.3: Move Admin Integration Tests Selectively

**Files:**

- Create/modify: `apps/web/test/integration/components/admin/*`
- Do not copy: duplicated shared account/auth primitive tests unless admin-specific behavior differs

- [ ] **Step 1: Move admin-specific integration flow**

Copy:

```txt
apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx
```

to:

```txt
apps/web/test/integration/components/admin/admin-user-management-flow.integration.test.tsx
```

- [ ] **Step 2: Update imports and expected paths**

Update imports to web-local modules. Any route expectations should use `/admin/*`.

- [ ] **Step 3: Decide whether auth integration tests are still needed**

Inspect:

```txt
apps/admin/test/integration/components/auth/signin-form.integration.test.tsx
apps/admin/test/integration/components/auth/signup-form.integration.test.tsx
```

Move them only if they assert admin-specific callback URLs such as `/admin/dashboard` or admin-specific messaging. Otherwise rely on existing web auth integration tests plus admin E2E.

- [ ] **Step 4: Run integration tests**

Run:

```bash
pnpm --filter @workspace/web test test/integration/components/admin
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/test/integration/components/admin
git commit -m "test(web): move admin integration coverage"
```

### Task 5.4: Update Root Scripts And Docs For Single App

**Files:**

- Modify: `package.json`
- Modify: `README.md`
- Modify: workflow/deployment files if present under `.github/workflows/`

- [ ] **Step 1: Update root scripts**

In `package.json`, keep web scripts and mark admin-specific scripts for removal only after `apps/admin` retirement. During transition, add a merged-app admin E2E script:

```json
"test:e2e:admin": "pnpm --filter @workspace/web test:e2e test/e2e/admin"
```

Keep:

```json
"test:e2e:web": "pnpm --filter @workspace/web test:e2e"
```

- [ ] **Step 2: Update README deployment language**

Change deployment docs to say one app deploy handles both customer and admin routes:

```md
The web app is the primary deployable application. Customer routes live at `/`
and workspace routes under `/ws`. Platform administration routes live under
`/admin` in the same TanStack Start app.
```

- [ ] **Step 3: Run script and docs checks**

Run:

```bash
pnpm run check:boundaries
pnpm --filter @workspace/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add package.json README.md .github/workflows
git commit -m "chore: document single app admin routes"
```

If `.github/workflows` does not exist or has no relevant changes, omit it from `git add`.

### Task 5.5: Establish Admin App Test Retirement Gate

**Files:**

- Modify: `docs/superpowers/specs/2026-04-23-single-app-admin-web-design.md` only if this gate changes during implementation

- [ ] **Step 1: Run migrated admin test suite in web**

Run:

```bash
pnpm --filter @workspace/web test test/unit/admin
pnpm --filter @workspace/web test test/unit/policy
pnpm --filter @workspace/web test test/unit/components/admin
pnpm --filter @workspace/web test test/integration/components/admin
pnpm --filter @workspace/web test:e2e test/e2e/admin
```

Expected: PASS.

- [ ] **Step 2: Run customer smoke coverage**

Run:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/auth/signin.spec.ts test/e2e/auth/signup.spec.ts
pnpm --filter @workspace/web test:e2e test/e2e/workspace/settings.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Record gate result in implementation notes**

If all checks pass, `apps/admin` can be retired in Phase 6. If any fail, do not delete `apps/admin`.

### Task 5.6: Add Customer No-Regression E2E Specs

**Files:**

- Create or modify: `apps/web/test/e2e/regression/customer-core.spec.ts`
- Update: `docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md`

- [ ] **Step 1: Add customer core regression spec**

Create `apps/web/test/e2e/regression/customer-core.spec.ts` with browser assertions that cover the customer flows most likely to regress during the app merge:

```ts
import { expect, test } from '@playwright/test';

test.describe('customer core regression', () => {
  test('keeps shared auth pages available', async ({ page }) => {
    await page.goto('/signin');
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    await page.goto('/signup');
    await expect(page).toHaveURL(/\/signup/);
    await expect(
      page.getByRole('button', { name: /sign up|create/i })
    ).toBeVisible();
  });

  test('keeps account and workspace routes protected by the shared session', async ({
    page,
  }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/signin/);

    await page.goto('/ws');
    await expect(page).toHaveURL(/\/signin/);
  });
});
```

If existing helpers already sign in seeded customer users, extend this spec with a signed-in workspace shell assertion instead of adding duplicate setup code.

- [ ] **Step 2: Run the customer regression spec**

Run:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/regression/customer-core.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Record evidence**

Append this row to `docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md`:

```md
| Customer core E2E | `pnpm --filter @workspace/web test:e2e test/e2e/regression/customer-core.spec.ts` | PASS | Playwright report path |
```

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/web/test/e2e/regression/customer-core.spec.ts docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md
git commit -m "test(web): add customer regression coverage"
```

### Task 5.7: Add Admin No-Regression E2E Specs

**Files:**

- Create or modify: `apps/web/test/e2e/admin/admin-core-regression.spec.ts`
- Update: `docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md`

- [ ] **Step 1: Add admin core regression spec**

Create `apps/web/test/e2e/admin/admin-core-regression.spec.ts` with assertions for the migrated admin entry points:

```ts
import { expect, test } from '@playwright/test';

test.describe('admin core regression', () => {
  test('redirects unauthenticated admin users to shared signin with admin intent', async ({
    page,
  }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/signin/);
    await expect(page).toHaveURL(
      /redirect=%2Fadmin%2Fdashboard|redirect=\/admin\/dashboard/
    );
  });

  test('does not expose admin-specific auth routes', async ({ page }) => {
    const signinResponse = await page.goto('/admin/signin');
    if (page.url().endsWith('/admin/signin')) {
      expect(signinResponse?.status()).toBe(404);
    } else {
      await expect(page).toHaveURL(/\/signin/);
    }

    const signupResponse = await page.goto('/admin/signup');
    if (page.url().endsWith('/admin/signup')) {
      expect(signupResponse?.status()).toBe(404);
    } else {
      await expect(page).toHaveURL(/\/signup|\/signin/);
    }
  });
});
```

Extend this spec with the existing seeded admin fixture after Task 5.1 exists:

```ts
test('loads core admin pages for a platform admin', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/admin\/users$/);
  await page.goto('/admin/workspaces');
  await expect(page).toHaveURL(/\/admin\/workspaces$/);
});
```

Use the real admin sign-in fixture in that test; do not fake authorization in the browser.

- [ ] **Step 2: Run the admin regression spec**

Run:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/admin/admin-core-regression.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Record evidence**

Append this row to `docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md`:

```md
| Admin core E2E | `pnpm --filter @workspace/web test:e2e test/e2e/admin/admin-core-regression.spec.ts` | PASS | Playwright report path |
```

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/web/test/e2e/admin/admin-core-regression.spec.ts docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md
git commit -m "test(web): add admin regression coverage"
```

### Task 5.8: Add Visual Regression Evidence Gate

**Files:**

- Create or modify: `apps/web/test/e2e/regression/visual-shells.spec.ts`
- Update: `docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md`

- [ ] **Step 1: Add shell screenshot checks**

Create `apps/web/test/e2e/regression/visual-shells.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test.describe('visual shell regression', () => {
  test('customer auth shell remains stable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/signin');
    await expect(page).toHaveScreenshot('customer-signin-shell.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });

  test('admin access denied shell remains stable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/admin/access-denied');
    await expect(page).toHaveScreenshot('admin-access-denied-shell.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
```

After seeded admin fixtures are available, add authenticated screenshots for `/admin/dashboard`, `/admin/users`, and `/admin/workspaces`.

- [ ] **Step 2: Generate or compare screenshots**

For first introduction of screenshots, run:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/regression/visual-shells.spec.ts --update-snapshots
```

For regression verification after snapshots exist, run:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/regression/visual-shells.spec.ts
```

Expected: PASS with committed screenshots or PASS against existing screenshots.

- [ ] **Step 3: Record evidence**

Append screenshot paths and command results to `docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md`.

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/web/test/e2e/regression/visual-shells.spec.ts apps/web/test/e2e docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md
git commit -m "test(web): add visual shell regression coverage"
```

### Task 5.9: Manual Product Smoke Sign-Off

**Files:**

- Update: `docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md`

- [ ] **Step 1: Start the merged web app**

Run:

```bash
pnpm dev:web
```

Expected: app starts and serves customer and admin routes from the same origin.

- [ ] **Step 2: Manually smoke customer UI**

Visit and verify:

```txt
/
/signin
/signup
/account
/ws
/ws/:workspaceId/overview
/ws/:workspaceId/settings
/billing
```

Record PASS/FAIL for layout, navigation, forms, and primary actions in the evidence file.

- [ ] **Step 3: Manually smoke admin UI**

Visit and verify:

```txt
/admin
/admin/access-denied
/admin/dashboard
/admin/users
/admin/users/:userId
/admin/workspaces
/admin/workspaces/:workspaceId
```

Record PASS/FAIL for layout, navigation, tables, filters, forms, and primary actions in the evidence file.

- [ ] **Step 4: Stop on any regression**

If any manual check fails, do not continue to Phase 6. Add a fix task before retiring `apps/admin`.

---

## Phase 6: Retire `apps/admin`

### Task 6.1: Remove Admin App Package

**Files:**

- Delete: `apps/admin/`
- Modify: `pnpm-workspace.yaml` if it explicitly lists apps
- Modify: `turbo.json` only if it references admin-specific tasks
- Modify: `package.json`
- Modify: `.dependency-cruiser.cjs`
- Modify: `tsconfig.json` or app references if needed

- [ ] **Step 1: Confirm merged app verification before deletion**

Run:

```bash
pnpm --filter @workspace/web typecheck
pnpm --filter @workspace/web lint
pnpm --filter @workspace/web test
pnpm --filter @workspace/web test:e2e test/e2e/admin
pnpm --filter @workspace/web test:e2e test/e2e/regression
```

Expected: PASS.

- [ ] **Step 2: Confirm regression evidence file is complete**

Open:

```txt
docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md
```

Expected: every baseline, during-migration, customer regression, admin regression, visual regression, and manual smoke row has a PASS result or a documented pre-existing failure. No blank result cells are allowed.

- [ ] **Step 3: Remove admin app directory**

Run:

```bash
git rm -r apps/admin
```

- [ ] **Step 4: Remove admin package references**

Update root scripts in `package.json`:

```json
"dev": "turbo run dev dev:stripe-webhook --filter @workspace/web",
"dev:web": "turbo run dev dev:stripe-webhook --filter @workspace/web",
"test:e2e:admin": "pnpm --filter @workspace/web test:e2e test/e2e/admin",
"test:e2e:web": "pnpm --filter @workspace/web test:e2e"
```

Remove:

```json
"dev:admin"
"start:admin"
"test:e2e:ui:admin"
"test:e2e:report:admin"
```

Adjust `.dependency-cruiser.cjs` path patterns from `apps/(web|admin)/src` to `apps/web/src` where appropriate.

- [ ] **Step 5: Run broad verification**

Run:

```bash
pnpm install --lockfile-only
pnpm run check:boundaries
pnpm run lint
pnpm run typecheck
pnpm test
pnpm --filter @workspace/web test:e2e test/e2e/regression
pnpm --filter @workspace/web test:e2e
pnpm run build
```

Expected: PASS.

- [ ] **Step 6: Record final no-regression evidence**

Append final command results to:

```txt
docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md
```

Expected: the final evidence table proves no UI or functionality regression with concrete command results and manual smoke status.

- [ ] **Step 7: Commit**

Run:

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .dependency-cruiser.cjs tsconfig.json docs/superpowers/evidence/2026-04-23-single-app-admin-web-regression.md
git commit -m "chore: retire standalone admin app"
```

If some listed files did not change, omit them from `git add`.

---

## Phase 7: Optional Simplification After Stabilization

### Task 7.1: Review Package Flattening Opportunities

**Files:**

- Read-only first:
  - `packages/components/src/*`
  - `packages/auth/src/*`
  - `packages/policy/src/*`
  - `packages/billing/src/*`

- [ ] **Step 1: Produce a package ownership report**

Run:

```bash
rg -n "@workspace/components|@workspace/auth|@workspace/policy|@workspace/billing" apps/web/src packages
```

Expected: identify package code that is truly app-only versus domain/shared.

- [ ] **Step 2: Keep domain packages**

Keep these packages unless a later design explicitly says otherwise:

```txt
packages/db
packages/db-schema
packages/policy
packages/billing
packages/ui
packages/auth
```

- [ ] **Step 3: Consider only app-composition moves**

Candidates for later moves:

```txt
packages/components/src/auth
packages/components/src/account
packages/components/src/layout
```

Only move a package folder if all consumers are now `apps/web` and the move reduces import indirection without weakening domain boundaries.

- [ ] **Step 4: Write a separate design before flattening**

Create a new spec before moving package code:

```txt
docs/superpowers/specs/YYYY-MM-DD-single-app-package-simplification-design.md
```

Do not combine this with the app merge.

---

## Final Verification Checklist

Definition of Done: no regression in visible UI or existing functionality, except for the intentional changes documented in the design spec:

- admin routes live under `/admin/*`,
- admin uses shared auth/account routes,
- there is one Better Auth session cookie,
- signed-in non-admin users see `/admin/access-denied`,
- `/health` and `/ping` are shared.

Run after all migration phases:

```bash
pnpm run check:boundaries
pnpm run lint
pnpm run typecheck
pnpm test
pnpm --filter @workspace/web test:e2e
pnpm run build
```

Expected: all PASS.

Targeted customer regression checks:

- `/` redirects into customer flow as before.
- `/signin` signs in a normal customer.
- `/signup` creates the same customer account flow as before.
- `/verify` and email verification still work with the E2E mock email helpers.
- `/accept-invite` still accepts workspace invitations.
- `/ws/:workspaceId/overview` loads for a customer workspace member.
- workspace sidebar, navigation, members, settings, and billing screens remain usable.
- `/account` loads shared account settings and notification preferences.

Targeted admin regression checks:

- `/admin` redirects unauthenticated users to `/signin` with admin redirect intent.
- `/admin` shows access denied for a signed-in non-admin user.
- `/admin/dashboard` loads for an admin user.
- `/admin/users` and `/admin/users/:userId` load for an admin user.
- `/admin/workspaces` and `/admin/workspaces/:workspaceId` load for an admin user.
- admin dashboard, sidebar, tables, filters, forms, and actions preserve the old admin UI behavior except for the `/admin/*` route prefix.
- Signing out clears access to both web and admin routes.
- `/health` and `/ping` work from the merged web app.

Playwright UI regression evidence:

- Keep or add screenshot-backed assertions for the customer workspace shell and admin shell.
- Check the admin users/workspaces table views at desktop size before deleting `apps/admin`.
- Check shared auth/account pages after admin auth routes are removed.
- Treat missing controls, broken layout, unreadable states, broken forms, or changed customer flows as blockers.

Functionality regression evidence:

- Existing customer auth, workspace, account, billing, and notification tests pass.
- Migrated admin dashboard/users/workspaces tests pass in `apps/web`.
- Admin access-denied and unauthenticated redirect E2E tests pass.
- Stripe webhook handling still terminates at the single `/api/auth/stripe/webhook` route.
- Root build and boundary checks pass after `apps/admin` references are removed.

Do not retire `apps/admin` until the regression checklist above is complete.

## Self-Review

Spec coverage:

- Runtime merge: covered by Phases 2 through 6.
- One cookie: covered by Phase 4.
- Access denied for non-admin users: covered by Phase 1 and Task 2.1.
- Route migration: covered by Phases 2 and 3.
- Testing/deployment simplification: covered by Phase 5.
- Package flattening deferred: covered by Phase 7.

Placeholder scan:

- No implementation task relies on unspecified future work.
- Route generation caveat is explicit because TanStack file-route names must be verified by the framework-generated route tree.

Type consistency:

- Admin entry kinds are `redirect`, `accessDenied`, and `canEnterAdminApp`.
- Admin route constants use `/admin/*`.
- The surviving runtime is consistently `@workspace/web`.
