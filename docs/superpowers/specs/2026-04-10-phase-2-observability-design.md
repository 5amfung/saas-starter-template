# Phase 2 Observability Design

## Goal

Extend the Phase 1 observability baseline so support can reconstruct important
customer incidents across `web`, `admin`, and `api-server` using workflow
breadcrumbs, targeted operational events, and stable request correlation.

This phase must cover all major business workflows:

- auth
- billing
- workspace lifecycle and membership
- admin mutations

Phase 2 must remain lightweight. It should improve incident reconstruction and
support triage without turning the repository into a full metrics or tracing
platform.

## Scope

### In scope

- Add high-value breadcrumbs for key user-facing workflows in `web` and
  `admin`.
- Add targeted server-side operational events for support-relevant business
  actions.
- Standardize event naming and correlation fields across frontend and backend.
- Define safe auth observability rules that prohibit logging secrets,
  credentials, or raw auth payloads.
- Improve the support workflow from customer report -> Sentry issue ->
  request ID -> logs.

### Out of scope

- Full distributed tracing across all requests and dependencies.
- Metrics dashboards, SLOs, alerting platforms, or long-term analytics.
- Generic instrumentation of every route, button, dialog, or render event.
- Logging raw request bodies, auth payloads, form state, or sensitive tokens.

## Current baseline

Phase 1 already provides:

- Sentry bootstrap in `web`, `admin`, and `api-server`
- request IDs in `api-server`
- structured request logging helpers in `packages/logging`
- app-level frontend crash capture using `AppErrorBoundary`
- support-friendly `/health` endpoints

What is still missing:

- business-level breadcrumbs for important workflows
- higher-value operational events for auth/billing/admin/workspace mutations
- a predictable support playbook linking UI events, Sentry, and logs

## Recommended approach

Use a workflow-first instrumentation model.

That means:

- frontend breadcrumbs record meaningful customer actions and transitions
- server logs/events record business outcomes and mutation boundaries
- both share stable correlation fields and operation names

This is preferred over UI-heavy telemetry because:

- support incidents usually start with user workflows, not component renders
- high-value events are easier to search and reason about
- lower event volume reduces noise and accidental sensitive data capture

## Architecture

### 1. Shared event naming and correlation contract

Phase 2 should standardize a small vocabulary for support events.

Every support-relevant breadcrumb or operational event should include, when
available:

- `operation`
- `requestId`
- `userId`
- `workspaceId`
- `route`
- `app`

The `operation` field becomes the main stable identifier for support and
engineering triage.

Examples:

- `auth.sign_in.started`
- `auth.sign_in.failed`
- `auth.password_reset.requested`
- `workspace.member.invited`
- `workspace.member.removed`
- `workspace.deleted`
- `billing.checkout.started`
- `billing.portal.started`
- `billing.subscription.downgraded`
- `admin.user.updated`
- `admin.user.deleted`
- `admin.workspace.entitlements.saved`

This contract should be documented in a shared helper or constants module, but
the actual instrumentation should remain owned by the relevant app/package.

### 2. Frontend breadcrumbs

Frontend breadcrumbs should be added only at workflow boundaries and mutation
entry points.

#### `apps/web`

Add breadcrumbs for:

- sign in submit
- sign in failure state
- sign up submit
- password reset request submit
- invite acceptance entry
- workspace switch
- workspace creation submit
- workspace deletion submit
- member invite submit
- member removal confirm
- leave workspace confirm
- transfer ownership confirm
- billing checkout start
- billing portal start
- downgrade/cancel/reactivate submit

#### `apps/admin`

Add breadcrumbs for:

- sign in submit
- admin user update submit
- admin user delete confirm
- workspace search/detail navigation when tied to a support workflow
- entitlement override save
- entitlement override clear

Breadcrumbs should be attached in action handlers, mutation hooks, or
user-intent boundaries, not in passive UI rendering.

### 3. Server-side operational events

Server-side events should record business outcomes and key transition points.

#### Auth

Auth logging should be limited to:

- sign-in attempt started or routed when a distinct auth branch is meaningful
- sign-in failure categories
- password reset request accepted
- email verification flow entered or completed
- invitation acceptance or rejection
- workspace auto-create failure

Auth logging must never include:

- passwords
- password confirmation fields
- reset tokens
- verification tokens
- raw OAuth tokens
- authorization headers
- cookies
- raw request bodies

Email addresses should be treated conservatively. If they are logged at all,
they must be redacted or transformed consistently rather than emitted raw in
general-purpose breadcrumbs.

#### Billing

Add operational events for:

- checkout session creation start/success/failure
- portal session creation start/success/failure
- subscription transitions already captured in Phase 1, expanded only when
  needed for support outcomes
- entitlement-related billing failures surfaced to customer workflows

#### Workspace lifecycle and membership

Add operational events for:

- workspace created
- workspace deleted
- member invited
- invitation canceled
- member removed
- ownership transferred
- workspace settings updated when relevant to support workflows

#### Admin mutations

Add operational events for:

- admin user updated
- admin user deleted
- entitlement override saved
- entitlement override cleared

### 4. Support workflow contract

The support workflow for a customer incident should become:

1. Support identifies the impacted app and workflow.
2. Support finds the relevant Sentry issue or customer-visible error.
3. Support extracts `requestId`, `operation`, `userId`, and `workspaceId`.
4. Support searches structured logs using those fields.
5. Engineering can reconstruct both the user action sequence and the
   server-side outcome.

Phase 2 should explicitly optimize for this flow rather than generic telemetry
completeness.

## File-level design

### Shared helpers

Potential additions:

- `packages/logging/src/operations.ts`
  - shared operation name constants or helper builders
- `packages/logging/src/redaction.ts`
  - safe helper for auth/log redaction if the implementation needs a central
    rule set

These should stay small and focused. Do not create a large telemetry framework.

### `apps/web`

Likely touch points:

- `apps/web/src/lib/observability.ts`
- billing action handlers and components
- workspace mutation hooks and dialog handlers
- auth-related routes/components where user-intent starts

### `apps/admin`

Likely touch points:

- `apps/admin/src/lib/observability.ts`
- admin user form/delete flows
- entitlement override flows
- admin auth entry points if needed

### `packages/auth`

Likely touch points:

- `packages/auth/src/auth.server.ts`

This package should own auth-safe server-side operational events and enforce
the redaction rule for auth-related logs.

## Security and privacy rules

This phase must explicitly enforce the following:

- Never log passwords, password confirmations, or raw credential payloads.
- Never log reset tokens, verify tokens, OAuth access tokens, refresh tokens,
  cookies, or raw authorization headers.
- Never attach raw form bodies to breadcrumbs or server logs.
- Prefer stable identifiers such as `userId` and `workspaceId` over sensitive
  user-entered fields.
- If a customer-entered field is needed for support, prefer redacted or
  transformed output.

These rules apply to:

- Sentry breadcrumbs
- Sentry exception context
- structured logs
- auth-related helpers

## Testing strategy

Phase 2 should be tested with focused unit and integration coverage.

### Frontend

- Breadcrumb helpers are called for the intended high-value actions.
- Breadcrumb payloads include the expected operation and identifiers.
- Breadcrumbs do not receive sensitive input fields.

### Server

- Auth event payloads exclude sensitive fields.
- Billing/workspace/admin events emit stable operation names.
- Existing request correlation remains intact.

### Verification

Run focused tests per touched owner first, then finish with:

- `pnpm run check`
- `pnpm test`

## Tradeoffs

### Why not instrument every user interaction?

Because that would increase noise, cost, and privacy risk without improving
support outcomes proportionally.

### Why not jump to tracing now?

Phase 1 and Phase 2 are still optimized for small-scale production support.
Tracing is valuable later, but it is not necessary to reconstruct the highest
value workflows yet.

### Why keep the event model small?

Smaller telemetry surfaces are easier to audit for safety and easier for
support to use consistently.

## Success criteria

Phase 2 is successful when:

- important auth, billing, workspace, and admin workflows emit stable
  breadcrumbs or operational events
- support can pivot from Sentry to logs using shared identifiers
- no auth-sensitive payloads are logged
- the implementation stays lightweight and passes repo-wide verification
