# Phase 2 Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workflow-level breadcrumbs and targeted operational events for auth, billing, workspace lifecycle/membership, and admin mutations so support can pivot from Sentry to request IDs to structured logs without exposing sensitive auth data.

**Architecture:** Extend the Phase 1 baseline with a small shared event contract, app-level breadcrumb helpers, and server-owned business event logging. Keep instrumentation at workflow boundaries only, and centralize auth-safe event shaping so passwords, tokens, and raw auth payloads never reach breadcrumbs or logs.

**Tech Stack:** TanStack Start, Hono, TypeScript, Better Auth, Sentry, Vitest, existing `@workspace/logging`

---

## File Structure

- Create: `packages/logging/src/operations.ts`
  - Shared operation-name constants/builders for support-relevant workflows.
- Create: `packages/logging/src/redaction.ts`
  - Shared redaction helpers for auth-safe metadata shaping.
- Modify: `packages/logging/package.json`
  - Export the new shared helpers.
- Modify: `packages/logging/tsconfig.json`
  - Add path mappings for the new helper modules.
- Create: `packages/logging/test` is **not** needed
  - Reuse app/package test harnesses instead of introducing a new test stack.

- Modify: `apps/web/src/lib/observability.ts`
  - Add higher-level breadcrumb helpers that accept operation names and shared identifiers.
- Modify: `apps/admin/src/lib/observability.ts`
  - Add the same workflow-oriented breadcrumb helpers for admin flows.
- Modify: `apps/api-server/src/lib/observability.ts`
  - Add optional server event helpers that normalize shared fields before capture/logging.

- Modify: `packages/auth/src/auth.server.ts`
  - Add auth-safe operational events and redaction rules.
- Modify: `packages/auth/test/unit/auth.server.test.ts`
  - Verify auth event names and explicit exclusion of sensitive fields.

- Modify: `apps/web/src/billing/billing.functions.ts`
  - Emit billing operational events for checkout/portal/downgrade/cancel/reactivate flows.
- Modify: `apps/web/test/unit/billing/billing.functions.test.ts`
  - Verify billing event names and correlation fields.

- Modify: `apps/web/src/workspace/workspace-members.functions.ts`
  - Emit workspace membership/lifecycle operational events.
- Modify: `apps/web/test/unit/workspace/workspace-members.functions.test.ts`
  - Verify server-side workspace event payloads.

- Modify: `apps/admin/src/admin/users.functions.ts`
  - Emit admin user mutation operational events.
- Modify: `apps/admin/src/admin/workspaces.functions.ts`
  - Emit admin entitlement override operational events.
- Modify: `apps/admin/test/unit/admin/users.functions.test.ts`
  - Verify admin user event payloads.
- Modify: `apps/admin/test/unit/admin/workspaces.functions.test.ts`
  - Verify admin workspace event payloads.

- Modify: `apps/web/src/components/auth/signin-form.tsx` **if present via package composition, otherwise use the owning shared component path**
  - Add breadcrumbs for auth submit/failure boundaries.
- Modify: `apps/web/src/components/workspace/*`
  - Add breadcrumbs at invite/remove/leave/transfer/delete confirmation entry points.
- Modify: `apps/web/src/components/billing/*`
  - Add breadcrumbs at checkout/portal/downgrade/cancel/reactivate entry points.
- Modify: `apps/admin/src/components/admin/*`
  - Add breadcrumbs for admin user update/delete and entitlement override actions.
- Modify: affected unit/integration tests in `apps/web/test/**` and `apps/admin/test/**`
  - Assert breadcrumb calls for high-value workflows only.

- Modify: `docs/superpowers/specs/2026-04-10-phase-2-observability-design.md`
  - Only if implementation details need a minor spec correction during execution.

### Task 1: Define the shared Phase 2 event contract

**Files:**

- Create: `packages/logging/src/operations.ts`
- Create: `packages/logging/src/redaction.ts`
- Modify: `packages/logging/package.json`
- Modify: `packages/logging/tsconfig.json`
- Test: `apps/web/test/unit/lib/request-context.test.ts`
- Test: `apps/admin/test/unit/lib/request-context.test.ts`
- Test: `packages/auth/test/unit/auth.server.test.ts`

- [x] **Step 1: Write failing tests for operation helpers and auth redaction**

```ts
import { describe, expect, it } from 'vitest';
import {
  AUTH_OPERATIONS,
  BILLING_OPERATIONS,
  WORKSPACE_OPERATIONS,
} from '@workspace/logging/operations';
import { redactAuthMetadata } from '@workspace/logging/redaction';

describe('redactAuthMetadata', () => {
  it('removes password and token-like fields', () => {
    expect(
      redactAuthMetadata({
        email: 'user@example.com',
        password: 'secret',
        token: 'token-value',
      })
    ).toEqual({
      email: '[REDACTED_EMAIL]',
    });
  });
});

describe('operation constants', () => {
  it('exports stable workflow operation names', () => {
    expect(AUTH_OPERATIONS.signInFailed).toBe('auth.sign_in.failed');
    expect(BILLING_OPERATIONS.checkoutStarted).toBe('billing.checkout.started');
    expect(WORKSPACE_OPERATIONS.memberInvited).toBe('workspace.member.invited');
  });
});
```

- [x] **Step 2: Run the narrow failing tests**

Run: `pnpm --filter @workspace/auth test test/unit/auth.server.test.ts`
Expected: FAIL because the shared operation/redaction modules do not exist yet.

- [x] **Step 3: Implement the shared helpers**

```ts
export const AUTH_OPERATIONS = {
  signInStarted: 'auth.sign_in.started',
  signInFailed: 'auth.sign_in.failed',
  passwordResetRequested: 'auth.password_reset.requested',
  invitationAccepted: 'auth.invitation.accepted',
} as const;

const AUTH_SENSITIVE_KEYS = new Set([
  'password',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
]);

export function redactAuthMetadata(
  input: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => !AUTH_SENSITIVE_KEYS.has(key))
      .map(([key, value]) => [
        key === 'email' ? key : key,
        key === 'email' ? '[REDACTED_EMAIL]' : value,
      ])
  );
}
```

- [x] **Step 4: Run the narrow tests again**

Run: `pnpm --filter @workspace/auth test test/unit/auth.server.test.ts`
Expected: PASS for the new helper coverage.

- [ ] **Step 5: Commit**

```bash
git add packages/logging/src/operations.ts packages/logging/src/redaction.ts packages/logging/package.json packages/logging/tsconfig.json packages/auth/test/unit/auth.server.test.ts
git commit -m "feat(logging): add phase 2 event contract"
```

### Task 2: Upgrade app observability helpers for workflow breadcrumbs

**Files:**

- Modify: `apps/web/src/lib/observability.ts`
- Modify: `apps/admin/src/lib/observability.ts`
- Test: `apps/web/test/unit/lib/observability.test.ts`
- Test: `apps/admin/test/unit/lib/observability.test.ts`

- [x] **Step 1: Write failing tests for workflow breadcrumb helpers**

```ts
it('records a workflow breadcrumb with operation and identifiers', async () => {
  const { recordWorkflowBreadcrumb } = await import('@/lib/observability');

  recordWorkflowBreadcrumb({
    category: 'workspace',
    operation: 'workspace.member.invited',
    message: 'workspace member invited',
    requestId: 'req_123',
    workspaceId: 'ws_123',
  });

  expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
    category: 'workspace',
    message: 'workspace member invited',
    level: 'info',
    data: {
      operation: 'workspace.member.invited',
      requestId: 'req_123',
      workspaceId: 'ws_123',
    },
  });
});
```

- [x] **Step 2: Run the web/admin observability tests to confirm failure**

Run: `pnpm --filter @workspace/web test test/unit/lib/observability.test.ts && pnpm --filter @workspace/admin-web test test/unit/lib/observability.test.ts`
Expected: FAIL because `recordWorkflowBreadcrumb` does not exist yet.

- [x] **Step 3: Implement minimal workflow breadcrumb helpers**

```ts
export function recordWorkflowBreadcrumb(input: {
  category: string;
  operation: string;
  message: string;
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  route?: string;
}) {
  Sentry.addBreadcrumb({
    category: input.category,
    message: input.message,
    level: 'info',
    data: {
      operation: input.operation,
      requestId: input.requestId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      route: input.route,
    },
  });
}
```

- [x] **Step 4: Run the web/admin observability tests again**

Run: `pnpm --filter @workspace/web test test/unit/lib/observability.test.ts && pnpm --filter @workspace/admin-web test test/unit/lib/observability.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/observability.ts apps/admin/src/lib/observability.ts apps/web/test/unit/lib/observability.test.ts apps/admin/test/unit/lib/observability.test.ts
git commit -m "feat(observability): add workflow breadcrumb helpers"
```

### Task 3: Add auth-safe operational events in `packages/auth`

**Files:**

- Modify: `packages/auth/src/auth.server.ts`
- Test: `packages/auth/test/unit/auth.server.test.ts`

- [x] **Step 1: Write failing auth-event tests**

```ts
it('logs auth-safe sign-in failure metadata without credentials', async () => {
  const createAuth = await importCreateAuth();
  const logger = vi.fn();

  createAuth(buildTestConfig({ logger }));
  const config = betterAuthSpy.mock.calls[0][0] as BetterAuthConfig;
  const afterHook = config.hooks!.after!;

  await afterHook({
    path: '/sign-in/email',
    context: { newSession: undefined },
  });

  expect(logger).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    expect.objectContaining({ password: expect.anything() })
  );
});
```

- [x] **Step 2: Run the auth test file to verify the new expectation fails**

Run: `pnpm --filter @workspace/auth test test/unit/auth.server.test.ts`
Expected: FAIL until auth-safe events are implemented.

- [x] **Step 3: Implement auth-safe operation logging**

```ts
await log('warn', 'sign in failed', {
  operation: AUTH_OPERATIONS.signInFailed,
  ...redactAuthMetadata({
    route: ctx.path,
    userId: ctx.context.newSession?.user.id,
    email: ctx.body?.email,
  }),
});
```

- [x] **Step 4: Run the auth tests again**

Run: `pnpm --filter @workspace/auth test test/unit/auth.server.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/auth.server.ts packages/auth/test/unit/auth.server.test.ts
git commit -m "feat(auth): add phase 2 operational events"
```

### Task 4: Add billing operational events and web billing breadcrumbs

**Files:**

- Modify: `apps/web/src/billing/billing.functions.ts`
- Modify: relevant billing UI entry points such as `apps/web/src/components/billing/billing-page.tsx`
- Test: `apps/web/test/unit/billing/billing.functions.test.ts`
- Test: `apps/web/test/unit/components/billing/billing-page.test.tsx`

- [x] **Step 1: Write failing tests for billing event emission**

```ts
it('records checkout-start workflow metadata before creating a session', async () => {
  const { createWorkspaceCheckoutSession } =
    await import('@/billing/billing.functions');

  await createWorkspaceCheckoutSession({
    data: {
      workspaceId: 'ws_123',
      planId: 'starter',
      annual: false,
    },
  });

  expect(loggerMock).toHaveBeenCalledWith(
    'info',
    'billing checkout started',
    expect.objectContaining({
      operation: 'billing.checkout.started',
      workspaceId: 'ws_123',
    })
  );
});
```

- [x] **Step 2: Run the narrow billing tests to confirm failure**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing.functions.test.ts test/unit/components/billing/billing-page.test.tsx`
Expected: FAIL

- [x] **Step 3: Implement minimal billing server events and UI breadcrumbs**

```ts
logger('info', 'billing checkout started', {
  operation: BILLING_OPERATIONS.checkoutStarted,
  workspaceId: data.workspaceId,
});

recordWorkflowBreadcrumb({
  category: 'billing',
  operation: BILLING_OPERATIONS.checkoutStarted,
  message: 'billing checkout started',
  workspaceId,
});
```

- [x] **Step 4: Run the billing tests again**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing.functions.test.ts test/unit/components/billing/billing-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/billing/billing.functions.ts apps/web/src/components/billing/billing-page.tsx apps/web/test/unit/billing/billing.functions.test.ts apps/web/test/unit/components/billing/billing-page.test.tsx
git commit -m "feat(web): add billing workflow observability"
```

### Task 5: Add workspace lifecycle and membership breadcrumbs/events

**Files:**

- Modify: `apps/web/src/workspace/workspace-members.functions.ts`
- Modify: `apps/web/src/components/workspace/workspace-invite-dialog.tsx`
- Modify: `apps/web/src/components/workspace/workspace-delete-dialog.tsx`
- Modify: `apps/web/src/components/workspace/workspace-transfer-ownership-dialog.tsx`
- Modify: `apps/web/src/workspace/use-members-table.ts`
- Modify: `apps/web/src/workspace/use-invitations-table.ts`
- Test: `apps/web/test/unit/workspace/workspace-members.functions.test.ts`
- Test: `apps/web/test/unit/components/workspace/workspace-invite-dialog.test.tsx`
- Test: `apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx`
- Test: `apps/web/test/unit/components/workspace/workspace-transfer-ownership-dialog.test.tsx`

- [x] **Step 1: Write failing tests for workspace workflow breadcrumbs and events**

```ts
it('records workspace member invitation workflow metadata', async () => {
  render(<WorkspaceInviteDialog ... />);

  await user.click(screen.getByRole('button', { name: /invite/i }));

  expect(recordWorkflowBreadcrumbMock).toHaveBeenCalledWith(
    expect.objectContaining({
      operation: 'workspace.member.invited',
    })
  );
});
```

- [x] **Step 2: Run the narrow workspace test set to confirm failure**

Run: `pnpm --filter @workspace/web test test/unit/workspace/workspace-members.functions.test.ts test/unit/components/workspace/workspace-invite-dialog.test.tsx test/unit/components/workspace/workspace-delete-dialog.test.tsx test/unit/components/workspace/workspace-transfer-ownership-dialog.test.tsx`
Expected: FAIL

- [x] **Step 3: Implement workspace workflow instrumentation**

```ts
recordWorkflowBreadcrumb({
  category: 'workspace',
  operation: WORKSPACE_OPERATIONS.memberInvited,
  message: 'workspace member invited',
  workspaceId,
});

logger('info', 'workspace member invited', {
  operation: WORKSPACE_OPERATIONS.memberInvited,
  workspaceId: data.workspaceId,
});
```

- [x] **Step 4: Run the workspace test set again**

Run: `pnpm --filter @workspace/web test test/unit/workspace/workspace-members.functions.test.ts test/unit/components/workspace/workspace-invite-dialog.test.tsx test/unit/components/workspace/workspace-delete-dialog.test.tsx test/unit/components/workspace/workspace-transfer-ownership-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/workspace/workspace-members.functions.ts apps/web/src/components/workspace/workspace-invite-dialog.tsx apps/web/src/components/workspace/workspace-delete-dialog.tsx apps/web/src/components/workspace/workspace-transfer-ownership-dialog.tsx apps/web/src/workspace/use-members-table.ts apps/web/src/workspace/use-invitations-table.ts apps/web/test/unit/workspace/workspace-members.functions.test.ts apps/web/test/unit/components/workspace/workspace-invite-dialog.test.tsx apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx apps/web/test/unit/components/workspace/workspace-transfer-ownership-dialog.test.tsx
git commit -m "feat(web): add workspace workflow observability"
```

### Task 6: Add admin mutation breadcrumbs and operational events

**Files:**

- Modify: `apps/admin/src/admin/users.functions.ts`
- Modify: `apps/admin/src/admin/workspaces.functions.ts`
- Modify: relevant admin UI components such as `apps/admin/src/components/admin/admin-user-form.tsx`
- Modify: `apps/admin/src/components/admin/admin-delete-user-dialog.tsx`
- Modify: `apps/admin/src/components/admin/admin-entitlement-override-form.tsx`
- Test: `apps/admin/test/unit/admin/users.functions.test.ts`
- Test: `apps/admin/test/unit/admin/workspaces.functions.test.ts`
- Test: `apps/admin/test/unit/components/admin/admin-user-form.test.tsx`
- Test: `apps/admin/test/unit/components/admin/admin-delete-user-dialog.test.tsx`
- Test: `apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx`

- [x] **Step 1: Write failing admin observability tests**

```ts
it('records admin user update workflow metadata', async () => {
  render(<AdminUserForm ... />);

  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(recordWorkflowBreadcrumbMock).toHaveBeenCalledWith(
    expect.objectContaining({
      operation: 'admin.user.updated',
    })
  );
});
```

- [x] **Step 2: Run the narrow admin test set to confirm failure**

Run: `pnpm --filter @workspace/admin-web test test/unit/admin/users.functions.test.ts test/unit/admin/workspaces.functions.test.ts test/unit/components/admin/admin-user-form.test.tsx test/unit/components/admin/admin-delete-user-dialog.test.tsx test/unit/components/admin-entitlement-override-form.test.tsx`
Expected: FAIL

- [x] **Step 3: Implement admin mutation instrumentation**

```ts
recordWorkflowBreadcrumb({
  category: 'admin',
  operation: ADMIN_OPERATIONS.userUpdated,
  message: 'admin user updated',
  userId,
});

logger('info', 'admin entitlement overrides saved', {
  operation: ADMIN_OPERATIONS.workspaceEntitlementsSaved,
  workspaceId: data.workspaceId,
});
```

- [x] **Step 4: Run the admin test set again**

Run: `pnpm --filter @workspace/admin-web test test/unit/admin/users.functions.test.ts test/unit/admin/workspaces.functions.test.ts test/unit/components/admin/admin-user-form.test.tsx test/unit/components/admin/admin-delete-user-dialog.test.tsx test/unit/components/admin-entitlement-override-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/admin/users.functions.ts apps/admin/src/admin/workspaces.functions.ts apps/admin/src/components/admin/admin-user-form.tsx apps/admin/src/components/admin/admin-delete-user-dialog.tsx apps/admin/src/components/admin/admin-entitlement-override-form.tsx apps/admin/test/unit/admin/users.functions.test.ts apps/admin/test/unit/admin/workspaces.functions.test.ts apps/admin/test/unit/components/admin/admin-user-form.test.tsx apps/admin/test/unit/components/admin/admin-delete-user-dialog.test.tsx apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx
git commit -m "feat(admin): add mutation workflow observability"
```

### Task 7: Verify the Phase 2 support workflow end to end

**Files:**

- No new source files
- Verify: root check/test workflow plus focused support sanity checks

- [x] **Step 1: Run the focused workflow validation set**

Run: `pnpm --filter @workspace/auth test test/unit/auth.server.test.ts && pnpm --filter @workspace/web test test/unit/billing/billing.functions.test.ts test/unit/workspace/workspace-members.functions.test.ts && pnpm --filter @workspace/admin-web test test/unit/admin/users.functions.test.ts test/unit/admin/workspaces.functions.test.ts`
Expected: PASS

- [x] **Step 2: Run the full repository verification pair**

Run: `pnpm run check && pnpm test`
Expected: PASS

- [ ] **Step 3: Do a manual support-flow sanity check**

```text
1. Trigger one auth failure flow and confirm the resulting log/event does not include password or token material.
2. Trigger one billing workflow and confirm the breadcrumb/operation name is searchable.
3. Trigger one workspace mutation and confirm support can correlate it with requestId/workspaceId.
4. Trigger one admin mutation and confirm it produces a stable admin operation name.
5. Confirm Sentry issue context and logs share enough identifiers for support triage.
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore(observability): verify phase 2 workflow telemetry"
```

## Self-Review

- Spec coverage:
  - all requested Phase 2 flows are covered: auth, billing, workspace lifecycle/membership, admin mutations
  - support workflow correlation is covered explicitly in Tasks 1, 3, 4, 5, 6, and 7
  - auth-sensitive data exclusion is covered in Tasks 1 and 3
- Placeholder scan:
  - no `TODO`/`TBD` placeholders remain
- Type consistency:
  - shared identifiers remain `operation`, `requestId`, `userId`, `workspaceId`, and `route`
