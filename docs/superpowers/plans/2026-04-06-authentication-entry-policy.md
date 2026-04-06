# Authentication Entry Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a first-class auth-entry policy layer so `apps/web` and `apps/admin` stop re-deriving entry decisions from raw session fields, role checks, and hidden workspace side effects.

**Architecture:** Keep `packages/policy` pure by adding shared auth-entry facts and app-entry evaluators there, keep `packages/auth` focused on raw session/auth primitives, and move redirect/error mapping into app-local policy guards. Reuse the existing admin capability pattern as the template, but broaden it to cover the real Section 14.1 seams: session validity, email verification, workspace readiness for `web`, and platform-admin access for `admin`.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, TanStack Start, Better Auth, ESLint, Vitest, Playwright

---

## Scope and Gap Closure

This plan addresses the specific gaps called out by Section 14.1 in `docs/superpowers/specs/2026-04-04-shared-policy-capability-architecture-design.md`:

- no explicit auth-entry facts model,
- no clean separation between session validity, account state, onboarding/access requirements, and app-entry decisions,
- repeated web/admin redirect logic across middleware, route loaders, and server functions,
- hidden `apps/web` entry side effect where active workspace selection happens during auth middleware,
- bespoke invite-entry handling that bypasses any shared entry-policy contract.

This plan intentionally keeps scope tight:

- include `apps/web` entry, `apps/admin` entry, and web invite acceptance entry,
- do not replace workspace route/action authorization,
- do not introduce a generalized onboarding engine,
- do not broaden into billing or entitlement policy.

## File Structure

### New files

- `docs/superpowers/plans/2026-04-06-authentication-entry-policy.md`
- `packages/policy/src/auth-entry.ts`
- `packages/policy/test/unit/auth-entry.test.ts`
- `apps/web/src/policy/web-app-entry.shared.ts`
- `apps/web/src/policy/web-app-entry.server.ts`
- `apps/web/src/policy/web-app-entry.functions.ts`
- `apps/web/src/policy/web-app-entry.ts`
- `apps/web/test/unit/policy/web-app-entry.server.test.ts`
- `apps/admin/test/unit/policy/admin-app-capabilities.server.test.ts`
- `apps/web/test/e2e/auth/accept-invite-entry.spec.ts`

### Existing files expected to change

- `packages/policy/src/index.ts`
- `packages/auth/src/validators.ts`
- `apps/web/src/middleware/auth.ts`
- `apps/web/src/routes/index.tsx`
- `apps/web/src/routes/_auth.tsx`
- `apps/web/src/routes/_protected.tsx`
- `apps/web/src/routes/accept-invite.tsx`
- `apps/web/src/workspace/workspace.server.ts`
- `apps/admin/src/auth/validators.ts`
- `apps/admin/src/middleware/auth.ts`
- `apps/admin/src/routes/index.tsx`
- `apps/admin/src/routes/_auth.tsx`
- `apps/admin/src/routes/_protected.tsx`
- `apps/admin/src/policy/admin-app-capabilities.shared.ts`
- `apps/admin/src/policy/admin-app-capabilities.server.ts`
- `apps/admin/src/policy/admin-app-capabilities.functions.ts`
- `apps/web/eslint.config.js`
- `apps/admin/eslint.config.js`

### Responsibility map

- `packages/policy/src/auth-entry.ts`
  Owns pure auth-entry fact types, app-entry outcomes, evaluators, and tiny helper predicates.
- `apps/web/src/policy/web-app-entry.shared.ts`
  Owns web-specific fact normalization from raw session/workspace state into `packages/policy` inputs.
- `apps/web/src/policy/web-app-entry.server.ts`
  Owns web entry fact loading, typed guards, and redirect mapping for web app entry.
- `apps/admin/src/policy/admin-app-capabilities.*`
  Continues to own admin app entry, but migrates from raw role normalization to the shared auth-entry evaluator pattern.
- `packages/auth/src/validators.ts` and `apps/admin/src/auth/validators.ts`
  Shrink back to auth-generic session helpers or become thin wrappers over app policy guards; they should no longer own app-entry semantics.
- `apps/web/src/workspace/workspace.server.ts`
  Exposes the lowest-correct workspace readiness helper used by web entry fact loading without embedding redirect behavior.
- ESLint configs
  Add guardrails so routes stop authorizing entry from raw `session.user.emailVerified`, `session.user.role`, or direct workspace-session booleans.

## Task 1: Freeze the auth-entry contract in `packages/policy`

**Files:**

- Create: `packages/policy/src/auth-entry.ts`
- Create: `packages/policy/test/unit/auth-entry.test.ts`
- Modify: `packages/policy/src/index.ts`

- [x] **Step 1: Write failing evaluator tests for the current entry matrix**

Cover at least:

- guest cannot enter `apps/web`,
- signed-in unverified user cannot enter `apps/web` and must verify email,
- verified web user with accessible workspaces but no active workspace can enter only after workspace resolution,
- guest cannot enter `apps/admin`,
- verified non-admin user cannot enter `apps/admin` and gets an admin-only denial outcome,
- verified admin can enter `apps/admin`.

- [x] **Step 2: Implement shared auth-entry fact and outcome types**

Add a pure module with contracts similar to:

```ts
export interface AuthEntryFacts {
  hasSession: boolean;
  emailVerified: boolean;
  platformRole: 'admin' | 'user' | null;
}

export interface WebAppEntryFacts extends AuthEntryFacts {
  activeWorkspaceId: string | null;
  accessibleWorkspaceCount: number;
}

export interface WebAppEntryCapabilities {
  canEnterWebApp: boolean;
  mustSignIn: boolean;
  mustVerifyEmail: boolean;
  mustResolveWorkspace: boolean;
}

export interface AdminAppEntryCapabilities {
  canEnterAdminApp: boolean;
  mustSignIn: boolean;
  mustVerifyEmail: boolean;
  isAdminOnlyDenied: boolean;
}
```

Keep this evaluator pure. Do not add redirects, request headers, or Better Auth calls here.

- [x] **Step 3: Encode the initial evaluator rules**

Use the current repo behavior as the initial matrix:

- `web`
  - no session -> `mustSignIn`
  - unverified session -> `mustVerifyEmail`
  - verified session with `accessibleWorkspaceCount === 0` -> `mustResolveWorkspace`
  - verified session with workspace access -> `canEnterWebApp`
- `admin`
  - no session -> `mustSignIn`
  - unverified session -> `mustVerifyEmail`
  - verified non-admin -> `isAdminOnlyDenied`
  - verified admin -> `canEnterAdminApp`

- [x] **Step 4: Export the auth-entry module from the package surface**

Update `packages/policy/src/index.ts` to export the new auth-entry types and evaluators without disturbing existing workspace/admin exports.

- [x] **Step 5: Verify targeted package checks**

Run:

- `pnpm --filter @workspace/policy test test/unit/auth-entry.test.ts`
- `pnpm --filter @workspace/policy typecheck`

- [ ] **Step 6: Commit**

```bash
git add packages/policy
git commit -m "feat(policy): add auth entry evaluators"
```

## Task 2: Add a web app-entry policy layer that owns workspace readiness

**Files:**

- Create: `apps/web/src/policy/web-app-entry.shared.ts`
- Create: `apps/web/src/policy/web-app-entry.server.ts`
- Create: `apps/web/src/policy/web-app-entry.functions.ts`
- Create: `apps/web/src/policy/web-app-entry.ts`
- Create: `apps/web/test/unit/policy/web-app-entry.server.test.ts`
- Modify: `apps/web/src/workspace/workspace.server.ts`

- [x] **Step 1: Write failing web entry server tests first**

Cover at least:

- guest resolves to sign-in redirect,
- unverified session resolves to verify redirect,
- verified session with no active workspace but at least one accessible workspace resolves workspace first,
- verified session with no accessible workspaces returns a typed blocked result instead of silently failing,
- verified session with active workspace returns `canEnterWebApp`.

- [x] **Step 2: Add focused workspace-readiness helpers**

Refactor `apps/web/src/workspace/workspace.server.ts` so the entry layer can load facts without hidden redirects or mixed auth semantics. Add helpers shaped like:

```ts
export async function listAccessibleWorkspaces(headers: Headers) {
  return getAuth().api.listOrganizations({ headers });
}

export async function resolvePreferredWorkspace(
  headers: Headers,
  session: { session?: { activeOrganizationId?: string | null } }
) {
  // Return the chosen workspace or null; do not redirect here.
}
```

Keep selection logic in the workspace module, but keep entry decisions in the policy module.

- [x] **Step 3: Implement the web entry fact loader**

In `apps/web/src/policy/web-app-entry.server.ts`, load:

- raw session from Better Auth,
- email verification state,
- current `activeOrganizationId`,
- accessible workspace count,
- preferred workspace resolution result when active workspace is missing.

Then pass those facts into `evaluateWebAppEntry(...)`.

- [x] **Step 4: Add web app-entry guards and client-safe accessors**

Expose app-facing helpers similar to:

```ts
export async function getCurrentWebAppEntry(headers?: Headers);
export async function requireWebAppEntry(headers?: Headers);
```

Also expose `createServerFn` and hook-facing wrappers so routes/components can consume evaluated entry state rather than calling `authClient.useSession()` plus custom booleans everywhere.

- [x] **Step 5: Move active-workspace side effects behind explicit entry handling**

`requireWebAppEntry(...)` may still set the active workspace when the evaluator returns `mustResolveWorkspace`, but that side effect must be explicit in the app-entry guard instead of hidden in generic auth middleware.

Keep this as a documented transition behavior:

- evaluator decides whether workspace resolution is required,
- web guard performs workspace resolution,
- route proceeds only after the guard can return `canEnterWebApp`.

- [x] **Step 6: Verify targeted web checks**

Run:

- `pnpm --filter @workspace/web test test/unit/policy/web-app-entry.server.test.ts`
- `pnpm --filter @workspace/web typecheck`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/policy apps/web/src/workspace apps/web/test/unit/policy
git commit -m "feat(web): add web app entry policy"
```

## Task 3: Refactor web middleware and root/auth routes to consume the new entry policy

**Files:**

- Modify: `apps/web/src/middleware/auth.ts`
- Modify: `apps/web/src/routes/index.tsx`
- Modify: `apps/web/src/routes/_auth.tsx`
- Modify: `apps/web/src/routes/_protected.tsx`
- Modify: `packages/auth/src/validators.ts`

- [x] **Step 1: Replace middleware coupling with app-entry guards**

Update `apps/web/src/middleware/auth.ts` so protected entry uses the web app-entry guard, not `getVerifiedSession()` plus `ensureActiveWorkspaceForSession()` directly.

- [x] **Step 2: Make guest-route behavior consume typed entry outcomes**

For `apps/web/src/routes/_auth.tsx` and `apps/web/src/routes/index.tsx`, stop deriving entry decisions from:

```ts
session?.user.emailVerified;
```

Instead consume the new web app-entry helpers so the root route and auth layout redirect according to the same entry matrix.

- [x] **Step 3: Keep `packages/auth` auth-generic**

Reduce `packages/auth/src/validators.ts` to session/auth primitives only, for example:

- `getSessionOrNull(...)`
- `requireVerifiedSession(...)`

Do not keep web app entry redirects there; those belong in `apps/web/src/policy/web-app-entry.server.ts`.

- [x] **Step 4: Update protected-layout client behavior**

Refactor `apps/web/src/routes/_protected.tsx` so the client-side fallback uses evaluated entry state instead of `authClient.useSession()` plus `emailVerified`.

If the app already guarantees server redirect correctness, prefer a minimal loading/null state and avoid duplicating authorization logic in the component.

- [x] **Step 5: Verify route and middleware tests**

Run:

- `pnpm --filter @workspace/web test test/unit/middleware/auth.test.ts`
- `pnpm --filter @workspace/web test test/unit/components/app-sidebar.test.ts`
- `pnpm --filter @workspace/web typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/middleware/auth.ts apps/web/src/routes apps/web/test packages/auth/src/validators.ts
git commit -m "refactor(web): route entry through app policy"
```

## Task 4: Align admin entry with the shared auth-entry evaluator

**Files:**

- Modify: `apps/admin/src/policy/admin-app-capabilities.shared.ts`
- Modify: `apps/admin/src/policy/admin-app-capabilities.server.ts`
- Modify: `apps/admin/src/policy/admin-app-capabilities.functions.ts`
- Modify: `apps/admin/src/auth/validators.ts`
- Modify: `apps/admin/src/middleware/auth.ts`
- Modify: `apps/admin/src/routes/index.tsx`
- Modify: `apps/admin/src/routes/_auth.tsx`
- Modify: `apps/admin/src/routes/_protected.tsx`
- Create: `apps/admin/test/unit/policy/admin-app-capabilities.server.test.ts`

- [x] **Step 1: Write failing admin entry tests**

Cover:

- guest -> sign-in,
- unverified user -> verify,
- verified non-admin -> admin-only denial,
- verified admin -> dashboard access,
- auth layout redirects only for admin-capable sessions.

- [x] **Step 2: Replace raw role normalization with shared entry evaluation**

Refactor `apps/admin/src/policy/admin-app-capabilities.shared.ts` to build `AuthEntryFacts` from the raw session and call the shared `evaluateAdminAppEntry(...)` logic.

Keep the existing admin capability API shape where practical so the route blast radius stays small.

- [x] **Step 3: Move redirect mapping into admin policy guards**

Update `apps/admin/src/auth/validators.ts` and `apps/admin/src/middleware/auth.ts` so they become thin adapters over admin entry policy outcomes instead of re-implementing:

```ts
session.user.emailVerified;
session.user.role === 'admin';
```

- [x] **Step 4: Simplify route components**

Update `apps/admin/src/routes/index.tsx`, `apps/admin/src/routes/_auth.tsx`, and `apps/admin/src/routes/_protected.tsx` so they rely on the same evaluated admin entry state across root redirect, auth layout, and protected shell.

- [x] **Step 5: Verify targeted admin checks**

Run:

- `pnpm --filter @workspace/admin-web test test/unit/policy/admin-app-capabilities.server.test.ts`
- `pnpm --filter @workspace/admin-web test test/unit/hooks/use-session-query.test.ts`
- `pnpm --filter @workspace/admin-web typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/policy apps/admin/src/auth apps/admin/src/middleware apps/admin/src/routes apps/admin/test/unit/policy
git commit -m "refactor(admin): share auth entry evaluation"
```

## Task 5: Pull invite acceptance into the entry-policy model

**Files:**

- Modify: `apps/web/src/routes/accept-invite.tsx`
- Create: `apps/web/test/e2e/auth/accept-invite-entry.spec.ts`

- [x] **Step 1: Convert invite entry rules into explicit entry outcomes**

Keep the existing product behavior, but stop open-coding the state machine in the route:

- missing session -> sign-up with redirect back to invite,
- unverified session -> sign out then sign-up with redirect,
- verified session -> accept invite.

Route this through the web app-entry helpers or a small invite-entry helper built on the same auth-entry facts.

- [x] **Step 2: Preserve invite-specific redirect intent**

Do not lose:

```ts
const returnTo = `/accept-invite?id=${encodeURIComponent(id)}`;
```

The policy/guard layer should decide eligibility; the route should keep ownership of invite-token-specific redirect targets and UI messaging.

- [x] **Step 3: Add end-to-end coverage for invite edge cases**

Cover:

- unauthenticated invite visit,
- unverified signed-in invite visit,
- verified signed-in invite visit.

- [x] **Step 4: Verify invite flow checks**

Run:

- `pnpm --filter @workspace/web test:e2e test/e2e/auth/accept-invite-entry.spec.ts`

If the repo’s actual e2e path differs, place the spec under the existing auth e2e folder and run the exact matching command for that file.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/accept-invite.tsx apps/web/test/e2e/auth/accept-invite-entry.spec.ts
git commit -m "test(web): cover invite entry policy"
```

## Task 6: Add lint and architectural checks against entry-policy drift

**Files:**

- Modify: `apps/web/eslint.config.js`
- Modify: `apps/admin/eslint.config.js`

- [x] **Step 1: Add route-level restrictions for raw auth-entry checks**

Extend route lint rules to catch direct authorization from patterns such as:

```ts
session?.user.emailVerified;
session.user.role === 'admin';
activeOrganizationId;
```

Scope this to route files and only where the expression is being used as an entry authorization decision, not for harmless display logic.

- [x] **Step 2: Prefer app policy modules in route code**

Add or extend restricted-import rules so routes/components consume app policy helpers/hooks instead of server-only modules or raw session checks for entry.

- [x] **Step 3: Verify static checks**

Run:

- `pnpm run lint`
- `pnpm run check:boundaries`

- [ ] **Step 4: Commit**

```bash
git add apps/web/eslint.config.js apps/admin/eslint.config.js
git commit -m "chore(lint): guard auth entry policy boundaries"
```

## Task 7: Run final regression verification for the auth-entry slice

**Files:**

- Modify: `docs/superpowers/specs/2026-04-04-shared-policy-capability-architecture-design.md`

- [x] **Step 1: Run the narrowest meaningful regression set**

Run:

- `pnpm --filter @workspace/policy test test/unit/auth-entry.test.ts`
- `pnpm --filter @workspace/web test test/unit/policy/web-app-entry.server.test.ts`
- `pnpm --filter @workspace/admin-web test test/unit/policy/admin-app-capabilities.server.test.ts`
- `pnpm --filter @workspace/web typecheck`
- `pnpm --filter @workspace/admin-web typecheck`

- [x] **Step 2: Run broader repo-level safety checks**

Run:

- `pnpm run lint`
- `pnpm run check:boundaries`

- [x] **Step 3: Update the original design doc’s follow-up status**

Add a brief note under Section 14.1 or an adjacent follow-up note that the repo now has an auth-entry policy slice for:

- web app entry,
- admin app entry,
- invite entry,

and list any remaining future work such as richer onboarding requirements beyond email verification and workspace readiness.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-04-shared-policy-capability-architecture-design.md
git commit -m "docs(policy): record auth entry follow-up status"
```

## Self-Review

### Spec coverage

This plan covers each open area from Section 14.1:

- explicit auth-entry facts: Task 1
- separated app-entry decisions: Tasks 1, 2, 4
- web/admin entry questions: Tasks 2, 3, 4
- onboarding/access requirements via email verification and workspace readiness: Tasks 1, 2, 5
- shared guard/testing conventions: Tasks 5, 6, 7

### Remaining intentionally out of scope

- generic onboarding workflow engine,
- non-entry account-state policy outside verification/workspace readiness,
- replacing deeper workspace/page/action capability architecture,
- billing/feature-access entry rules.
