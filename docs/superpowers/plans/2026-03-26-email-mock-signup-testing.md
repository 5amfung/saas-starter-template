# Email Mock & Sign-Up Flow Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable testing the full sign-up → email verification → workspace flow without real email access, using a mock email client with parallel-safe captured email retrieval.

**Architecture:** A `MockEmailClient` implements the existing `EmailClient` interface, storing emails in a `Map<string, CapturedEmail[]>` keyed by recipient. `init.ts` conditionally swaps the real Resend client for the mock when `NODE_ENV=test`. A test-only API route exposes captured emails to Playwright over HTTP, while Vitest tests import the mock directly.

**Tech Stack:** TypeScript, Better Auth, Resend (mocked), TanStack Start (file-based routes), Playwright (E2E), Vitest (integration), pnpm

**Spec:** `docs/superpowers/specs/2026-03-26-email-mock-signup-testing-design.md`

---

### Task 1: Create Mock Email Client

**Files:**

- Create: `packages/email/src/mock-email-client.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/email/test/unit/mock-email-client.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { createMockEmailClient } from '../src/mock-email-client';
import { createElement } from 'react';
import type { MockEmailClient } from '../src/mock-email-client';

describe('createMockEmailClient', () => {
  let client: MockEmailClient;

  beforeEach(() => {
    client = createMockEmailClient({ appName: 'TestApp' });
  });

  it('captures a sent email and retrieves it by recipient', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'Hello',
      react: createElement('div', null, 'test'),
    });

    const emails = client.getEmailsFor('alice@test.com');
    expect(emails).toHaveLength(1);
    expect(emails[0]!.to).toBe('alice@test.com');
    expect(emails[0]!.subject).toBe('Hello');
    expect(emails[0]!.sentAt).toBeInstanceOf(Date);
  });

  it('returns empty array for unknown recipient', () => {
    const emails = client.getEmailsFor('nobody@test.com');
    expect(emails).toEqual([]);
  });

  it('isolates emails by recipient', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'For Alice',
      react: createElement('div', null, 'alice'),
    });
    await client.sendEmail({
      to: 'bob@test.com',
      subject: 'For Bob',
      react: createElement('div', null, 'bob'),
    });

    expect(client.getEmailsFor('alice@test.com')).toHaveLength(1);
    expect(client.getEmailsFor('bob@test.com')).toHaveLength(1);
    expect(client.getEmailsFor('alice@test.com')[0]!.subject).toBe('For Alice');
  });

  it('clearEmailsFor removes only that recipient', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'For Alice',
      react: createElement('div', null, 'alice'),
    });
    await client.sendEmail({
      to: 'bob@test.com',
      subject: 'For Bob',
      react: createElement('div', null, 'bob'),
    });

    client.clearEmailsFor('alice@test.com');

    expect(client.getEmailsFor('alice@test.com')).toEqual([]);
    expect(client.getEmailsFor('bob@test.com')).toHaveLength(1);
  });

  it('clearEmails removes all emails', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'For Alice',
      react: createElement('div', null, 'alice'),
    });
    await client.sendEmail({
      to: 'bob@test.com',
      subject: 'For Bob',
      react: createElement('div', null, 'bob'),
    });

    client.clearEmails();

    expect(client.getAllEmails()).toEqual([]);
  });

  it('getAllEmails returns all captured emails', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'One',
      react: createElement('div', null, '1'),
    });
    await client.sendEmail({
      to: 'bob@test.com',
      subject: 'Two',
      react: createElement('div', null, '2'),
    });

    expect(client.getAllEmails()).toHaveLength(2);
  });

  it('orders emails by sentAt', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'First',
      react: createElement('div', null, '1'),
    });
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'Second',
      react: createElement('div', null, '2'),
    });

    const emails = client.getEmailsFor('alice@test.com');
    expect(emails).toHaveLength(2);
    expect(emails[0]!.subject).toBe('First');
    expect(emails[1]!.subject).toBe('Second');
    expect(emails[0]!.sentAt.getTime()).toBeLessThanOrEqual(
      emails[1]!.sentAt.getTime()
    );
  });

  it('handles array of recipients', async () => {
    await client.sendEmail({
      to: ['alice@test.com', 'bob@test.com'],
      subject: 'Group',
      react: createElement('div', null, 'group'),
    });

    expect(client.getEmailsFor('alice@test.com')).toHaveLength(1);
    expect(client.getEmailsFor('bob@test.com')).toHaveLength(1);
  });

  it('exposes config with appName', () => {
    expect(client.config.appName).toBe('TestApp');
  });

  it('returns an object with id from sendEmail', async () => {
    const result = await client.sendEmail({
      to: 'alice@test.com',
      subject: 'Hello',
      react: createElement('div', null, 'test'),
    });

    expect(result).toHaveProperty('id');
    expect(typeof result!.id).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/email test test/unit/mock-email-client.test.ts`
Expected: FAIL — `mock-email-client` module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/email/src/mock-email-client.ts`:

```ts
import type { ReactElement } from 'react';
import type {
  EmailClient,
  EmailConfig,
  SendEmailOptions,
} from './resend.server';

export interface CapturedEmail {
  to: string;
  subject: string;
  react: ReactElement;
  sentAt: Date;
}

export interface MockEmailClient extends EmailClient {
  getEmailsFor(recipientEmail: string): CapturedEmail[];
  clearEmailsFor(recipientEmail: string): void;
  getAllEmails(): CapturedEmail[];
  clearEmails(): void;
}

interface MockEmailClientConfig {
  appName: string;
}

export function createMockEmailClient(
  mockConfig: MockEmailClientConfig
): MockEmailClient {
  const store = new Map<string, CapturedEmail[]>();

  const config: EmailConfig = {
    apiKey: 'mock-api-key',
    fromEmail: 'test@example.com',
    appName: mockConfig.appName,
  };

  function addEmail(to: string, subject: string, react: ReactElement): void {
    const entry: CapturedEmail = { to, subject, react, sentAt: new Date() };
    const existing = store.get(to);
    if (existing) {
      existing.push(entry);
    } else {
      store.set(to, [entry]);
    }
  }

  return {
    config,

    async sendEmail({ to, subject, react }: SendEmailOptions) {
      const recipients = Array.isArray(to) ? to : [to];
      for (const recipient of recipients) {
        addEmail(recipient, subject, react);
      }
      return {
        id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
    },

    getEmailsFor(recipientEmail: string): CapturedEmail[] {
      return store.get(recipientEmail) ?? [];
    },

    clearEmailsFor(recipientEmail: string): void {
      store.delete(recipientEmail);
    },

    getAllEmails(): CapturedEmail[] {
      return Array.from(store.values()).flat();
    },

    clearEmails(): void {
      store.clear();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/email test test/unit/mock-email-client.test.ts`
Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/email/src/mock-email-client.ts packages/email/test/unit/mock-email-client.test.ts
git commit -m "feat(email): add mock email client with parallel-safe in-memory store"
```

---

### Task 2: Export Mock Email Client from Package

**Files:**

- Modify: `packages/email/src/index.ts`

- [ ] **Step 1: Add re-export in index.ts**

Add to `packages/email/src/index.ts`:

```ts
export {
  createMockEmailClient,
  type CapturedEmail,
  type MockEmailClient,
} from './mock-email-client';
```

The full file should be:

```ts
export {
  createEmailClient,
  type EmailConfig,
  type EmailClient,
  type SendEmailOptions,
} from './resend.server';
export {
  buildEmailRequestContext,
  type EmailRequestContext,
} from './request-context';
export {
  createMockEmailClient,
  type CapturedEmail,
  type MockEmailClient,
} from './mock-email-client';
```

- [ ] **Step 2: Run typecheck to verify exports compile**

Run: `pnpm --filter @workspace/email typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/email/src/index.ts
git commit -m "feat(email): export mock email client from package"
```

---

### Task 3: Wire Mock Email Client into init.ts

**Files:**

- Modify: `apps/web/src/init.ts`

- [ ] **Step 1: Update init.ts with conditional email client creation**

Replace lines 4 and 9-15 in `apps/web/src/init.ts`. The full file should become:

```ts
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createAuth } from '@workspace/auth/server';
import { createDb } from '@workspace/db';
import { createEmailClient, createMockEmailClient } from '@workspace/email';
import { logger } from '@/lib/logger';

export const db = createDb(process.env.DATABASE_URL!);

export const emailClient =
  process.env.NODE_ENV === 'test'
    ? createMockEmailClient({ appName: process.env.VITE_APP_NAME || 'App' })
    : createEmailClient({
        apiKey: process.env.RESEND_API_KEY!,
        fromEmail: process.env.RESEND_FROM_EMAIL!,
        replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
        appName: process.env.VITE_APP_NAME || 'App',
        devPrefix: process.env.NODE_ENV !== 'production',
      });

export const auth = createAuth({
  db,
  emailClient,
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
  logger,
  getRequestHeaders,
});
```

- [ ] **Step 2: Run typecheck to verify the conditional compiles**

Run: `pnpm --filter @workspace/web typecheck`
Expected: No errors. Both `createEmailClient` and `createMockEmailClient` return `EmailClient`-compatible types.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/init.ts
git commit -m "feat(web): conditionally use mock email client in test mode"
```

---

### Task 4: Create Test Email API Route

**Files:**

- Create: `apps/web/src/routes/api/test/emails.ts`

- [ ] **Step 1: Write the route**

Create `apps/web/src/routes/api/test/emails.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router';
import type { MockEmailClient } from '@workspace/email';
import { emailClient } from '@/init';

function isMockEmailClient(client: unknown): client is MockEmailClient {
  return (
    typeof client === 'object' &&
    client !== null &&
    'getEmailsFor' in client &&
    typeof (client as MockEmailClient).getEmailsFor === 'function'
  );
}

function handleGet(request: Request): Response {
  if (process.env.NODE_ENV !== 'test' || !isMockEmailClient(emailClient)) {
    return new Response('Not Found', { status: 404 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get('to');

  if (!to) {
    return Response.json(
      { error: 'Missing required query parameter: to' },
      { status: 400 }
    );
  }

  const emails = emailClient.getEmailsFor(to).map((email) => ({
    to: email.to,
    subject: email.subject,
    verificationUrl:
      email.react && typeof email.react === 'object' && 'props' in email.react
        ? ((email.react as { props?: { verificationUrl?: string } }).props
            ?.verificationUrl ?? null)
        : null,
    sentAt: email.sentAt.toISOString(),
  }));

  return Response.json({ emails });
}

function handleDelete(request: Request): Response {
  if (process.env.NODE_ENV !== 'test' || !isMockEmailClient(emailClient)) {
    return new Response('Not Found', { status: 404 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get('to');

  if (!to) {
    return Response.json(
      { error: 'Missing required query parameter: to' },
      { status: 400 }
    );
  }

  emailClient.clearEmailsFor(to);
  return Response.json({ cleared: true });
}

export const Route = createFileRoute('/api/test/emails')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handleGet(request),
      DELETE: async ({ request }: { request: Request }) =>
        handleDelete(request),
    },
  },
});
```

- [ ] **Step 2: Run the TanStack Router code generation to update the route tree**

Run: `pnpm --filter @workspace/web dev &` then wait a few seconds for the route tree to regenerate, then stop the dev server. Or if there is a dedicated generate command, use that. Check that `apps/web/src/routeTree.gen.ts` now includes the `/api/test/emails` route.

Alternatively, run: `pnpm --filter @workspace/web typecheck`
The router plugin should auto-generate route tree entries during type-checking.

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter @workspace/web typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/api/test/emails.ts apps/web/src/routeTree.gen.ts
git commit -m "feat(web): add test-only API route for captured emails"
```

---

### Task 5: Create Auth Helpers in test-utils

**Files:**

- Create: `packages/test-utils/src/auth-helpers.ts`
- Modify: `packages/test-utils/src/index.ts`

- [ ] **Step 1: Write the auth helpers**

Create `packages/test-utils/src/auth-helpers.ts`:

```ts
interface CreateVerifiedUserOptions {
  email: string;
  password: string;
  name?: string;
}

interface CreateVerifiedUserResult {
  userId: string;
  cookie: string;
}

/**
 * Signs up a new user and immediately verifies their email via the admin API.
 * Returns the session cookie for use in Playwright tests.
 *
 * Requires:
 * - The test server running with NODE_ENV=test
 * - A test admin user already created (adminEmail/adminPassword)
 */
export async function createVerifiedUser(
  baseUrl: string,
  options: CreateVerifiedUserOptions,
  admin: { email: string; password: string }
): Promise<CreateVerifiedUserResult> {
  // Step 1: Sign up the new user.
  const signupResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: options.email,
      password: options.password,
      name: options.name ?? options.email.split('@')[0],
    }),
  });

  if (!signupResponse.ok) {
    const body = await signupResponse.text();
    throw new Error(`Sign-up failed (${signupResponse.status}): ${body}`);
  }

  const signupData = (await signupResponse.json()) as {
    user?: { id?: string };
  };
  const userId = signupData.user?.id;
  if (!userId) {
    throw new Error('Sign-up response did not include user ID');
  }

  // Step 2: Sign in as admin.
  const adminSigninResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: admin.email,
      password: admin.password,
    }),
  });

  if (!adminSigninResponse.ok) {
    const body = await adminSigninResponse.text();
    throw new Error(
      `Admin sign-in failed (${adminSigninResponse.status}): ${body}`
    );
  }

  const adminCookies = adminSigninResponse.headers.get('set-cookie') ?? '';

  // Step 3: Use admin API to verify the user's email.
  const verifyResponse = await fetch(`${baseUrl}/api/auth/admin/update-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookies,
    },
    body: JSON.stringify({
      userId,
      data: { emailVerified: true },
    }),
  });

  if (!verifyResponse.ok) {
    const body = await verifyResponse.text();
    throw new Error(
      `Admin verify user failed (${verifyResponse.status}): ${body}`
    );
  }

  // Step 4: Sign in as the verified user to get their session cookie.
  const userSigninResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: options.email,
      password: options.password,
    }),
  });

  if (!userSigninResponse.ok) {
    const body = await userSigninResponse.text();
    throw new Error(
      `User sign-in after verify failed (${userSigninResponse.status}): ${body}`
    );
  }

  const userCookie = userSigninResponse.headers.get('set-cookie') ?? '';

  return { userId, cookie: userCookie };
}
```

- [ ] **Step 2: Add re-export in index.ts**

Update `packages/test-utils/src/index.ts` to:

```ts
export * from './factories';
export * from './render';
export { createVerifiedUser } from './auth-helpers';
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @workspace/test-utils typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/test-utils/src/auth-helpers.ts packages/test-utils/src/index.ts
git commit -m "feat(test-utils): add createVerifiedUser helper for E2E tests"
```

---

### Task 6: Update Playwright Config

**Files:**

- Modify: `apps/web/playwright.config.ts`

- [ ] **Step 1: Enable baseURL and webServer in Playwright config**

The current config has `baseURL` and `webServer` commented out. Update `apps/web/playwright.config.ts` to enable them:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
    },
  },
});
```

Key changes:

- Uncommented `baseURL: 'http://localhost:3000'`
- Uncommented and configured `webServer` block with `NODE_ENV: 'test'` so the dev server starts with the mock email client

- [ ] **Step 2: Commit**

```bash
git add apps/web/playwright.config.ts
git commit -m "feat(web): configure Playwright with baseURL and webServer"
```

---

### Task 7: Write E2E Sign-Up Tests

**Files:**

- Create: `apps/web/test/e2e/auth/signup.spec.ts`

- [ ] **Step 1: Write the E2E test file**

Create `apps/web/test/e2e/auth/signup.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

/** Generate a unique email for each test to avoid parallel collisions. */
function uniqueEmail(): string {
  return `test-signup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
}

const VALID_PASSWORD = 'TestPassword123!';

/**
 * Fetches captured emails from the test-only API route.
 * Retries up to maxRetries times with a delay, since the email
 * may not be captured instantly after form submission.
 */
async function getTestEmails(
  baseURL: string,
  to: string,
  maxRetries = 5
): Promise<
  Array<{
    to: string;
    subject: string;
    verificationUrl: string | null;
    sentAt: string;
  }>
> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(
      `${baseURL}/api/test/emails?to=${encodeURIComponent(to)}`
    );
    const data = (await response.json()) as {
      emails: Array<{
        to: string;
        subject: string;
        verificationUrl: string | null;
        sentAt: string;
      }>;
    };
    if (data.emails.length > 0) return data.emails;
    await new Promise((r) => setTimeout(r, 500));
  }
  return [];
}

test.describe('Sign-up flow', () => {
  test('happy path: sign up, verify email, reach workspace', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail();

    // Navigate to sign-up page.
    await page.goto('/signup');
    await expect(
      page.getByRole('heading', { name: 'Create your account' })
    ).toBeVisible();

    // Fill out the form.
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirm Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should navigate to verify page.
    await expect(page).toHaveURL(/\/verify/);
    await expect(page.getByText('Check your email')).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Fetch the verification URL from the test email API.
    const emails = await getTestEmails(baseURL!, email);
    expect(emails).toHaveLength(1);
    expect(emails[0]!.subject).toBe('Verify your email address');
    expect(emails[0]!.verificationUrl).toBeTruthy();

    // Visit the verification URL.
    await page.goto(emails[0]!.verificationUrl!);

    // Should auto-sign in and redirect to workspace.
    await page.waitForURL(/\/ws\/.*\/overview/, { timeout: 10000 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('duplicate email shows error', async ({ page }) => {
    const email = uniqueEmail();

    // Sign up first time.
    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirm Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/verify/);

    // Sign up second time with same email.
    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirm Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should show duplicate error.
    await expect(
      page.getByText('An account with this email already exists')
    ).toBeVisible();
  });

  test('weak password shows validation error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Confirm Password').fill('short');
    await page.getByLabel('Password', { exact: true }).blur();

    // Should show password length error.
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test('password mismatch shows validation error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirm Password').fill('DifferentPassword123!');
    await page.getByLabel('Confirm Password').blur();

    // Should show mismatch error.
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('resend verification email captures a second email', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail();

    // Sign up.
    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel('Confirm Password').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(/\/verify/);

    // Wait for first email to be captured.
    let emails = await getTestEmails(baseURL!, email);
    expect(emails.length).toBeGreaterThanOrEqual(1);
    const firstCount = emails.length;

    // Click resend.
    await page
      .getByRole('button', { name: 'Resend verification email' })
      .click();

    // Wait for a second email to appear.
    const maxWait = 10;
    for (let i = 0; i < maxWait; i++) {
      emails = await getTestEmails(baseURL!, email);
      if (emails.length > firstCount) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(emails.length).toBeGreaterThan(firstCount);
  });

  test('invalid verification link shows error or redirects', async ({
    page,
  }) => {
    // Visit a malformed verification URL.
    await page.goto(
      '/api/auth/verify-email?token=invalid-token-12345&callbackURL=/ws'
    );

    // Better Auth should reject the invalid token.
    // The exact behavior depends on Better Auth's error handling —
    // it may redirect to an error page or show an error message.
    // We just verify the user does NOT end up on the workspace dashboard.
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toMatch(/\/ws\/.*\/overview/);
  });
});
```

- [ ] **Step 2: Run the E2E tests**

Run: `pnpm --filter @workspace/web test:e2e test/e2e/auth/signup.spec.ts`
Expected: All 6 tests PASS (this requires the dev server to start with `NODE_ENV=test` via the Playwright webServer config from Task 6).

Note: If the tests fail due to the webServer not starting properly or environment variables not being set, you may need to create a `.env.test` file or adjust the webServer config. Debug any failures individually.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/e2e/auth/signup.spec.ts
git commit -m "test(e2e): add sign-up flow tests with email verification"
```

---

### Task 8: Write Integration Tests for Mock Email Infrastructure

**Files:**

- Create: `apps/web/test/integration/components/auth/signup-verification-flow.integration.test.tsx`

- [ ] **Step 1: Write the integration test file**

Create `apps/web/test/integration/components/auth/signup-verification-flow.integration.test.tsx`:

```ts
import { createElement } from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { createMockEmailClient } from '@workspace/email';
import type { MockEmailClient } from '@workspace/email';

describe('Mock email client integration', () => {
  let client: MockEmailClient;

  beforeEach(() => {
    client = createMockEmailClient({ appName: 'TestApp' });
  });

  it('captures verification email with correct URL and subject', async () => {
    const verificationUrl =
      'http://localhost:3000/api/auth/verify-email?token=abc123&callbackURL=/ws';

    await client.sendEmail({
      to: 'user@test.com',
      subject: 'Verify your email address',
      react: createElement('div', { verificationUrl }, 'Verify'),
    });

    const emails = client.getEmailsFor('user@test.com');
    expect(emails).toHaveLength(1);
    expect(emails[0]!.subject).toBe('Verify your email address');
    expect(emails[0]!.react.props.verificationUrl).toBe(verificationUrl);
  });

  it('verification URL contains token and callbackURL params', async () => {
    const verificationUrl =
      'http://localhost:3000/api/auth/verify-email?token=test-token-xyz&callbackURL=%2Fws';

    await client.sendEmail({
      to: 'user@test.com',
      subject: 'Verify your email address',
      react: createElement('div', { verificationUrl }, 'Verify'),
    });

    const emails = client.getEmailsFor('user@test.com');
    const url = new URL(emails[0]!.react.props.verificationUrl as string);
    expect(url.searchParams.get('token')).toBe('test-token-xyz');
    expect(url.searchParams.get('callbackURL')).toBe('/ws');
  });

  it('isolates emails between different recipients', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'For Alice',
      react: createElement('div', null, 'alice'),
    });
    await client.sendEmail({
      to: 'bob@test.com',
      subject: 'For Bob',
      react: createElement('div', null, 'bob'),
    });

    const aliceEmails = client.getEmailsFor('alice@test.com');
    const bobEmails = client.getEmailsFor('bob@test.com');

    expect(aliceEmails).toHaveLength(1);
    expect(bobEmails).toHaveLength(1);
    expect(aliceEmails[0]!.subject).toBe('For Alice');
    expect(bobEmails[0]!.subject).toBe('For Bob');
  });

  it('clearEmailsFor removes only that recipient, others intact', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'For Alice',
      react: createElement('div', null, 'alice'),
    });
    await client.sendEmail({
      to: 'bob@test.com',
      subject: 'For Bob',
      react: createElement('div', null, 'bob'),
    });

    client.clearEmailsFor('alice@test.com');

    expect(client.getEmailsFor('alice@test.com')).toEqual([]);
    expect(client.getEmailsFor('bob@test.com')).toHaveLength(1);
    expect(client.getEmailsFor('bob@test.com')[0]!.subject).toBe('For Bob');
  });

  it('clearEmails removes entire store (Vitest-safe, separate process)', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'For Alice',
      react: createElement('div', null, 'alice'),
    });
    await client.sendEmail({
      to: 'bob@test.com',
      subject: 'For Bob',
      react: createElement('div', null, 'bob'),
    });

    client.clearEmails();

    expect(client.getAllEmails()).toEqual([]);
    expect(client.getEmailsFor('alice@test.com')).toEqual([]);
    expect(client.getEmailsFor('bob@test.com')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the integration tests**

Run: `pnpm --filter @workspace/web test test/integration/components/auth/signup-verification-flow.integration.test.tsx`
Expected: All 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/integration/components/auth/signup-verification-flow.integration.test.tsx
git commit -m "test(integration): add mock email infrastructure validation tests"
```

---

### Task 9: Run Full Test Suite and Verify No Regressions

- [ ] **Step 1: Run existing unit and integration tests**

Run: `pnpm test`
Expected: All existing tests still pass. The new `init.ts` conditional should not affect any existing tests since they mock their dependencies.

- [ ] **Step 2: Run typecheck across the entire monorepo**

Run: `pnpm run typecheck`
Expected: No type errors.

- [ ] **Step 3: Run lint**

Run: `pnpm run lint`
Expected: No lint errors. Fix any issues if found.

- [ ] **Step 4: Commit any fixes if needed**

If any fixes were needed:

```bash
git add -A
git commit -m "fix: resolve lint/type issues from email mock integration"
```
