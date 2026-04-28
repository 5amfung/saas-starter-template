# SF-53 Observability Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add confirmed, Sentry-native metrics for SF-53 auth, billing, email, and `/api/*` latency signals in `apps/web`.

**Architecture:** Add a server-only metric helper that wraps `Sentry.metrics.count` and `Sentry.metrics.distribution`. Instrument only confirmed server/provider/webhook boundaries, reuse the existing observability module, and keep all metric attributes low-cardinality and free of user/workspace/email/Stripe identifiers.

**Tech Stack:** TanStack Start, Better Auth, Better Auth Stripe, Resend, Sentry TanStack Start SDK, TypeScript, Vitest

---

## File Structure

- Modify: `apps/web/src/observability/operations.ts`
  Purpose: add stable metric names.
- Create: `apps/web/src/observability/metrics.server.ts`
  Purpose: emit Sentry count/distribution metrics and normalize API metric paths.
- Modify: `apps/web/src/observability/server.ts`
  Purpose: export the server metric helpers.
- Modify: `apps/web/src/observability/request-logger.server.ts`
  Purpose: record `/api/*` latency distributions.
- Modify: `apps/web/src/auth/server/auth.server.ts`
  Purpose: emit confirmed auth and billing metrics from Better Auth callbacks.
- Modify: `apps/web/src/auth/server/auth-emails.server.ts`
  Purpose: emit specific auth email counters after successful sends.
- Modify: `apps/web/src/email/resend.server.ts`
  Purpose: emit total email sent counter after Resend accepts the email.
- Test: `apps/web/test/unit/observability/metrics.server.test.ts`
  Purpose: verify metric span shape, sanitization, and path normalization.
- Test: `apps/web/test/unit/observability/request-logger.server.test.ts`
  Purpose: verify API latency recording behavior.
- Modify tests:
  `apps/web/test/unit/auth/auth.server.test.ts`,
  `apps/web/test/unit/auth/auth-emails.server.test.ts`,
  `apps/web/test/unit/email/resend.server.test.ts`
  Purpose: verify instrumentation at confirmed event boundaries.

## Task 1: Add Server Metric Helper

**Files:**

- Modify: `apps/web/src/observability/operations.ts`
- Create: `apps/web/src/observability/metrics.server.ts`
- Modify: `apps/web/src/observability/server.ts`
- Test: `apps/web/test/unit/observability/metrics.server.test.ts`

- [x] **Step 1: Write failing helper tests**

Create `apps/web/test/unit/observability/metrics.server.test.ts`:

```ts
import * as Sentry from '@sentry/tanstackstart-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  METRICS,
  emitCountMetric,
  emitDistributionMetric,
  normalizeApiMetricPath,
} from '@/observability/server';

vi.mock('@sentry/tanstackstart-react', () => ({
  metrics: {
    count: vi.fn(),
    distribution: vi.fn(),
  },
}));

const countMetricMock = vi.mocked(Sentry.metrics.count);
const distributionMetricMock = vi.mocked(Sentry.metrics.distribution);

describe('server metric helpers', () => {
  beforeEach(() => {
    countMetricMock.mockClear();
    distributionMetricMock.mockClear();
  });

  it('emits count metrics through the Sentry Metrics API', () => {
    emitCountMetric(METRICS.AUTH_SIGNUP_CREATED, {
      route: '/api/auth/$',
      result: 'success',
      userId: 'must-not-ship',
      email: 'person@example.com',
    });

    expect(countMetricMock).toHaveBeenCalledWith('auth.signup.created', 1, {
      attributes: {
        route: '/api/auth/$',
        result: 'success',
      },
    });
  });

  it('emits distribution metrics with a unit', () => {
    emitDistributionMetric(METRICS.API_REQUEST_LATENCY_MS, 42, 'ms', {
      method: 'POST',
      path: '/api/auth/$',
      statusFamily: '2xx',
    });

    expect(distributionMetricMock).toHaveBeenCalledWith(
      'api.request.latency_ms',
      42,
      {
        unit: 'ms',
        attributes: {
          method: 'POST',
          path: '/api/auth/$',
          statusFamily: '2xx',
        },
      }
    );
  });

  it.each([
    ['/api/auth/sign-in/email?x=1', '/api/auth/$'],
    ['/api/auth/callback/google', '/api/auth/$'],
    ['/api/messaging/hello', '/api/messaging/hello'],
    ['/api/test/emails?to=a@example.com', '/api/test/emails'],
    ['/api/workspaces/123456789abcdef', '/api/workspaces/:param'],
    ['/not-api/path', null],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeApiMetricPath(input)).toBe(expected);
  });
});
```

- [x] **Step 2: Run the failing helper tests**

Run: `pnpm --filter @workspace/web test test/unit/observability/metrics.server.test.ts`

Expected: FAIL because `metrics.server.ts`, `METRICS`, and the helper exports do not exist.

- [x] **Step 3: Implement the helper**

Add these metric constants to `apps/web/src/observability/operations.ts`:

```ts
export const METRICS = {
  AUTH_SIGNUP_CREATED: 'auth.signup.created',
  AUTH_SIGNUP_VERIFIED: 'auth.signup.verified',
  AUTH_PASSWORD_RESET_COMPLETED: 'auth.password_reset.completed',
  AUTH_SIGNIN_GOOGLE_COMPLETED: 'auth.signin.google.completed',
  BILLING_SUBSCRIPTION_STARTER_CREATED: 'billing.subscription.starter.created',
  BILLING_SUBSCRIPTION_PRO_CREATED: 'billing.subscription.pro.created',
  BILLING_SUBSCRIPTION_FREE_DOWNGRADED: 'billing.subscription.free.downgraded',
  BILLING_SUBSCRIPTION_STARTER_DOWNGRADED:
    'billing.subscription.starter.downgraded',
  EMAIL_SENT: 'email.sent',
  EMAIL_VERIFICATION_SENT: 'email.verification.sent',
  EMAIL_PASSWORD_RESET_SENT: 'email.password_reset.sent',
  EMAIL_WORKSPACE_INVITATION_SENT: 'email.workspace_invitation.sent',
  API_REQUEST_LATENCY_MS: 'api.request.latency_ms',
} as const;

export type MetricName = (typeof METRICS)[keyof typeof METRICS];
```

Create `apps/web/src/observability/metrics.server.ts`:

```ts
import * as Sentry from '@sentry/tanstackstart-react';
import type { MetricName } from './operations';

type MetricAttributeValue = string | number | boolean;
type MetricAttributes = Record<string, MetricAttributeValue | null | undefined>;

const BLOCKED_METRIC_ATTRIBUTE_KEYS = new Set([
  'email',
  'stripeCustomerId',
  'stripeSubscriptionId',
  'subscriptionId',
  'token',
  'userId',
  'workspaceId',
]);

const DYNAMIC_SEGMENT_PATTERN = /^(?:[0-9]+|[0-9a-f]{8,}|[A-Za-z0-9_-]{16,})$/;

function sanitizeMetricAttributes(attributes: MetricAttributes) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([key, value]) => {
      if (value === null || value === undefined) return false;
      return !BLOCKED_METRIC_ATTRIBUTE_KEYS.has(key);
    })
  );
}

export function emitCountMetric(
  name: MetricName,
  attributes: MetricAttributes = {},
  value = 1
) {
  Sentry.metrics.count(name, value, {
    attributes: sanitizeMetricAttributes(attributes),
  });
}

export function emitDistributionMetric(
  name: MetricName,
  value: number,
  unit: string,
  attributes: MetricAttributes = {}
) {
  Sentry.metrics.distribution(name, value, {
    unit,
    attributes: sanitizeMetricAttributes(attributes),
  });
}

export function normalizeApiMetricPath(input: string): string | null {
  const pathname = new URL(input, 'http://local.test').pathname;
  if (!pathname.startsWith('/api/')) return null;
  if (pathname.startsWith('/api/auth/')) return '/api/auth/$';

  return pathname
    .split('/')
    .map((segment) =>
      DYNAMIC_SEGMENT_PATTERN.test(segment) ? ':param' : segment
    )
    .join('/');
}
```

Update `apps/web/src/observability/server.ts`:

```ts
export { METRICS } from './operations';
export type { MetricName } from './operations';
export {
  emitCountMetric,
  emitDistributionMetric,
  normalizeApiMetricPath,
} from './metrics.server';
```

- [x] **Step 4: Run the helper tests**

Run: `pnpm --filter @workspace/web test test/unit/observability/metrics.server.test.ts`

Expected: PASS.

## Task 2: Instrument Confirmed Auth Metrics

**Files:**

- Modify: `apps/web/src/auth/server/auth.server.ts`
- Modify: `apps/web/test/unit/auth/auth.server.test.ts`

- [x] **Step 1: Add failing auth server assertions**

In `apps/web/test/unit/auth/auth.server.test.ts`, extend the hoisted mocks:

```ts
import { METRICS, OPERATIONS } from '@/observability/server';

const emitCountMetricMock = vi.fn();
```

In the `vi.mock('@/observability/server', ...)` return object, add:

```ts
emitCountMetric: emitCountMetricMock,
```

Add assertions to the existing user create hook success test:

```ts
expect(emitCountMetricMock).toHaveBeenCalledWith(METRICS.AUTH_SIGNUP_CREATED, {
  route: '/api/auth/$',
  result: 'success',
});
```

Add new tests in the `after hook` describe block:

```ts
it('records a Google sign-in metric only for successful Google callbacks', async () => {
  const createAuth = await importCreateAuth();
  createAuth(buildTestConfig());
  const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
  const afterHook = config.hooks!.after!;

  await afterHook({
    path: '/callback/google',
    context: { newSession: { user: { id: 'user_google' } } },
  });

  expect(emitCountMetricMock).toHaveBeenCalledWith(
    METRICS.AUTH_SIGNIN_GOOGLE_COMPLETED,
    { provider: 'google', route: '/api/auth/$', result: 'success' }
  );
});

it('does not record a Google sign-in metric for email sign-in', async () => {
  const createAuth = await importCreateAuth();
  createAuth(buildTestConfig());
  const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
  const afterHook = config.hooks!.after!;

  await afterHook({
    path: '/sign-in/email',
    context: { newSession: { user: { id: 'user_email' } } },
  });

  expect(emitCountMetricMock).not.toHaveBeenCalledWith(
    METRICS.AUTH_SIGNIN_GOOGLE_COMPLETED,
    expect.anything()
  );
});
```

Extend the test-only `BetterAuthConfig` interface:

```ts
emailAndPassword?: {
  onPasswordReset?: (data: { user: { id: string } }) => Promise<void>;
};
emailVerification?: {
  afterEmailVerification?: (user: { id: string }) => Promise<void>;
};
```

Add tests:

```ts
it('records verified signup after Better Auth verifies email', async () => {
  const createAuth = await importCreateAuth();
  createAuth(buildTestConfig());
  const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;

  await config.emailVerification!.afterEmailVerification!({ id: 'user_1' });

  expect(emitCountMetricMock).toHaveBeenCalledWith(
    METRICS.AUTH_SIGNUP_VERIFIED,
    { route: '/api/auth/$', result: 'success' }
  );
});

it('records completed password reset from Better Auth onPasswordReset', async () => {
  const createAuth = await importCreateAuth();
  createAuth(buildTestConfig());
  const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;

  await config.emailAndPassword!.onPasswordReset!({
    user: { id: 'user_1' },
  });

  expect(emitCountMetricMock).toHaveBeenCalledWith(
    METRICS.AUTH_PASSWORD_RESET_COMPLETED,
    { route: '/api/auth/$', result: 'success' }
  );
});
```

- [x] **Step 2: Run the failing auth tests**

Run: `pnpm --filter @workspace/web test test/unit/auth/auth.server.test.ts`

Expected: FAIL because auth callbacks do not emit metrics yet.

- [x] **Step 3: Implement auth metric emission**

In `apps/web/src/auth/server/auth.server.ts`, import:

```ts
import {
  METRICS,
  OPERATIONS,
  buildWorkflowAttributes,
  emitCountMetric,
  startWorkflowSpan,
  workflowLogger,
} from '@/observability/server';
```

Add to `emailAndPassword`:

```ts
onPasswordReset: async () => {
  emitCountMetric(METRICS.AUTH_PASSWORD_RESET_COMPLETED, {
    route: '/api/auth/$',
    result: 'success',
  });
},
```

Add to `emailVerification`:

```ts
afterEmailVerification: async () => {
  emitCountMetric(METRICS.AUTH_SIGNUP_VERIFIED, {
    route: '/api/auth/$',
    result: 'success',
  });
},
```

In `databaseHooks.user.create.after`, emit the sign-up metric after the existing
default-workspace logic returns without throwing:

```ts
emitCountMetric(METRICS.AUTH_SIGNUP_CREATED, {
  route: '/api/auth/$',
  result: 'success',
});
```

In the existing `hooks.after` block, after the sign-in update succeeds, add:

```ts
if (ctx.path === '/callback/google') {
  emitCountMetric(METRICS.AUTH_SIGNIN_GOOGLE_COMPLETED, {
    provider: 'google',
    route: '/api/auth/$',
    result: 'success',
  });
}
```

- [x] **Step 4: Run the auth tests**

Run: `pnpm --filter @workspace/web test test/unit/auth/auth.server.test.ts`

Expected: PASS.

## Task 3: Instrument Confirmed Email Metrics

**Files:**

- Modify: `apps/web/src/email/resend.server.ts`
- Modify: `apps/web/src/auth/server/auth-emails.server.ts`
- Modify: `apps/web/test/unit/email/resend.server.test.ts`
- Modify: `apps/web/test/unit/auth/auth-emails.server.test.ts`

- [x] **Step 1: Write failing Resend assertions**

In `apps/web/test/unit/email/resend.server.test.ts`, mock observability:

```ts
const emitCountMetricMock = vi.fn();

vi.doMock('@/observability/server', async () => ({
  METRICS: {
    EMAIL_SENT: 'email.sent',
  },
  emitCountMetric: emitCountMetricMock,
}));
```

Add to the successful send test:

```ts
expect(emitCountMetricMock).toHaveBeenCalledWith('email.sent', {
  provider: 'resend',
  result: 'success',
});
```

Add to the error test:

```ts
expect(emitCountMetricMock).not.toHaveBeenCalled();
```

- [x] **Step 2: Write failing auth email assertions**

In `apps/web/test/unit/auth/auth-emails.server.test.ts`, mock
`@/observability/server`:

```ts
const emitCountMetricMock = vi.fn();

vi.mock('@/observability/server', () => ({
  METRICS: {
    EMAIL_VERIFICATION_SENT: 'email.verification.sent',
    EMAIL_PASSWORD_RESET_SENT: 'email.password_reset.sent',
    EMAIL_WORKSPACE_INVITATION_SENT: 'email.workspace_invitation.sent',
  },
  emitCountMetric: emitCountMetricMock,
}));
```

After each successful specific email test, assert:

```ts
expect(emitCountMetricMock).toHaveBeenCalledWith('email.password_reset.sent', {
  result: 'success',
});
```

Use `email.verification.sent` for `sendVerificationEmail` and
`email.workspace_invitation.sent` for `sendInvitationEmail`.

Add one failure test:

```ts
it('does not emit specific metrics when the email send fails', async () => {
  sendEmailMock.mockRejectedValueOnce(new Error('send failed'));

  await expect(
    emails.sendResetPasswordEmail({
      user: { email: 'user@example.com' },
      url: 'https://app.example.com/reset',
    })
  ).rejects.toThrow('send failed');

  expect(emitCountMetricMock).not.toHaveBeenCalled();
});
```

- [x] **Step 3: Run the failing email tests**

Run:

```bash
pnpm --filter @workspace/web test test/unit/email/resend.server.test.ts test/unit/auth/auth-emails.server.test.ts
```

Expected: FAIL because email metrics are not emitted yet.

- [x] **Step 4: Implement email metrics**

In `apps/web/src/email/resend.server.ts`, import:

```ts
import { METRICS, emitCountMetric } from '@/observability/server';
```

After the Resend error check and before returning `data`, add:

```ts
emitCountMetric(METRICS.EMAIL_SENT, {
  provider: 'resend',
  result: 'success',
});
```

In `apps/web/src/auth/server/auth-emails.server.ts`, import:

```ts
import { METRICS, emitCountMetric } from '@/observability/server';
```

After successful `sendEmail` calls, add:

```ts
emitCountMetric(METRICS.EMAIL_PASSWORD_RESET_SENT, { result: 'success' });
emitCountMetric(METRICS.EMAIL_VERIFICATION_SENT, { result: 'success' });
emitCountMetric(METRICS.EMAIL_WORKSPACE_INVITATION_SENT, {
  result: 'success',
});
```

Use the matching metric in each function. Do not emit a specific metric for
`sendChangeEmailConfirmation`.

- [x] **Step 5: Run the email tests**

Run:

```bash
pnpm --filter @workspace/web test test/unit/email/resend.server.test.ts test/unit/auth/auth-emails.server.test.ts
```

Expected: PASS.

## Task 4: Instrument Confirmed Billing Metrics

**Files:**

- Modify: `apps/web/src/auth/server/auth.server.ts`
- Modify: `apps/web/test/unit/auth/auth.server.test.ts`

- [x] **Step 1: Add billing callback test helpers**

In `apps/web/test/unit/auth/auth.server.test.ts`, add:

```ts
function getStripeSubscriptionOpts() {
  const call = stripeMock.mock.calls[0];
  return call[0] as {
    subscription: {
      onSubscriptionComplete: (data: {
        subscription: {
          id: string;
          plan: string;
          referenceId: string;
          status: string;
        };
        plan: { name: string };
      }) => Promise<void>;
      onSubscriptionCreated: (data: {
        subscription: {
          id: string;
          plan: string;
          referenceId: string;
          status: string;
        };
        plan: { name: string };
      }) => Promise<void>;
      onSubscriptionUpdate: (data: {
        event: unknown;
        subscription: {
          id: string;
          plan: string;
          referenceId: string;
          status: string;
        };
      }) => Promise<void>;
      onSubscriptionDeleted: (data: {
        subscription: {
          id: string;
          plan: string;
          referenceId: string;
          status: string;
        };
      }) => Promise<void>;
    };
  };
}
```

- [x] **Step 2: Write failing billing metric tests**

Add tests:

```ts
it('records confirmed Starter and Pro subscription creation from Stripe callbacks', async () => {
  const createAuth = await importCreateAuth();
  createAuth(buildTestConfig());
  const opts = getStripeSubscriptionOpts();

  await opts.subscription.onSubscriptionComplete({
    subscription: {
      id: 'sub_1',
      plan: 'starter',
      referenceId: 'org_1',
      status: 'active',
    },
    plan: { name: 'starter' },
  });
  await opts.subscription.onSubscriptionCreated({
    subscription: {
      id: 'sub_2',
      plan: 'pro',
      referenceId: 'org_1',
      status: 'active',
    },
    plan: { name: 'pro' },
  });

  expect(emitCountMetricMock).toHaveBeenCalledWith(
    METRICS.BILLING_SUBSCRIPTION_STARTER_CREATED,
    { plan: 'starter', result: 'success' }
  );
  expect(emitCountMetricMock).toHaveBeenCalledWith(
    METRICS.BILLING_SUBSCRIPTION_PRO_CREATED,
    { plan: 'pro', result: 'success' }
  );
});

it('records confirmed downgrade to Free from subscription deletion', async () => {
  const createAuth = await importCreateAuth();
  createAuth(buildTestConfig());
  const opts = getStripeSubscriptionOpts();

  await opts.subscription.onSubscriptionDeleted({
    subscription: {
      id: 'sub_1',
      plan: 'pro',
      referenceId: 'org_1',
      status: 'active',
    },
  });

  expect(emitCountMetricMock).toHaveBeenCalledWith(
    METRICS.BILLING_SUBSCRIPTION_FREE_DOWNGRADED,
    { fromPlan: 'pro', toPlan: 'free', result: 'success' }
  );
});
```

Add a Starter downgrade test with a previous Stripe price ID. Set
`process.env.STRIPE_PRO_MONTHLY_PRICE_ID = 'price_pro_monthly'` before creating
auth, then use:

```ts
await opts.subscription.onSubscriptionUpdate({
  event: {
    data: {
      previous_attributes: {
        items: {
          data: [
            {
              price: { id: 'price_pro_monthly' },
            },
          ],
        },
      },
    },
  },
  subscription: {
    id: 'sub_1',
    plan: 'starter',
    referenceId: 'org_1',
    status: 'active',
  },
});

expect(emitCountMetricMock).toHaveBeenCalledWith(
  METRICS.BILLING_SUBSCRIPTION_STARTER_DOWNGRADED,
  { fromPlan: 'pro', toPlan: 'starter', result: 'success' }
);
```

Add a negative test where `previous_attributes` is empty and assert the Starter
downgrade metric is not emitted.

- [x] **Step 3: Run the failing billing tests**

Run: `pnpm --filter @workspace/web test test/unit/auth/auth.server.test.ts`

Expected: FAIL because the Stripe callbacks only log to console.

- [x] **Step 4: Implement confirmed billing metrics**

In `apps/web/src/auth/server/auth.server.ts`, add local helpers near
`buildSubscriptionLogPayload`:

```ts
const PLAN_TIERS: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

function isPlanId(value: string): value is PlanId {
  return (
    value === 'free' ||
    value === 'starter' ||
    value === 'pro' ||
    value === 'enterprise'
  );
}

function getCreatedSubscriptionMetric(plan: string) {
  if (plan === 'starter') return METRICS.BILLING_SUBSCRIPTION_STARTER_CREATED;
  if (plan === 'pro') return METRICS.BILLING_SUBSCRIPTION_PRO_CREATED;
  return null;
}

function extractPreviousPriceIdsFromStripeEvent(event: unknown): Array<string> {
  const previousAttributes = (
    event as {
      data?: {
        previous_attributes?: {
          items?: { data?: Array<{ price?: { id?: string } }> };
        };
      };
    }
  )?.data?.previous_attributes;
  return (
    previousAttributes?.items?.data
      ?.map((item) => item.price?.id)
      .filter((value): value is string => typeof value === 'string') ?? []
  );
}

function resolvePreviousPlanFromStripeEvent(event: unknown): PlanId | null {
  for (const priceId of extractPreviousPriceIdsFromStripeEvent(event)) {
    const planId = priceToPlanMap[priceId];
    if (planId) return planId;
  }
  return null;
}
```

Add a local helper:

```ts
function emitCreatedSubscriptionMetric(plan: string) {
  const metric = getCreatedSubscriptionMetric(plan);
  if (!metric) return;
  emitCountMetric(metric, {
    plan,
    result: 'success',
  });
}
```

Inside both `onSubscriptionComplete` and `onSubscriptionCreated`, after the
existing log, add:

```ts
emitCreatedSubscriptionMetric(subscription.plan);
```

Inside `onSubscriptionUpdate`, after the existing log, add:

```ts
const toPlan = subscription.plan;
const fromPlan = resolvePreviousPlanFromStripeEvent(event);
if (
  toPlan === 'starter' &&
  fromPlan &&
  PLAN_TIERS[fromPlan] > PLAN_TIERS.starter
) {
  emitCountMetric(METRICS.BILLING_SUBSCRIPTION_STARTER_DOWNGRADED, {
    fromPlan,
    toPlan,
    result: 'success',
  });
}
```

Inside `onSubscriptionDeleted`, after the existing log, add:

```ts
const fromPlan = subscription.plan;
if (isPlanId(fromPlan) && fromPlan !== 'free') {
  emitCountMetric(METRICS.BILLING_SUBSCRIPTION_FREE_DOWNGRADED, {
    fromPlan,
    toPlan: 'free',
    result: 'success',
  });
}
```

- [x] **Step 5: Run the billing/auth tests**

Run: `pnpm --filter @workspace/web test test/unit/auth/auth.server.test.ts`

Expected: PASS.

## Task 5: Instrument API Latency

**Files:**

- Modify: `apps/web/src/observability/request-logger.server.ts`
- Create: `apps/web/test/unit/observability/request-logger.server.test.ts`

- [ ] **Step 1: Write failing latency tests**

Create `apps/web/test/unit/observability/request-logger.server.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const emitDistributionMetricMock = vi.fn();

vi.mock('@/observability/metrics.server', () => ({
  emitDistributionMetric: emitDistributionMetricMock,
  normalizeApiMetricPath: (input: string) => {
    const pathname = new URL(input, 'http://local.test').pathname;
    if (pathname.startsWith('/api/auth/')) return '/api/auth/$';
    if (pathname.startsWith('/api/')) return pathname;
    return null;
  },
}));

vi.mock('@/observability/operations', async (importActual) => ({
  ...(await importActual<object>()),
  METRICS: { API_REQUEST_LATENCY_MS: 'api.request.latency_ms' },
}));

describe('request logger API latency metric helper', () => {
  beforeEach(() => {
    vi.resetModules();
    emitDistributionMetricMock.mockClear();
  });

  it('records API latency for successful responses', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1042);
    const { recordApiLatencyMetric } =
      await import('@/observability/request-logger.server');

    recordApiLatencyMetric({
      method: 'POST',
      url: 'https://app.test/api/auth/sign-in/email?ignored=1',
      status: 200,
      durationMs: 42,
    });

    expect(emitDistributionMetricMock).toHaveBeenCalledWith(
      'api.request.latency_ms',
      42,
      'ms',
      {
        method: 'POST',
        path: '/api/auth/$',
        statusFamily: '2xx',
        result: 'success',
      }
    );
    vi.restoreAllMocks();
  });

  it('skips non-API paths', async () => {
    const { recordApiLatencyMetric } =
      await import('@/observability/request-logger.server');

    recordApiLatencyMetric({
      method: 'GET',
      url: 'https://app.test/ws/abc',
      status: 200,
      durationMs: 12,
    });

    expect(emitDistributionMetricMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the failing latency tests**

Run: `pnpm --filter @workspace/web test test/unit/observability/request-logger.server.test.ts`

Expected: FAIL because `recordApiLatencyMetric` is not exported.

- [ ] **Step 3: Implement latency recording**

In `apps/web/src/observability/request-logger.server.ts`, import:

```ts
import { METRICS } from './operations';
import {
  emitDistributionMetric,
  normalizeApiMetricPath,
} from './metrics.server';
```

Add:

```ts
export function getStatusFamily(status: number): string {
  return `${Math.floor(status / 100)}xx`;
}

export function recordApiLatencyMetric(input: {
  method: string;
  url: string;
  status: number;
  durationMs: number;
}) {
  const path = normalizeApiMetricPath(input.url);
  if (!path) return;

  emitDistributionMetric(
    METRICS.API_REQUEST_LATENCY_MS,
    input.durationMs,
    'ms',
    {
      method: input.method,
      path,
      statusFamily: getStatusFamily(input.status),
      result: input.status >= 500 ? 'failure' : 'success',
    }
  );
}
```

Call it in the middleware success path after computing `duration`:

```ts
recordApiLatencyMetric({
  method: request.method,
  url: request.url,
  status: result.response.status,
  durationMs: duration,
});
```

Call it in the catch path before `Sentry.captureException`:

```ts
recordApiLatencyMetric({
  method: request.method,
  url: request.url,
  status: 500,
  durationMs: duration,
});
```

- [ ] **Step 4: Run the latency tests**

Run: `pnpm --filter @workspace/web test test/unit/observability/request-logger.server.test.ts`

Expected: PASS.

## Task 6: Final Verification

**Files:**

- All files touched in Tasks 1-5.

- [ ] **Step 1: Run targeted observability/auth/email tests**

Run:

```bash
pnpm --filter @workspace/web test test/unit/observability/metrics.server.test.ts test/unit/observability/request-logger.server.test.ts test/unit/auth/auth.server.test.ts test/unit/auth/auth-emails.server.test.ts test/unit/email/resend.server.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run web typecheck**

Run: `pnpm --filter @workspace/web typecheck`

Expected: PASS.

- [ ] **Step 3: Run boundary check**

Run: `pnpm run check:boundaries`

Expected: PASS.

- [ ] **Step 4: Review metric safety**

Run:

```bash
rg -n "emitCountMetric|emitDistributionMetric" apps/web/src
```

Expected: Every metric call uses only low-cardinality attributes. No metric call
passes `userId`, `workspaceId`, `email`, `subscriptionId`,
`stripeCustomerId`, `stripeSubscriptionId`, tokens, raw request bodies, or raw
query strings.

- [ ] **Step 5: Stop before implementation closeout**

Do not close SF-53 yet. Leave the issue in `In Progress` until implementation
is complete, verified, and a PR exists.
