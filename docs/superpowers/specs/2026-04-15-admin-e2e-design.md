# Admin UI E2E Design

## Summary

This design introduces a phased end-to-end testing strategy for `apps/admin` using the existing Playwright harness, seeded database fixtures, and Better Auth-backed session issuance. The first wave focuses on read-only regression guards for the highest-risk admin surfaces. The second wave adds mutation workflows only after the foundational navigation, route-guard, and data-loading paths are stable.

The primary goal is to tighten code quality around the Admin UI and reduce future drift by covering cross-layer seams that unit and integration tests do not fully exercise: sign-in, capability-gated navigation, server-function-backed queries, seeded data rendering, and deep-linked detail pages.

## Goals

- Provide durable browser coverage for the most important admin read-only flows.
- Reuse the repository's seeded E2E fixture strategy rather than creating test data through the UI.
- Keep wave 1 low-flake and fast enough to run regularly in local development and CI.
- Establish a helper pattern that wave 2 mutation tests can build on without duplicating auth and navigation setup.

## Non-Goals

- Replacing unit or integration tests for `apps/admin`.
- Exhaustively covering every admin screen in the first rollout.
- Using the shared Gmail admin account for automated tests.
- Exercising live email or live payment flows as part of admin read-only coverage.

## Existing Context

The codebase already has the key infrastructure needed for admin E2E:

- `apps/admin/playwright.config.ts` already defines a Playwright project and a Playwright-managed admin server on port `3001`.
- `apps/admin/test/e2e/global-setup.ts` already seeds baseline E2E data and verifies that the admin app is using the mock email client before tests run.
- `packages/db-schema/src/seed/e2e-fixtures.ts` provides durable seeded accounts and workspaces, including `E2E_PLATFORM_ADMIN`.
- `packages/test-utils/src/e2e-auth.ts` already provides a Better Auth-compatible seeded sign-in helper that returns a real session cookie.

The current admin browser coverage is intentionally thin: `apps/admin/test/e2e/auth/signin.spec.ts` proves the seeded platform admin can sign in and reach the protected shell. This is a good starting point, but it leaves important admin regressions uncovered.

The current seeded baseline is also narrower than the desired coverage shape. In particular, wave 1 workspace filter coverage and wave 2 entitlement coverage both depend on clearly named seeded workspace records, including an enterprise workspace if enterprise-only assertions are required.

## Why E2E Matters For Admin

`apps/admin` is strongly shaped by route guards and capability checks:

- navigation items are driven by admin capabilities
- protected routes gate entry with capability-aware `beforeLoad` checks
- read-only pages rely on server functions and TanStack Query data loading
- detail pages depend on seeded record existence and route parameter wiring

These are precisely the kinds of seams that can drift while still passing unit tests. A narrow, well-chosen E2E suite gives confidence that the actual browser experience remains intact.

## Chosen Approach

Use a two-wave rollout with the following principles:

1. Wave 1 covers read-only guardrails only.
2. Tests use seeded fixtures from `packages/db-schema/src/seed/e2e-fixtures.ts` and related seed helpers.
3. Tests authenticate through Better Auth endpoints using seeded credentials so the browser gets a real session cookie.
4. Assertions target semantic UI output and seeded values, not fragile layout details.
5. Each spec owns one admin surface so failures are easy to interpret.

This approach was chosen over a pure smoke-test suite because smoke tests alone would miss important regressions in list filtering, deep-link navigation, and seeded record rendering. It was chosen over mutation-first coverage because write-path browser tests are more expensive and more brittle before the read-only paths are stabilized.

## Wave 1 Scope

Wave 1 should cover the following browser behaviors:

### 1. Authentication Entry

Keep and strengthen the existing seeded admin sign-in flow:

- visit `/signin`
- sign in with `E2E_PLATFORM_ADMIN`
- reach `/dashboard`
- confirm the protected shell renders expected admin navigation

This remains the basic health check for the admin app.

### 2. Protected Shell Navigation

Add a read-only admin shell spec that proves the seeded platform admin can navigate to:

- `/dashboard`
- `/users`
- `/workspaces`

This spec should assert on visible nav items and successful route transitions. It should not duplicate all page-specific assertions from the page-level specs.

### 3. Users List

Add read-only coverage for the users index page:

- seeded users appear in the table
- search narrows to a seeded user
- filter tabs behave correctly for seeded data
- row links or action-menu links navigate to `/users/$userId`

Wave 1 should only rely on fixture-backed records whose state is known and deterministic.

### 4. User Detail

Add read-only coverage for the user detail page:

- direct deep-link navigation to a seeded user works
- seeded fields render correctly
- page-level affordances tied to capabilities are visible in the expected state

Wave 1 must not submit the user form or delete a user.

### 5. Workspaces List

Add read-only coverage for the workspaces index page:

- seeded workspaces appear with expected plan and status labels
- search narrows to a seeded workspace
- `all`, `self-serve`, and `enterprise` filters behave correctly for seeded workspaces
- row links or action-menu links navigate to `/workspaces/$workspaceId`

If wave 1 keeps the enterprise filter assertion, the baseline E2E seed must include a deterministic enterprise workspace. Otherwise the plan must explicitly narrow workspace filter coverage to the seeded self-serve cases.

### 6. Workspace Detail

Add read-only coverage for the workspace detail page:

- direct deep-link navigation to a seeded workspace works
- workspace metadata renders from seeded data
- subscription information renders as expected for the seeded plan
- capability-gated read-only sections appear when appropriate

Wave 1 must not submit entitlement override forms, create API keys, or perform support actions.

## Wave 2 Scope

Wave 2 can extend the same helper layer into mutation-oriented workflows, including:

- editing user fields through the admin user form
- destructive or semi-destructive user actions such as delete, ban, or unban when supported
- entitlement override workflows for enterprise workspaces
- support-action and API-key workflows if those actions can be safely seeded and reset

Wave 2 should only begin after the wave 1 suite is stable and the auth/navigation helpers have settled.

## Wave 2 Detailed Design

Wave 2 should treat mutation coverage as a separate reliability problem from wave 1.

Where wave 1 proves that the admin UI can load, navigate, and render seeded records correctly, wave 2 should prove that the most important write paths:

- submit successfully through the real browser UI
- update persisted state in a way the UI reflects on reload
- enforce capability and safety rules in the actual admin shell
- leave the test environment in a known state between runs

Because these tests mutate shared database state, wave 2 also needs an explicit isolation strategy. Mutation specs should either run under a serialized worker configuration or be isolated strongly enough that reseeding and writes cannot race.

The mutation suite should stay intentionally selective. It does not need to automate every button in the admin UI. It should focus on workflows where a regression would create real operational risk or future maintenance drift.

### Wave 2 Target Areas

#### 1. User Management Mutations

These tests should cover the highest-value admin user actions that are exposed through `apps/admin/src/routes/_protected/users/$userId.tsx` and related admin components:

- editing non-destructive user fields in the admin user form
- validating that successful saves are reflected in the UI after reload
- validating that unsafe actions remain blocked when they should be, such as self-delete protections
- optionally covering ban or unban flows if those actions are supported through the current admin UI and can be seeded/reset safely

Wave 2 should avoid combining many unrelated user actions in one browser test. Separate a user-edit spec from a dangerous-action spec so failures remain easy to diagnose.

#### 2. Workspace Mutation Coverage

Mutation coverage for workspaces should center on the write-capable areas visible on the workspace detail screen:

- entitlement override changes for enterprise workspaces
- support actions that are intentionally exposed to platform admins
- API-key-related actions only if they can run against E2E-safe infrastructure and be cleaned up deterministically

Any mutation that touches external systems or secrets should only be automated if the E2E environment already contains a safe mock or a reversible local-only test path.

#### 3. Mutation Guardrails

Wave 2 should also validate that admin safety rules remain intact:

- a platform admin cannot perform explicitly forbidden self-destructive actions
- unavailable actions stay hidden or disabled when the target record or capability context requires it
- mutation errors surface clearly in the UI when a workflow cannot complete

This is especially important in `apps/admin` because capability checks, route context, and server-function ownership can drift independently.

## Wave 2 Test Data Strategy

Wave 2 should still use seeded fixtures as the foundation, but it needs a stricter mutation data model than wave 1.

Recommended pattern:

- keep baseline records for navigation and read-only assertions
- introduce named mutation-target fixtures whose starting state is explicitly designed for a single write workflow
- where possible, reset mutated state by reseeding before the suite or before each relevant spec group
- avoid sharing one mutable seeded record across many unrelated mutation specs
- ensure new fixture exports are matched by actual rows inserted in the E2E seed flow

Examples:

- a seeded user intended for edit-form tests
- a seeded user intended for dangerous-action tests
- a seeded enterprise workspace intended for entitlement override tests

This reduces cross-test coupling and makes failures easier to reason about.

## Wave 2 Helper Strategy

Wave 2 should reuse the wave 1 sign-in and fixture helpers, then add only the smallest additional helpers needed for stable write-path execution.

Appropriate wave 2 helpers may include:

- mutation-target fixture references
- tiny form helpers for repetitive admin form interactions
- small “save and wait for success” utilities when the same success pattern repeats across multiple specs

Wave 2 should still avoid over-abstracting page behavior. Helpers should remove duplication, not hide the important steps of a mutation flow.

## Wave 2 Verification Strategy

Mutation implementation should verify behavior more aggressively than wave 1:

- first run the single spec under development
- reload the page and assert the changed state is visible
- if relevant, verify the change through a second view that consumes the same persisted data
- run the mutation commands in serialized mode unless a dedicated isolated mutation project exists
- only run the combined admin Chromium suite after reseeding and worker-isolation assumptions are explicit

If mutation helpers extend shared E2E utilities or seeded fixture definitions, run the smallest relevant typecheck for the changed package or app.

## Wave 2 Risks And Mitigations

### Risk: Flaky write-path assertions

Mitigation:

- prefer assertions based on visible success/error UI and persisted state after reload
- avoid arbitrary sleeps
- keep one workflow per spec where possible

### Risk: Shared mutable fixtures create cross-test interference

Mitigation:

- create dedicated mutation-target fixtures
- reseed or scope fixtures so one spec does not inherit another spec's writes

### Risk: Unsafe external side effects

Mitigation:

- only automate support or API-key actions if the E2E environment is explicitly safe for them
- otherwise defer them until a mock or reset strategy exists

## Wave 2 Success Criteria

Wave 2 is successful when:

- the admin suite covers at least one user mutation workflow and one workspace mutation workflow end-to-end
- each mutation spec proves both UI success and persisted post-submit state
- mutation-target fixtures are deterministic and isolated enough to prevent cross-spec drift
- every mutation-target fixture referenced by the specs is created by the E2E seed flow
- the suite still remains understandable, selective, and maintainable

## Test Data Strategy

The shared Gmail admin account is useful for manual exploration only. Automated tests must use seeded fixtures from `packages/db-schema/src/seed/e2e-fixtures.ts`.

The preferred fixture model is:

- baseline seeded records are created before the suite through Playwright global setup
- tests use seeded credentials to obtain a real session cookie from Better Auth
- page assertions reference known seeded records and fixture-owned values

This keeps tests deterministic and avoids coupling browser coverage to incidental UI setup paths.

## Helper Strategy

Wave 1 should introduce a very small helper layer for admin E2E rather than copying sign-in and setup steps into every spec.

Recommended helper responsibilities:

- sign in as the seeded platform admin
- seed browser context with a valid session cookie
- expose stable fixture references for seeded user/workspace assertions
- optionally provide small navigation helpers for common admin entry points

These helpers should stay thin. The goal is reuse without hiding too much browser behavior.

## File Ownership

- `apps/admin/test/e2e/**`: admin Playwright specs and admin-specific test fixtures
- `packages/test-utils/**`: reusable E2E auth/session helpers that can be shared across apps
- `packages/db-schema/src/seed/**`: seeded E2E fixture source of truth

New helpers should be added at the lowest sensible layer. Admin-only Playwright conveniences should stay in `apps/admin/test/e2e`, while generic seeded-auth helpers should remain in `packages/test-utils`.

When touching shared packages, prefer additive changes over behavioral changes. Existing exports used by `apps/web` E2E must keep their current semantics unless there is an intentional cross-app migration.

## Assertion Strategy

Prefer assertions that are:

- based on visible labels, buttons, headings, tabs, links, and seeded values
- resilient to styling/layout changes
- narrow enough that failures identify the broken subsystem quickly

Avoid assertions that depend on transient loading states, exact table structure when not necessary, or incidental CSS/layout details.

## Verification Strategy

Implementation should verify the suite incrementally:

- first run the existing admin sign-in spec
- then run each new admin spec independently
- then run the admin Chromium suite as a whole
- if `packages/db-schema` or `packages/test-utils` changes, run the smallest relevant `apps/web` E2E smoke coverage that depends on those shared helpers

If helper changes touch shared E2E tooling, also run the smallest relevant typecheck or lint command for the affected package or app.

## Risks And Mitigations

### Risk: Fixture assumptions drift from UI behavior

Mitigation:

- assert only against fixture-backed values already owned by `packages/db-schema`
- centralize fixture references so spec updates happen in one place when seeded data changes

### Risk: Admin E2E changes accidentally break `apps/web` E2E

Mitigation:

- keep admin-specific helpers in `apps/admin/test/e2e/**` whenever possible
- make shared fixture and helper changes additive rather than mutating existing exports in place
- verify the existing `apps/web` E2E flows that already depend on shared seed/auth utilities after any shared-package edit

### Risk: Read-only coverage accidentally starts depending on write paths

Mitigation:

- keep wave 1 limited to navigation, loading, filtering, and detail rendering
- defer form submission and support actions to wave 2

### Risk: Helpers become too abstract

Mitigation:

- keep helper scope small and explicit
- avoid wrapping ordinary page interactions that are clearer in the spec itself

## Success Criteria

This effort is successful when:

- `apps/admin` has a small, stable set of read-only E2E specs covering sign-in, navigation, users, and workspaces
- all wave 1 tests run against seeded fixtures rather than ad hoc UI-created data
- failures clearly indicate the affected admin surface
- the test structure naturally supports a second wave of mutation workflows
