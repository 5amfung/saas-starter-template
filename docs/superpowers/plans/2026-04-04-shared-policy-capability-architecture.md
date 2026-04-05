# Shared Policy Capability Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a shared capability-based policy architecture for `apps/web` and `apps/admin`, then migrate billing, settings, and invite/member management in `apps/web` to consume it consistently.

**Architecture:** Add a new pure `packages/policy` package that evaluates typed capabilities from app-provided facts. Keep fact loading, framework integration, redirects, and server-action guards in app-local policy modules. Migrate one representative workspace slice end to end, then add lint and boundary guardrails to prevent raw role-based policy drift from returning.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, TanStack Start, TanStack Router, Better Auth, ESLint, Dependency Cruiser, Vitest, Playwright

---

## File Structure

### New files

- `packages/policy/package.json`
- `packages/policy/tsconfig.json`
- `packages/policy/src/index.ts`
- `packages/policy/src/workspace.ts`
- `packages/policy/src/admin-app.ts`
- `packages/policy/test/unit/workspace.test.ts`
- `packages/policy/test/unit/admin-app.test.ts`
- `apps/web/src/policy/workspace-capabilities.server.ts`
- `apps/web/src/policy/workspace-capabilities.functions.ts`
- `apps/web/src/policy/workspace-capabilities.ts`
- `apps/web/test/unit/policy/workspace-capabilities.server.test.ts`
- `apps/admin/src/policy/admin-app-capabilities.server.ts`
- `apps/admin/src/policy/admin-app-capabilities.ts`
- `apps/admin/test/unit/policy/admin-app-capabilities.server.test.ts`

### Existing files expected to change

- `pnpm-workspace.yaml`
- `turbo.json`
- `apps/web/src/components/app-sidebar.tsx`
- `apps/web/src/routes/_protected/ws/$workspaceId.tsx`
- `apps/web/src/routes/_protected/ws/$workspaceId/billing.tsx`
- `apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx`
- `apps/web/src/routes/_protected/ws/$workspaceId/members.tsx`
- `apps/web/src/billing/billing.functions.ts`
- `apps/web/src/components/workspace/workspace-delete-dialog.tsx`
- `apps/web/src/workspace/use-invitations-table.ts`
- `apps/web/src/workspace/use-members-table.ts`
- `apps/web/test/e2e/workspace/billing.spec.ts`
- `apps/web/test/unit/components/app-sidebar.test.tsx`
- `apps/web/test/unit/billing/billing.functions.test.ts`
- `apps/web/eslint.config.js`
- `apps/admin/src/routes/_protected.tsx`
- `apps/admin/src/admin/workspaces.functions.ts`
- `.dependency-cruiser.cjs`
- root/package lint or check config files as needed for new package inclusion

### Responsibility map

- `packages/policy/src/workspace.ts`
  Owns workspace policy types, capability names, evaluator, and capability assertions.
- `packages/policy/src/admin-app.ts`
  Owns admin-app policy types, capability names, evaluator, and capability assertions.
- `apps/web/src/policy/*`
  Owns loading workspace facts from existing auth/billing/workspace modules and exposing app-facing guard/query helpers.
- `apps/admin/src/policy/*`
  Owns loading platform-admin facts and exposing app-facing guard/query helpers.
- route files
  Consume app policy guards and stop encoding raw role decisions.
- component files
  Consume capability data only.
- tests
  Verify evaluator correctness, app guard correctness, and end-to-end route/action behavior.

## Task 1: Create the `@workspace/policy` package skeleton

**Files:**

- Create: `packages/policy/package.json`
- Create: `packages/policy/tsconfig.json`
- Create: `packages/policy/src/index.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `turbo.json`

- [x] **Step 1: Add the new package to the workspace**

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
  - packages/*
```

Confirm `packages/*` already covers the new package; if so, no semantic change is needed beyond verifying inclusion.

- [x] **Step 2: Create the package manifest**

```json
{
  "name": "@workspace/policy",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

- [x] **Step 3: Create the package tsconfig**

```json
{
  "extends": "../typescript-config/base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

Adjust the `extends` path to the repo’s actual base tsconfig location if needed after inspection.

- [x] **Step 4: Create the initial public barrel**

```ts
export * from './workspace';
export * from './admin-app';
```

- [x] **Step 5: Run package discovery/type verification**

Run: `pnpm --filter @workspace/policy exec tsc --noEmit`
Expected: package resolves and TypeScript discovers the new package; failures should only be from files not yet created.

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml turbo.json packages/policy
git commit -m "feat(policy): scaffold shared policy package"
```

## Task 2: Implement the pure workspace policy evaluator

**Files:**

- Create: `packages/policy/src/workspace.ts`
- Create: `packages/policy/test/unit/workspace.test.ts`
- Modify: `packages/policy/src/index.ts`

- [x] **Step 1: Write the failing workspace evaluator tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  evaluateWorkspaceCapabilities,
  hasWorkspaceCapability,
  type WorkspacePolicyContext,
} from '../../src/workspace';

const baseContext = (
  overrides: Partial<WorkspacePolicyContext> = {}
): WorkspacePolicyContext => ({
  workspaceRole: 'member',
  isLastWorkspace: false,
  hasActiveSubscription: false,
  ...overrides,
});

describe('evaluateWorkspaceCapabilities', () => {
  it('grants members only read access to overview, projects, and members', () => {
    const capabilities = evaluateWorkspaceCapabilities(baseContext());

    expect(capabilities.canViewOverview).toBe(true);
    expect(capabilities.canViewProjects).toBe(true);
    expect(capabilities.canViewMembers).toBe(true);
    expect(capabilities.canViewSettings).toBe(false);
    expect(capabilities.canViewBilling).toBe(false);
    expect(capabilities.canInviteMembers).toBe(false);
  });

  it('grants admins settings, billing, and member-management access', () => {
    const capabilities = evaluateWorkspaceCapabilities(
      baseContext({ workspaceRole: 'admin' })
    );

    expect(capabilities.canViewSettings).toBe(true);
    expect(capabilities.canManageSettings).toBe(true);
    expect(capabilities.canViewBilling).toBe(true);
    expect(capabilities.canManageBilling).toBe(true);
    expect(capabilities.canInviteMembers).toBe(true);
  });

  it('allows owners to delete only when not last workspace and no active subscription', () => {
    expect(
      evaluateWorkspaceCapabilities(baseContext({ workspaceRole: 'owner' }))
        .canDeleteWorkspace
    ).toBe(true);

    expect(
      evaluateWorkspaceCapabilities(
        baseContext({ workspaceRole: 'owner', isLastWorkspace: true })
      ).canDeleteWorkspace
    ).toBe(false);

    expect(
      evaluateWorkspaceCapabilities(
        baseContext({
          workspaceRole: 'owner',
          hasActiveSubscription: true,
        })
      ).canDeleteWorkspace
    ).toBe(false);
  });

  it('returns no capabilities when the actor has no workspace role', () => {
    const capabilities = evaluateWorkspaceCapabilities(
      baseContext({ workspaceRole: null })
    );

    expect(
      Object.entries(capabilities).filter(([, value]) => value === true)
    ).toEqual([]);
  });

  it('checks capability names through helper APIs', () => {
    const capabilities = evaluateWorkspaceCapabilities(
      baseContext({ workspaceRole: 'admin' })
    );

    expect(hasWorkspaceCapability(capabilities, 'canManageBilling')).toBe(true);
    expect(hasWorkspaceCapability(capabilities, 'canDeleteWorkspace')).toBe(
      false
    );
  });
});
```

- [x] **Step 2: Run the workspace package tests to verify failure**

Run: `pnpm --filter @workspace/policy test packages/policy/test/unit/workspace.test.ts`
Expected: FAIL because `workspace.ts` does not exist yet or exported symbols are missing.

- [x] **Step 3: Implement the evaluator and helper types**

```ts
export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspacePolicyContext {
  workspaceRole: WorkspaceRole | null;
  isLastWorkspace: boolean;
  hasActiveSubscription: boolean;
}

export interface WorkspaceCapabilities {
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

export type WorkspaceCapability = keyof Omit<
  WorkspaceCapabilities,
  'workspaceRole'
>;

const emptyCapabilities = (
  workspaceRole: WorkspaceRole | null
): WorkspaceCapabilities => ({
  workspaceRole,
  canViewOverview: false,
  canViewProjects: false,
  canViewMembers: false,
  canViewSettings: false,
  canViewBilling: false,
  canInviteMembers: false,
  canManageMembers: false,
  canManageSettings: false,
  canManageBilling: false,
  canDeleteWorkspace: false,
});

export function evaluateWorkspaceCapabilities(
  context: WorkspacePolicyContext
): WorkspaceCapabilities {
  const { workspaceRole, isLastWorkspace, hasActiveSubscription } = context;
  if (!workspaceRole) return emptyCapabilities(null);

  if (workspaceRole === 'member') {
    return {
      ...emptyCapabilities(workspaceRole),
      canViewOverview: true,
      canViewProjects: true,
      canViewMembers: true,
    };
  }

  const baseAdminCapabilities: WorkspaceCapabilities = {
    ...emptyCapabilities(workspaceRole),
    canViewOverview: true,
    canViewProjects: true,
    canViewMembers: true,
    canViewSettings: true,
    canViewBilling: true,
    canInviteMembers: true,
    canManageMembers: true,
    canManageSettings: true,
    canManageBilling: true,
    canDeleteWorkspace: false,
  };

  if (workspaceRole === 'admin') return baseAdminCapabilities;

  return {
    ...baseAdminCapabilities,
    workspaceRole,
    canDeleteWorkspace: !isLastWorkspace && !hasActiveSubscription,
  };
}

export function hasWorkspaceCapability(
  capabilities: WorkspaceCapabilities,
  capability: WorkspaceCapability
): boolean {
  return capabilities[capability];
}
```

- [x] **Step 4: Export the workspace evaluator from the package barrel**

```ts
export * from './workspace';
export * from './admin-app';
```

- [x] **Step 5: Re-run the workspace policy tests**

Run: `pnpm --filter @workspace/policy test packages/policy/test/unit/workspace.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/policy/src/index.ts packages/policy/src/workspace.ts packages/policy/test/unit/workspace.test.ts
git commit -m "feat(policy): add workspace capability evaluator"
```

## Task 3: Implement the pure admin-app policy evaluator

**Files:**

- Create: `packages/policy/src/admin-app.ts`
- Create: `packages/policy/test/unit/admin-app.test.ts`
- Modify: `packages/policy/src/index.ts`

- [x] **Step 1: Write the failing admin-app evaluator tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  evaluateAdminAppCapabilities,
  hasAdminAppCapability,
  type AdminAppPolicyContext,
} from '../../src/admin-app';

describe('evaluateAdminAppCapabilities', () => {
  it('denies non-admin platform users', () => {
    const capabilities = evaluateAdminAppCapabilities({
      platformRole: 'user',
    } satisfies AdminAppPolicyContext);

    expect(capabilities.canAccessAdminApp).toBe(false);
    expect(capabilities.canViewWorkspaces).toBe(false);
  });

  it('grants platform admins access to admin-app operations', () => {
    const capabilities = evaluateAdminAppCapabilities({
      platformRole: 'admin',
    } satisfies AdminAppPolicyContext);

    expect(capabilities.canAccessAdminApp).toBe(true);
    expect(capabilities.canViewAdminDashboard).toBe(true);
    expect(capabilities.canViewUsers).toBe(true);
    expect(capabilities.canViewWorkspaces).toBe(true);
    expect(capabilities.canManageEntitlementOverrides).toBe(true);
    expect(hasAdminAppCapability(capabilities, 'canViewWorkspaces')).toBe(true);
  });
});
```

- [x] **Step 2: Run the admin-app package tests to verify failure**

Run: `pnpm --filter @workspace/policy test packages/policy/test/unit/admin-app.test.ts`
Expected: FAIL because `admin-app.ts` does not exist yet or exported symbols are missing.

- [x] **Step 3: Implement the evaluator and helpers**

```ts
export type PlatformRole = 'admin' | 'user';

export interface AdminAppPolicyContext {
  platformRole: PlatformRole | null;
}

export interface AdminAppCapabilities {
  platformRole: PlatformRole | null;
  canAccessAdminApp: boolean;
  canViewAdminDashboard: boolean;
  canViewUsers: boolean;
  canViewWorkspaces: boolean;
  canManageEntitlementOverrides: boolean;
}

export type AdminAppCapability = keyof Omit<
  AdminAppCapabilities,
  'platformRole'
>;

export function evaluateAdminAppCapabilities(
  context: AdminAppPolicyContext
): AdminAppCapabilities {
  const isPlatformAdmin = context.platformRole === 'admin';
  return {
    platformRole: context.platformRole,
    canAccessAdminApp: isPlatformAdmin,
    canViewAdminDashboard: isPlatformAdmin,
    canViewUsers: isPlatformAdmin,
    canViewWorkspaces: isPlatformAdmin,
    canManageEntitlementOverrides: isPlatformAdmin,
  };
}

export function hasAdminAppCapability(
  capabilities: AdminAppCapabilities,
  capability: AdminAppCapability
): boolean {
  return capabilities[capability];
}
```

- [x] **Step 4: Re-run the admin-app policy tests**

Run: `pnpm --filter @workspace/policy test packages/policy/test/unit/admin-app.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/policy/src/admin-app.ts packages/policy/test/unit/admin-app.test.ts packages/policy/src/index.ts
git commit -m "feat(policy): add admin app capability evaluator"
```

## Task 4: Add web app policy fact loading and guard helpers

**Files:**

- Create: `apps/web/src/policy/workspace-capabilities.server.ts`
- Create: `apps/web/src/policy/workspace-capabilities.functions.ts`
- Create: `apps/web/src/policy/workspace-capabilities.ts`
- Create: `apps/web/test/unit/policy/workspace-capabilities.server.test.ts`
- Modify: `apps/web/src/workspace/workspace.functions.ts`

- [x] **Step 1: Write the failing web policy integration tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  getWorkspaceCapabilitiesForUser,
  requireWorkspaceCapabilityForUser,
} from '@/policy/workspace-capabilities.server';

vi.mock('@/workspace/workspace.server', () => ({
  getActiveMemberRole: vi.fn(),
  listUserWorkspaces: vi.fn(),
}));

vi.mock('@/billing/billing.server', () => ({
  getWorkspaceBillingData: vi.fn(),
}));

describe('workspace-capabilities.server', () => {
  it('computes admin capabilities from loaded facts', async () => {
    // arrange mocks for admin role, multiple workspaces, and no active subscription
    const capabilities = await getWorkspaceCapabilitiesForUser(
      new Headers(),
      'workspace_123',
      'user_123'
    );

    expect(capabilities.canManageBilling).toBe(true);
    expect(capabilities.canDeleteWorkspace).toBe(false);
  });

  it('throws when a required capability is missing', async () => {
    await expect(
      requireWorkspaceCapabilityForUser(
        new Headers(),
        'workspace_123',
        'user_123',
        'canManageBilling'
      )
    ).rejects.toMatchObject({ message: expect.stringContaining('forbidden') });
  });
});
```

- [x] **Step 2: Run the targeted test to verify failure**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/policy/workspace-capabilities.server.test.ts`
Expected: FAIL because the policy server module does not exist yet.

- [x] **Step 3: Implement the server-side fact loader and guards**

```ts
import {
  evaluateWorkspaceCapabilities,
  hasWorkspaceCapability,
  type WorkspaceCapability,
  type WorkspaceCapabilities,
} from '@workspace/policy';
import {
  getActiveMemberRole,
  listUserWorkspaces,
} from '@/workspace/workspace.server';
import { getWorkspaceBillingData } from '@/billing/billing.server';

export async function getWorkspaceCapabilitiesForUser(
  headers: Headers,
  workspaceId: string,
  userId: string
): Promise<WorkspaceCapabilities> {
  const [workspaceRole, workspaces, billing] = await Promise.all([
    getActiveMemberRole(headers, workspaceId, userId),
    listUserWorkspaces(headers),
    getWorkspaceBillingData(headers, workspaceId).catch(() => null),
  ]);

  const hasActiveSubscription =
    billing?.subscription?.status === 'active' && billing.planId !== 'free';

  return evaluateWorkspaceCapabilities({
    workspaceRole:
      workspaceRole === 'owner' ||
      workspaceRole === 'admin' ||
      workspaceRole === 'member'
        ? workspaceRole
        : null,
    isLastWorkspace: workspaces.length <= 1,
    hasActiveSubscription,
  });
}

export async function requireWorkspaceCapabilityForUser(
  headers: Headers,
  workspaceId: string,
  userId: string,
  capability: WorkspaceCapability
) {
  const capabilities = await getWorkspaceCapabilitiesForUser(
    headers,
    workspaceId,
    userId
  );

  if (!hasWorkspaceCapability(capabilities, capability)) {
    throw new Error(`forbidden: missing workspace capability ${capability}`);
  }

  return capabilities;
}
```

Use the actual existing billing APIs after inspection. If `getWorkspaceBillingData` is too presentation-oriented for policy loading, load the minimal billing facts from the lowest correct existing layer instead.

- [x] **Step 4: Add app-facing wrappers for routes/components**

```ts
// apps/web/src/policy/workspace-capabilities.functions.ts
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import * as z from 'zod';
import { auth } from '@/init';
import { getWorkspaceCapabilitiesForUser } from './workspace-capabilities.server';

export const getWorkspaceCapabilities = createServerFn()
  .inputValidator(z.object({ workspaceId: z.string() }))
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session || !session.user.emailVerified) {
      throw new Error('Unauthenticated');
    }

    return getWorkspaceCapabilitiesForUser(
      headers,
      data.workspaceId,
      session.user.id
    );
  });
```

```ts
// apps/web/src/policy/workspace-capabilities.ts
import { useSuspenseQuery } from '@tanstack/react-query';
import { getWorkspaceCapabilities } from './workspace-capabilities.functions';

export function useWorkspaceCapabilities(workspaceId: string) {
  return useSuspenseQuery({
    queryKey: ['workspace', 'capabilities', workspaceId],
    queryFn: () => getWorkspaceCapabilities({ data: { workspaceId } }),
  });
}
```

- [x] **Step 5: Re-run the web policy integration tests**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/policy/workspace-capabilities.server.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/policy apps/web/test/unit/policy/workspace-capabilities.server.test.ts apps/web/src/workspace/workspace.functions.ts
git commit -m "feat(web): add workspace policy guards"
```

## Task 5: Add admin app policy fact loading and guard helpers

**Files:**

- Create: `apps/admin/src/policy/admin-app-capabilities.server.ts`
- Create: `apps/admin/src/policy/admin-app-capabilities.ts`
- Create: `apps/admin/test/unit/policy/admin-app-capabilities.server.test.ts`
- Modify: `apps/admin/src/routes/_protected.tsx`

- [x] **Step 1: Write the failing admin-app integration tests**

```ts
import { describe, expect, it } from 'vitest';
import { getAdminAppCapabilitiesForSession } from '@/policy/admin-app-capabilities.server';

describe('admin-app-capabilities.server', () => {
  it('grants admin-app capabilities to platform admins', async () => {
    const result = await getAdminAppCapabilitiesForSession({
      user: { role: 'admin' },
    });

    expect(result.canAccessAdminApp).toBe(true);
    expect(result.canManageEntitlementOverrides).toBe(true);
  });

  it('denies non-admin platform users', async () => {
    const result = await getAdminAppCapabilitiesForSession({
      user: { role: 'user' },
    });

    expect(result.canAccessAdminApp).toBe(false);
  });
});
```

- [x] **Step 2: Run the targeted test to verify failure**

Run: `pnpm --filter @workspace/admin-web test apps/admin/test/unit/policy/admin-app-capabilities.server.test.ts`
Expected: FAIL because the policy server module does not exist yet.

- [x] **Step 3: Implement the admin-app fact loader and hook wrapper**

```ts
import {
  evaluateAdminAppCapabilities,
  type AdminAppCapabilities,
  type PlatformRole,
} from '@workspace/policy';

export function getAdminAppCapabilitiesForSession(session: {
  user?: { role?: string | null };
}): AdminAppCapabilities {
  const platformRole =
    session.user?.role === 'admin'
      ? ('admin' as PlatformRole)
      : ('user' as PlatformRole);

  return evaluateAdminAppCapabilities({ platformRole });
}
```

Use the existing route middleware/session-loading path after inspection so admin routes can consume this helper without re-checking raw `user.role === 'admin'` inline.

- [x] **Step 4: Re-run the admin-app integration tests**

Run: `pnpm --filter @workspace/admin-web test apps/admin/test/unit/policy/admin-app-capabilities.server.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/policy apps/admin/test/unit/policy/admin-app-capabilities.server.test.ts apps/admin/src/routes/_protected.tsx
git commit -m "feat(admin): add admin app policy guards"
```

## Task 6: Migrate billing route, nav visibility, and server actions to workspace capabilities

**Files:**

- Modify: `apps/web/src/components/app-sidebar.tsx`
- Modify: `apps/web/src/routes/_protected/ws/$workspaceId.tsx`
- Modify: `apps/web/src/routes/_protected/ws/$workspaceId/billing.tsx`
- Modify: `apps/web/src/billing/billing.functions.ts`
- Modify: `apps/web/test/unit/components/app-sidebar.test.tsx`
- Modify: `apps/web/test/unit/billing/billing.functions.test.ts`
- Modify: `apps/web/test/e2e/workspace/billing.spec.ts`

- [x] **Step 1: Write failing tests for capability-driven billing access**

```ts
it('shows Billing nav item when workspace capabilities allow billing access', async () => {
  // mock canViewBilling = true
});

it('hides Billing nav item when workspace capabilities deny billing access', async () => {
  // mock canViewBilling = false
});

it('rejects billing route before page render when canViewBilling is false', async () => {
  // assert redirect/notFound/forbidden path at route boundary
});

it('rejects billing server actions when canManageBilling is false', async () => {
  // assert guarded server function throws forbidden error
});
```

- [x] **Step 2: Run the targeted billing tests and observe failure**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/components/app-sidebar.test.tsx apps/web/test/unit/billing/billing.functions.test.ts`
Expected: FAIL because the code still uses raw role checks and bespoke owner gating.

- [x] **Step 3: Replace sidebar role checks with capability consumption**

```ts
const { data: capabilities } = useWorkspaceCapabilities(activeWorkspaceId);

const navMain = activeWorkspaceId
  ? [
      { title: 'Overview', url: `/ws/${activeWorkspaceId}/overview`, icon: <IconDashboard /> },
      { title: 'Projects', url: `/ws/${activeWorkspaceId}/projects`, icon: <IconFolder /> },
      { title: 'Members', url: `/ws/${activeWorkspaceId}/members`, icon: <IconUsers /> },
      ...(capabilities?.canViewBilling
        ? [{ title: 'Billing', url: `/ws/${activeWorkspaceId}/billing`, icon: <IconCreditCard /> }]
        : []),
      ...(capabilities?.canViewSettings
        ? [{ title: 'Settings', url: `/ws/${activeWorkspaceId}/settings`, icon: <IconSettings /> }]
        : []),
    ]
  : [];
```

- [x] **Step 4: Guard the billing route at the route boundary**

```ts
export const Route = createFileRoute('/_protected/ws/$workspaceId/billing')({
  loader: async ({ params }) => {
    const capabilities = await getWorkspaceCapabilities({
      data: { workspaceId: params.workspaceId },
    });

    if (!capabilities.canViewBilling) {
      throw notFound({ routeId: '__root__' });
    }

    return capabilities;
  },
  component: WorkspaceBillingPage,
  staticData: { title: 'Billing' },
});
```

Use the repo’s preferred denial behavior after inspecting existing patterns. If `notFound` is not correct, replace with the app’s established forbidden/redirect behavior.

- [x] **Step 5: Replace bespoke billing owner checks with capability guards**

```ts
const session = await requireVerifiedSession();
await requireWorkspaceCapabilityForUser(
  headers,
  data.workspaceId,
  session.user.id,
  'canManageBilling'
);
```

Apply this to:

- invoice fetches if billing visibility should allow them,
- checkout/portal/mutation actions,
- billing data fetches that currently use `requireWorkspaceOwner`.

- [x] **Step 6: Re-run the targeted billing tests**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/components/app-sidebar.test.tsx apps/web/test/unit/billing/billing.functions.test.ts apps/web/test/e2e/workspace/billing.spec.ts`
Expected: PASS, including direct URL denial behavior for unauthorized workspace actors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/app-sidebar.tsx apps/web/src/routes/_protected/ws/$workspaceId.tsx apps/web/src/routes/_protected/ws/$workspaceId/billing.tsx apps/web/src/billing/billing.functions.ts apps/web/test/unit/components/app-sidebar.test.tsx apps/web/test/unit/billing/billing.functions.test.ts apps/web/test/e2e/workspace/billing.spec.ts
git commit -m "refactor(web): gate billing through workspace capabilities"
```

## Task 7: Migrate settings visibility, route access, and delete behavior to workspace capabilities

**Files:**

- Modify: `apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx`
- Modify: `apps/web/src/components/app-sidebar.tsx`
- Modify: `apps/web/src/components/workspace/workspace-delete-dialog.tsx`
- Add or modify matching unit tests for settings/delete behavior

- [x] **Step 1: Write failing tests for settings and delete capability rules**

```ts
it('shows Settings nav item when canViewSettings is true', async () => {
  // mock capabilities.canViewSettings = true
});

it('denies settings route when canViewSettings is false', async () => {
  // assert route denial
});

it('disables workspace deletion when canDeleteWorkspace is false', async () => {
  // assert UI and/or action path deny deletion
});
```

- [x] **Step 2: Run the targeted tests and observe failure**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/components/app-sidebar.test.tsx apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx`
Expected: FAIL because settings/delete decisions are still derived from role and billing data directly in route code.

- [x] **Step 3: Replace settings route role checks with capability consumption**

```ts
const capabilities = parentRoute.useLoaderData().capabilities;

if (!capabilities.canViewSettings) {
  return null;
}

const canDelete = capabilities.canDeleteWorkspace;
const canManageSettings = capabilities.canManageSettings;
```

If route-level denial is handled in the loader, the component should no longer branch on raw `role`.

- [x] **Step 4: Move deletion preconditions behind capability-driven behavior**

```ts
const deleteDisabledMessage = capabilities.canDeleteWorkspace
  ? null
  : 'Workspace deletion is not allowed under the current policy.';
```

Preserve user-friendly reasons if needed by later expanding the capability contract to include denial reasons instead of boolean-only values.

- [x] **Step 5: Re-run the targeted settings/delete tests**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/components/app-sidebar.test.tsx apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx apps/web/src/components/app-sidebar.tsx apps/web/src/components/workspace/workspace-delete-dialog.tsx
git commit -m "refactor(web): gate settings through workspace capabilities"
```

## Task 8: Migrate invite/member management to workspace capabilities

**Files:**

- Modify: `apps/web/src/routes/_protected/ws/$workspaceId/members.tsx`
- Modify: `apps/web/src/workspace/use-invitations-table.ts`
- Modify: `apps/web/src/workspace/use-members-table.ts`
- Modify: related unit/e2e tests for member invitation behavior

- [x] **Step 1: Write failing tests for invite consistency**

```ts
it('shows Invite action only when canInviteMembers is true', async () => {
  // mock capabilities.canInviteMembers = true/false
});

it('allows workspace admins to invite when the capability allows it', async () => {
  // assert no owner-only mismatch remains
});

it('denies invite actions when canInviteMembers is false', async () => {
  // assert guarded path throws forbidden error
});
```

- [x] **Step 2: Run the targeted tests and observe failure**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/workspace apps/web/test/e2e/workspace/members.spec.ts`
Expected: FAIL because the UI and mutation paths still rely on inconsistent role assumptions.

- [x] **Step 3: Replace raw invite role checks with capability consumption**

```ts
const { data: capabilities } = useWorkspaceCapabilities(workspaceId);
const canInvite = capabilities?.canInviteMembers ?? false;
```

Use the same capability to drive button visibility and server/action guard behavior.

- [x] **Step 4: Route all protected invite/member mutations through guarded helpers**

```ts
await requireWorkspaceCapabilityForUser(
  headers,
  workspaceId,
  session.user.id,
  'canInviteMembers'
);
```

If the current invite/remove flows call `authClient.organization.*` directly from UI hooks, move the protected operations behind app-owned server functions first, then apply the guard there.

- [x] **Step 5: Re-run the targeted member-management tests**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/workspace apps/web/test/e2e/workspace/members.spec.ts`
Expected: PASS, including the admin-can-invite case.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/_protected/ws/$workspaceId/members.tsx apps/web/src/workspace/use-invitations-table.ts apps/web/src/workspace/use-members-table.ts
git commit -m "refactor(web): gate member invites through workspace capabilities"
```

## Task 9: Add lint and boundary guardrails against policy drift

**Files:**

- Modify: `apps/web/eslint.config.js`
- Modify: `apps/admin/eslint.config.js` or shared lint config if that is where restrictions belong
- Modify: `.dependency-cruiser.cjs`
- Add or modify tests/check fixtures if the repo validates lint/boundary rules in CI

- [x] **Step 1: Add failing boundary/lint coverage or fixture cases**

```js
// Example restricted patterns:
// role === 'owner'
// role === 'admin'
// currentUserRole === ...
// activeRole === ...
```

Create or update config tests/fixtures if the repo has a pattern for validating lint or dependency-cruiser restrictions.

- [x] **Step 2: Run the existing boundary and lint commands to establish baseline**

Run: `pnpm run lint`
Expected: PASS or reveal current violations that need staged cleanup.

Run: `pnpm run check:boundaries`
Expected: PASS or reveal current import paths that need adjustment.

- [x] **Step 3: Add targeted ESLint restrictions**

```js
{
  files: ['src/routes/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "BinaryExpression[operator='==='][right.value='owner'], BinaryExpression[operator='==='][right.value='admin'], BinaryExpression[operator='==='][right.value='member']",
        message:
          'Do not derive workspace authorization from raw role checks in routes/components. Use policy capabilities instead.',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: ['@/hooks/use-active-member-role-query'],
      },
    ],
  },
}
```

Tune selectors and exclusions so policy modules and tests remain allowed.

- [x] **Step 4: Add dependency-cruiser protections**

```js
{
  name: 'no-policy-internal-imports',
  from: { path: '^apps/' },
  to: {
    path: '^packages/policy/src/',
    pathNot: '^packages/policy/src/index.ts$',
  },
  severity: 'error',
}
```

Add corresponding rules to keep `packages/policy` free of app/framework/infrastructure imports.

- [x] **Step 5: Re-run lint and boundary checks**

Run: `pnpm run lint`
Expected: PASS

Run: `pnpm run check:boundaries`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/eslint.config.js apps/admin/eslint.config.js .dependency-cruiser.cjs
git commit -m "chore(policy): add guardrails against policy drift"
```

## Task 10: Run final verification across the migrated slice

**Files:**

- No intended source edits

- [x] **Step 1: Run targeted package tests**

Run: `pnpm --filter @workspace/policy test`
Expected: PASS

Run: `pnpm --filter @workspace/web test apps/web/test/unit/policy apps/web/test/unit/billing apps/web/test/unit/components apps/web/test/unit/workspace`
Expected: PASS

Run: `pnpm --filter @workspace/admin-web test apps/admin/test/unit/policy`
Expected: PASS

- [x] **Step 2: Run e2e tests for the migrated web slice**

Run: `pnpm --filter @workspace/web test:e2e test/e2e/workspace/billing.spec.ts test/e2e/workspace/members.spec.ts`
Expected: PASS

- [x] **Step 3: Run repo-wide boundary and type safety checks relevant to the new package**

Run: `pnpm run typecheck`
Expected: PASS

Run: `pnpm run check:boundaries`
Expected: PASS

- [x] **Step 4: Inspect the final diff for drift risks**

Run: `git diff --stat`
Expected: shows policy package, app policy modules, migrated web routes/components/actions, and lint/boundary config updates only.

- [ ] **Step 5: Commit**

```bash
git add packages/policy apps/web/src/policy apps/admin/src/policy apps/web apps/admin .dependency-cruiser.cjs
git commit -m "refactor(policy): centralize workspace and admin capabilities"
```
