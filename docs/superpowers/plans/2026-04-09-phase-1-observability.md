# Phase 1 Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight production-troubleshooting observability baseline for `web`, `admin`, and `api-server` using shared structured logging, consistent request correlation, and required Sentry-based error visibility.

**Architecture:** Keep infrastructure intentionally small. Reuse `packages/logging` as the shared contract for structured logs and request context, extend each app at its existing middleware and bootstrap seams, and require Sentry for exception capture instead of standing up a full telemetry platform. Limit configuration to a minimal env contract: `APP_ENV`, `APP_RELEASE`, `LOG_LEVEL`, and `SENTRY_DSN`. `SENTRY_DSN` may be empty in local development, but staging and production are expected to provide it; when absent, logging still falls back to console/stdout.

**Tech Stack:** TanStack Start, Hono, TypeScript, existing `@workspace/logging`, Sentry SDKs for browser/server, Vitest

---

## File Structure

- Modify: `packages/logging/src/logger.ts`
  - Expand the logger to accept structured context fields consistently across server and client.
- Modify: `packages/logging/src/request-logger.server.ts`
  - Add richer request lifecycle logging with correlation metadata.
- Create: `packages/logging/src/request-context.ts`
  - Shared helpers for request ID extraction, log metadata normalization, and safe context shaping.
- Modify: `packages/logging/package.json`
  - Export the new shared request-context helper.
- Modify: `apps/web/src/lib/logger.ts`
  - Keep the thin wrapper, but expose app-specific logger helpers if needed.
- Modify: `apps/admin/src/lib/logger.ts`
  - Keep the thin wrapper, but expose app-specific logger helpers if needed.
- Create: `apps/web/src/lib/observability.ts`
  - Centralize `web` Sentry init, app tags, and breadcrumb helpers.
- Create: `apps/admin/src/lib/observability.ts`
  - Centralize `admin` Sentry init, app tags, and breadcrumb helpers.
- Create: `apps/api-server/src/lib/observability.ts`
  - Centralize `api-server` Sentry init, request capture helpers, and app tags.
- Modify: `apps/api-server/src/app.ts`
  - Register Sentry-aware middleware in the Hono stack.
- Modify: `apps/api-server/src/middleware/request-logger.ts`
  - Emit structured request completion logs with request IDs and route metadata.
- Modify: `apps/api-server/src/middleware/error-handler.ts`
  - Capture exceptions and return request IDs in sanitized error responses.
- Modify: `apps/web/src/routes/api/auth/$.ts`
  - Add request metadata capture around Better Auth handlers.
- Modify: `apps/admin/src/routes/api/auth/$.ts`
  - Add request metadata capture around Better Auth handlers.
- Modify: `apps/web/src/init.ts`
  - Initialize auth with richer logger wiring and request-context helpers.
- Modify: `apps/admin/src/init.ts`
  - Initialize auth with richer logger wiring and request-context helpers.
- Modify: `.env.example`
  - Add the minimal shared observability env contract used by all apps.
- Modify: `packages/auth/src/auth.server.ts`
  - Improve auth and billing-related logs to include operation names and correlation fields.
- Modify: `apps/web/src/routes/health.ts`
  - Convert the current health route into a simple, support-friendly readiness response.
- Modify: `apps/admin/src/routes/health.ts`
  - Convert the current health route into a simple, support-friendly readiness response.
- Create: `apps/web/src/components/error-boundary.tsx`
  - App-level frontend error capture wrapper if an existing shared boundary is not already in place.
- Create: `apps/admin/src/components/error-boundary.tsx`
  - App-level frontend error capture wrapper if an existing shared boundary is not already in place.
- Modify: `apps/web/src/routes/__root.tsx`
  - Register global frontend error capture and app tags.
- Modify: `apps/admin/src/routes/__root.tsx`
  - Register global frontend error capture and app tags.
- Test: `apps/api-server/test/unit/app.test.ts`
  - Verify request ID and error response behavior remain correct after instrumentation.
- Test: `apps/web/test/unit/routes/health.test.ts`
  - Verify health payload shape and status semantics stay stable.
- Test: `apps/admin/test/unit/routes/health.test.ts`
  - Verify health payload shape and status semantics stay stable.
- Create: `apps/web/test/unit/lib/observability.test.ts`
  - Verify Sentry init and breadcrumb helper behavior with mocks.
- Create: `apps/admin/test/unit/lib/observability.test.ts`
  - Verify Sentry init and breadcrumb helper behavior with mocks.
- Create: `apps/api-server/test/unit/lib/observability.test.ts`
  - Verify server-side observability helper behavior with mocks.

### Task 1: Define the shared observability contract

**Files:**

- Create: `packages/logging/src/request-context.ts`
- Modify: `packages/logging/src/logger.ts`
- Modify: `packages/logging/src/request-logger.server.ts`
- Modify: `packages/logging/package.json`
- Test: `apps/web/test/unit/lib/logger.test.ts`
- Test: `apps/admin/test/unit/lib/logger.test.ts`

- [x] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeLogContext } from '@workspace/logging/request-context';

describe('normalizeLogContext', () => {
  it('keeps only defined observability fields', () => {
    expect(
      normalizeLogContext({
        requestId: 'req_123',
        route: '/api/auth/sign-in',
        userId: undefined,
        workspaceId: 'ws_123',
      })
    ).toEqual({
      requestId: 'req_123',
      route: '/api/auth/sign-in',
      workspaceId: 'ws_123',
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm test apps/web/test/unit/lib/logger.test.ts apps/admin/test/unit/lib/logger.test.ts`
Expected: FAIL because `@workspace/logging/request-context` does not exist and logger behavior is not yet updated.

- [x] **Step 3: Add the request-context helper**

```ts
export type ObservabilityContext = {
  requestId?: string;
  traceId?: string;
  route?: string;
  operation?: string;
  userId?: string;
  workspaceId?: string;
  statusCode?: number;
  durationMs?: number;
};

export function normalizeLogContext(
  context: ObservabilityContext
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined)
  );
}
```

- [x] **Step 4: Update the shared logger to emit structured fields**

```ts
const payload = {
  timestamp,
  level,
  message,
  service,
  environment: process.env.NODE_ENV,
  ...normalizeLogContext(
    typeof data === 'object' && data !== null
      ? (data as Record<string, unknown>)
      : {}
  ),
  data,
};
```

- [x] **Step 5: Update the request logger middleware**

```ts
log('info', 'request completed', {
  requestId,
  route: new URL(request.url).pathname,
  operation: `${request.method} ${new URL(request.url).pathname}`,
  statusCode: result.response.status,
  durationMs: duration,
});
```

- [x] **Step 6: Run targeted tests to verify they pass**

Run: `pnpm test apps/web/test/unit/lib/logger.test.ts apps/admin/test/unit/lib/logger.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/logging/src/request-context.ts packages/logging/src/logger.ts packages/logging/src/request-logger.server.ts packages/logging/package.json apps/web/test/unit/lib/logger.test.ts apps/admin/test/unit/lib/logger.test.ts
git commit -m "feat(logging): add shared observability context"
```

### Task 2: Add lightweight Sentry bootstrapping per app

**Files:**

- Create: `apps/web/src/lib/observability.ts`
- Create: `apps/admin/src/lib/observability.ts`
- Create: `apps/api-server/src/lib/observability.ts`
- Create: `apps/web/test/unit/lib/observability.test.ts`
- Create: `apps/admin/test/unit/lib/observability.test.ts`
- Create: `apps/api-server/test/unit/lib/observability.test.ts`

- [x] **Step 1: Write the failing unit tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';
import { initObservability } from '@/lib/observability';

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
}));

describe('initObservability', () => {
  it('initializes Sentry only when DSN is configured', () => {
    initObservability({ dsn: 'https://example', environment: 'production' });
    expect(Sentry.init).toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm test apps/web/test/unit/lib/observability.test.ts apps/admin/test/unit/lib/observability.test.ts apps/api-server/test/unit/lib/observability.test.ts`
Expected: FAIL because the modules do not exist.

- [x] **Step 3: Implement minimal app-specific observability bootstrap**

```ts
export function initObservability(config: {
  dsn?: string;
  appEnv: 'local' | 'staging' | 'production';
  release?: string;
  app: 'web' | 'admin' | 'api-server';
}) {
  if (!config.dsn) return;

  Sentry.init({
    dsn: config.dsn,
    environment: config.appEnv,
    release: config.release,
    initialScope: {
      tags: {
        app: config.app,
      },
    },
    tracesSampleRate: 0,
  });
}
```

- [x] **Step 4: Add a shared breadcrumb helper**

```ts
export function recordUserActionBreadcrumb(input: {
  category: string;
  message: string;
  data?: Record<string, unknown>;
}) {
  Sentry.addBreadcrumb({
    category: input.category,
    message: input.message,
    data: input.data,
    level: 'info',
  });
}
```

- [x] **Step 5: Run the new observability tests**

Run: `pnpm test apps/web/test/unit/lib/observability.test.ts apps/admin/test/unit/lib/observability.test.ts apps/api-server/test/unit/lib/observability.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/observability.ts apps/admin/src/lib/observability.ts apps/api-server/src/lib/observability.ts apps/web/test/unit/lib/observability.test.ts apps/admin/test/unit/lib/observability.test.ts apps/api-server/test/unit/lib/observability.test.ts
git commit -m "feat(observability): add sentry bootstrap helpers"
```

### Task 3: Add request correlation and server-side capture to `api-server`

**Files:**

- Modify: `apps/api-server/src/app.ts`
- Modify: `apps/api-server/src/middleware/request-logger.ts`
- Modify: `apps/api-server/src/middleware/error-handler.ts`
- Test: `apps/api-server/test/unit/app.test.ts`

- [x] **Step 1: Extend the unit test with error-capture expectations**

```ts
it('returns a request id on internal errors', async () => {
  const response = await app.request('/boom');
  const payload = await response.json();

  expect(response.status).toBe(500);
  expect(payload.error.requestId).toBeTruthy();
});
```

- [x] **Step 2: Run the API-server test to verify the new expectation fails or is incomplete**

Run: `pnpm --filter @workspace/api-server test test/unit/app.test.ts`
Expected: FAIL until the new failing route/test wiring is in place.

- [x] **Step 3: Capture structured request completion logs**

```ts
console.info(
  JSON.stringify({
    level: 'info',
    message: 'request completed',
    service: 'api-server',
    requestId: getRequestId(context),
    route: context.req.path,
    operation: `${context.req.method} ${context.req.path}`,
    statusCode: context.res.status,
    durationMs: Date.now() - startedAt,
  })
);
```

- [x] **Step 4: Capture exceptions through the observability helper**

```ts
captureServerError(_error, {
  requestId: getRequestId(context),
  route: context.req.path,
});
```

- [x] **Step 5: Run the API-server unit test again**

Run: `pnpm --filter @workspace/api-server test test/unit/app.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api-server/src/app.ts apps/api-server/src/middleware/request-logger.ts apps/api-server/src/middleware/error-handler.ts apps/api-server/test/unit/app.test.ts
git commit -m "feat(api-server): capture correlated request errors"
```

### Task 4: Instrument `web` and `admin` auth entrypoints and app bootstraps

**Files:**

- Modify: `apps/web/src/init.ts`
- Modify: `apps/admin/src/init.ts`
- Modify: `apps/web/src/routes/api/auth/$.ts`
- Modify: `apps/admin/src/routes/api/auth/$.ts`
- Modify: `.env.example`
- Modify: `packages/auth/src/auth.server.ts`

- [x] **Step 1: Add a failing auth logging expectation where the current tests already cover logger injection**

```ts
expect(createAuth).toHaveBeenCalledWith(
  expect.objectContaining({
    logger: expect.any(Function),
  })
);
```

- [x] **Step 2: Run the targeted init/auth tests**

Run: `pnpm test apps/web/test/unit/init/init.test.ts apps/admin/test/unit/init/init.test.ts packages/auth/test/unit/auth.server.test.ts`
Expected: FAIL once the new request-context-aware behavior is asserted.

- [x] **Step 3: Wrap auth route handling with request metadata extraction**

```ts
const pathname = new URL(request.url).pathname;
logger('info', 'auth request received', {
  route: pathname,
  operation: `${request.method} ${pathname}`,
});
return await getAuth().handler(request);
```

- [x] **Step 4: Replace free-form auth logs with operation-based structured logs**

```ts
await log('info', 'subscription updated', {
  operation: 'billing.subscription.updated',
  ...buildSubscriptionLogPayload(subscription),
});
```

- [x] **Step 5: Add the minimal shared env contract to `.env.example`**

```dotenv
APP_ENV=local
APP_RELEASE=dev
LOG_LEVEL=debug
# Leave empty locally if you only want console logging.
# Staging and production should provide a real DSN.
SENTRY_DSN=
```

- [x] **Step 6: Run the targeted auth/init tests again**

Run: `pnpm test apps/web/test/unit/init/init.test.ts apps/admin/test/unit/init/init.test.ts packages/auth/test/unit/auth.server.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/init.ts apps/admin/src/init.ts apps/web/src/routes/api/auth/$.ts apps/admin/src/routes/api/auth/$.ts .env.example packages/auth/src/auth.server.ts
git commit -m "feat(auth): add structured request observability"
```

### Task 5: Add frontend error capture and support breadcrumbs

**Files:**

- Create: `apps/web/src/components/error-boundary.tsx`
- Create: `apps/admin/src/components/error-boundary.tsx`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/admin/src/routes/__root.tsx`

- [x] **Step 1: Write a failing component test for global error capture**

```tsx
it('captures rendering failures', async () => {
  render(
    <AppErrorBoundary>
      <Boom />
    </AppErrorBoundary>
  );
  expect(captureExceptionMock).toHaveBeenCalled();
});
```

- [x] **Step 2: Run the targeted component tests**

Run: `pnpm test apps/web/test/unit/components apps/admin/test/unit/components`
Expected: FAIL for the new error-boundary test file before implementation.

- [x] **Step 3: Add a minimal error boundary wrapper**

```tsx
export function AppErrorBoundary(props: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={<div>Something went wrong.</div>}
      onError={(error) => captureFrontendError(error)}
    >
      {props.children}
    </ErrorBoundary>
  );
}
```

- [ ] **Step 4: Add support breadcrumbs for key customer actions**

```ts
recordUserActionBreadcrumb({
  category: 'workspace',
  message: 'workspace member invited',
  data: { workspaceId },
});
```

- [x] **Step 5: Run the targeted component tests again**

Run: `pnpm test apps/web/test/unit/components apps/admin/test/unit/components`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/error-boundary.tsx apps/admin/src/components/error-boundary.tsx apps/web/src/routes/__root.tsx apps/admin/src/routes/__root.tsx
git commit -m "feat(frontend): capture app errors and breadcrumbs"
```

### Task 6: Make health endpoints support-friendly instead of infra-heavy

**Files:**

- Modify: `apps/web/src/routes/health.ts`
- Modify: `apps/admin/src/routes/health.ts`
- Test: `apps/web/test/unit/routes/health.test.ts`
- Test: `apps/admin/test/unit/routes/health.test.ts`

- [x] **Step 1: Add failing tests for a simpler readiness payload**

```ts
expect(payload).toEqual({
  status: 'healthy',
  app: 'web',
  timestamp: expect.any(String),
  checks: {
    database: {
      status: 'connected',
    },
  },
});
```

- [x] **Step 2: Run the health tests**

Run: `pnpm test apps/web/test/unit/routes/health.test.ts apps/admin/test/unit/routes/health.test.ts`
Expected: FAIL because the payload shape still includes raw process memory details.

- [x] **Step 3: Simplify the health responses**

```ts
return Response.json({
  status: database.status === 'connected' ? 'healthy' : 'error',
  app: 'web',
  timestamp: new Date().toISOString(),
  checks: {
    database,
  },
});
```

- [x] **Step 4: Run the health tests again**

Run: `pnpm test apps/web/test/unit/routes/health.test.ts apps/admin/test/unit/routes/health.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/health.ts apps/admin/src/routes/health.ts apps/web/test/unit/routes/health.test.ts apps/admin/test/unit/routes/health.test.ts
git commit -m "feat(health): simplify readiness responses"
```

### Task 7: Verify the lightweight observability baseline end to end

**Files:**

- No new source files
- Verify: repository root commands and targeted test commands above

- [x] **Step 1: Run the targeted validation set**

Run: `pnpm test apps/web/test/unit/lib/logger.test.ts apps/admin/test/unit/lib/logger.test.ts apps/web/test/unit/init/init.test.ts apps/admin/test/unit/init/init.test.ts apps/web/test/unit/routes/health.test.ts apps/admin/test/unit/routes/health.test.ts packages/auth/test/unit/auth.server.test.ts`
Expected: PASS

- [x] **Step 2: Run the API-server targeted validation**

Run: `pnpm --filter @workspace/api-server test test/unit/app.test.ts`
Expected: PASS

- [x] **Step 3: Run a repo-level safety check for shared typing and boundaries**

Run: `pnpm run typecheck`
Expected: PASS

- [x] **Step 4: Run boundary validation if any new cross-package exports/imports were added**

Run: `pnpm run check:boundaries`
Expected: PASS

- [ ] **Step 5: Do a manual production-support sanity check**

```text
1. Trigger a handled error in web/admin and confirm a Sentry event appears with app tag, route, and release.
2. Trigger an API-server error and confirm the response contains `requestId`.
3. Search logs for that `requestId` and confirm the request lifecycle can be reconstructed.
4. Visit `/health` in web and admin and confirm the readiness payload is concise and dependency-focused.
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore(observability): verify lightweight production support baseline"
```

## Self-Review

- Spec coverage:
  - lightweight rollout: covered by required Sentry, shared logs, no heavy metrics stack
  - end-to-end troubleshooting: covered by request IDs, structured logs, breadcrumbs, error capture
  - frontend + backend health: covered by frontend error capture, API-server instrumentation, health endpoints
- Placeholder scan:
  - no `TODO`/`TBD` placeholders remain
- Type consistency:
  - shared observability field names are standardized as `requestId`, `route`, `operation`, `userId`, `workspaceId`, `statusCode`, `durationMs`
