# Admin E2E Cookie Prefix Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move admin-specific cookie-prefix E2E coverage into a minimal `apps/admin` Playwright harness while keeping a Web-only cookie assertion in the Web suite.

**Architecture:** Keep the current SF-28 auth implementation intact and only reorganize test ownership. Narrow the existing Web Playwright spec to verify the Web session cookie contract, then add the smallest Admin Playwright setup needed to create a verified user, promote him to `admin` in the database, sign in to Admin, and run the single cross-app session coexistence check from the Admin suite.

**Tech Stack:** TypeScript, Playwright, Vite/TanStack Start, Better Auth, Drizzle ORM, pnpm

---

## File Structure

- Modify: `apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts`
  Responsibility: Web-only cookie-prefix regression that now asserts only the Web session cookie contract.
- Create: `apps/admin/playwright.config.ts`
  Responsibility: minimal Admin Playwright configuration, mirroring Web’s proven prebuilt-server E2E pattern.
- Modify: `apps/admin/package.json`
  Responsibility: add the minimal E2E scripts for Admin.
- Create: `apps/admin/test/e2e/global-setup.ts`
  Responsibility: fail-fast Admin E2E safety check and server reachability guard.
- Create: `apps/admin/test/e2e/auth/admin-cookie-prefix.spec.ts`
  Responsibility: Admin-owned cross-app session coexistence regression.
- Create: `apps/admin/test/e2e/lib/parse-cookie-header.ts`
  Responsibility: local cookie parsing helper for Admin E2E tests.
- Create: `apps/admin/test/e2e/lib/auth-helpers.ts`
  Responsibility: small Admin E2E utilities for response draining, verified-user creation via Web, and direct DB promotion to `admin`.

## Task 1: Narrow The Web E2E Test To Web-Only Behavior

**Files:**

- Modify: `apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts`

- [ ] **Step 1: Rewrite the Web test to only assert the Web session cookie**

Update `apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts` to this shape:

```ts
import { expect, test } from '@playwright/test';
import {
  VALID_PASSWORD,
  createVerifiedUser,
  uniqueEmail,
} from '@workspace/test-utils';
import { parseCookieHeader } from '../lib/parse-cookie-header';

const WEB_SESSION_COOKIE = 'better-auth.session_token';

test.describe('Web cookie prefix', () => {
  test('web sign-in emits the default web session cookie', async ({
    baseURL,
  }) => {
    const email = uniqueEmail('web-cookie-prefix');
    const { cookie } = await createVerifiedUser(baseURL!, {
      email,
      password: VALID_PASSWORD,
    });

    const cookieNames = parseCookieHeader(cookie).map((entry) => entry.name);

    expect(cookieNames).toContain(WEB_SESSION_COOKIE);
  });
});
```

- [ ] **Step 2: Run the single Web Playwright spec before touching Admin**

Run outside the sandbox:

```bash
pnpm run web:test:e2e:chromium -- test/e2e/auth/admin-cookie-prefix.spec.ts
```

Expected:

- PASS for the narrowed Web-only cookie assertion.

- [ ] **Step 3: Commit the Web-only test split**

```bash
git add apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts
git commit -m "test(web): narrow cookie prefix e2e to web session cookie"
```

## Task 2: Add Minimal Admin Playwright Infrastructure

**Files:**

- Create: `apps/admin/playwright.config.ts`
- Create: `apps/admin/test/e2e/global-setup.ts`
- Modify: `apps/admin/package.json`

- [ ] **Step 1: Add the Admin package scripts**

Update `apps/admin/package.json` scripts to include:

```json
{
  "build:e2e": "E2E_MOCK_EMAIL=true vite build",
  "test:e2e": "pnpm run build:e2e && playwright test",
  "test:e2e:chromium": "pnpm run build:e2e && playwright test --project=chromium",
  "test:e2e:report": "playwright show-report"
}
```

Keep the existing scripts unchanged.

- [ ] **Step 2: Add the Admin Playwright config**

Create `apps/admin/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  globalSetup: './test/e2e/global-setup.ts',
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node --env-file=.env .output/server/index.mjs',
      url: 'http://localhost:3001',
      reuseExistingServer: true,
      env: {
        PORT: '3001',
      },
      stderr: 'pipe',
    },
  ],
});
```

- [ ] **Step 3: Add the Admin global setup**

Create `apps/admin/test/e2e/global-setup.ts`:

```ts
import type { FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3001';

  let response: Response;
  try {
    response = await fetch(baseURL);
  } catch (error) {
    throw new Error(
      `E2E safeguard: Could not reach ${baseURL}. ` +
        `Is the Admin server running? (${error instanceof Error ? error.message : String(error)})`
    );
  }

  if (!response.ok) {
    throw new Error(
      `E2E safeguard failed: GET ${baseURL} returned ${response.status}.`
    );
  }

  await response.body?.cancel();
}
```

This keeps the first Admin harness small and explicit. Do not add broader setup logic yet.

- [ ] **Step 4: Run the smallest Admin config sanity checks**

Run:

```bash
pnpm --filter @workspace/admin-web exec eslint playwright.config.ts test/e2e/global-setup.ts
```

Expected:

- PASS with no lint errors for the new config files.

- [ ] **Step 5: Commit the Admin E2E harness skeleton**

```bash
git add apps/admin/package.json apps/admin/playwright.config.ts apps/admin/test/e2e/global-setup.ts
git commit -m "test(admin): add minimal playwright harness"
```

## Task 3: Add Admin E2E Helpers For Role Promotion And Cookie Parsing

**Files:**

- Create: `apps/admin/test/e2e/lib/parse-cookie-header.ts`
- Create: `apps/admin/test/e2e/lib/auth-helpers.ts`

- [ ] **Step 1: Add a local cookie parsing helper**

Create `apps/admin/test/e2e/lib/parse-cookie-header.ts` by mirroring the working Web helper:

```ts
type ParsedCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax';
};

function splitSetCookieHeader(raw: string): Array<string> {
  const setCookies: Array<string> = [];
  let current = '';

  for (const segment of raw.split(', ')) {
    const beforeSemicolon = segment.split(';')[0];
    if (current === '' || beforeSemicolon.includes('=')) {
      if (current) setCookies.push(current);
      current = segment;
    } else {
      current += `, ${segment}`;
    }
  }

  if (current) setCookies.push(current);

  return setCookies;
}

export function parseCookieHeader(
  raw: string,
  domain = 'localhost'
): Array<ParsedCookie> {
  return splitSetCookieHeader(raw).map((entry) => {
    const [nameValue] = entry.trim().split(';');
    const idx = nameValue.indexOf('=');
    return {
      name: nameValue.slice(0, idx).trim(),
      value: nameValue.slice(idx + 1).trim(),
      domain,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    };
  });
}
```

- [ ] **Step 2: Add the Admin auth/setup helper**

Create `apps/admin/test/e2e/lib/auth-helpers.ts`:

```ts
import { eq } from 'drizzle-orm';
import { createVerifiedUser } from '@workspace/test-utils';
import { createDb } from '@workspace/db';
import * as schema from '@workspace/db-schema';
import { user as userTable } from '@workspace/db-schema';

const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:3000';

const db = createDb(process.env.DATABASE_URL!, schema);

export async function drain(response: Response): Promise<void> {
  await response.body?.cancel();
}

export async function createVerifiedAdminCandidate(options: {
  email: string;
  password: string;
}) {
  return createVerifiedUser(WEB_BASE_URL, options);
}

export async function promoteUserToAdmin(userId: string): Promise<void> {
  await db
    .update(userTable)
    .set({ role: 'admin' })
    .where(eq(userTable.id, userId));
}
```

- [ ] **Step 3: Lint the new helper files**

Run:

```bash
pnpm --filter @workspace/admin-web exec eslint test/e2e/lib/parse-cookie-header.ts test/e2e/lib/auth-helpers.ts
```

Expected:

- PASS with no lint errors.

- [ ] **Step 4: Commit the helper layer**

```bash
git add apps/admin/test/e2e/lib/parse-cookie-header.ts apps/admin/test/e2e/lib/auth-helpers.ts
git commit -m "test(admin): add e2e auth setup helpers"
```

## Task 4: Add The Admin-Owned Cross-App Cookie Coexistence Test

**Files:**

- Create: `apps/admin/test/e2e/auth/admin-cookie-prefix.spec.ts`

- [ ] **Step 1: Write the Admin Playwright spec**

Create `apps/admin/test/e2e/auth/admin-cookie-prefix.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { VALID_PASSWORD, uniqueEmail } from '@workspace/test-utils';
import {
  createVerifiedAdminCandidate,
  drain,
  promoteUserToAdmin,
} from '../lib/auth-helpers';
import { parseCookieHeader } from '../lib/parse-cookie-header';

const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
const WEB_SESSION_COOKIE = 'better-auth.session_token';
const ADMIN_SESSION_COOKIE = 'admin.session_token';

test.describe('Admin cookie prefix', () => {
  test('web and admin session cookies coexist without collision', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('admin-cookie-prefix');
    const { userId, cookie: webCookie } = await createVerifiedAdminCandidate({
      email,
      password: VALID_PASSWORD,
    });

    await promoteUserToAdmin(userId);

    const webCookieNames = parseCookieHeader(webCookie).map(
      (cookie) => cookie.name
    );
    expect(webCookieNames).toContain(WEB_SESSION_COOKIE);

    await page.context().addCookies(parseCookieHeader(webCookie));

    const adminResponse = await fetch(`${baseURL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseURL!,
      },
      body: JSON.stringify({
        email,
        password: VALID_PASSWORD,
      }),
    });

    expect(adminResponse.ok).toBeTruthy();

    const adminCookie = adminResponse.headers.get('set-cookie') ?? '';
    const adminCookieNames = parseCookieHeader(adminCookie).map(
      (cookie) => cookie.name
    );

    expect(adminCookieNames).toContain(ADMIN_SESSION_COOKIE);
    expect(adminCookieNames).not.toContain(WEB_SESSION_COOKIE);

    await drain(adminResponse);

    await page.context().addCookies(parseCookieHeader(adminCookie));

    const cookieNames = (await page.context().cookies()).map(
      (cookie) => cookie.name
    );

    expect(cookieNames).toContain(WEB_SESSION_COOKIE);
    expect(cookieNames).toContain(ADMIN_SESSION_COOKIE);
  });
});
```

- [ ] **Step 2: Lint the new Admin spec**

Run:

```bash
pnpm --filter @workspace/admin-web exec eslint test/e2e/auth/admin-cookie-prefix.spec.ts
```

Expected:

- PASS with no lint errors.

- [ ] **Step 3: Commit the Admin cross-app spec**

```bash
git add apps/admin/test/e2e/auth/admin-cookie-prefix.spec.ts
git commit -m "test(admin): cover cross-app session cookie separation"
```

## Task 5: Final Verification

**Files:**

- Verify: `apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts`
- Verify: `apps/admin/playwright.config.ts`
- Verify: `apps/admin/test/e2e/global-setup.ts`
- Verify: `apps/admin/test/e2e/lib/auth-helpers.ts`
- Verify: `apps/admin/test/e2e/lib/parse-cookie-header.ts`
- Verify: `apps/admin/test/e2e/auth/admin-cookie-prefix.spec.ts`

- [ ] **Step 1: Run the Web cookie-prefix spec outside the sandbox**

Run:

```bash
pnpm run web:test:e2e:chromium -- test/e2e/auth/admin-cookie-prefix.spec.ts
```

Expected:

- PASS for the narrowed Web-only session-cookie assertion.

- [ ] **Step 2: Run the Admin Chromium E2E spec outside the sandbox**

Run:

```bash
pnpm --filter @workspace/admin-web test:e2e:chromium -- test/e2e/auth/admin-cookie-prefix.spec.ts
```

Expected:

- PASS for the Admin-owned coexistence regression.
- The test proves:
  - the generated user is elevated to `admin`
  - Admin emits `admin.session_token`
  - Admin does not emit `better-auth.session_token`
  - the Web and Admin session cookies coexist in one browser context

- [ ] **Step 3: Run focused lint for all touched E2E files**

Run:

```bash
pnpm --filter @workspace/admin-web exec eslint playwright.config.ts test/e2e/global-setup.ts test/e2e/lib/auth-helpers.ts test/e2e/lib/parse-cookie-header.ts test/e2e/auth/admin-cookie-prefix.spec.ts
pnpm --filter @workspace/web exec eslint test/e2e/auth/admin-cookie-prefix.spec.ts
```

Expected:

- PASS for both commands.

- [ ] **Step 4: Capture the final diff**

Run:

```bash
git diff -- apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts apps/admin/package.json apps/admin/playwright.config.ts apps/admin/test/e2e/global-setup.ts apps/admin/test/e2e/lib/auth-helpers.ts apps/admin/test/e2e/lib/parse-cookie-header.ts apps/admin/test/e2e/auth/admin-cookie-prefix.spec.ts
```

Expected:

- The diff shows:
  - Web test narrowed to Web-only behavior
  - Admin Playwright harness added
  - Admin helper files added
  - one Admin-owned coexistence regression added

- [ ] **Step 5: Create the final commit if previous checkpoints were skipped**

```bash
git add apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts apps/admin/package.json apps/admin/playwright.config.ts apps/admin/test/e2e/global-setup.ts apps/admin/test/e2e/lib/auth-helpers.ts apps/admin/test/e2e/lib/parse-cookie-header.ts apps/admin/test/e2e/auth/admin-cookie-prefix.spec.ts
git commit -m "test(admin): move cookie prefix e2e ownership"
```

## Self-Review

### Spec Coverage

- Web keeps a Web-only cookie-prefix assertion: covered in Task 1.
- Admin gets a minimal Playwright harness: covered in Task 2.
- Admin gets DB role promotion setup: covered in Task 3.
- The single cross-app coexistence check moves to Admin: covered in Task 4.
- Outside-sandbox E2E verification is explicit: covered in Task 5.

### Placeholder Scan

- No `TODO` or `TBD` markers.
- Each task contains exact files, commands, and expected outcomes.
- The Admin role-promotion requirement is explicit and testable.

### Type Consistency

- The plan consistently uses `better-auth.session_token` for Web and `admin.session_token` for Admin.
- The helper contract consistently returns `userId` and `cookie` from verified-user creation.
- The Admin E2E config and scripts consistently target port `3001`.
