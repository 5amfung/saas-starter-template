# Phase 2 Sentry Observability Design

## Goal

Extend the current Sentry baseline so support and engineering can reconstruct
major customer workflows in `web` and `admin` using Sentry-native tracing,
structured logs, and safe event enrichment.

This phase must cover the highest-value business workflows:

- auth
- billing
- workspace lifecycle and membership
- admin mutations

The design should stay lightweight. It should improve incident reconstruction
inside Sentry without introducing a custom telemetry platform.

## Scope

### In scope

- Add custom spans around important business mutation boundaries.
- Add structured Sentry logs for important workflow outcomes.
- Standardize a small vocabulary of operation names and event attributes.
- Enrich errors, logs, and spans with safe workflow metadata.
- Define auth-safe observability rules that prohibit sensitive data capture.
- Improve support triage from Sentry issue or trace -> workflow operation ->
  related logs and spans.

### Out of scope

- A bespoke metrics or event-pipeline framework.
- Request ID based correlation as a required contract.
- Full instrumentation of every route, render, click, or passive UI transition.
- Logging raw request bodies, auth payloads, tokens, cookies, or credentials.
- `apps/api-server` instrumentation. That app will be handled separately.

## Current baseline

The current implementation already provides:

- separate Sentry projects for `apps/web` and `apps/admin`
- frontend Sentry initialization with tracing, replay, and logs
- server-side Sentry initialization
- TanStack Start Sentry request/function middleware
- request-level error capture in shared request logging

What is still missing:

- business-level operation names shared across logs and spans
- custom spans for important workflow mutations
- structured Sentry logs for business outcomes
- consistent workflow attributes such as `operation`, `workspaceId`, and
  `userId`
- clear auth-specific redaction rules

## Recommended approach

Use a Sentry-native workflow instrumentation model.

That means:

- tracing provides cross-runtime correlation
- custom spans mark important mutation boundaries
- structured logs record business outcomes and support-relevant events
- tags and contexts enrich issues and traces with workflow metadata

This is preferred over the original breadcrumb-first model because:

- traces already provide correlation between frontend and backend work
- Sentry logs are searchable and support structured attributes
- custom spans are a better fit for mutation boundaries than manual
  breadcrumbs
- manual breadcrumbs remain available, but are optional and should not be the
  primary business observability layer

## Architecture

### 1. Shared operation vocabulary

Phase 2 should standardize a small set of stable operation names.

Every support-relevant span or structured log should include an `operation`
field. This becomes the primary workflow identifier for triage.

Core attributes should include, when relevant and safe:

- `operation`
- `route`
- `userId`
- `workspaceId`
- `result`

Workflow-specific attributes may include:

- `planId`
- `subscriptionId`
- `targetUserId`
- `memberRole`
- `failureCategory`

Because `web` and `admin` already use separate Sentry projects, `app` is not a
required attribute.

Examples:

- `auth.sign_in`
- `auth.sign_up`
- `auth.password_reset.request`
- `auth.invite.accept`
- `billing.checkout.create_session`
- `billing.portal.create_session`
- `billing.subscription.cancel`
- `billing.subscription.downgrade`
- `workspace.create`
- `workspace.delete`
- `workspace.member.invite`
- `workspace.member.remove`
- `workspace.member.leave`
- `workspace.transfer_ownership`
- `admin.user.update`
- `admin.user.delete`
- `admin.workspace.entitlements.save`
- `admin.workspace.entitlements.clear`

This vocabulary should live in a small shared helper such as
`packages/logging/src/operations.ts`.

### 2. Tracing model

Tracing is already enabled through Sentry. Phase 2 should build on that rather
than introducing request-level correlation outside Sentry.

The main pattern is:

- use automatic Sentry tracing for navigation and request continuity
- add custom spans around major workflow mutations
- attach operation and business attributes to those spans

Custom spans should be created at the actual mutation boundary, not at passive
UI render points.

Examples:

- browser span when the user starts a billing checkout flow
- server span when checkout session creation runs
- server span when workspace membership mutation executes
- admin mutation span for user updates or entitlement overrides

The goal is to answer:

- what workflow was attempted
- how long it took
- whether it failed
- what workspace or user it affected

### 3. Structured logging model

Structured Sentry logs should be the primary workflow event signal.

Use `Sentry.logger.info`, `warn`, and `error` to record:

- workflow start when useful for support
- workflow success
- workflow failure
- important policy or entitlement rejections

Each log should carry structured attributes aligned with the operation
vocabulary.

Examples:

- `operation=workspace.member.invite`, `workspaceId`, `memberRole`,
  `result=success`
- `operation=billing.checkout.create_session`, `workspaceId`, `planId`,
  `result=failure`, `failureCategory=forbidden`
- `operation=admin.user.delete`, `targetUserId`, `result=success`

Avoid using plain unstructured strings as the only payload for business logs.

### 4. Error enrichment

Errors that reach Sentry should be enriched with workflow metadata using Sentry
tags and context, not a parallel correlation mechanism.

Use:

- tags for low-cardinality searchable fields
- context for richer structured detail
- user scope only where appropriate and safe

Recommended tag candidates:

- `operation_family`
- normalized `route`
- `result` when useful and low-cardinality

Recommended context candidates:

- `workspaceId`
- `targetUserId`
- `planId`
- `memberRole`
- normalized failure details

High-cardinality fields should generally stay in log attributes or event
context, not tags.

### 5. Manual breadcrumbs

Manual breadcrumbs are still supported by Sentry, but they are not the primary
pattern for this phase.

Use manual breadcrumbs only when a small number of client-only intent steps are
especially helpful for debugging a nearby crash or error.

Examples of acceptable breadcrumb use:

- entering invite acceptance flow
- opening downgrade confirmation before a crash
- confirming a destructive workspace action immediately before an error

Do not create a broad breadcrumb layer for every mutation. Prefer spans and
structured logs first.

## Workflow coverage

### Auth

Add observability for:

- sign in success and failure categories
- sign up success and failure categories
- password reset request accepted
- invite acceptance success and rejection
- email verification completion when relevant to support
- default workspace auto-create failure

Auth observability must never include:

- passwords
- password confirmation fields
- reset tokens
- verification tokens
- OAuth access or refresh tokens
- cookies
- authorization headers
- raw request bodies

Email addresses should not be logged raw in general-purpose workflow events.
If support truly needs identity correlation, use stable user IDs and only add
email-derived values through a deliberate redaction or hashing rule.

### Billing

Add observability for:

- checkout session creation success and failure
- portal session creation success and failure
- cancel, reactivate, and downgrade mutations
- entitlement check failures that block customer workflows

Existing subscription lifecycle logs may stay, but they are not sufficient on
their own because they do not fully cover the customer-facing workflow entry
points.

### Workspace lifecycle and membership

Add observability for:

- workspace creation success and failure
- workspace deletion success and failure
- workspace switch when it starts a new customer workflow
- member invitation success and failure
- invitation cancellation
- member removal
- leaving a workspace
- ownership transfer
- important workspace settings mutations when they affect support workflows

### Admin mutations

Add observability for:

- admin user update success and failure
- admin user delete success and failure
- entitlement override save success and failure
- entitlement override clear success and failure

Admin list and detail page views do not need generic instrumentation unless
they are directly part of a support workflow.

## Support workflow contract

The support workflow for a customer incident should become:

1. Support finds the relevant issue, replay, or trace in the correct Sentry
   project.
2. Support identifies the workflow via `operation` and related event
   attributes.
3. Support inspects linked spans, logs, and enriched errors in the same trace
   or issue context.
4. Engineering reconstructs what the user attempted, where it failed, and what
   entity was affected.

This phase should optimize for Sentry-first investigation rather than a custom
request-ID-to-logs workflow.

## File-level design

### Shared helpers

Potential additions:

- `packages/logging/src/operations.ts`
  - shared operation constants and small attribute helpers
- `packages/logging/src/redaction.ts`
  - auth-safe redaction and normalization helpers for logging

These helpers should remain small. Do not introduce a full telemetry
abstraction layer.

### `apps/web`

Likely touch points:

- `apps/web/src/lib/observability.ts`
- auth route components and mutation handlers
- billing mutation entry points
- workspace creation, deletion, membership, and ownership flows

### `apps/admin`

Likely touch points:

- `apps/admin/src/lib/observability.ts`
- admin user mutation flows
- entitlement override mutation flows
- admin auth entry points when support-relevant

### `packages/auth`

Likely touch points:

- `packages/auth/src/auth.server.ts`

This package should own auth-safe server-side operational logs and any shared
auth redaction rules.

## Implementation principles

- Prefer custom spans plus structured logs over manual breadcrumbs.
- Use one stable `operation` name for the same workflow across frontend and
  backend touch points.
- Enrich Sentry events with safe metadata instead of building a parallel
  correlation system.
- Keep tags low-cardinality and searchable.
- Keep sensitive auth data out of logs, contexts, and tags.
- Instrument mutation boundaries, not passive rendering.

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
