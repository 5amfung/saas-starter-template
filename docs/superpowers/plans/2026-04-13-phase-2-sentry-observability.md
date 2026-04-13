# Phase 2 Sentry Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight, Sentry-native business-workflow observability for `apps/web` and `apps/admin` using custom spans, structured logs, and safe enrichment for auth, billing, workspace lifecycle, membership, and admin mutation flows.

**Architecture:** Keep Sentry as the only correlation system. Add a small shared operation vocabulary and a tiny observability helper layer in `@workspace/logging`, then instrument workflow mutation boundaries at the client and server edges. Use custom spans for workflow timing, `Sentry.logger.*` for business outcomes, and tags/context for safe enrichment while keeping auth-sensitive data out of logs.

**Tech Stack:** TanStack Start, TanStack Router, React Query, Sentry TanStack Start SDK, Better Auth, TypeScript, Vitest

---

## File structure

### Shared observability layer

- Create: `packages/logging/src/operations.ts`
  Purpose: stable operation names and narrow operation type unions.
- Create: `packages/logging/src/observability.shared.ts`
  Purpose: pure attribute helpers and redaction/normalization helpers safe for both browser and server.
- Create: `packages/logging/src/client.ts`
  Purpose: client-safe helpers for workflow spans/log emission.
- Create: `packages/logging/src/server.ts`
  Purpose: server-safe helpers plus `requestLogger` re-export.
- Modify: `packages/logging/package.json`
  Purpose: expose client and server entrypoints without importing server-only code into the browser.
- Test: `packages/logging/test/unit/operations.test.ts`
  Purpose: lock operation names, attribute shaping, and redaction behavior.

### Auth workflow instrumentation

- Modify: `packages/components/src/auth/signin-form.tsx`
- Modify: `packages/components/src/auth/signup-form.tsx`
- Modify: `packages/components/src/auth/forgot-password-form.tsx`
- Modify: `apps/web/src/routes/accept-invite.tsx`
- Modify: `packages/auth/src/auth.server.ts`
- Test: `apps/web/test/unit/components/auth/signin-form.test.tsx`
- Test: `apps/web/test/unit/components/auth/signup-form.test.tsx`
- Test: `apps/web/test/unit/components/auth/forgot-password-form.test.tsx`
- Test: `packages/auth/test/unit/auth.server.test.ts`

### Billing workflow instrumentation

- Modify: `apps/web/src/billing/billing.functions.ts`
- Modify: `apps/web/src/components/billing/billing-page.tsx`
- Test: `apps/web/test/unit/billing/billing.functions.test.ts`
- Test: `apps/web/test/unit/components/billing/billing-page.test.tsx`

### Workspace lifecycle and membership instrumentation

- Modify: `apps/web/src/components/workspace-switcher.tsx`
- Modify: `apps/web/src/components/workspace/workspace-delete-dialog.tsx`
- Modify: `apps/web/src/workspace/use-members-table.ts`
- Modify: `apps/web/src/components/workspace/workspace-members-table.tsx`
- Modify: `apps/web/src/components/workspace/workspace-invite-dialog.tsx`
- Test: `apps/web/test/unit/components/workspace-switcher.test.tsx`
- Test: `apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx`
- Test: `apps/web/test/unit/workspace/use-members-table.test.ts`
- Test: `apps/web/test/integration/components/workspace/workspace-invite-flow.integration.test.tsx`
- Test: `apps/web/test/integration/components/workspace/workspace-lifecycle-flow.integration.test.tsx`

### Admin mutation instrumentation

- Modify: `apps/admin/src/admin/users.functions.ts`
- Modify: `apps/admin/src/admin/workspaces.functions.ts`
- Modify: `apps/admin/src/components/admin/admin-user-form.tsx`
- Modify: `apps/admin/src/components/admin/admin-delete-user-dialog.tsx`
- Modify: `apps/admin/src/components/admin/admin-entitlement-override-form.tsx`
- Test: `apps/admin/test/unit/admin/workspaces.functions.test.ts`
- Test: `apps/admin/test/unit/components/admin/admin-user-form.test.tsx`
- Test: `apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx`
- Test: `apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx`

## Task 1: Build the shared Sentry observability layer

**Files:**

- Create: `packages/logging/src/operations.ts`
- Create: `packages/logging/src/observability.shared.ts`
- Create: `packages/logging/src/client.ts`
- Create: `packages/logging/src/server.ts`
- Modify: `packages/logging/package.json`
- Test: `packages/logging/test/unit/operations.test.ts`

- [x] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  redactAuthWorkflowAttributes,
} from '../../src/client';

describe('observability helpers', () => {
  it('builds stable workflow attributes', () => {
    expect(
      buildWorkflowAttributes(OPERATIONS.BILLING_CHECKOUT_CREATE_SESSION, {
        workspaceId: 'ws_123',
        route: '/ws/$workspaceId/billing',
        result: 'success',
      })
    ).toEqual({
      operation: 'billing.checkout.create_session',
      operationFamily: 'billing',
      route: '/ws/$workspaceId/billing',
      result: 'success',
      workspaceId: 'ws_123',
    });
  });

  it('redacts auth-sensitive values', () => {
    expect(
      redactAuthWorkflowAttributes({
        email: 'person@example.com',
        token: 'secret-token',
        userId: 'user_123',
      })
    ).toEqual({
      userId: 'user_123',
    });
  });
});
```

- [ ] **Step 2: Run the package test to verify it fails**

Run: `pnpm --filter @workspace/logging test packages/logging/test/unit/operations.test.ts`
Expected: FAIL with missing module/export errors for `OPERATIONS`, `buildWorkflowAttributes`, or `redactAuthWorkflowAttributes`

- [x] **Step 3: Add the minimal shared helper implementation**

```ts
// packages/logging/src/operations.ts
export const OPERATIONS = {
  AUTH_SIGN_IN: 'auth.sign_in',
  AUTH_SIGN_UP: 'auth.sign_up',
  AUTH_PASSWORD_RESET_REQUEST: 'auth.password_reset.request',
  AUTH_INVITE_ACCEPT: 'auth.invite.accept',
  BILLING_CHECKOUT_CREATE_SESSION: 'billing.checkout.create_session',
  BILLING_PORTAL_CREATE_SESSION: 'billing.portal.create_session',
  BILLING_SUBSCRIPTION_CANCEL: 'billing.subscription.cancel',
  BILLING_SUBSCRIPTION_DOWNGRADE: 'billing.subscription.downgrade',
  BILLING_SUBSCRIPTION_REACTIVATE: 'billing.subscription.reactivate',
  WORKSPACE_CREATE: 'workspace.create',
  WORKSPACE_DELETE: 'workspace.delete',
  WORKSPACE_MEMBER_INVITE: 'workspace.member.invite',
  WORKSPACE_MEMBER_REMOVE: 'workspace.member.remove',
  WORKSPACE_MEMBER_LEAVE: 'workspace.member.leave',
  WORKSPACE_TRANSFER_OWNERSHIP: 'workspace.transfer_ownership',
  ADMIN_USER_UPDATE: 'admin.user.update',
  ADMIN_USER_DELETE: 'admin.user.delete',
  ADMIN_WORKSPACE_ENTITLEMENTS_SAVE: 'admin.workspace.entitlements.save',
  ADMIN_WORKSPACE_ENTITLEMENTS_CLEAR: 'admin.workspace.entitlements.clear',
} as const;

export type WorkflowOperation = (typeof OPERATIONS)[keyof typeof OPERATIONS];
```

```ts
// packages/logging/src/observability.shared.ts
import { type WorkflowOperation } from './operations';

type WorkflowResult = 'attempt' | 'success' | 'failure';

type WorkflowAttributes = {
  route?: string;
  userId?: string;
  workspaceId?: string;
  targetUserId?: string;
  planId?: string;
  memberRole?: string;
  failureCategory?: string;
  result?: WorkflowResult;
};

export function buildWorkflowAttributes(
  operation: WorkflowOperation,
  attributes: WorkflowAttributes = {}
) {
  return {
    operation,
    operationFamily: operation.split('.')[0] ?? 'unknown',
    ...attributes,
  };
}

export function redactAuthWorkflowAttributes(
  attributes: Record<string, unknown>
) {
  const {
    email: _email,
    password: _password,
    token: _token,
    ...safe
  } = attributes;
  return safe;
}
```

```ts
// packages/logging/src/client.ts
export { OPERATIONS } from './operations';
export {
  buildWorkflowAttributes,
  redactAuthWorkflowAttributes,
} from './observability.shared';
```

```ts
// packages/logging/src/server.ts
export { OPERATIONS } from './operations';
export {
  buildWorkflowAttributes,
  redactAuthWorkflowAttributes,
} from './observability.shared';
export { requestLogger } from './request-logger.server';
```

```json
// packages/logging/package.json
{
  "exports": {
    ".": "./src/server.ts",
    "./client": "./src/client.ts",
    "./server": "./src/server.ts"
  }
}
```

- [x] **Step 4: Run the package tests and typecheck**

Run: `pnpm --filter @workspace/logging test packages/logging/test/unit/operations.test.ts`
Expected: PASS

Run: `pnpm --filter @workspace/logging typecheck`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add packages/logging/package.json packages/logging/src/operations.ts packages/logging/src/observability.shared.ts packages/logging/src/client.ts packages/logging/src/server.ts packages/logging/test/unit/operations.test.ts
git commit -m "feat(logging): add shared sentry observability helpers"
```

## Task 2: Instrument auth workflows with spans, logs, and redaction-safe metadata

**Files:**

- Modify: `packages/components/src/auth/signin-form.tsx`
- Modify: `packages/components/src/auth/signup-form.tsx`
- Modify: `packages/components/src/auth/forgot-password-form.tsx`
- Modify: `apps/web/src/routes/accept-invite.tsx`
- Modify: `packages/auth/src/auth.server.ts`
- Test: `apps/web/test/unit/components/auth/signin-form.test.tsx`
- Test: `apps/web/test/unit/components/auth/signup-form.test.tsx`
- Test: `apps/web/test/unit/components/auth/forgot-password-form.test.tsx`
- Test: `packages/auth/test/unit/auth.server.test.ts`

- [ ] **Step 1: Add failing tests for auth workflow logging/spans**

```ts
it('logs auth.sign_in failure without leaking email', async () => {
  const loggerError = vi.fn();
  vi.spyOn(Sentry, 'logger', 'get').mockReturnValue({
    ...Sentry.logger,
    error: loggerError,
  });

  render(<SigninForm />);
  await user.type(screen.getByLabelText(/email/i), 'person@example.com');
  await user.type(screen.getByLabelText(/password/i), 'bad-password');
  await user.click(screen.getByRole('button', { name: /sign in/i }));

  expect(loggerError).toHaveBeenCalledWith(
    'Auth sign-in failed',
    expect.objectContaining({
      operation: 'auth.sign_in',
      result: 'failure',
      failureCategory: 'invalid_credentials',
    })
  );
  expect(loggerError).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ email: 'person@example.com' })
  );
});
```

```ts
it('captures workspace auto-create failure with safe auth metadata', async () => {
  await expect(runUserCreateHook()).rejects.toThrow('boom');
  expect(Sentry.captureException).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({
      tags: expect.objectContaining({ operation_family: 'auth' }),
      contexts: expect.objectContaining({
        auth_workflow: expect.objectContaining({
          operation: 'workspace.create',
          result: 'failure',
        }),
      }),
    })
  );
});
```

- [ ] **Step 2: Run auth-focused tests to verify failure**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/components/auth/signin-form.test.tsx apps/web/test/unit/components/auth/signup-form.test.tsx apps/web/test/unit/components/auth/forgot-password-form.test.tsx`
Expected: FAIL because Sentry workflow logging is not emitted yet

Run: `pnpm --filter @workspace/auth test packages/auth/test/unit/auth.server.test.ts`
Expected: FAIL because auth server hooks do not emit enriched Sentry events yet

- [ ] **Step 3: Implement auth instrumentation**

```ts
// packages/components/src/auth/signin-form.tsx
import * as Sentry from '@sentry/tanstackstart-react';
import { OPERATIONS, buildWorkflowAttributes } from '@workspace/logging/client';

await Sentry.startSpan(
  {
    op: OPERATIONS.AUTH_SIGN_IN,
    name: 'Sign in',
    attributes: buildWorkflowAttributes(OPERATIONS.AUTH_SIGN_IN, {
      route: '/signin',
      result: 'attempt',
    }),
  },
  async () => {
    const { error } = await authClient.signIn.email({
      email: value.email,
      password: value.password,
      callbackURL,
    });

    if (error) {
      Sentry.logger.error('Auth sign-in failed', {
        ...buildWorkflowAttributes(OPERATIONS.AUTH_SIGN_IN, {
          route: '/signin',
          result: 'failure',
          failureCategory:
            error.status === 401 ? 'invalid_credentials' : 'unknown',
        }),
      });
      return;
    }

    Sentry.logger.info('Auth sign-in succeeded', {
      ...buildWorkflowAttributes(OPERATIONS.AUTH_SIGN_IN, {
        route: '/signin',
        result: 'success',
      }),
    });
  }
);
```

```ts
// packages/auth/src/auth.server.ts
import * as Sentry from '@sentry/tanstackstart-react';
import {
  OPERATIONS,
  buildWorkflowAttributes,
  redactAuthWorkflowAttributes,
} from '@workspace/logging/server';

Sentry.logger.error(
  'Workspace auto-create failed',
  redactAuthWorkflowAttributes(
    buildWorkflowAttributes(OPERATIONS.WORKSPACE_CREATE, {
      userId: user.id,
      result: 'failure',
      failureCategory: 'auto_create_failed',
    })
  )
);

Sentry.captureException(error, {
  tags: {
    operation_family: 'auth',
    result: 'failure',
  },
  contexts: {
    auth_workflow: redactAuthWorkflowAttributes({
      operation: OPERATIONS.WORKSPACE_CREATE,
      userId: user.id,
      result: 'failure',
      failureCategory: 'auto_create_failed',
    }),
  },
});
```

- [ ] **Step 4: Re-run the targeted auth tests**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/components/auth/signin-form.test.tsx apps/web/test/unit/components/auth/signup-form.test.tsx apps/web/test/unit/components/auth/forgot-password-form.test.tsx`
Expected: PASS

Run: `pnpm --filter @workspace/auth test packages/auth/test/unit/auth.server.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/components/src/auth/signin-form.tsx packages/components/src/auth/signup-form.tsx packages/components/src/auth/forgot-password-form.tsx apps/web/src/routes/accept-invite.tsx packages/auth/src/auth.server.ts apps/web/test/unit/components/auth/signin-form.test.tsx apps/web/test/unit/components/auth/signup-form.test.tsx apps/web/test/unit/components/auth/forgot-password-form.test.tsx packages/auth/test/unit/auth.server.test.ts
git commit -m "feat(auth): add sentry workflow instrumentation"
```

## Task 3: Instrument billing workflow spans and structured logs

**Files:**

- Modify: `apps/web/src/billing/billing.functions.ts`
- Modify: `apps/web/src/components/billing/billing-page.tsx`
- Test: `apps/web/test/unit/billing/billing.functions.test.ts`
- Test: `apps/web/test/unit/components/billing/billing-page.test.tsx`

- [x] **Step 1: Add failing billing observability tests**

```ts
it('logs checkout creation failure with operation metadata', async () => {
  await expect(
    createWorkspaceCheckoutSession({
      data: {
        workspaceId: 'ws_123',
        planId: 'pro',
        annual: false,
      },
    })
  ).rejects.toThrow();

  expect(Sentry.logger.error).toHaveBeenCalledWith(
    'Billing checkout session failed',
    expect.objectContaining({
      operation: 'billing.checkout.create_session',
      workspaceId: 'ws_123',
      planId: 'pro',
      result: 'failure',
    })
  );
});
```

```ts
it('wraps portal launch in a client span', async () => {
  render(<BillingPage workspaceId="ws_123" workspaceName="Acme" />);
  await user.click(screen.getByRole('button', { name: /billing portal/i }));
  expect(Sentry.startSpan).toHaveBeenCalledWith(
    expect.objectContaining({
      op: 'billing.portal.create_session',
    }),
    expect.any(Function)
  );
});
```

- [ ] **Step 2: Run the billing tests to confirm failure**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/billing/billing.functions.test.ts apps/web/test/unit/components/billing/billing-page.test.tsx`
Expected: FAIL because billing spans/logs are not emitted yet

- [x] **Step 3: Add billing instrumentation**

```ts
// apps/web/src/billing/billing.functions.ts
import * as Sentry from '@sentry/tanstackstart-react';
import { OPERATIONS, buildWorkflowAttributes } from '@workspace/logging/server';

return Sentry.startSpan(
  {
    op: OPERATIONS.BILLING_CHECKOUT_CREATE_SESSION,
    name: 'Create billing checkout session',
    attributes: buildWorkflowAttributes(
      OPERATIONS.BILLING_CHECKOUT_CREATE_SESSION,
      {
        workspaceId: data.workspaceId,
        planId: data.planId,
        result: 'attempt',
      }
    ),
  },
  async () => {
    try {
      const result = await createCheckoutForWorkspace(...);
      Sentry.logger.info('Billing checkout session created', {
        ...buildWorkflowAttributes(
          OPERATIONS.BILLING_CHECKOUT_CREATE_SESSION,
          {
            workspaceId: data.workspaceId,
            planId: data.planId,
            result: 'success',
          }
        ),
      });
      return result;
    } catch (error) {
      Sentry.logger.error('Billing checkout session failed', {
        ...buildWorkflowAttributes(
          OPERATIONS.BILLING_CHECKOUT_CREATE_SESSION,
          {
            workspaceId: data.workspaceId,
            planId: data.planId,
            result: 'failure',
          }
        ),
      });
      throw error;
    }
  }
);
```

```ts
// apps/web/src/components/billing/billing-page.tsx
import * as Sentry from '@sentry/tanstackstart-react';
import { OPERATIONS, buildWorkflowAttributes } from '@workspace/logging/client';

const handlePortalOpen = () =>
  Sentry.startSpan(
    {
      op: OPERATIONS.BILLING_PORTAL_CREATE_SESSION,
      name: 'Open billing portal',
      attributes: buildWorkflowAttributes(
        OPERATIONS.BILLING_PORTAL_CREATE_SESSION,
        {
          route: '/ws/$workspaceId/billing',
          workspaceId,
          result: 'attempt',
        }
      ),
    },
    () => manageMutation.mutateAsync()
  );
```

- [x] **Step 4: Re-run the billing tests**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/billing/billing.functions.test.ts apps/web/test/unit/components/billing/billing-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/billing/billing.functions.ts apps/web/src/components/billing/billing-page.tsx apps/web/test/unit/billing/billing.functions.test.ts apps/web/test/unit/components/billing/billing-page.test.tsx
git commit -m "feat(billing): add sentry workflow observability"
```

## Task 4: Instrument workspace lifecycle and membership workflows

**Files:**

- Modify: `apps/web/src/components/workspace-switcher.tsx`
- Modify: `apps/web/src/components/workspace/workspace-delete-dialog.tsx`
- Modify: `apps/web/src/workspace/use-members-table.ts`
- Modify: `apps/web/src/components/workspace/workspace-members-table.tsx`
- Modify: `apps/web/src/components/workspace/workspace-invite-dialog.tsx`
- Test: `apps/web/test/unit/components/workspace-switcher.test.tsx`
- Test: `apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx`
- Test: `apps/web/test/unit/workspace/use-members-table.test.ts`
- Test: `apps/web/test/integration/components/workspace/workspace-invite-flow.integration.test.tsx`
- Test: `apps/web/test/integration/components/workspace/workspace-lifecycle-flow.integration.test.tsx`

- [ ] **Step 1: Add failing workspace observability tests**

```ts
it('logs workspace creation success with operation metadata', async () => {
  render(<WorkspaceSwitcher workspaces={[]} activeWorkspaceId={null} />);
  await user.click(screen.getByText(/add workspace/i));
  await user.type(screen.getByRole('textbox'), 'Acme');
  await user.click(screen.getByRole('button', { name: /create workspace/i }));

  expect(Sentry.logger.info).toHaveBeenCalledWith(
    'Workspace created',
    expect.objectContaining({
      operation: 'workspace.create',
      result: 'success',
    })
  );
});
```

```ts
it('logs member removal failure with workspace metadata', async () => {
  await result.current.onRemoveMember('member_123');
  expect(Sentry.logger.error).toHaveBeenCalledWith(
    'Workspace member removal failed',
    expect.objectContaining({
      operation: 'workspace.member.remove',
      workspaceId: 'ws_123',
      result: 'failure',
    })
  );
});
```

- [ ] **Step 2: Run the workspace tests to verify failure**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/components/workspace-switcher.test.tsx apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx apps/web/test/unit/workspace/use-members-table.test.ts apps/web/test/integration/components/workspace/workspace-invite-flow.integration.test.tsx apps/web/test/integration/components/workspace/workspace-lifecycle-flow.integration.test.tsx`
Expected: FAIL because workspace spans/logs are not emitted yet

- [ ] **Step 3: Implement workspace instrumentation**

```ts
// apps/web/src/components/workspace-switcher.tsx
import * as Sentry from '@sentry/tanstackstart-react';
import { OPERATIONS, buildWorkflowAttributes } from '@workspace/logging/client';

await Sentry.startSpan(
  {
    op: OPERATIONS.WORKSPACE_CREATE,
    name: 'Create workspace',
    attributes: buildWorkflowAttributes(OPERATIONS.WORKSPACE_CREATE, {
      route: '/ws',
      result: 'attempt',
    }),
  },
  async () => createWorkspaceMutation.mutateAsync(name)
);
```

```ts
// apps/web/src/workspace/use-members-table.ts
Sentry.logger.info('Workspace member removed', {
  ...buildWorkflowAttributes(OPERATIONS.WORKSPACE_MEMBER_REMOVE, {
    workspaceId,
    result: 'success',
  }),
});

Sentry.logger.error('Workspace ownership transfer failed', {
  ...buildWorkflowAttributes(OPERATIONS.WORKSPACE_TRANSFER_OWNERSHIP, {
    workspaceId,
    result: 'failure',
  }),
});
```

```ts
// apps/web/src/components/workspace/workspace-delete-dialog.tsx
Sentry.startSpan(
  {
    op: OPERATIONS.WORKSPACE_DELETE,
    name: 'Delete workspace',
    attributes: buildWorkflowAttributes(OPERATIONS.WORKSPACE_DELETE, {
      workspaceId,
      result: 'attempt',
    }),
  },
  async () => deleteMutation.mutateAsync()
);
```

- [ ] **Step 4: Re-run the targeted workspace tests**

Run: `pnpm --filter @workspace/web test apps/web/test/unit/components/workspace-switcher.test.tsx apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx apps/web/test/unit/workspace/use-members-table.test.ts apps/web/test/integration/components/workspace/workspace-invite-flow.integration.test.tsx apps/web/test/integration/components/workspace/workspace-lifecycle-flow.integration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/workspace-switcher.tsx apps/web/src/components/workspace/workspace-delete-dialog.tsx apps/web/src/workspace/use-members-table.ts apps/web/src/components/workspace/workspace-members-table.tsx apps/web/src/components/workspace/workspace-invite-dialog.tsx apps/web/test/unit/components/workspace-switcher.test.tsx apps/web/test/unit/components/workspace/workspace-delete-dialog.test.tsx apps/web/test/unit/workspace/use-members-table.test.ts apps/web/test/integration/components/workspace/workspace-invite-flow.integration.test.tsx apps/web/test/integration/components/workspace/workspace-lifecycle-flow.integration.test.tsx
git commit -m "feat(workspace): add sentry lifecycle observability"
```

## Task 5: Instrument admin mutations

**Files:**

- Modify: `apps/admin/src/admin/users.functions.ts`
- Modify: `apps/admin/src/admin/workspaces.functions.ts`
- Modify: `apps/admin/src/components/admin/admin-user-form.tsx`
- Modify: `apps/admin/src/components/admin/admin-delete-user-dialog.tsx`
- Modify: `apps/admin/src/components/admin/admin-entitlement-override-form.tsx`
- Test: `apps/admin/test/unit/admin/workspaces.functions.test.ts`
- Test: `apps/admin/test/unit/components/admin/admin-user-form.test.tsx`
- Test: `apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx`
- Test: `apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx`

- [ ] **Step 1: Add failing admin observability tests**

```ts
it('logs admin user update success with target user metadata', async () => {
  await updateUser({
    data: {
      userId: 'user_123',
      name: 'Updated',
      email: 'updated@example.com',
      emailVerified: true,
      image: '',
      role: 'user',
      banned: false,
      banReason: '',
      banExpires: '',
    },
  });

  expect(Sentry.logger.info).toHaveBeenCalledWith(
    'Admin user updated',
    expect.objectContaining({
      operation: 'admin.user.update',
      targetUserId: 'user_123',
      result: 'success',
    })
  );
});
```

```ts
it('wraps entitlement override save in a client span', async () => {
  render(<AdminEntitlementOverrideForm workspaceId="ws_123" overrides={null} />);
  await user.click(screen.getByRole('button', { name: /save/i }));
  expect(Sentry.startSpan).toHaveBeenCalledWith(
    expect.objectContaining({
      op: 'admin.workspace.entitlements.save',
    }),
    expect.any(Function)
  );
});
```

- [ ] **Step 2: Run the admin tests to verify failure**

Run: `pnpm --filter @workspace/admin-web test apps/admin/test/unit/admin/workspaces.functions.test.ts apps/admin/test/unit/components/admin/admin-user-form.test.tsx apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx`
Expected: FAIL because admin workflow spans/logs are not implemented yet

- [ ] **Step 3: Implement admin instrumentation**

```ts
// apps/admin/src/admin/users.functions.ts
import * as Sentry from '@sentry/tanstackstart-react';
import { OPERATIONS, buildWorkflowAttributes } from '@workspace/logging/server';

return Sentry.startSpan(
  {
    op: OPERATIONS.ADMIN_USER_UPDATE,
    name: 'Update admin user',
    attributes: buildWorkflowAttributes(OPERATIONS.ADMIN_USER_UPDATE, {
      targetUserId: data.userId,
      result: 'attempt',
    }),
  },
  async () => {
    const result = await updateAdminUser(data);
    Sentry.logger.info('Admin user updated', {
      ...buildWorkflowAttributes(OPERATIONS.ADMIN_USER_UPDATE, {
        targetUserId: data.userId,
        result: 'success',
      }),
    });
    return result;
  }
);
```

```ts
// apps/admin/src/components/admin/admin-entitlement-override-form.tsx
import * as Sentry from '@sentry/tanstackstart-react';
import { OPERATIONS, buildWorkflowAttributes } from '@workspace/logging/client';

await Sentry.startSpan(
  {
    op: OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
    name: 'Save entitlement overrides',
    attributes: buildWorkflowAttributes(
      OPERATIONS.ADMIN_WORKSPACE_ENTITLEMENTS_SAVE,
      {
        workspaceId,
        result: 'attempt',
      }
    ),
  },
  async () => saveMutation.mutateAsync()
);
```

- [ ] **Step 4: Re-run the targeted admin tests**

Run: `pnpm --filter @workspace/admin-web test apps/admin/test/unit/admin/workspaces.functions.test.ts apps/admin/test/unit/components/admin/admin-user-form.test.tsx apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/admin/users.functions.ts apps/admin/src/admin/workspaces.functions.ts apps/admin/src/components/admin/admin-user-form.tsx apps/admin/src/components/admin/admin-delete-user-dialog.tsx apps/admin/src/components/admin/admin-entitlement-override-form.tsx apps/admin/test/unit/admin/workspaces.functions.test.ts apps/admin/test/unit/components/admin/admin-user-form.test.tsx apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx
git commit -m "feat(admin): add sentry mutation observability"
```

## Task 6: Run cross-package validation and tighten the public API

**Files:**

- Modify: `packages/logging/package.json` if any export cleanup remains
- Modify: any touched files from Tasks 1-5
- Test: no new files; verify the changed surface area end-to-end

- [ ] **Step 1: Add one import-safety assertion if browser/server boundaries regressed**

```ts
import { describe, expect, it } from 'vitest';

describe('@workspace/logging exports', () => {
  it('keeps client helpers separate from server-only request logger', async () => {
    const client = await import('@workspace/logging/client');
    expect(client.OPERATIONS.AUTH_SIGN_IN).toBe('auth.sign_in');
  });
});
```

- [ ] **Step 2: Run targeted typecheck and test commands**

Run: `pnpm --filter @workspace/logging typecheck`
Expected: PASS

Run: `pnpm --filter @workspace/auth test packages/auth/test/unit/auth.server.test.ts`
Expected: PASS

Run: `pnpm --filter @workspace/web test apps/web/test/unit/billing/billing.functions.test.ts apps/web/test/unit/components/billing/billing-page.test.tsx apps/web/test/unit/components/workspace-switcher.test.tsx apps/web/test/unit/workspace/use-members-table.test.ts`
Expected: PASS

Run: `pnpm --filter @workspace/admin-web test apps/admin/test/unit/admin/workspaces.functions.test.ts apps/admin/test/unit/components/admin/admin-user-form.test.tsx apps/admin/test/unit/components/admin-entitlement-override-form.test.tsx`
Expected: PASS

- [ ] **Step 3: Run boundary and app typechecks**

Run: `pnpm run check:boundaries`
Expected: PASS

Run: `pnpm --filter @workspace/web typecheck`
Expected: PASS

Run: `pnpm --filter @workspace/admin-web typecheck`
Expected: PASS

- [ ] **Step 4: Manually verify the Sentry event shape in development**

Run:

```bash
pnpm web:dev
pnpm admin:dev
```

Expected:

- a sign-in failure emits `operation=auth.sign_in`
- a billing action emits `operation=billing.checkout.create_session` or `billing.portal.create_session`
- a workspace membership mutation emits the matching `workspace.*` operation
- an admin mutation emits the matching `admin.*` operation
- no auth logs include raw email, password, token, cookie, or authorization data

- [ ] **Step 5: Commit the final verification adjustments**

```bash
git add packages/logging/package.json packages/logging/src apps/web/src apps/admin/src packages/auth/src apps/web/test apps/admin/test packages/auth/test
git commit -m "test(observability): verify sentry workflow instrumentation"
```

## Self-review

Spec coverage check:

- shared operation vocabulary: Task 1
- custom spans at mutation boundaries: Tasks 2-5
- structured logs as primary workflow signal: Tasks 2-5
- auth-safe redaction rules: Tasks 1-2
- workflow coverage for auth, billing, workspace, and admin: Tasks 2-5
- Sentry-first validation and boundary safety: Task 6

Placeholder scan:

- no `TODO` or `TBD` placeholders remain
- every task includes exact files, concrete code, and explicit commands

Type consistency check:

- all tasks use the same `OPERATIONS.*` constants
- shared attributes consistently use `operation`, `route`, `userId`, `workspaceId`, `targetUserId`, `planId`, `memberRole`, `failureCategory`, and `result`
- client imports come from `@workspace/logging/client`; server imports come from `@workspace/logging/server`
