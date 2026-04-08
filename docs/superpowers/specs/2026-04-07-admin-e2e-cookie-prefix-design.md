# Admin E2E Cookie Prefix Ownership Design

**Date:** 2026-04-07
**Goal:** Move admin-specific cookie-prefix end-to-end coverage out of `apps/web` and into a minimal `apps/admin` Playwright setup, while keeping one Web-only cookie assertion in the Web E2E suite.
**Approach:** Add the smallest Admin E2E harness needed to run one admin-owned cookie-prefix test, promote its generated test user directly in the database to satisfy the admin login precondition, and keep the single cross-app coexistence check in the Admin suite.
**Scope exclusion:** This design does not aim for full Admin E2E parity with Web, does not add a shared repo-root Playwright setup, and does not change the underlying auth implementation for SF-28.

---

## 1. Context

The SF-28 implementation added a Playwright regression in [`apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts).

That test is valuable because it verifies the browser-level contract for session cookie separation, but it currently mixes Web and Admin concerns inside the Web E2E suite.

The diff feedback is directionally correct:

- Web-specific tests should live in `apps/web/test/e2e`
- Admin-specific tests should live in `apps/admin/test/e2e`

Today, however, `apps/admin` does not yet have its own Playwright setup. In contrast, `apps/web` already has:

- [`apps/web/playwright.config.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/web/playwright.config.ts)
- [`apps/web/test/e2e/global-setup.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/web/test/e2e/global-setup.ts)
- package scripts for `build:e2e` and Playwright execution
- a prebuilt-server E2E pattern that avoids `EMFILE` watcher failures

There is also an Admin-specific precondition that matters for test design:

- a user must already have `user.role = 'admin'` in the database to log in to the Admin UI

That means Admin E2E cannot rely on a normal verified-user flow alone. It must elevate its generated test user before attempting Admin sign-in.

## 2. Problem

We want better test ownership without losing the strongest regression coverage.

If we simply move the mixed test without adding Admin E2E infrastructure, Admin still has no proper home for end-to-end tests.

If we split the test too aggressively, we may lose the most valuable assertion from the existing implementation:

- one browser context can hold both the Web session cookie and the Admin session cookie without a naming collision

The design therefore needs to do three things at once:

1. keep Web-only behavior tested in `apps/web`
2. move Admin-owned behavior into `apps/admin`
3. preserve exactly one cross-app coexistence check

## 3. Objectives

1. Give `apps/admin` a minimal Playwright harness that mirrors the proven `apps/web` setup only where needed.
2. Keep a small Web-only cookie assertion in `apps/web/test/e2e`.
3. Move the single cross-app session-cookie coexistence test into `apps/admin/test/e2e`.
4. Make the Admin test self-sufficient by promoting its generated test user directly in the database to `admin`.
5. Avoid broader E2E infrastructure refactors until Admin has more than this initial use case.

## 4. Recommended Design

### Web suite responsibility

Keep one Web-only test in [`apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts), but narrow it to the Web concern only:

- create and verify a normal Web user
- sign in to Web
- assert the Web response emits `better-auth.session_token`

This test should no longer:

- sign in to Admin
- depend on Admin role elevation
- assert cross-app coexistence

### Admin suite responsibility

Create a minimal Admin Playwright setup:

- [`apps/admin/playwright.config.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/playwright.config.ts)
- [`apps/admin/test/e2e/global-setup.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/test/e2e/global-setup.ts)
- [`apps/admin/test/e2e/auth/admin-cookie-prefix.spec.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/test/e2e/auth/admin-cookie-prefix.spec.ts)

Add minimal package scripts in [`apps/admin/package.json`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/package.json):

- `build:e2e`
- `test:e2e`
- `test:e2e:chromium`
- optionally `test:e2e:report`

The Admin cookie-prefix spec becomes the single cross-app coexistence check:

1. create and verify a user through the existing email-backed setup flow
2. update `user.role` directly in the database to `'admin'`
3. obtain a Web session cookie and assert it includes `better-auth.session_token`
4. sign in to Admin and assert the Admin response includes `admin.session_token`
5. assert the Admin response does not include `better-auth.session_token`
6. add both cookie sets into one browser context
7. assert both session cookies coexist in that single context

This preserves the strongest regression exactly once while moving ownership to the Admin suite.

## 5. Admin Test Setup Details

### Why direct DB promotion is appropriate

Admin login is gated by persisted user role, not just credentials.

The generated test user therefore must be elevated before the Admin sign-in step. Directly updating the database is acceptable here because:

- the user explicitly approved direct DB promotion for this test setup
- the precondition lives in persisted application data
- adding a test-only elevation endpoint would create more product surface area than necessary

The relevant schema is the `user.role` column in [`packages/db-schema/src/auth.schema.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/packages/db-schema/src/auth.schema.ts).

### Likely helper boundary

Add a tiny Admin E2E helper under `apps/admin/test/e2e/lib/` for:

- creating a DB client
- promoting a user ID to `role = 'admin'`
- draining unused fetch responses
- optionally parsing cookie headers if the helper is duplicated locally rather than imported from Web

This helper should stay narrowly focused on Admin E2E setup and avoid becoming a general seeding framework.

## 6. Playwright Harness Shape

The Admin Playwright setup should mirror the important parts of Web's harness:

- `testDir: './test/e2e'`
- browser projects starting with Chromium
- prebuilt server pattern instead of `vite dev`, to avoid `EMFILE`
- `reuseExistingServer: true` for local iteration
- HTML report support

Admin base URL should be `http://localhost:3001`.

### Global setup note

Web's global setup probes `/api/test/emails` to ensure `E2E_MOCK_EMAIL=true` is active.

For Admin, the global setup should follow the same safety principle, but it should not blindly assume the exact same route exists unless that route is actually reachable in Admin.

Recommended behavior:

- verify the Admin server is reachable at its configured base URL
- if Admin exposes the test email endpoint, use the same safeguard
- if Admin relies on Web for email-backed setup, keep the Admin global setup small and explicit about that dependency

The main goal is to prevent accidental E2E runs against the wrong server mode without overengineering the first Admin harness.

## 7. Alternatives Considered

### Option A: Minimal Admin E2E harness plus one moved coexistence test

Recommended.

Benefits:

- aligns test ownership with app boundaries
- preserves the highest-value coexistence check
- keeps scope intentionally small
- makes the admin role precondition explicit in test setup

Tradeoff:

- introduces a small amount of duplicated Playwright setup between Web and Admin

### Option B: Move all cookie-prefix coverage fully into Admin and remove Web coverage

Rejected.

Problems:

- loses direct Web-suite coverage for the Web cookie contract
- makes Web behavior implicit instead of owned by the Web app's tests

### Option C: Create shared root Playwright infrastructure for both apps now

Rejected for now.

Problems:

- larger architectural decision than this follow-up needs
- introduces shared ownership questions before enough Admin E2E usage exists
- increases scope well beyond the diff comment

## 8. Expected File Changes

Web:

- modify [`apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/web/test/e2e/auth/admin-cookie-prefix.spec.ts)

Admin:

- modify [`apps/admin/package.json`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/package.json)
- add [`apps/admin/playwright.config.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/playwright.config.ts)
- add [`apps/admin/test/e2e/global-setup.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/test/e2e/global-setup.ts)
- add [`apps/admin/test/e2e/auth/admin-cookie-prefix.spec.ts`](/Users/sfung/.codex/worktrees/e349/sass-starter-template/apps/admin/test/e2e/auth/admin-cookie-prefix.spec.ts)
- add one or more tiny helpers under `apps/admin/test/e2e/lib/`

## 9. Verification Plan

Minimum verification:

1. Run the narrowed Web cookie-prefix test in the Web Playwright suite and confirm it asserts only the Web session cookie contract.
2. Run the new Admin E2E test in the Admin Playwright suite and confirm:
   - the generated test user is promoted to `admin`
   - Admin emits `admin.session_token`
   - Admin does not emit `better-auth.session_token`
   - the Web and Admin session cookies coexist in one browser context
3. Run the Admin Playwright execution outside the Codex sandbox.

Supporting verification:

- lint the new Admin Playwright files
- run any focused unit or type checks needed if helper modules introduce imports from `@workspace/db` or `@workspace/db-schema`

## 10. Risks and Constraints

- The Admin E2E harness will initially depend on a DB write during setup, so test data cleanup and uniqueness must rely on isolated generated users rather than mutation rollback.
- Some Better Auth plugin cookies may still use the default `better-auth.*` namespace. The coexistence test should stay focused on the session-token split rather than demanding full cookie namespace isolation.
- Admin's first E2E harness should stay intentionally small; once more Admin E2E coverage exists, shared abstractions can be reconsidered with more evidence.

## 11. Definition of Done

This follow-up is complete when:

- Web keeps a Web-only cookie-prefix E2E assertion
- Admin has its own minimal Playwright harness
- the single cross-app coexistence check lives in `apps/admin/test/e2e`
- the Admin test promotes its generated user to `admin` directly in the database
- the relevant E2E commands pass, with Admin Playwright execution performed outside the sandbox
