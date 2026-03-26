# Email Mock & Sign-Up Flow Testing

## Problem

The user sign-up flow requires email verification before a user can access protected routes. E2E and integration tests cannot access real emails sent via Resend, making it impossible to test the full sign-up → verify → workspace flow.

## Solution

Replace the real Resend email client with an in-memory mock implementation in test environments. Captured emails (including verification URLs) are accessible via a test-only API endpoint for Playwright and via direct import for Vitest.

A separate admin-API-based utility provides a fast "create verified user" shortcut for tests that need an authenticated user but aren't testing the sign-up flow.

## Architecture

### Component Overview

| Component            | Location                                                                                  | Purpose                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Mock Email Client    | `packages/email/src/mock-email-client.ts`                                                 | In-memory `EmailClient` implementation; stores emails keyed by recipient |
| Test Email API Route | `apps/web/src/routes/api/test/emails.ts`                                                  | Exposes captured emails to Playwright via HTTP                           |
| Conditional Wiring   | `apps/web/src/init.ts`                                                                    | Swaps real → mock email client when `NODE_ENV === 'test'`                |
| Auth Helpers         | `packages/test-utils/src/auth-helpers.ts`                                                 | `createVerifiedUser()` for non-signup tests                              |
| E2E Signup Tests     | `apps/web/test/e2e/auth/signup.spec.ts`                                                   | Full browser-driven sign-up flow tests                                   |
| Integration Tests    | `apps/web/test/integration/components/auth/signup-verification-flow.integration.test.tsx` | Mock email infrastructure validation                                     |

### Mock Email Client (`packages/email/src/mock-email-client.ts`)

Implements the existing `EmailClient` interface from `packages/email/src/resend.server.ts`.

**Parallel-safe design:** Emails are stored in a `Map<string, CapturedEmail[]>` keyed by recipient email address. Each test uses a unique email (e.g., `test-signup-${Date.now()}@example.com`), so parallel tests are naturally isolated.

```ts
interface CapturedEmail {
  to: string;
  subject: string;
  react: ReactElement;
  sentAt: Date;
}

interface MockEmailClient extends EmailClient {
  getEmailsFor(recipientEmail: string): CapturedEmail[];
  clearEmailsFor(recipientEmail: string): void;
  getAllEmails(): CapturedEmail[];
  clearEmails(): void;
}
```

Key behaviors:

- `sendEmail()` stores the email in the map instead of calling Resend.
- `getEmailsFor(email)` returns only that recipient's emails, ordered by `sentAt`.
- `clearEmailsFor(email)` removes only that recipient's emails — safe for parallel E2E tests.
- `clearEmails()` empties the entire store — only safe in Vitest (each worker has its own process/instance). Never exposed via the E2E API route.
- `config` returns a static test config (no real API key needed).

**Parallel safety note:** In Playwright E2E tests, all workers share a single server process and therefore a single `MockEmailClient` instance. Global `clearEmails()` would wipe other workers' captured emails. The design avoids this by: (1) each test using a unique recipient email for natural isolation, and (2) only exposing per-recipient `clearEmailsFor()` via the HTTP API. In Vitest, each worker is a separate process with its own instance, so `clearEmails()` is safe.

**Location rationale:** Lives in `packages/email/` (not `packages/test-utils/`) because production code (`init.ts`) conditionally imports it. Keeping it co-located with the `EmailClient` interface avoids a production → test-utils dependency.

### Conditional Wiring (`apps/web/src/init.ts`)

The existing `init.ts` creates the email client and passes it to `createAuth()`. The change is a single conditional at this composition root:

```ts
import { createEmailClient } from '@workspace/email';
import { createMockEmailClient } from '@workspace/email/mock-email-client';

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
```

No changes to `createAuth()` or any auth logic — it receives an `EmailClient` either way.

### Test Email API Route (`apps/web/src/routes/api/test/emails.ts`)

A file-based route that exposes captured emails over HTTP for Playwright tests.

**Endpoints:**

- `GET /api/test/emails?to=user@example.com` — Returns captured emails for that recipient as JSON.
- `DELETE /api/test/emails?to=user@example.com` — Clears only that recipient's emails. The `to` param is required — no global clear is exposed via HTTP to prevent parallel test interference.

**Guards:**

- Returns `404` unless `NODE_ENV === 'test'`. This route does not exist in production.
- Validates the `to` query parameter is present on GET requests.

**Response shape (GET):**

```json
{
  "emails": [
    {
      "to": "user@example.com",
      "subject": "Verify your email address",
      "sentAt": "2026-03-26T10:00:00.000Z"
    }
  ]
}
```

**Extracting the verification URL:** The `react` prop in `CapturedEmail` contains the `EmailVerificationEmail` component with a `verificationUrl` prop. The API route extracts this from the React element's props and includes it in the response as a top-level `verificationUrl` field per email entry.

### Auth Helpers (`packages/test-utils/src/auth-helpers.ts`)

A Playwright utility for tests that need a verified user without exercising the sign-up flow.

```ts
async function createVerifiedUser(
  baseUrl: string,
  options: { email: string; password: string; name?: string }
): Promise<{ cookie: string; userId: string }>;
```

**Flow:**

1. `POST /api/auth/sign-up/email` — Creates the user.
2. `POST /api/auth/admin/update-user` — Sets `emailVerified: true` (requires admin context).
3. Returns session cookie for Playwright to inject via `page.context().addCookies()`.

**Admin context:** The test environment's auth config includes a known test admin user ID (configured in `createAuth({ adminUserIds })` for the test env). The helper signs in as this admin user first, then calls the admin update endpoint to verify the target user. This keeps the helper purely HTTP-based so it works from any test runner (Playwright or Vitest) without importing server internals.

## Test Coverage

### E2E Tests (`apps/web/test/e2e/auth/signup.spec.ts`)

| Test Case                                    | Flow                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Happy path: sign up, verify, reach workspace | Fill form → submit → GET `/api/test/emails?to=...` → navigate to `verificationUrl` → assert `/ws/$workspaceId/overview` |
| Duplicate email shows error                  | Sign up with existing email → assert "email already exists" message                                                     |
| Weak password shows validation error         | Submit with < 8 char password → assert validation error                                                                 |
| Password mismatch shows validation error     | Submit with non-matching passwords → assert validation error                                                            |
| Resend verification email                    | Sign up → on `/verify` page → click "Resend" → GET test API → assert second email captured                              |
| Expired/invalid verification link            | Navigate to malformed verification URL → assert error handling                                                          |

Each test uses a unique email: `test-signup-${Date.now()}@example.com`.

### Integration Tests (`apps/web/test/integration/components/auth/signup-verification-flow.integration.test.tsx`)

| Test Case                                     | What it validates                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Mock email client captures verification email | Call `sendVerificationEmail` → assert `getEmailsFor()` returns correct URL and subject              |
| Verification URL structure                    | Assert captured URL contains expected token param and callback URL                                  |
| Email store isolation                         | Send emails to two recipients → assert `getEmailsFor()` returns only the correct recipient's emails |
| Per-recipient cleanup                         | Send email → `clearEmailsFor(email)` → assert only that recipient's emails cleared, others intact   |
| Global cleanup (Vitest only)                  | Send emails to two recipients → `clearEmails()` → assert entire store is empty                      |

### Existing Tests (unchanged)

- `apps/web/test/unit/components/auth/signup-form.test.tsx` — 14 unit tests covering form validation, error handling, navigation. These mock `authClient` entirely and remain untouched.
- `apps/web/test/integration/components/auth/signup-form.integration.test.tsx` — Existing integration test for sign-up form. Stays as-is.

## Files

### New Files

| File                                                                                      | Description                             |
| ----------------------------------------------------------------------------------------- | --------------------------------------- |
| `packages/email/src/mock-email-client.ts`                                                 | Mock `EmailClient` with in-memory store |
| `apps/web/src/routes/api/test/emails.ts`                                                  | Test-only API route for captured emails |
| `packages/test-utils/src/auth-helpers.ts`                                                 | `createVerifiedUser()` utility          |
| `apps/web/test/e2e/auth/signup.spec.ts`                                                   | E2E sign-up flow tests                  |
| `apps/web/test/integration/components/auth/signup-verification-flow.integration.test.tsx` | Mock email infrastructure tests         |

### Modified Files

| File                               | Change                                                    |
| ---------------------------------- | --------------------------------------------------------- |
| `apps/web/src/init.ts`             | Conditional email client creation based on `NODE_ENV`     |
| `packages/email/src/index.ts`      | Export `createMockEmailClient` and `MockEmailClient` type |
| `packages/test-utils/src/index.ts` | Export `createVerifiedUser`                               |

## Data Flow

### E2E Happy Path

```
Playwright fills sign-up form
  → POST /api/auth/sign-up/email
  → Better Auth creates user (emailVerified: false)
  → Better Auth calls sendVerificationEmail()
  → Mock email client stores { to, subject, verificationUrl }

Playwright calls GET /api/test/emails?to=user@test.com
  → Route reads from mock email client store
  → Returns JSON with verificationUrl

Playwright navigates to verificationUrl
  → Better Auth verifies token
  → Sets emailVerified: true
  → Auto-signs in (autoSignInAfterVerification: true)
  → Redirects to /ws/$workspaceId/overview

Playwright asserts workspace dashboard is visible
```

### Integration Test Flow

```
Test imports createMockEmailClient() directly
  → Creates a mock client instance
  → Calls sendEmail() with test data
  → Calls getEmailsFor() to retrieve captured emails
  → Asserts on captured email contents
```

## Error Handling

- **Test API route in production:** Returns 404. The `NODE_ENV` guard prevents any email data exposure.
- **Missing `to` param:** Test API returns 400 with descriptive error.
- **No emails found:** Test API returns 200 with empty `emails` array (not an error — the email may not have been sent yet). Playwright tests should retry with a short poll if needed.
- **Mock client in production:** Impossible — `init.ts` conditional ensures the mock is only created when `NODE_ENV === 'test'`.
