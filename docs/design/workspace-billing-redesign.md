# Workspace-Level Billing Redesign

> **Status:** Draft
> **Date:** 2026-03-23
> **Scope:** Move subscription ownership from user to workspace (organization).

## 1. Background

The current billing model ties subscriptions to users via `subscription.referenceId = userId`. Plan limits (`maxWorkspaces`, `maxMembersPerWorkspace`) are resolved from the user's subscription. This creates a coupling where the user's plan governs all their workspaces uniformly.

The new model ties subscriptions to workspaces. Each workspace has its own independent plan. This aligns with how the product is structured (workspace-centric collaboration) and matches industry patterns (GitHub, Slack, Linear).

## 2. Design Decisions

| Decision                                | Choice                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| Subscription ownership                  | Per workspace (organization)                                                            |
| Workspace types                         | No distinction — all workspaces are equal                                               |
| `workspaceType` / `personalOwnerUserId` | Remove from schema and all code                                                         |
| Free workspaces                         | Unlimited per user, 1 member each                                                       |
| Workspace creation                      | Always free — no checkout gate                                                          |
| Upgrading                               | Owner can upgrade any workspace via its billing page                                    |
| Downgrading                             | Allowed freely, takes effect at period end                                              |
| Member soft limit                       | Existing members grandfathered; can't add beyond new plan's limit                       |
| Feature / usage hard limit              | Immediately enforced on new actions; existing data untouched                            |
| Read-only / lockout state               | Eliminated — not needed                                                                 |
| Billing page                            | Per workspace at `/ws/$workspaceId/billing`, owner only                                 |
| User-level billing                      | Overview page listing owned workspaces with plan, status, renewal date                  |
| Workspace deletion                      | Blocked when workspace has active subscription, or when it's the user's last workspace  |
| Stripe customer                         | Per organization (`organization.stripeCustomerId`), created on-demand at first checkout |
| User `stripeCustomerId`                 | Stays in schema (plugin-managed), always `null`; set `createCustomerOnSignUp: false`    |
| Migration                               | Clean break — no backward compatibility required                                        |

## 3. Data Model Changes

### 3.1 Remove workspace type fields

**Remove from `organization` table and all code:**

- `workspaceType` column
- `personalOwnerUserId` column

**Remove from `packages/auth/src/workspace-types.ts`:**

- `PERSONAL_WORKSPACE_TYPE`, `STANDARD_WORKSPACE_TYPE`, `PERSONAL_WORKSPACE_NAME`
- `WORKSPACE_TYPES`, `WorkspaceType`, `PersonalWorkspaceFields`
- `isPersonalWorkspace()`, `isPersonalWorkspaceOwnedByUser()`
- `buildPersonalWorkspaceSlug()`

**Remove from `organizationPlugin` schema config:**

```diff
- schema: {
-   organization: {
-     additionalFields: {
-       workspaceType: { type: 'string', input: true, required: false },
-       personalOwnerUserId: { type: 'string', input: true, required: false },
-     },
-   },
- },
```

**Remove entirely:**

- `packages/auth/src/auth-workspace.server.ts` (workspace field validation)

### 3.2 Subscription reference changes

**Current:** `subscription.referenceId` stores `userId`.

**New:** `subscription.referenceId` stores `organizationId`.

This is configured in the Better Auth Stripe plugin via the `organization` option:

```ts
stripe({
  stripeClient,
  stripeWebhookSecret: config.stripe.webhookSecret,
  createCustomerOnSignUp: false, // Changed from true.
  organization: {
    enabled: true,
  },
  // ... rest unchanged
})
```

When `organization.enabled: true`, Better Auth's Stripe plugin:

- Uses `organization.stripeCustomerId` instead of `user.stripeCustomerId`.
- Sets `subscription.referenceId` to the active `organizationId`.
- Creates Stripe customers per organization on first checkout.

### 3.3 Plan limits restructure

**Current `PlanLimits`:**

```ts
interface PlanLimits {
  maxWorkspaces: number;        // Remove — no longer relevant.
  maxMembersPerWorkspace: number;
}
```

**New `PlanLimits`:**

```ts
interface PlanLimits {
  maxMembers: number; // Maximum members in this workspace. -1 = unlimited.
}
```

- `maxWorkspaces` is removed entirely. Users can create unlimited workspaces.
- `maxMembersPerWorkspace` is renamed to `maxMembers` (it's per-workspace by definition now).

**Updated plan definitions:**

| Plan    | `maxMembers` | Price (monthly) | Price (annual) |
| ------- | ------------ | --------------- | -------------- |
| Free    | 1            | —               | —              |
| Starter | 5            | $5              | $50            |
| Pro     | 25           | $49             | $490           |

## 4. Billing Logic Changes

### 4.1 Plan resolution — user to workspace

All plan resolution functions shift from user-scoped to workspace-scoped.

**Current flow:**

```
getUserActivePlanId(headers, userId)
  → auth.api.listActiveSubscriptions({ referenceId: userId })
  → resolveUserPlanId(subscriptions)
```

**New flow:**

```
getWorkspaceActivePlanId(headers, workspaceId)
  → auth.api.listActiveSubscriptions({ referenceId: workspaceId })
  → resolveWorkspacePlanId(subscriptions)
```

The pure function `resolveUserPlanId()` is renamed to `resolveWorkspacePlanId()` — the logic is identical (filter to active/trialing, pick highest tier).

### 4.2 Limit checks — simplified

**Current `checkUserPlanLimit`:**

- `feature: 'workspace'` → checks user's plan vs owned workspace count.
- `feature: 'member'` → finds workspace owner → resolves owner's plan → checks member count.

**New `checkWorkspacePlanLimit`:**

- `feature: 'member'` → resolves workspace's own plan → checks member count.
- `feature: 'workspace'` → removed entirely.

The indirection of "find workspace owner → resolve owner's plan" is eliminated. The workspace's own subscription determines its limits.

```ts
async function checkWorkspacePlanLimit(
  headers: Headers,
  workspaceId: string,
  feature: 'member'
): Promise<CheckPlanLimitResult> {
  const ctx = await getWorkspacePlanContext(headers, workspaceId);
  const limit = ctx.limits.maxMembers;
  if (limit === -1) {
    return { allowed: true, current: 0, limit: -1, planName: ctx.planName, upgradePlan: ctx.upgradePlan };
  }
  const current = await auth.billing.countWorkspaceMembers(workspaceId);
  return {
    allowed: current < limit,
    current,
    limit,
    planName: ctx.planName,
    upgradePlan: ctx.upgradePlan,
  };
}
```

### 4.3 Better Auth organization hooks

**`beforeCreateOrganization`:**

- Remove plan limit check entirely. Workspace creation is always allowed.
- Remove `isPersonalWorkspace` check.
- Remove `validateWorkspaceFields` call.

```ts
beforeCreateOrganization: async ({ organization, user }) => {
  // No plan-based gating. Workspaces are always free to create.
},
```

**`beforeCreateInvitation`:**

- Resolve the workspace's own plan instead of the owner's user-level plan.

```ts
beforeCreateInvitation: async ({ organization }) => {
  const planId = await billing.resolveWorkspacePlanIdFromDb(organization.id);
  const limits = getPlanLimitsForPlanId(planId);
  if (limits.maxMembers === -1) return;
  const memberCount = await billing.countWorkspaceMembers(organization.id);
  if (memberCount >= limits.maxMembers) {
    throw new APIError('FORBIDDEN', {
      message: `This workspace has reached its member limit (${limits.maxMembers}). Upgrade the workspace plan to invite more members.`,
    });
  }
},
```

**`beforeDeleteOrganization`:**

- Replace personal workspace check with "last workspace" and "active subscription" checks.

```ts
beforeDeleteOrganization: async ({ organization }) => {
  // Block deletion of workspaces with active subscriptions.
  // User must cancel the subscription first via Stripe Portal.
  const planId = await billing.resolveWorkspacePlanIdFromDb(organization.id);
  if (planId !== FREE_PLAN_ID) {
    const subscriptions = await db
      .select({ status: subscriptionTable.status })
      .from(subscriptionTable)
      .where(eq(subscriptionTable.referenceId, organization.id));
    const hasActive = subscriptions.some(
      (s) => s.status === 'active' || s.status === 'trialing'
    );
    if (hasActive) {
      throw new APIError('BAD_REQUEST', {
        message:
          'Cannot delete a workspace with an active subscription. Cancel the subscription first.',
      });
    }
  }

  // Block deletion of the user's last workspace.
  const ownerId = await billing.getWorkspaceOwnerUserId(organization.id);
  if (!ownerId) return;

  const workspaceCount = await billing.countOwnedWorkspaces(ownerId);
  if (workspaceCount <= 1) {
    throw new APIError('BAD_REQUEST', {
      message: 'Cannot delete your last workspace.',
    });
  }
},
```

### 4.4 Invoices — workspace-scoped

**Current:** `getInvoicesForUser(userId)` → uses `user.stripeCustomerId`.

**New:** `getInvoicesForWorkspace(workspaceId)` → uses `organization.stripeCustomerId`.

```ts
async function getInvoicesForWorkspace(workspaceId: string) {
  const [org] = await db
    .select({ stripeCustomerId: organizationTable.stripeCustomerId })
    .from(organizationTable)
    .where(eq(organizationTable.id, workspaceId));

  if (!org?.stripeCustomerId) return [];

  // Same Stripe API call, different customer ID source.
  const invoices = await stripeClient.invoices.list({
    customer: org.stripeCustomerId,
    limit: 100,
    created: { gte: twelveMonthsAgo },
  });
  // ... map to invoice shape
}
```

### 4.5 Checkout — workspace-scoped

**Current:** `createCheckoutForPlan(headers, planId, annual)` → `auth.api.upgradeSubscription()` with user context.

**New:** `createCheckoutForWorkspace(headers, workspaceId, planId, annual)` → same API but with the workspace's active organization set so `referenceId` is the `organizationId`.

Success/cancel URLs update from `/billing` to `/ws/$workspaceId/billing`.

### 4.6 Billing portal — workspace-scoped

**Current:** `createUserBillingPortal(headers)` → uses user's Stripe customer.

**New:** `createWorkspaceBillingPortal(headers, workspaceId)` → uses organization's Stripe customer.

Return URL updates from `/billing` to `/ws/$workspaceId/billing`.

### 4.7 Subscription reactivation — workspace-scoped

**Current:** `reactivateUserSubscription(headers, userId)` → queries by `referenceId = userId`.

**New:** `reactivateWorkspaceSubscription(headers, workspaceId)` → queries by `referenceId = workspaceId`.

## 5. Enforcement Model

### 5.1 Two enforcement types

| Type           | Governs                     | Behavior                                                                                                                                             | Example                                                                                                                                          |
| -------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Soft limit** | Member count                | Existing members grandfathered. Cannot add beyond the plan's limit. If members are removed below the limit, new invites are allowed up to the limit. | Had 10 members on Pro, downgrade to Starter (5 max). 10 members remain. Remove 6 (down to 4) → can invite 1 more (to 5). Cannot invite beyond 5. |
| **Hard limit** | Feature gates, usage quotas | Immediately enforced on new actions. Existing data untouched.                                                                                        | File upload cap drops from 100MB to 10MB. Existing 50MB files remain. New uploads capped at 10MB.                                                |

### 5.2 Workspace effective state

The workspace's effective state is always derived — never stored.

```
Effective state = f(subscription status, current usage, plan limits)
```

| Subscription state                        | Meets free-tier limits? | Result                                                                            |
| ----------------------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| Active / trialing                         | —                       | Fully functional at plan level                                                    |
| `cancelAtPeriodEnd = true`, within period | —                       | Active; show "expires on [date]" banner                                           |
| Canceled (past period end)                | Yes (≤1 member)         | Operates as free workspace                                                        |
| Canceled (past period end)                | No (>1 member)          | Grandfathered members stay; can't add new ones; feature/usage gates at free level |
| `past_due`                                | —                       | Active with payment warning banner                                                |
| No subscription record                    | —                       | Free workspace (never had a paid plan)                                            |

### 5.3 Cancellation and downgrade policy

Cancellation and downgrade are **always allowed** — no pre-checks, no denial, no warnings. The user manages cancellation via Stripe Customer Portal (accessed through the workspace billing page).

When the subscription transitions at period end, the enforcement model in §5.1 and §5.2 kicks in naturally:

- New plan's soft limits (member count) apply to future additions only.
- New plan's hard limits (feature gates, usage quotas) apply immediately to new actions.

No custom cancellation UI or `auth.api.cancelSubscription()` call is needed. Stripe Portal handles the full cancellation flow.

## 6. Billing Helpers Refactoring

### 6.1 `packages/auth/src/billing.server.ts`

| Current function                       | New function                                | Change                                                                 |
| -------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `resolveUserPlanIdFromDb(userId)`      | `resolveWorkspacePlanIdFromDb(workspaceId)` | Query by `referenceId = workspaceId`                                   |
| `countOwnedWorkspaces(userId)`         | `countOwnedWorkspaces(userId)`              | Unchanged — still needed for "last workspace" deletion check           |
| `getWorkspaceOwnerUserId(workspaceId)` | `getWorkspaceOwnerUserId(workspaceId)`      | Unchanged — still needed for deletion check and billing access control |
| `countWorkspaceMembers(workspaceId)`   | `countWorkspaceMembers(workspaceId)`        | Unchanged                                                              |
| `getInvoicesForUser(userId)`           | `getInvoicesForWorkspace(workspaceId)`      | Query org's `stripeCustomerId` instead of user's                       |

### 6.2 `apps/web/src/billing/billing.server.ts`

| Current function                                             | New function                                                       | Change                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `getUserActivePlanId(headers, userId)`                       | `getWorkspaceActivePlanId(headers, workspaceId)`                   | `referenceId = workspaceId`                                           |
| `getUserPlanContext(headers, userId)`                        | `getWorkspacePlanContext(headers, workspaceId)`                    | Delegates to workspace plan resolution                                |
| `getBillingData(headers, userId)`                            | `getWorkspaceBillingData(headers, workspaceId)`                    | `referenceId = workspaceId`                                           |
| `checkUserPlanLimit(headers, userId, feature, workspaceId?)` | `checkWorkspacePlanLimit(headers, workspaceId, feature)`           | Resolves workspace's own plan directly; `'workspace'` feature removed |
| `createCheckoutForPlan(headers, planId, annual)`             | `createCheckoutForWorkspace(headers, workspaceId, planId, annual)` | Sets active org, workspace-scoped redirect URLs                       |
| `createUserBillingPortal(headers)`                           | `createWorkspaceBillingPortal(headers, workspaceId)`               | Uses org's Stripe customer                                            |
| `reactivateUserSubscription(headers, userId)`                | `reactivateWorkspaceSubscription(headers, workspaceId)`            | `referenceId = workspaceId`                                           |

### 6.3 `apps/web/src/billing/billing.functions.ts` (server functions)

| Current                                     | New                                                               | Change                                                |
| ------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| `getInvoices()`                             | `getWorkspaceInvoices({ workspaceId })`                           | Requires `workspaceId` input                          |
| `createCheckoutSession({ planId, annual })` | `createWorkspaceCheckoutSession({ workspaceId, planId, annual })` | Requires `workspaceId` input                          |
| `createPortalSession()`                     | `createWorkspacePortalSession({ workspaceId })`                   | Requires `workspaceId` input                          |
| `getUserBillingData()`                      | `getWorkspaceBillingData({ workspaceId })`                        | Requires `workspaceId` input                          |
| `reactivateSubscription()`                  | `reactivateWorkspaceSubscription({ workspaceId })`                | Requires `workspaceId` input                          |
| `checkPlanLimit({ feature, workspaceId? })` | `checkWorkspacePlanLimit({ workspaceId, feature })`               | `workspaceId` required; `'workspace'` feature removed |

All server functions must verify the requesting user is the workspace owner before performing billing actions.

### 6.4 `packages/auth/src/plans.ts`

| Change                              | Detail                                                 |
| ----------------------------------- | ------------------------------------------------------ |
| `PlanLimits.maxWorkspaces`          | Remove field                                           |
| `PlanLimits.maxMembersPerWorkspace` | Rename to `maxMembers`                                 |
| Plan `features` arrays              | Update display strings                                 |
| `resolveUserPlanId()`               | Rename to `resolveWorkspacePlanId()` (logic unchanged) |

## 7. Routing & UI Changes

### 7.1 New route: `/ws/$workspaceId/billing`

Workspace-level billing page. Only accessible to workspace owner.

**Behavior:**

- Shows current plan for this workspace.
- Shows upgrade/downgrade options.
- Shows invoice history for this workspace.
- Manage subscription button (Stripe portal).
- Reactivation option if canceling.

### 7.2 Updated route: `/_protected/_account/billing`

Repurposed as a billing overview page.

**Behavior:**

- Lists all workspaces the user owns.
- Each row shows: workspace name, current plan, subscription status, next renewal date.
- Each row links to `/ws/$workspaceId/billing`.
- No actions on this page — view and navigate only.

### 7.3 Workspace creation flow

**Current:** "Add workspace" button → `checkPlanLimit({ feature: 'workspace' })` → if allowed, show name dialog; if blocked, show upgrade prompt.

**New:** "Add workspace" button → show name dialog immediately. No plan check needed. Workspace is always created as free.

**Files to update:**

- `apps/web/src/components/workspace-switcher.tsx` — remove plan limit check, remove upgrade prompt for workspace creation.

### 7.4 Workspace settings page

**Current:** Personal workspaces cannot be deleted. Delete button disabled with "Personal workspace can not be deleted" message.

**New:** Deletion is blocked in two cases:

1. **Active subscription** — "Cancel your subscription before deleting this workspace."
2. **Last workspace** — "Cannot delete your last workspace."

The settings page should check both conditions and show the appropriate message. The delete button is disabled with the relevant reason.

**Files to update:**

- `apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx` — replace `isPersonalWorkspace` check with "active subscription" and "last workspace" checks.
- `apps/web/src/components/workspace/workspace-delete-dialog.tsx` — no changes needed (already generic).

### 7.5 Workspace settings page — add billing link

The workspace settings page should include a link/section to the workspace billing page (visible to owner only).

### 7.6 Sidebar navigation

Add "Billing" nav item under workspace navigation for workspace owners.

### 7.7 Member invitation

**Current:** `checkPlanLimit({ feature: 'member', workspaceId })` — resolves workspace owner's user-level plan.

**New:** `checkWorkspacePlanLimit({ workspaceId, feature: 'member' })` — resolves workspace's own plan.

**Files to update:**

- `apps/web/src/routes/_protected/ws/$workspaceId/members.tsx` — update `checkPlanLimit` call.

### 7.8 Default workspace on signup

**Current:** Creates a personal workspace with `workspaceType: 'personal'`, name "Personal", slug `personal-{userId}`.

**New:** Creates a regular workspace with a default name (e.g., "My Workspace" or the user's name), random slug. No special fields.

**Files to update:**

- `packages/auth/src/auth.server.ts` — `databaseHooks.user.create.after` hook.

### 7.9 Default workspace selection

**Current:** `pickDefaultWorkspace()` prefers the personal workspace owned by the user.

**New:** `pickDefaultWorkspace()` picks the first workspace (by creation date) or the active one.

**Files to update:**

- `apps/web/src/workspace/workspace.ts` — simplify `pickDefaultWorkspace()`.
- `apps/web/src/workspace/workspace.server.ts` — update `ensureActiveWorkspaceForSession()` if it references personal workspace logic.

## 8. Auth Plugin Config Changes

### 8.1 Stripe plugin

```ts
stripe({
  stripeClient,
  stripeWebhookSecret: config.stripe.webhookSecret,
  createCustomerOnSignUp: false,                       // Changed: no user-level Stripe customer.
  organization: {
    enabled: true,                                     // New: org-level Stripe customers.
  },
  // getCheckoutSessionParams unchanged.
  subscription: {
    enabled: true,
    plans: stripePlans,
    // All lifecycle hooks unchanged — they log subscription events.
    // referenceId in the subscription payload will now be organizationId.
  },
})
```

### 8.2 Organization plugin

```ts
organizationPlugin({
  allowUserToCreateOrganization: true,
  creatorRole: 'owner',
  requireEmailVerificationOnInvitation: true,
  sendInvitationEmail: authEmails.sendInvitationEmail,
  // schema.organization.additionalFields removed entirely.
  organizationHooks: {
    // Updated hooks as described in Section 4.3.
  },
})
```

## 9. Files Affected

### Remove entirely

| File                                         | Reason                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `packages/auth/src/workspace-types.ts`       | Workspace type concept eliminated                                                                                                |
| `packages/auth/src/auth-workspace.server.ts` | Workspace field validation no longer needed. **Note:** `buildAcceptInviteUrl` must be migrated to `auth-emails.server.ts` first. |

### Major changes

| File                                                          | Changes                                                                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `packages/auth/src/index.ts`                                  | Remove `export * from './workspace-types'` re-export                                                                          |
| `packages/auth/src/plans.ts`                                  | Remove `maxWorkspaces`, rename `maxMembersPerWorkspace` → `maxMembers`, rename `resolveUserPlanId` → `resolveWorkspacePlanId` |
| `packages/auth/src/billing.server.ts`                         | Refactor all functions from user-scoped to workspace-scoped                                                                   |
| `packages/auth/src/auth.server.ts`                            | Update Stripe plugin config, org hooks, signup hook                                                                           |
| `packages/auth/src/auth-emails.server.ts`                     | Absorb `buildAcceptInviteUrl` from deleted `auth-workspace.server.ts`                                                         |
| `apps/web/src/billing/billing.server.ts`                      | Refactor all functions from user-scoped to workspace-scoped                                                                   |
| `apps/web/src/billing/billing.functions.ts`                   | Update all server functions to accept `workspaceId`                                                                           |
| `apps/web/src/components/billing/billing-page.tsx`            | Workspace-scoped billing page                                                                                                 |
| `apps/web/src/routes/_protected/_account/billing.tsx`         | Repurpose as overview page                                                                                                    |
| `apps/web/src/routes/_protected/ws/$workspaceId/billing.tsx`  | New route: workspace billing                                                                                                  |
| `apps/web/src/components/workspace-switcher.tsx`              | Remove plan limit check for creation                                                                                          |
| `apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx` | Replace personal workspace check with last-workspace check                                                                    |
| `apps/web/src/routes/_protected/ws/$workspaceId/members.tsx`  | Update plan limit check call                                                                                                  |
| `apps/web/src/workspace/workspace.ts`                         | Remove workspace type re-exports, simplify `pickDefaultWorkspace`                                                             |
| `apps/web/src/workspace/workspace.server.ts`                  | Remove personal workspace references                                                                                          |

### Minor changes (reference cleanup)

| File                                                            | Changes                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/web/src/components/workspace/workspace-delete-dialog.tsx` | No code changes (already generic)                                   |
| `apps/web/src/components/app-sidebar.tsx`                       | Add billing nav item for owners                                     |
| `apps/web/src/hooks/use-upgrade-prompt.ts`                      | May need workspace context                                          |
| `apps/web/src/components/billing/upgrade-prompt-dialog.tsx`     | Redirect to workspace billing                                       |
| `apps/web/src/components/billing/billing-plan-cards.tsx`        | No structural change                                                |
| `apps/web/src/components/billing/billing-downgrade-banner.tsx`  | No structural change                                                |
| `apps/web/src/components/billing/billing-invoice-table.tsx`     | No structural change                                                |
| `packages/test-utils/src/factories.ts`                          | Remove `workspaceType` and `personalOwnerUserId` from org factories |

### Database migration

- Remove `workspaceType` column from `organization` table.
- Remove `personalOwnerUserId` column from `organization` table.

### Tests to update

All tests referencing workspace types, user-level billing, or plan limit checks will need updates to match the new workspace-scoped model.

**Billing tests:**

- `apps/web/test/unit/billing/billing.server.test.ts`
- `apps/web/test/unit/billing/billing.functions.test.ts`

**Auth package tests:**

- `packages/auth/test/unit/workspace-types.test.ts` — remove entirely (module deleted)
- `packages/auth/test/unit/auth-workspace.server.test.ts` — remove entirely (module deleted)
- `packages/auth/test/unit/plans.test.ts`

**Workspace tests:**

- `apps/web/test/unit/workspace/workspace.test.ts`
- `apps/web/test/unit/workspace/workspace.server.test.ts`

**Component / hook tests:**

- `apps/web/test/unit/hooks/use-upgrade-prompt.test.ts`
- `apps/web/test/unit/components/workspace-switcher.test.tsx`
- `apps/web/test/unit/components/billing/billing-page.test.tsx`
- `apps/web/test/unit/components/billing/billing-plan-cards.test.tsx`
- `apps/web/test/unit/components/billing/upgrade-prompt-dialog.test.tsx`

**Integration tests:**

- `apps/web/test/integration/components/billing/billing-upgrade-flow.integration.test.tsx`

## 10. Stripe Configuration

### Stripe Dashboard changes

- No product/price changes needed — plans remain the same.
- Customer Portal configuration may need review to ensure org-level customers work correctly.
- Webhook endpoint remains the same — Better Auth handles routing.

### Environment variables

No new env vars needed. Existing `STRIPE_*_PRICE_ID` vars remain unchanged.

## 11. Out of Scope

These items are acknowledged but deferred:

- **Feature gates** — Plan-level feature toggling (e.g., "advanced analytics on Pro only"). The `PlanLimits` type can be extended later.
- **Usage quotas** — Per-workspace usage metering (e.g., storage, API calls). Can be added as new `PlanLimits` fields.
- **Per-seat pricing** — Currently flat per-plan. Could be added by integrating Stripe's per-seat billing with the `maxMembers` limit.
- **Workspace transfer** — Transferring ownership of a workspace (and its subscription) to another user.
