# Plan: Modular Billing & Entitlement Rebuild

**Implementation reference:** [Design document](../../design/enterprise-billing-modular-architecture.md)  
**Status:** In Progress  
**State Tag:** `[ ] Planned [x] In Progress [ ] Completed`  
**Next Action:** Align unit/integration test command matrix and begin task-by-task execution.

> **For agentic workers:** use subagent delegation for parallel steps, then merge by checkpoint.

**Date:** 2026-04-03  
**Goal:** Rebuild the enterprise entitlements/checkout/override flow with explicit domain contracts.

**Revision Log:**

- 2026-04-03 (owner: execution) — Added migration plan and task breakdown for modular rebuild.
- 2026-04-03 (owner: execution) — Added workstream evidence and Definition of Done matrix.
- 2026-04-03 (owner: execution) — Added status convention and execution alignment with linked spec/design docs.

## Scope

This is a clean-slate implementation focused on stabilization and modularity.

- Create a dedicated entitlement domain package and contract-first API.
- Make invitation and billing enforcement always use resolved entitlements.
- Preserve current self-serve experience for Free/Starter/Pro flows.
- Enforce explicit contact-sales behavior for enterprise targets.

## Task 1 — Domain package and type contracts

- [ ] Add `@workspace/billing` package (or equivalent location agreed by code owners).
- [ ] Export:
  - entitlement keys, sentinels, and metadata maps;
  - `resolveEntitlements`, `checkLimit`, `hasFeature`, `computeEntitlementDiff`, `describeEntitlements`;
  - plan-action matrix helper (`getWorkspacePlanAction`).
- [ ] Add unit tests for:
  - override merge behavior (inherit/force),
  - feature checks,
  - numeric checks,
  - entitlement diff generation.

## Task 2 — Server-side plan/resolution migration

- [ ] Replace all ad-hoc `getPlanLimitsForPlanId` / single-limit enforcement points with:
  - plan resolution by workspace,
  - `resolveWorkspaceEntitlements(workspaceId)`.
- [ ] Refactor invite policy enforcement path to use resolved entitlements.
- [ ] Gate enterprise checkout in billing functions:
  - self-serve plans return checkout session,
  - enterprise returns contact-sales error/message path.

## Task 3 — Billing payload contract and UI data flow

- [ ] Ensure billing page passes `currentEntitlements` into plan-card components.
- [ ] Remove all fallback behavior that substitutes raw catalog defaults for current workspace state.
- [ ] Use action type (`upgrade`, `downgrade`, `cancel`, `contact_sales`, `current`) in UI prompts.
- [ ] Update enterprise card and upgrade prompt copy.

## Task 4 — Admin override API and UI

- [ ] Ensure feature override form writes explicit booleans:
  - inherit (`undefined`/omitted),
  - `true`,
  - `false`.
- [ ] Ensure numeric form supports inherit / explicit value / unlimited.
- [ ] Save only explicit override keys; avoid writing inherited keys.
- [ ] Add tests that cover empty, explicit true, explicit false, and explicit unlimited updates.

## Task 5 — Regression lock

- [ ] Add/update failing-path tests for contract mismatch:
  - missing workspace entitlements in billing fixture,
  - enterprise action path should not call checkout,
  - accessibility warnings when using `<a>` through button primitives.
- [ ] Run:
  - `pnpm run typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm web:test:e2e:chromium`

## Acceptance Criteria

- 1. Enterprise target in upgrade flow never starts checkout.
- 2. Invite/member enforcement uses resolved workspace entitlements for both checks and current usage.
- 3. Current-plan display uses effective entitlements, not static catalog values.
- 4. Admin feature overrides represent tri-state semantics correctly.
- 5. Contract is centralized and stable enough to prevent regressions from partial payloads.

## Current milestone checkpointing

- [ ] Plan: modular contracts are defined and consumed by core callers.
- [ ] Checkpoint: server enforcement and action model migration complete.
- [ ] Checkpoint: billing UI now always renders from resolved entitlements.
- [ ] Checkpoint: enterprise contact-sales path locked with no checkout fallback.
- [ ] Checkpoint: admin override tri-state + serialization suite is complete and passing.

### Workstream Evidence

| Track             | What to complete                                   | How we know                                                                |
| ----------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| Contract          | `@workspace/billing` package created               | Build passes with exported types/API and test coverage.                    |
| Server migration  | Rewire `beforeCreateInvitation` and billing checks | Unit tests no longer stub raw plan IDs; assertions use entitlement limits. |
| UI payload        | Billing loaders pass resolved entitlements         | Integration tests include missing-entitlements guard.                      |
| Checkout behavior | enterprise path uses contact-sales                 | Contract test rejects checkout for enterprise and surfaces contact action. |
| Admin overrides   | Tri-state and unlimited cases are supported        | Admin tests cover false/true/omit and unlimited numeric cases.             |

### Definition of Done

| Track                        | Command                                                                                                           | Acceptance                                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Contract foundation          | `pnpm run typecheck`                                                                                              | Domain package compiles and exports entitlements/plans/plan-action contracts cleanly.                                    |
| Server migration             | `pnpm --filter @workspace/web test test/unit/billing`                                                             | Self-serve and enterprise branches both use resolved workspace entitlements; enterprise no longer bypasses policy model. |
| UI contract completion       | `pnpm --filter @workspace/web test test/integration/components/billing/billing-upgrade-flow.integration.test.tsx` | Billing context always renders from resolved entitlement payload and contract omissions are impossible.                  |
| Checkout/contact-sales split | `pnpm --filter @workspace/web test test/unit/components/billing/upgrade-prompt-dialog.test.tsx`                   | Enterprise path is never wired to checkout and always presents contact-sales CTA/copy.                                   |
| Admin overrides              | `pnpm --filter @workspace/admin test apps/admin/test/unit/admin/workspaces.schemas.test.ts`                       | Tests verify overwrite semantics and explicit serialization for feature/limit controls.                                  |
