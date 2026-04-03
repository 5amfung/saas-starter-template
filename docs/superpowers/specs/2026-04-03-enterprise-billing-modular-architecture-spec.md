# Specification: Modular Entitlement + Billing Architecture Rebuild

**Implementation reference:** [Design document](../../design/enterprise-billing-modular-architecture.md)  
**Status:** `[ ] Planned [x] In Progress [ ] Completed`  
**Next Action:** Validate contract APIs against current test baselines before server migration.

**Revision Log:**

- 2026-04-03 (owner: architecture) — Added architectural spec aligned to modular migration.
- 2026-04-03 (owner: architecture) — Added checkpoint evidence and Definition of Done.
- 2026-04-03 (owner: architecture) — Added status conventions and revision tracking.

## Context

The current billing/entitlement work has become brittle due to mixed domain ownership:

- plan/catalog logic spread across auth and web server layers,
- UI receiving partially resolved values,
- checkout behavior inferred from plan references instead of an explicit action model.

This spec defines the architecture for a clean rebuild in development context (backward compatibility is not required).

## Objective

Build explicit, testable domain boundaries for:

- workspace plan identity and subscription state,
- entitlement resolution and enforcement,
- checkout/contact-sales decisioning,
- admin override management,
- billing and invitation policy enforcement.

## Contract-First Design

1. **Entitlement math lives in one package.**
   A dedicated module resolves entitlements and exposes helpers for checks/diffs/display.

2. **Billing orchestration and entitlement policy are separated.**
   Billing actions determine what the customer can do next (checkout vs contact-sales); entitlement resolver determines what the workspace can do now.

3. **One effective entitlement set per workspace.**
   Server must always compute a single `Entitlements` object before enforcement or display.

4. **Overrides are partial JSON patches.**
   Omitted override key means inherit, present key means force that value.

## Public Contract (minimum required)

### 1) Entitlement package API

- `type LimitKey = 'members' | 'projects' | 'workspaces' | 'apiKeys'`
- `type FeatureKey = 'sso' | 'auditLogs' | 'apiAccess' | 'prioritySupport'`
- `type QuotaKey = 'storageGb' | 'apiCallsMonthly'`
- `interface Entitlements { limits; features; quotas }`
- `resolveEntitlements(base, overrides)`
- `checkLimit(entitlements, key, usage)`
- `hasFeature(entitlements, feature)`
- `computeEntitlementDiff(from, to)`
- `describeEntitlements(entitlements, metadata)`

### 2) Billing plan-action contract

- `type PlanAction = 'current' | 'upgrade' | 'downgrade' | 'cancel' | 'contact_sales'`

### 3) Runtime contract from server to UI

Billing UI payload must provide:

- workspace plan info,
- current subscription plan id,
- `currentEntitlements` (resolved, effective),
- catalog plans (for upgrade targets),
- plan action for each target plan.

## Domain boundary rules

- `@workspace/auth`
  - handles identity/session and subscription persistence,
  - does not own business-rule checks for workspace capabilities.
- `@workspace/billing` (or equivalent domain package)
  - owns `Entitlements`, `resolveEntitlements`, `checkLimit`, `hasFeature`,
  - owns plan action calculation for workspace transitions.
- `apps/web/src/billing/*`
  - receives resolved entitlements from server,
  - renders UI states only; must not re-compute enforcement policy.
- `apps/admin`
  - manages admin-only override CRUD only,
  - serializes tri-state overrides cleanly.

## Required behavior

### Billing UI behavior

- Self-serve plans must keep checkout flow.
- Enterprise plan cards must render “Custom pricing” and `Contact Sales`.
- No call to checkout for enterprise targets.

### Enforcement behavior

- Invite/member-limit checks must call workspace-resolved entitlements.
- Workspace self-serve plans resolve using subscription + plan defaults.
- Enterprise workspaces resolve using subscription + overrides (if present), not plan defaults alone.

### Admin behavior

- Admin override UI for feature flags uses explicit states:
  - inherit default,
  - force `true`,
  - force `false`.
- Numeric override UI can represent:
  - inherit default (blank),
  - explicit value,
  - explicit unlimited.

## Migration plan

1. Add the modular billing package with complete tests.
2. Migrate server enforcement (`beforeCreateInvitation`, limits) to the package.
3. Normalize billing payload contract and remove UI fallback assumptions.
4. Implement enterprise-contact-sales action path and remove checkout assumptions.
5. Finish admin override serialization and tri-state validation.
6. Add cross-layer regression tests for:
   - contract completeness (no undefined entitlements),
   - enterprise vs self-serve transitions,
   - accessibility-safe button/link usage.

## Execution checkpoints

- [ ] Contract-first domain APIs are implemented and used by all billing/enforcement callers.
- [ ] Plan action matrix is the single source of truth for checkout/contact-sales behavior.
- [ ] Workspace entitlement resolution occurs before every policy check and every billing render.
- [ ] Invite flow no longer reads plan IDs directly for limits.
- [ ] Admin override validation preserves inherit / force-false / force-true semantics.

### Checkpoint Evidence

| Checkpoint                      | Decision proof                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Contract implementation         | `resolveEntitlements`, `checkLimit`, `hasFeature`, `getWorkspacePlanAction` imported into server callers only. |
| Action matrix authority         | Checkout functions branch on action enum and explicitly reject enterprise targets.                             |
| Resolution before policy checks | Server loaders call entitlement resolution helper in every path that enforces limits.                          |
| Invite enforcement migration    | Invite tests cover enterprise and self-serve transitions with no direct plan constant comparisons.             |
| Admin override semantics        | Validation tests assert saved payload omits inherited keys and includes explicit `false`/`true`.               |

### Definition of Done

| Checkpoint                        | Verification                                                                                                      | Completion criteria                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Contract-first API implementation | `pnpm --filter @workspace/auth test packages/auth/test/unit/entitlements.test.ts`                                 | APIs exist, are stable, and all consumers compile against them.                                |
| Checkout/contact-sales authority  | `pnpm --filter @workspace/web test test/unit/billing/billing.server.test.ts`                                      | No checkout execution for enterprise target; action enum is authoritative in transition logic. |
| Resolution-before-render/check    | `pnpm --filter @workspace/web test test/integration/components/billing/billing-upgrade-flow.integration.test.tsx` | Tests cannot run with undefined entitlements; server returns resolved entitlements in payload. |
| Invite flow migration             | `pnpm --filter @workspace/web test test/unit/workspace/workspace.functions.test.ts` (or equivalent invite tests)  | Invite checks rely on entitlement checks, not raw plan constants.                              |
| Admin override validation         | `pnpm --filter @workspace/admin test apps/admin/test/unit/admin/workspaces.functions.test.ts`                     | Tests cover inherited, forced true, forced false, and unlimited serialization paths.           |
