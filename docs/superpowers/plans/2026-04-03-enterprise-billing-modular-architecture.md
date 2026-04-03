# Plan: Enterprise Billing and Entitlement Modular Rebuild

**Implementation reference:** [Design document](../../design/enterprise-billing-modular-architecture.md)  
**Status:** In Progress  
**State tag:** `[ ] Planned [x] In Progress [ ] Completed`  
**Date:** 2026-04-03

## Goal

Implement a long-term modular system where application layers only call billing domain contracts and never access billing storage directly.

## Workstream 1: Package structure and contracts

- [ ] Create `@workspace/billing` internal layers:
  - `contracts/`
  - `domain/`
  - `application/`
  - `infrastructure/`
- [ ] Publish only approved public APIs from package root.
- [ ] Add contract tests for all query, command, and policy APIs.

**Exit criteria:** contract APIs compile, are tested, and are the only app-facing billing entry points.

## Workstream 2: Boundary enforcement

- [ ] Add lint/dep boundary rule:
  - `apps/web` cannot import billing tables.
  - `apps/admin` cannot import billing tables.
- [ ] Add forbidden-import rule for `@workspace/billing/infrastructure/*` from app layers.
- [ ] Add dependency-direction checks (`billing -> apps` disallowed, `apps -> billing internals` disallowed).
- [ ] Add CI check that fails on forbidden imports.

**Exit criteria:** direct app-to-billing-table imports are impossible in CI.

## Workstream 3: Server cutover

- [ ] Migrate billing page loaders to `getWorkspaceBillingSnapshot`.
- [ ] Migrate invite/member enforcement to `assertInviteAllowed` and `assertWorkspaceLimit`.
- [ ] Migrate checkout endpoint to `createCheckoutSession`.

**Exit criteria:** no ad-hoc plan-limit checks remain in app server logic.

## Workstream 4: Admin cutover

- [ ] Migrate admin override read flow to `getWorkspaceEntitlementOverrides`.
- [ ] Migrate admin save flow to `setWorkspaceEntitlementOverrides`.
- [ ] Migrate admin clear flow to `clearWorkspaceEntitlementOverrides`.
- [ ] Remove admin-side table imports and raw override queries.

**Exit criteria:** admin is a strict client of billing contracts.

## Workstream 5: UI and action model alignment

- [ ] Billing cards and dialogs consume plan action enum from snapshot payload.
- [ ] Enterprise target action renders contact-sales CTA only.
- [ ] Checkout CTA appears only when action is self-serve upgrade.
- [ ] Current plan cards render `currentEntitlements` from snapshot payload.

**Exit criteria:** no UI code infers action behavior from plan ID directly.

## Workstream 6: Regression lock

- [ ] Add tests for:
  - missing `currentEntitlements` payload contract failures,
  - enterprise checkout rejection,
  - admin tri-state and numeric override round-trip,
  - no `nativeButton` warning regressions on link CTAs.
- [ ] Add runtime schema validation for `WorkspaceBillingSnapshot` server response.
- [ ] Add contract-fixture builders for billing payloads to prevent partial fixture drift.
- [ ] Remove legacy entitlement helpers and mixed return-shape paths.

**Exit criteria:** regression tests cover previous failure modes and pass.

## Verification matrix

1. `pnpm run typecheck`
2. `pnpm run lint`
3. `pnpm test`
4. `pnpm web:test:e2e:chromium`
5. boundary/dep-check command (CI-required) passes

## Completion criteria

1. Every enforcement path calls billing policy APIs.
2. Enterprise plan transitions never trigger checkout.
3. App layers have zero direct billing table imports.
4. Billing page and dialogs render from resolved snapshot entitlements.
5. Admin override serialization is contract-correct and test-covered.
6. Drift-prevention checks are active in CI as required checks.
