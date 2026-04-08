# SF-28 Admin Cookie Prefix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Admin and Web browser sessions by giving the Admin Better Auth instance its own `admin` cookie prefix while leaving Web on Better Auth's default prefix.

**Architecture:** Keep `packages/auth` as the single Better Auth configuration boundary and add one optional `cookiePrefix` override to `AuthConfig`. Wire that override only from `apps/admin/src/init.ts`, then verify the change with focused unit tests and one small cross-app Playwright test that checks cookie names in the same browser context.

**Tech Stack:** TypeScript, Better Auth, TanStack Start, Vitest, Playwright, pnpm

---

## File Structure

- Modify: `packages/auth/src/auth.server.ts`
  Responsibility: shared Better Auth factory used by both apps.
- Modify: `packages/auth/test/unit/auth.server.test.ts`
  Responsibility: unit coverage for Better Auth config assembly.
- Modify: `apps/admin/src/init.ts`
  Responsibility: Admin bootstrap wiring for shared auth factory creation.
- Modify: `apps/admin/test/unit/init/init.test.ts`
  Responsibility: Admin app bootstrap regression coverage.
- Modify: `apps/web/test/unit/init/init.test.ts`
  Responsibility: Web bootstrap regression coverage proving no cookie override is added.
- Create: `apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts`
  Responsibility: focused cross-app browser regression proving Web and Admin cookies coexist with distinct names.

## Task 1: Add Shared Auth Cookie Prefix Support

**Files:**

- Modify: `packages/auth/src/auth.server.ts`
- Modify: `packages/auth/test/unit/auth.server.test.ts`

- [ ] **Step 1: Write the failing auth-factory unit assertions**

Add two focused tests to `packages/auth/test/unit/auth.server.test.ts` near the existing config assertions:

```ts
it('forwards advanced.cookiePrefix when provided', async () => {
  const createAuth = await importCreateAuth();

  createAuth(buildTestConfig({ cookiePrefix: 'admin' }));
  const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig & {
    advanced?: { cookiePrefix?: string };
  };

  expect(config.advanced?.cookiePrefix).toBe('admin');
});

it('does not set advanced.cookiePrefix when omitted', async () => {
  const createAuth = await importCreateAuth();

  createAuth(buildTestConfig());
  const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig & {
    advanced?: { cookiePrefix?: string };
  };

  expect(config.advanced?.cookiePrefix).toBeUndefined();
});
```

Also extend the imported `AuthConfig` test helper shape so `buildTestConfig({ cookiePrefix: 'admin' })` is type-valid.

- [ ] **Step 2: Run the focused auth unit test first**

Run:

```bash
pnpm --filter @workspace/auth test test/unit/auth.server.test.ts
```

Expected:

- FAIL because `AuthConfig` and `betterAuth(...)` do not yet support `cookiePrefix`.

- [ ] **Step 3: Add the minimal shared auth implementation**

Update `packages/auth/src/auth.server.ts` in two places:

```ts
export interface AuthConfig {
  db: Database;
  emailClient: EmailClient;
  baseUrl: string;
  secret: string;
  cookiePrefix?: string;
  google: {
    clientId: string;
    clientSecret: string;
  };
```

and inside `betterAuth({ ... })`:

```ts
  const advanced = config.cookiePrefix
    ? { cookiePrefix: config.cookiePrefix }
    : undefined;

  const auth = betterAuth({
    telemetry: {
      enabled: false,
    },
    advanced,
```

Keep the rest of the auth config unchanged.

- [ ] **Step 4: Re-run the auth unit test**

Run:

```bash
pnpm --filter @workspace/auth test test/unit/auth.server.test.ts
```

Expected:

- PASS with the new `advanced.cookiePrefix` assertions green.

- [ ] **Step 5: Commit the shared auth checkpoint**

```bash
git add packages/auth/src/auth.server.ts packages/auth/test/unit/auth.server.test.ts
git commit -m "feat(auth): support app-specific cookie prefixes"
```

## Task 2: Wire Admin To Use The Prefix And Lock App Bootstraps

**Files:**

- Modify: `apps/admin/src/init.ts`
- Modify: `apps/admin/test/unit/init/init.test.ts`
- Modify: `apps/web/test/unit/init/init.test.ts`

- [ ] **Step 1: Write the bootstrap expectations before changing app code**

Update `apps/admin/test/unit/init/init.test.ts` so the `createAuthMock` expectation includes:

```ts
cookiePrefix: 'admin',
```

Keep the rest of the expected object the same.

Update `apps/web/test/unit/init/init.test.ts` so the expectation remains unchanged and does **not** add `cookiePrefix`.

- [ ] **Step 2: Run the focused init tests before implementation**

Run:

```bash
pnpm --filter @workspace/admin-web test test/unit/init/init.test.ts
pnpm --filter @workspace/web test test/unit/init/init.test.ts
```

Expected:

- Admin init test FAILS because `cookiePrefix: 'admin'` is not yet passed.
- Web init test continues to PASS and serves as the no-regression baseline.

- [ ] **Step 3: Add the Admin-only bootstrap override**

Update `apps/admin/src/init.ts` so the `createAuth(...)` call includes:

```ts
    authSingleton = createAuth({
      db: getDb(),
      emailClient: getEmailClient(),
      baseUrl: process.env.BETTER_AUTH_URL!,
      secret: process.env.BETTER_AUTH_SECRET!,
      cookiePrefix: 'admin',
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
```

Leave `apps/web/src/init.ts` unchanged.

- [ ] **Step 4: Re-run the focused init tests**

Run:

```bash
pnpm --filter @workspace/admin-web test test/unit/init/init.test.ts
pnpm --filter @workspace/web test test/unit/init/init.test.ts
```

Expected:

- PASS for both test files.
- Admin proves the override is wired.
- Web proves the default prefix path remains untouched.

- [ ] **Step 5: Commit the app wiring checkpoint**

```bash
git add apps/admin/src/init.ts apps/admin/test/unit/init/init.test.ts apps/web/test/unit/init/init.test.ts
git commit -m "feat(admin): isolate admin auth cookies"
```

## Task 3: Add A Small Cross-App E2E Cookie Regression Test

**Files:**

- Create: `apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts`
- Verify: `apps/web/playwright.config.ts`
- Verify: `apps/admin/package.json`

- [ ] **Step 1: Write the targeted Playwright regression**

Create `apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts` with this structure:

```ts
import { expect, test } from '@playwright/test';
import {
  VALID_PASSWORD,
  createVerifiedUser,
  uniqueEmail,
} from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? 'http://localhost:3001';

test('web and admin sessions use distinct cookie names', async ({
  page,
  baseURL,
}) => {
  const email = uniqueEmail('admin-cookie-prefix');
  const webSession = await createVerifiedUser(baseURL!, {
    email,
    password: VALID_PASSWORD,
  });
  await page.context().addCookies(parseCookieHeader(webSession.cookie));

  const webCookieNames = (await page.context().cookies()).map(
    (cookie) => cookie.name
  );
  expect(webCookieNames.some((name) => name.startsWith('better-auth'))).toBe(
    true
  );

  const adminResponse = await page.request.post(
    `${ADMIN_BASE_URL}/api/auth/sign-in/email`,
    {
      headers: {
        'Content-Type': 'application/json',
        Origin: ADMIN_BASE_URL,
      },
      data: {
        email,
        password: VALID_PASSWORD,
        rememberMe: false,
      },
    }
  );

  expect(adminResponse.ok()).toBeTruthy();

  const cookieNames = (await page.context().cookies()).map(
    (cookie) => cookie.name
  );
  expect(cookieNames.some((name) => name.startsWith('better-auth'))).toBe(true);
  expect(cookieNames.some((name) => name.startsWith('admin'))).toBe(true);
});
```

Refine the assertions if the actual Better Auth cookie names include suffixes such as `.session_token` or `.session_data`, but keep the test focused on prefix separation only.

- [ ] **Step 2: Sanity-check the new spec file for naming and helper imports**

Run:

```bash
pnpm --filter @workspace/web test test/e2e/auth/admin-cookie-prefix.spec.ts --runInBand
```

Expected:

- This may fail in the sandboxed environment before the real browser run, but the test file should at least compile cleanly if Vitest picks it up incorrectly or if TypeScript reports import issues.
- If this command is noisy or not useful in this repo, skip it and rely on the Playwright run in the final verification task.

- [ ] **Step 3: Commit the E2E regression test**

```bash
git add apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts
git commit -m "test(web): cover admin and web cookie separation"
```

## Task 4: Final Verification

**Files:**

- Verify: `packages/auth/test/unit/auth.server.test.ts`
- Verify: `apps/admin/test/unit/init/init.test.ts`
- Verify: `apps/web/test/unit/init/init.test.ts`
- Verify: `apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts`

- [ ] **Step 1: Run the focused unit verification suite**

Run:

```bash
pnpm --filter @workspace/auth test test/unit/auth.server.test.ts
pnpm --filter @workspace/admin-web test test/unit/init/init.test.ts
pnpm --filter @workspace/web test test/unit/init/init.test.ts
```

Expected:

- PASS for all three focused unit test files.

- [ ] **Step 2: Start the Admin app outside the Codex sandbox**

Run this outside the sandbox in a separate terminal:

```bash
pnpm --filter @workspace/admin-web dev
```

Expected:

- Admin app serves on `http://localhost:3001`.

- [ ] **Step 3: Run the small Playwright regression outside the Codex sandbox**

Run this outside the sandbox:

```bash
ADMIN_BASE_URL=http://localhost:3001 pnpm run web:test:e2e:chromium -- test/e2e/auth/admin-cookie-prefix.spec.ts
```

Expected:

- PASS for the single targeted Chromium test.
- Browser context contains at least one Web cookie with the default `better-auth` prefix and at least one Admin cookie with the `admin` prefix.

- [ ] **Step 4: Capture the final diff**

Run:

```bash
git diff -- packages/auth/src/auth.server.ts packages/auth/test/unit/auth.server.test.ts apps/admin/src/init.ts apps/admin/test/unit/init/init.test.ts apps/web/test/unit/init/init.test.ts apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts
```

Expected:

- The diff is limited to the shared auth config, Admin bootstrap wiring, focused unit assertions, and the small Playwright regression.

- [ ] **Step 5: Create the final single commit if earlier checkpoints were skipped**

```bash
git add packages/auth/src/auth.server.ts packages/auth/test/unit/auth.server.test.ts apps/admin/src/init.ts apps/admin/test/unit/init/init.test.ts apps/web/test/unit/init/init.test.ts apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts
git commit -m "feat(admin): separate admin auth cookie namespace"
```

## Self-Review

### Spec Coverage

- Shared auth factory accepts an optional cookie prefix: covered in Task 1.
- Admin passes `cookiePrefix: 'admin'`: covered in Task 2.
- Web keeps the default prefix: covered in Task 2.
- Unit coverage proves the pass-through behavior: covered in Tasks 1 and 2.
- Small cross-app Playwright verification is included and explicitly marked to run outside the sandbox: covered in Task 4.

### Placeholder Scan

- No `TODO` or `TBD` markers.
- Every task includes exact files, commands, and expected outcomes.
- The sandbox constraint for Playwright execution is explicit.

### Type Consistency

- The plan consistently uses `cookiePrefix`, `advanced.cookiePrefix`, and `admin`.
- The E2E test uses the existing `parseCookieHeader` helper and Web Playwright suite layout.
