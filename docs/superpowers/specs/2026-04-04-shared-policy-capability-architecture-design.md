# Shared Policy Capability Architecture Design

**Date:** 2026-04-04
**Goal:** Centralize business policy into shared capability evaluators so `apps/web` and `apps/admin` stop re-deriving authorization and workflow rules from scattered role checks.
**Approach:** Introduce a shared `packages/policy` core with pure evaluators and typed capability contracts; keep fact loading and route integration inside each app.
**Scope exclusion:** This design does not broaden authentication policy ownership yet. Signed-in and verified-user checks remain in auth/middleware preconditions for now.

---

## 1. Context

The repo has package structure and some boundary enforcement, but business decisions are still spread across route components, UI composition, hooks, server functions, and auth glue.

This creates semantic drift:

- nav visibility can differ from direct URL access,
- route access can differ from action access,
- UI can expose actions that backend logic later rejects,
- package ownership is blurred when multiple layers encode the same rule.

Concrete examples already exist in the current codebase:

- workspace Billing nav visibility is checked in UI while direct route access is not blocked at the route boundary,
- workspace invite behavior is partially role-gated in UI but enforced differently elsewhere,
- workspace settings and delete behavior combine role, billing state, and workspace lifecycle conditions inside route code,
- `packages/auth` and `packages/billing` both carry billing-related semantics that are at risk of diverging.

The immediate scaling problem is not only modularity. It is missing policy ownership.

## 2. Objective

Create one stable policy architecture pattern that answers:

- what facts are loaded,
- where decisions are evaluated,
- how routes/actions/UI consume those decisions,
- how the repo prevents future drift.

The first target is workspace policy in `apps/web`, but the architecture must also support `apps/admin` through a parallel platform-admin capability model.

## 3. Core Design Principles

1. UI does not authorize. UI renders capabilities.
2. Routes guard page access.
3. Server functions guard action access.
4. Roles are policy inputs, not business decisions.
5. Shared packages own contracts and evaluators.
6. Apps own fact loading, redirects, and framework integration.
7. Policy evaluation stays pure and typed.
8. Authentication preconditions remain outside policy until intentionally expanded later.

## 4. Authority Domains

The term `admin` currently refers to two different authority systems and must be separated explicitly.

### 4.1 Platform authority

- source: `user.role`
- app context: `apps/admin`
- purpose: access to platform administration features

### 4.2 Workspace authority

- source: `member.role`
- app context: `apps/web`
- purpose: access to workspace pages and actions

The same human may satisfy both authority systems, but the active app determines which policy model applies.

Rules:

- a platform admin in `apps/admin` acts only through platform policy,
- the same person in `apps/web` acts only through workspace policy,
- there is no implicit platform-admin bypass in the web app.

## 5. Package Structure And Ownership

Introduce a new shared package:

- `packages/policy`

### 5.1 `packages/policy` owns

- authority domain types
- capability contract types
- pure capability evaluators
- guard/assertion helpers over evaluated capabilities
- policy error/result types where needed

### 5.2 `packages/policy` must not own

- database access
- Better Auth calls
- React hooks/components
- TanStack route logic
- redirects
- direct infrastructure integrations

### 5.3 App-owned integration layers

#### `apps/web`

Owns:

- session/workspace fact loading
- billing/lifecycle fact loading for workspace policy
- route guard integration
- server-function guard integration
- UI hooks/selectors that expose capabilities to components

#### `apps/admin`

Owns:

- session/platform-role fact loading
- route guard integration
- server-function guard integration
- admin-app hooks/selectors that expose capabilities to components

## 6. Shared Policy Contracts

### 6.1 Workspace policy context

Initial shape:

```ts
type WorkspaceRole = 'owner' | 'admin' | 'member';

interface WorkspacePolicyContext {
  workspaceRole: WorkspaceRole | null;
  isLastWorkspace: boolean;
  hasActiveSubscription: boolean;
}
```

Only facts required for actual business decisions belong here.

### 6.2 Workspace capabilities

Initial shape:

```ts
interface WorkspaceCapabilities {
  workspaceRole: WorkspaceRole | null;

  canViewOverview: boolean;
  canViewProjects: boolean;
  canViewMembers: boolean;
  canViewSettings: boolean;
  canViewBilling: boolean;

  canInviteMembers: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
  canManageBilling: boolean;
  canDeleteWorkspace: boolean;
}
```

Capability names should describe user-meaningful decisions, not raw facts.

### 6.3 Admin-app policy context

Initial shape:

```ts
type PlatformRole = 'admin' | 'user';

interface AdminAppPolicyContext {
  platformRole: PlatformRole | null;
}
```

### 6.4 Admin-app capabilities

Initial shape:

```ts
interface AdminAppCapabilities {
  platformRole: PlatformRole | null;

  canAccessAdminApp: boolean;
  canViewAdminDashboard: boolean;
  canViewUsers: boolean;
  canViewWorkspaces: boolean;
  canManageEntitlementOverrides: boolean;
}
```

## 7. Initial Capability Rules

### 7.1 Workspace app

#### `member`

- can view overview/projects/members
- cannot view settings
- cannot view billing
- cannot invite members
- cannot manage members
- cannot manage settings
- cannot manage billing
- cannot delete workspace

#### `admin`

- can view overview/projects/members/settings/billing
- can invite/manage members
- can manage settings
- can manage billing
- cannot delete workspace

#### `owner`

- everything `admin` can do
- can delete workspace only when:
  - `isLastWorkspace === false`
  - `hasActiveSubscription === false`

### 7.2 Admin app

#### platform `admin`

- can access admin app
- can view admin dashboard
- can view users
- can view workspaces
- can manage entitlement overrides

#### platform `user`

- cannot access admin app capabilities

## 8. Evaluator And Guard Pattern

The shared package should expose pure evaluators such as:

- `evaluateWorkspaceCapabilities(context)`
- `evaluateAdminAppCapabilities(context)`

App integration layers should expose guard-oriented APIs such as:

- `getWorkspaceCapabilities(...)`
- `requireWorkspaceCapability(..., capability)`
- `getAdminAppCapabilities(...)`
- `requireAdminAppCapability(..., capability)`

Expected usage pattern:

1. app code loads domain facts,
2. app code constructs a policy context,
3. shared evaluator computes capabilities,
4. route/actions/UI consume the capability result.

## 9. Consumption Rules By Layer

### 9.1 UI components

UI components may:

- read capabilities,
- render or hide affordances from capabilities,
- display denial messaging from capability-aware state.

UI components must not:

- derive authorization from raw role comparisons,
- treat action failure as the primary enforcement path,
- encode business policy from billing/lifecycle facts directly.

### 9.2 Route loaders

Route loaders must:

- enforce page access before page behavior proceeds,
- use capability guards rather than duplicated role logic.

### 9.3 Server functions

Server functions must:

- enforce action access at the mutation/query boundary,
- use capability guards rather than bespoke role checks.

## 10. First Migration Slice

The first end-to-end migration slice should cover:

1. Billing
2. Settings
3. Invite/member management

These features are the best initial slice because they already show:

- nav visibility vs route access mismatch,
- UI permission vs backend permission mismatch,
- role plus billing/lifecycle cross-domain rules,
- multiple enforcement points that need one source of truth.

## 11. Enforcement Tools

Drift prevention must be implemented with normal developer workflow tools, not only documentation.

### 11.1 ESLint

Add targeted rules to:

- forbid raw workspace role comparisons outside policy modules and approved tests,
- forbid route/components from importing low-level role helpers when capabilities should be used,
- forbid direct protected `authClient.organization.*` mutation usage from UI layers where guarded wrappers/server functions are required,
- forbid direct imports of policy internals outside public entry points.

### 11.2 Dependency Cruiser

Extend boundary rules to:

- allow apps to consume `packages/policy` public APIs only,
- prevent `packages/policy` from importing app code or infrastructure code,
- prevent UI layers from bypassing app policy modules for protected decisions,
- keep `packages/policy` pure and framework-agnostic.

### 11.3 Typed API design

Enforcement should also come from the API shape:

- routes/components should naturally consume capability contracts,
- server actions should naturally call guard helpers,
- public capability names should be typed and discoverable.

### 11.4 Architectural tests

Add focused tests for:

- capability matrices by role/context,
- route denial behavior before page behavior/data loading,
- server-action denial behavior,
- regressions for billing/settings/invite scenarios already discussed.

### 11.5 Review checklist

Add policy-specific review questions:

- does the feature define or update capabilities?
- is page access guarded?
- is action access guarded?
- does UI render from capabilities rather than raw roles?
- is business logic duplicated across layers or packages?

## 12. Package Convergence After Policy Adoption

After the new policy layer is stable in real usage:

- reduce duplicated billing-semantic ownership,
- converge on `packages/billing` as the single owner of billing semantics,
- keep `packages/auth` focused on auth and organization integration,
- keep `packages/policy` focused on capability contracts/evaluation rather than data loading or domain persistence.

This convergence step must happen after the capability pattern is proven, not before.

## 13. Out Of Scope For V1

- replacing the current auth/middleware entry checks,
- introducing a full custom permission-statement engine,
- introducing CASL or another generalized authorization library,
- merging workspace and platform authority into one policy model,
- solving every scattered policy domain at once.

The first goal is to establish one successful policy architecture pattern that can later be expanded to auth and other domains.

## 14. Follow-Up Expansion Areas

After the workspace-policy migration is stable, the same architecture pattern should be considered for other scattered decision domains.

These are follow-up candidates, not part of the first implementation slice.

### 14.1 Authentication and entry policy

Current repo behavior suggests authentication-entry rules are also spread across middleware, route loaders, and auth-related modules.

Potential future direction:

- define explicit auth-entry facts,
- evaluate app-entry capabilities from those facts,
- keep a clean separation between:
  - session validity,
  - account state,
  - onboarding/access requirements,
  - app-entry decisions.

Example future questions:

- can this user enter `apps/web`?
- can this user enter `apps/admin`?
- must this user complete onboarding or verification steps before continuing?

Follow-up status as of 2026-04-06:

- implemented an auth-entry policy slice for `apps/web` entry, `apps/admin` entry, and web invite acceptance entry,
- centralized entry evaluation around shared auth-entry facts plus app-local redirect/guard mapping,
- added lint guardrails so entry routes stop re-deriving app entry from raw session email verification, role, or workspace-session fields.

Remaining future work:

- broader onboarding requirements beyond email verification and workspace readiness,
- richer account-state and access-precondition modeling if additional product entry gates are introduced.

### 14.2 Workspace lifecycle policy

Workspace creation, switching, deletion, and membership transitions can eventually adopt the same pattern:

- context facts loaded in app/server integration layers,
- pure evaluation of allowed transitions,
- typed guards for lifecycle actions.

This is especially relevant when decisions span:

- membership role,
- current workspace count,
- billing/subscription state,
- pending invitations or ownership constraints.

### 14.3 Billing and feature-access policy

Once package ownership is cleaner, the same pattern can broaden from page/action authorization into broader product policy:

- feature access by plan/entitlement,
- upgrade prompts,
- enterprise override behavior,
- plan-dependent workflow branching.

The key rule remains the same:

- apps should consume evaluated capability or entitlement contracts,
- not re-derive billing decisions from raw plan IDs or scattered booleans.

### 14.4 Admin operational policy

As `apps/admin` grows, platform-admin behavior may need richer policy modeling:

- read vs modify capabilities,
- support actions vs destructive actions,
- billing override actions vs analytics/reporting actions.

This should still be expressed as platform-admin capabilities, not as generic `isAdmin` checks in route code.

### 14.5 Shared policy platform maturity path

If multiple domains adopt the same pattern successfully, the repo can later evolve toward a broader access-control platform.

That future step could include:

- shared policy primitives across domains,
- common denial/error contracts,
- broader policy testing conventions,
- expanded lint/boundary rules,
- eventual evaluation of whether a library like CASL is justified.

That decision should happen only after the repo has proven that the current capability-based architecture is stable and insufficient in specific ways.

## 15. Definition Of Done

This design is successfully implemented when all of the following are true:

1. `apps/web` uses workspace capabilities for billing, settings, and invite/member management.
2. Billing/settings/invite UI no longer derives authorization from raw workspace role checks.
3. Billing/settings/invite routes and server functions enforce the same policy via shared capability guards.
4. `apps/admin` uses a parallel platform-admin capability model built on the same shared package style.
5. ESLint and boundary checks exist to discourage policy drift.
6. The repo has a documented pattern for `facts -> evaluator -> capabilities -> guards`.
7. The architecture remains role-based for now, with a later path to broader policy adoption if needed.
