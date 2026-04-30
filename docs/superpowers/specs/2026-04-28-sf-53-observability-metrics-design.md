# SF-53 Observability Metrics Design

## Goal

Add Sentry-native application health metrics for SF-53 in `apps/web` so support
and engineering can track confirmed auth, billing, email, and API latency
signals without adding a separate telemetry vendor or metrics pipeline.

## Scope

In scope:

- Count confirmed sign-up, verified email, completed password reset, and
  Google sign-in events.
- Count confirmed Starter and Pro subscriptions, confirmed downgrades to Free,
  and confirmed downgrades to Starter.
- Count total provider-accepted emails plus verification, password reset, and
  workspace invitation emails.
- Record latency for routed `/api/*` handlers through the existing request
  logging middleware.
- Keep dimensions low-cardinality and safe for auth/billing contexts.

Out of scope:

- `# of users` and `# of active sessions` gauges. Product removed these from
  this pass.
- Any new database table, cron job, queue, external metrics vendor, or Linear
  issue text update.
- Client intent metrics for billing checkout, portal opens, reset requests, or
  UI clicks.

## Current Baseline

The app already initializes Sentry on the server and has an observability module
under `apps/web/src/observability`. The existing model uses Sentry spans and
structured logs for workflow observability. SF-53 should extend that model with
Sentry's separate Metrics API rather than reintroducing a custom framework.

The installed `@sentry/tanstackstart-react` SDK exposes
`Sentry.metrics.count`, `Sentry.metrics.distribution`, and
`Sentry.metrics.gauge`. Because SF-53 explicitly asks for counts and a
distribution, use those direct metric APIs. Do not encode these business counts
as attributes on current spans, and do not create dedicated fake metric spans.

## Metric Model

Create a small server-only helper that wraps Sentry Metrics with a stable,
sanitized calling convention:

- counts call `Sentry.metrics.count(name, value, { attributes })`
- distributions call
  `Sentry.metrics.distribution(name, value, { unit, attributes })`
- gauges are intentionally not implemented in this pass because user/session
  gauges were removed from scope

Metric dimensions must be limited to safe, low-cardinality values:

- Allowed: `provider`, `method`, `path`, `statusFamily`, `plan`,
  `fromPlan`, `toPlan`, `route`, `result`.
- Not allowed: user IDs, workspace IDs, subscription IDs, Stripe object IDs,
  email addresses, tokens, raw query strings, request bodies, or raw dynamic
  URLs.

The metric names are:

- `auth.signup.created`
- `auth.email.verified`
- `auth.password_reset.completed`
- `auth.signin.google.completed`
- `billing.subscription.starter.created`
- `billing.subscription.pro.created`
- `billing.subscription.free.downgraded`
- `billing.subscription.starter.downgraded`
- `email.sent`
- `email.verification.sent`
- `email.password_reset.sent`
- `email.workspace_invitation.sent`
- `api.request.latency_ms`

## Event Sources

Auth metrics must be emitted from Better Auth server-side confirmation points:

- New sign-up: `databaseHooks.user.create.after`, after the hook finishes its
  existing default-workspace work without throwing.
- Verified email: `emailVerification.afterEmailVerification`, after Better
  Auth updates `emailVerified`. This includes first-time verification and
  change-email verification flows.
- Completed password reset: `emailAndPassword.onPasswordReset`, after Better
  Auth updates or creates the credential password and deletes the reset token.
- Google sign-in: existing `hooks.after` sign-in hook, only when
  `ctx.path === '/callback/google'` and `ctx.context.newSession` exists.

Billing metrics must be emitted only from Better Auth Stripe lifecycle callbacks,
because those callbacks run from Stripe webhook-confirmed subscription state:

- Starter/Pro created: emit from `onSubscriptionComplete` for checkout-created
  subscriptions and from `onSubscriptionCreated` for subscriptions created
  outside checkout, only for plan `starter` or `pro`.
- Downgrade to Free: `onSubscriptionDeleted`, using the previous stored
  subscription plan as `fromPlan` and `free` as `toPlan`.
- Downgrade to Starter: `onSubscriptionUpdate`, only when the updated
  subscription plan is `starter` and the previous plan can be resolved from the
  Stripe event's previous price data to a higher tier. If the previous plan
  cannot be resolved, do not emit the metric.
- Do not emit billing metrics from `apps/web/src/billing/billing.functions.ts`;
  those functions represent user intent and scheduling, not confirmed durable
  billing state.

Email metrics must be emitted only after successful provider acceptance:

- `email.sent`: in `createEmailClient().sendEmail` after Resend returns without
  an error.
- Specific auth email metrics: in `createAuthEmails` after the awaited
  `emailClient.sendEmail` call succeeds for verification, password reset, and
  workspace invitation emails.
- Failed sends must not increment sent metrics.

API latency must be emitted in `requestLogger` for `/api/*` routes:

- Record one distribution span per handled request.
- Use the request method, normalized API path, status family, and duration in
  milliseconds.
- For thrown handlers, record the latency with status family `5xx`, then
  preserve the existing exception capture and rethrow behavior.
- Normalize API paths so dynamic segments and query strings do not create
  high-cardinality series.

## Testing Strategy

Use focused Vitest coverage around the helper and each boundary:

- Metric helper tests verify the Sentry span shape, metric constants, attribute
  sanitization, and API path normalization.
- Auth server tests verify signup, verified email, password reset completion,
  and Google callback sign-in counters emit once on success and not for
  unrelated paths.
- Billing tests verify Starter/Pro creation, Free downgrade, Starter downgrade,
  and no metric when a downgrade previous plan cannot be resolved.
- Email tests verify total and specific counters emit after successful sends and
  not when Resend throws.
- Request logger tests verify `/api/*` latency records method, normalized path,
  status family, and duration for success and thrown handlers.

## References

- Sentry TanStack Start metrics:
  https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/metrics/
- Better Auth hooks:
  https://www.better-auth.com/docs/concepts/hooks
- Better Auth database hooks:
  https://www.better-auth.com/docs/concepts/database#database-hooks
- Better Auth email verification and password reset callbacks:
  https://better-auth.com/docs/concepts/email
- Better Auth Stripe subscription lifecycle hooks:
  https://better-auth.com/docs/plugins/stripe#subscription-lifecycle-hooks
- Stripe Event object:
  https://docs.stripe.com/api/events/object
- Existing Sentry observability design:
  `docs/superpowers/specs/2026-04-13-phase-2-sentry-observability-design.md`
