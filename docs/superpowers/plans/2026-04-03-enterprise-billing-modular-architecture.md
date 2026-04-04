# Plan: Enterprise Billing and Entitlement Modular Rebuild

**Implementation reference:** [Design document](../../design/enterprise-billing-modular-architecture.md)  
**Status:** Completed  
**State tag:** `[ ] Planned [ ] In Progress [x] Completed`  
**Date:** 2026-04-03

## Goal

Implement a long-term modular system where application layers only call billing domain contracts and never access billing storage directly.

## Workstream 1: Package structure and contracts

- [x] Create `@workspace/billing` internal layers:
  - `contracts/`
  - `domain/`
  - `application/`
  - `infrastructure/`
- [x] Publish only approved public APIs from package root.
- [x] Add contract tests for all query, command, and policy APIs.

**Exit criteria:** contract APIs compile, are tested, and are the only app-facing billing entry points.

## Workstream 2: Boundary enforcement

- [x] Add lint/dep boundary rule:
  - `apps/web` cannot import billing tables.
  - `apps/admin` cannot import billing tables.
- [x] Add forbidden-import rule for `@workspace/billing/infrastructure/*` from app layers.
- [x] Add dependency-direction checks (`billing -> apps` disallowed, `apps -> billing internals` disallowed).
- [x] Add CI check that fails on forbidden imports.

**Exit criteria:** direct app-to-billing-table imports are impossible in CI.

## Workstream 3: Server cutover

- [x] Migrate billing page loaders to `getWorkspaceBillingSnapshot`.
- [x] Migrate invite/member enforcement to `assertInviteAllowed` and `assertWorkspaceLimit`.
- [x] Migrate checkout endpoint to `createCheckoutSession`.

**Exit criteria:** no ad-hoc plan-limit checks remain in app server logic.

## Workstream 4: Admin cutover

- [x] Migrate admin override read flow to `getWorkspaceEntitlementOverrides`.
- [x] Migrate admin save flow to `setWorkspaceEntitlementOverrides`.
- [x] Migrate admin clear flow to `clearWorkspaceEntitlementOverrides`.
- [x] Remove admin-side table imports and raw override queries.

**Exit criteria:** admin is a strict client of billing contracts.

## Workstream 5: UI and action model alignment

- [x] Billing cards and dialogs consume plan action enum from snapshot payload.
- [x] Enterprise target action renders contact-sales CTA only.
- [x] Checkout CTA appears only when action is self-serve upgrade.
- [x] Current plan cards render `currentEntitlements` from snapshot payload.

**Exit criteria:** no UI code infers action behavior from plan ID directly.

## Workstream 6: Regression lock

- [x] Add tests for:
  - missing `currentEntitlements` payload contract failures,
  - enterprise checkout rejection,
  - admin tri-state and numeric override round-trip,
  - no `nativeButton` warning regressions on link CTAs.
- [x] Add runtime schema validation for `WorkspaceBillingSnapshot` server response.
- [x] Add contract-fixture builders for billing payloads to prevent partial fixture drift.
- [x] Remove legacy entitlement helpers and mixed return-shape paths.

**Exit criteria:** regression tests cover previous failure modes and pass.

## Verification matrix

1. `pnpm run typecheck`
2. `pnpm run lint`
3. `pnpm test`
4. `pnpm web:test:e2e:chromium`
5. boundary/dep-check command (CI-required) passes

### Verification result (2026-04-03)

- `pnpm run check:boundaries` ✅
- `pnpm run typecheck` ✅
- `pnpm run lint` ✅
- `pnpm test` ✅
- `pnpm web:test:e2e:chromium` ⚠️ blocked in local env because the Playwright web server start command requires `.env` (`node: .env: not found`)

## Completion criteria

1. Every enforcement path calls billing policy APIs.
2. Enterprise plan transitions never trigger checkout.
3. App layers have zero direct billing table imports.
4. Billing page and dialogs render from resolved snapshot entitlements.
5. Admin override serialization is contract-correct and test-covered.
6. Drift-prevention checks are active in CI as required checks.
