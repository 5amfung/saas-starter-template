# Plan Limit Gate — Design

**Date:** 2026-03-12
**Status:** Approved

## Problem

When a user on the Starter plan tries to create a workspace or invite a member beyond their plan limits, the server hooks (`beforeCreateOrganization`, `beforeCreateInvitation`) throw a `FORBIDDEN` error. This surfaces as an unhelpful "Unauthorized" toast with no context about why or how to resolve it.

## Solution

A reusable **plan limit gate** that intercepts limited actions _before_ they hit the server, showing a contextual upgrade promotion dialog. Server hooks remain as a defense-in-depth safety net.

## Architecture

### Shared query helpers (`billing.server.ts`)

Two pure helper functions that encapsulate the Drizzle queries for counting usage. Both the server hooks and the `checkPlanLimit` server function call these — no SQL duplication.

```
countOwnedWorkspaces(userId: string): Promise<number>
```

Counts rows in `memberTable` where `userId` matches and `role === 'owner'`.

```
countWorkspaceMembers(workspaceId: string): Promise<number>
```

Counts rows in `memberTable` where `organizationId` matches.

### Refactored server hooks (`auth.server.ts`)

- `beforeCreateOrganization` — calls `countOwnedWorkspaces()` + plan resolution. Same behavior, uses shared helper.
- `beforeCreateInvitation` — calls `countWorkspaceMembers()` + plan resolution. Same behavior, uses shared helper.

Both hooks remain unchanged in behavior — they are the safety net.

### Server function (`billing.functions.ts`)

```ts
type LimitFeature = 'workspace' | 'member';

interface CheckPlanLimitInput {
  feature: LimitFeature;
  workspaceId?: string; // Required for 'member'.
}

interface CheckPlanLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  planName: string;
}
```

- `'workspace'` — calls `countOwnedWorkspaces(userId)`, compares to `maxWorkspaces`.
- `'member'` — calls `countWorkspaceMembers(workspaceId)`, compares to `maxMembersPerWorkspace`.
- Returns enough context for the dialog to show a meaningful message.

### Shared dialog (`upgrade-prompt-dialog.tsx`)

New file: `src/components/billing/upgrade-prompt-dialog.tsx`

```ts
interface UpgradePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string; // e.g. "Workspace limit reached"
  description: string; // e.g. "You're using 1/1 workspaces on the Starter plan."
  isUpgrading: boolean;
  onUpgrade: () => void;
}
```

- Uses `AlertDialog` (consistent with existing codebase dialogs).
- Two actions: **Cancel** and **Upgrade**.
- `onUpgrade` calls `createCheckoutSession` — same Stripe checkout flow as the billing page.

### Integration: Workspace switcher (`workspace-switcher.tsx`)

When "Add workspace" is clicked:

1. Call `checkPlanLimit({ feature: 'workspace' })`.
2. If `allowed` → open the existing create workspace `AlertDialog`.
3. If not `allowed` → open `UpgradePromptDialog` with message: _"You're using {current}/{limit} workspaces on the {planName} plan. Upgrade to Pro to create more."_

### Integration: Invite dialog trigger

Where the "Invite" button is rendered:

1. Call `checkPlanLimit({ feature: 'member', workspaceId })`.
2. If `allowed` → open the existing invite `AlertDialog`.
3. If not `allowed` → open `UpgradePromptDialog` with message: _"This workspace has {current}/{limit} members on the {planName} plan. Upgrade to Pro to invite more."_

## Data flow

```
User clicks action
  → checkPlanLimit (server function)
    → requireVerifiedSession()
    → getUserActivePlanId(userId)
    → countOwnedWorkspaces(userId) OR countWorkspaceMembers(workspaceId)
    → return { allowed, current, limit, planName }
  → If allowed: open original dialog
  → If not allowed: open UpgradePromptDialog
    → User clicks Upgrade → createCheckoutSession → Stripe Checkout
    → User clicks Cancel → dialog closes
```

## File changes

| File                                                   | Change                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `src/billing/billing.server.ts`                        | Add `countOwnedWorkspaces()`, `countWorkspaceMembers()` helpers |
| `src/billing/billing.functions.ts`                     | Add `checkPlanLimit` server function                            |
| `src/auth/auth.server.ts`                              | Refactor hooks to use shared helpers                            |
| `src/components/billing/upgrade-prompt-dialog.tsx`     | **New** — shared upgrade dialog                                 |
| `src/components/workspace-switcher.tsx`                | Gate "Add workspace" with limit check                           |
| `src/components/workspace/workspace-invite-dialog.tsx` | Gate "Invite" with limit check                                  |

## Extensibility

To gate a new feature in the future:

1. Add a new `LimitFeature` variant (e.g. `'project'`).
2. Add a new limit field to `PlanLimits`.
3. Add a count helper in `billing.server.ts`.
4. Add the case in `checkPlanLimit`.
5. Gate the UI trigger with the same pattern.
