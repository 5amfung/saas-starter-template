# SF-28 Admin Cookie Prefix Design

**Date:** 2026-04-07
**Goal:** Separate the Admin app session cookies from the Web app session cookies by configuring Better Auth `cookiePrefix: "admin"` for Admin only.
**Approach:** Extend the shared auth factory to accept an optional app-level `cookiePrefix` override, forward it to Better Auth through `advanced.cookiePrefix`, and set that override only in the Admin app bootstrap.
**Scope exclusion:** This design does not change Web cookie naming, auth flows, domains, session storage, or middleware behavior.

---

## 1. Context

Both [`apps/web/src/init.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/web/src/init.ts) and [`apps/admin/src/init.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/src/init.ts) create auth instances through the shared factory in [`packages/auth/src/auth.server.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/packages/auth/src/auth.server.ts).

Today those bootstraps pass the same shape of config into `createAuth(...)`, and the shared auth factory does not expose an app-specific cookie naming override.

Better Auth currently supports cookie namespace separation through `advanced.cookiePrefix`. Without an Admin-specific prefix, both apps use the default Better Auth cookie namespace and can read or overwrite the same browser session cookies.

## 2. Problem

Admin and Web should not share the same session cookie names.

When both apps use the same Better Auth cookie prefix:

- signing into one app can affect the other app's perceived session state
- logging out in one app can clear the other app's session cookies
- browser behavior becomes confusing when switching between Admin and Web in the same environment

The issue request is explicit: Admin should use `cookiePrefix: "admin"` and Web should keep the default prefix.

## 3. Objectives

1. Keep Web on Better Auth's default cookie prefix.
2. Give Admin its own cookie namespace using `admin`.
3. Preserve `packages/auth` as the single source of truth for auth configuration.
4. Keep the change minimal and local to auth bootstrap/config boundaries.
5. Add unit coverage that proves the override is passed only where intended.

## 4. Recommended Design

Add an optional `cookiePrefix?: string` field to the shared `AuthConfig` type in [`packages/auth/src/auth.server.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/packages/auth/src/auth.server.ts).

Inside `createAuth(config)`, forward the value to Better Auth through:

```ts
advanced: {
  ...(config.cookiePrefix ? { cookiePrefix: config.cookiePrefix } : {}),
}
```

or an equivalent conditional object assembly that omits `cookiePrefix` when no override is provided.

Then:

- update [`apps/admin/src/init.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/src/init.ts) to pass `cookiePrefix: 'admin'`
- leave [`apps/web/src/init.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/web/src/init.ts) unchanged

This keeps shared auth behavior centralized while making cookie namespace selection an explicit app bootstrap concern.

## 5. Why This Boundary Fits

The cookie collision is not caused by route logic, middleware, or database state. It is caused by how Better Auth names cookies when the auth instance is created.

That makes the shared auth factory the correct implementation boundary:

- `packages/auth` owns Better Auth configuration
- each app already owns its own `getAuth()` bootstrap call
- cookie prefix is app-specific configuration, not separate auth business logic

This avoids duplicating auth setup or introducing special-case Admin detection inside shared auth code.

## 6. Alternatives Considered

### Option A: Shared auth factory with optional app-level `cookiePrefix`

Recommended.

Benefits:

- minimal blast radius
- explicit and readable in Admin bootstrap
- keeps Web behavior unchanged
- preserves one shared auth implementation

Tradeoff:

- expands `AuthConfig` by one optional field

### Option B: Infer Admin mode inside `createAuth()` from `baseUrl` or env vars

Rejected.

Problems:

- hides app-specific behavior in shared logic
- makes the rule less obvious in tests and code review
- couples cookie behavior to deployment naming assumptions

### Option C: Override individual Better Auth cookie names directly

Rejected.

Problems:

- heavier than necessary for this issue
- more verbose and brittle than using the built-in prefix feature
- creates extra maintenance if Better Auth adds or changes cookie names

## 7. Expected File Changes

Implementation:

- [`packages/auth/src/auth.server.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/packages/auth/src/auth.server.ts)
- [`apps/admin/src/init.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/src/init.ts)

Tests:

- [`packages/auth/test/unit/auth.server.test.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/packages/auth/test/unit/auth.server.test.ts)
- [`apps/admin/test/unit/init/init.test.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/test/unit/init/init.test.ts)
- [`apps/web/test/unit/init/init.test.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/web/test/unit/init/init.test.ts)

## 8. Verification Plan

Minimum verification:

1. In auth unit tests, assert `advanced.cookiePrefix` is set to `'admin'` when `createAuth()` receives `{ cookiePrefix: 'admin' }`.
2. In auth unit tests, assert the field is omitted or undefined when no override is provided.
3. In Admin init tests, assert `createAuth(...)` is called with `cookiePrefix: 'admin'`.
4. In Web init tests, assert `createAuth(...)` is still called without a `cookiePrefix` override.
5. Run one small Playwright E2E test that signs into Web and Admin in the same browser context and verifies the session cookie names remain distinct.

E2E note:

- this repository's Playwright coverage currently provisions the Web app, not Admin, so the verification step should start Admin separately
- in this Codex environment, the Playwright E2E command must be run outside the sandbox
- the E2E should stay intentionally small and focused on cookie separation rather than broad auth coverage

The unit tests remain the primary proof that the config is wired correctly, while the small E2E test guards against accidental browser-level cookie collisions across the two apps.

## 9. Risks and Constraints

- Existing Admin sessions using the old default cookie names will no longer be reused after the change. Users may need to sign in again to Admin once after deployment.
- If there are any hidden assumptions elsewhere about Better Auth cookie names, those assumptions should be checked before adding hard-coded cookie assertions in new tests.
- This design intentionally avoids changing Web so the rollout risk stays focused on Admin session separation only.

## 10. Definition of Done

SF-28 is complete when:

- Admin passes `cookiePrefix: 'admin'` into the shared auth factory
- the shared auth factory forwards that override to Better Auth
- Web continues to use the default Better Auth cookie prefix
- the relevant unit tests prove the intended split
