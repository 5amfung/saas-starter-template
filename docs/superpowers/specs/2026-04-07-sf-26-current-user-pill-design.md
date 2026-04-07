# SF-26 Current User Pill Design

Date: 2026-04-07
Issue: SF-26

## Summary

Add a `Current user` pill to the workspace Members table in `apps/web`. The pill should appear in the Email Address column immediately after the current user's email and only on the row representing the signed-in user.

This is a presentation-only change. It should not alter member fetching, sorting behavior, role rendering, permissions, or row actions.

## Goals

- Make it easier for a signed-in user to identify himself in the Members table.
- Place the marker exactly where the issue requests: directly after the email in the Email Address column.
- Reuse the shared badge primitive so the pill matches the rest of the product UI.
- Keep the implementation narrowly scoped to the members table unless a broader change becomes clearly necessary.

## Non-Goals

- Changing how members are fetched or shaped from Better Auth.
- Adding new server fields or API parameters.
- Changing role labels, row action availability, or membership policy behavior.
- Introducing a reusable member-identity abstraction for a single badge if the table can own the presentation cleanly.

## Current Context

The members table lives in [`apps/web/src/components/workspace/workspace-members-table.tsx`](/Users/sfung/.codex/worktrees/7f79/sass-starter-template/apps/web/src/components/workspace/workspace-members-table.tsx).

Today:

- the email cell renders plain text,
- the component already receives `currentUserId`,
- each row already includes `userId`,
- the current user row is already treated specially for row actions such as `Leave`.

The members data is prepared in [`apps/web/src/workspace/use-members-table.ts`](/Users/sfung/.codex/worktrees/7f79/sass-starter-template/apps/web/src/workspace/use-members-table.ts), where each row is mapped to:

- `id`
- `userId`
- `email`
- `role`

That means the table already has enough information to decide whether a row belongs to the signed-in user without changing the fetch layer.

The repo also already uses the shared `Badge` primitive in other UI surfaces, such as [`packages/components/src/account/active-sessions-list.tsx`](/Users/sfung/.codex/worktrees/7f79/sass-starter-template/packages/components/src/account/active-sessions-list.tsx), which makes it the right visual primitive for this pill.

## Problem

In the current table, the signed-in user's row looks the same as every other row until the user inspects row actions or infers it from the email address.

That slows down scanning and makes self-identification less obvious, especially in larger workspaces.

## Recommended Design

Render the email cell as a small inline layout:

- email text first,
- a `Badge` labeled `Current user` immediately after it when `row.original.userId === currentUserId`.

Example structure:

```tsx
<div className="inline-flex items-center gap-2">
  <span>{email}</span>
  {isCurrentUser ? <Badge variant="secondary">Current user</Badge> : null}
</div>
```

This keeps the logic local to the presentation layer and avoids expanding the row contract for a purely visual label.

## Alternatives Considered

### Option A: derive `isCurrentUser` in the table

Recommended.

Why:

- smallest possible change,
- no hook or server contract updates,
- uses data the table already has,
- easy to verify with focused component tests.

Tradeoff:

- the derivation remains local to this component rather than being part of the row model.

### Option B: add `isCurrentUser` in `useMembersTable`

Rejected for now.

Why not:

- adds row-shape churn for a presentational concern,
- requires updating hook tests and shared test factories,
- does not provide much value unless multiple consumers need the same flag.

### Option C: extract a reusable member identity subcomponent

Rejected for now.

Why not:

- introduces an abstraction before there is a second real use case,
- increases file count and indirection for a one-label enhancement.

## Files Expected To Change

Primary:

- `apps/web/src/components/workspace/workspace-members-table.tsx`

Tests:

- `apps/web/test/unit/components/workspace/workspace-members-table.test.tsx`

No change is expected in:

- `apps/web/src/workspace/use-members-table.ts`
- server functions
- policy modules
- schema or database packages

## Verification Plan

Run focused verification for the changed component:

1. add a unit test asserting the `Current user` badge appears on the signed-in user's row,
2. add or update an assertion confirming non-current-user rows do not show the badge,
3. run the targeted Vitest file for the members table component.

Expected command:

```bash
pnpm --filter @workspace/web test test/unit/components/workspace/workspace-members-table.test.tsx
```

## Risks And Tradeoffs

The main tradeoff is locality versus reuse:

- keeping the logic in the table is the lowest-risk fix today,
- if the same label is later needed in multiple workspace member surfaces, it may make sense to promote the flag into the hook or extract a shared row-identity renderer at that time.

For SF-26, the local render-layer approach is the most proportionate solution.
