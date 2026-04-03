# Specification: Enterprise Billing and Entitlement Modular Rebuild

**Implementation reference:** [Design document](../../design/enterprise-billing-modular-architecture.md)  
**Status:** `[ ] Planned [x] In Progress [ ] Completed`  
**Date:** 2026-04-03

## 1. Context

The branch has shown repeated regressions caused by mixed domain ownership and implicit contracts across auth, billing, and admin.

This spec defines a clean-slate modular contract. Backward compatibility is not required.

## 2. Objective

Provide one stable billing domain API that owns:

- plan action decisions,
- entitlement resolution,
- entitlement enforcement,
- override persistence orchestration,
- checkout eligibility.

Application layers (`apps/web`, `apps/admin`) consume that API and do not access billing tables directly.

## 3. Contract requirements

## 3.1 Public query API

- `getWorkspaceBillingSnapshot(input)`
- `getWorkspaceEntitlements(input)`
- `previewPlanChange(input)`
- `getWorkspaceEntitlementOverrides(input)`

## 3.2 Public command API

- `setWorkspaceEntitlementOverrides(input)`
- `clearWorkspaceEntitlementOverrides(input)`
- `createCheckoutSession(input)`

## 3.3 Public policy API

- `assertWorkspaceLimit(input)`
- `assertWorkspaceFeature(input)`
- `assertInviteAllowed(input)`

## 3.4 Domain types

- `LimitKey = members | projects | workspaces | apiKeys`
- `FeatureKey = sso | auditLogs | apiAccess | prioritySupport`
- `QuotaKey = storageGb | apiCallsMonthly`
- `Entitlements = { limits, features, quotas }`
- `PlanAction = current | upgrade | downgrade | cancel | contact_sales | unavailable`

## 4. Hard boundary rules

1. `apps/web` must not import billing override/subscription tables.
2. `apps/admin` must not import billing override/subscription tables.
3. `@workspace/auth` does not implement entitlement math.
4. Plan transition behavior is derived from `PlanAction`, not inferred from plan IDs in UI.
5. UI receives resolved `currentEntitlements` from server snapshot payloads.

## 4.1 Drift prevention requirements

1. CI must include a forbidden-import check for:
   - `apps/web -> @workspace/db-schema` billing tables,
   - `apps/admin -> @workspace/db-schema` billing tables,
   - app imports of `@workspace/billing` internal infrastructure paths.
2. CI must include dependency direction checks:
   - `@workspace/billing` cannot depend on app modules,
   - app modules cannot bypass `@workspace/billing` public API for billing concerns.
3. Billing payload contract must be schema-validated:
   - runtime validation in server boundary,
   - fixture builders in tests must include required snapshot fields.
4. Public billing-contract changes require same-PR updates to docs and contract tests.

## 5. Functional requirements

### Billing and checkout

- Enterprise target plan must return `contact_sales` and never create a Stripe checkout session.
- Self-serve upgrade targets create checkout sessions.
- Downgrade preview uses entitlement diff from domain contract.

### Enforcement

- Invitation/member checks call billing policy APIs.
- Enforcement always uses resolved workspace entitlements.
- No raw plan constant checks in application enforcement paths.

### Admin overrides

- Feature overrides support inherit/true/false.
- Numeric overrides support inherit/value/unlimited.
- Persisted payloads contain only explicit override keys.

## 6. Error model

Billing package returns typed domain errors:

- `LIMIT_EXCEEDED`
- `FEATURE_NOT_ENABLED`
- `CHECKOUT_NOT_ALLOWED`
- `CONTACT_SALES_REQUIRED`
- `INVALID_OVERRIDE_PAYLOAD`
- `WORKSPACE_NOT_FOUND`

Each error includes stable `code`, user-safe `message`, and optional `metadata`.

## 7. Test requirements

### Contract and boundaries

- compile-time/lint rule tests fail if app code imports billing tables.
- contract tests verify query/command signatures and error codes.
- dependency-direction checks fail when layer rules are violated.

### Behavior

- enterprise checkout rejection path test.
- invitation enforcement on resolved entitlement test.
- billing page payload includes `currentEntitlements` test.
- admin tri-state and numeric serialization test.

### Accessibility

- link/button interactions in billing/admin tests must not emit `nativeButton` misuse warnings.

## 8. Definition of done

1. All enforcement and checkout decisions route through billing contract APIs.
2. App layers contain zero direct billing table imports.
3. Enterprise contact-sales behavior is enforced server-side and represented in UI action model.
4. Billing UI renders from resolved snapshot data only.
5. Admin override round-trip behavior is fully covered by tests.
6. Drift prevention checks are active and required in CI.
