# SF-32 Admin Role Update Design

## Summary

Fix Linear issue `SF-32`, where changing a user's role to `admin` from the Admin app fails with the toast error `[body] Invalid input: expected record, received undefined`.

The chosen approach is to keep the current single-submit Admin user form and correct the server-side Better Auth adapter to use the admin plugin's `adminUpdateUser` API instead of `updateUser`.

## Problem

The Admin app exposes a single "Save changes" action for editing visible user fields, including:

- profile fields
- email verification
- role
- ban-related fields

When an admin changes a user's role and saves, the request fails before the update completes, and the UI shows a body-validation error instead of a domain-specific message.

## Current Behavior

The current Admin app flow is:

1. [apps/admin/src/components/admin/admin-user-form.tsx](/Users/sfung/.codex/worktrees/78aa/sass-starter-template/apps/admin/src/components/admin/admin-user-form.tsx) collects all editable fields and submits them through `updateUser`.
2. [apps/admin/src/admin/users.functions.ts](/Users/sfung/.codex/worktrees/78aa/sass-starter-template/apps/admin/src/admin/users.functions.ts) validates the payload and forwards it to `updateAdminUser`.
3. [apps/admin/src/admin/users.server.ts](/Users/sfung/.codex/worktrees/78aa/sass-starter-template/apps/admin/src/admin/users.server.ts) calls `getAuth().api.updateUser(...)`.

The Better Auth admin plugin available in this repository exposes:

- `auth.api.adminUpdateUser` for general admin-side user updates
- `auth.api.setRole` for dedicated role changes

The installed Better Auth plugin does not expose the currently assumed `auth.api.updateUser` method for this admin flow.

## Root Cause

The Admin app server adapter is wired to the wrong Better Auth admin API contract.

Specifically:

- the local `AdminApiLike` type in [apps/admin/src/admin/users.server.ts](/Users/sfung/.codex/worktrees/78aa/sass-starter-template/apps/admin/src/admin/users.server.ts) claims an `updateUser` method exists
- the code uses an `unknown` cast, so TypeScript does not verify that assumption against the real Better Auth plugin surface
- at runtime, the wrong endpoint or endpoint shape is used, which causes request-body validation to fail with `[body] Invalid input: expected record, received undefined`

This is a boundary mismatch, not a UI-form design issue and not evidence that the single-save workflow is unsupported.

## Goals

- Preserve the current single "Save changes" Admin UX
- Allow role changes to succeed through the existing form submission path
- Align the Admin app adapter with the actual Better Auth admin plugin API
- Add regression coverage so future auth/plugin upgrades do not silently break this flow again

## Non-Goals

- Redesign the Admin user details page
- Split role editing into a separate button or dialog
- Introduce unrelated refactors in the admin user management stack

## Approaches Considered

## 1. Use `adminUpdateUser` for the existing save flow

Update the Admin server adapter to call `auth.api.adminUpdateUser({ headers, userId, data })`.

Pros:

- smallest change
- preserves current UX
- matches Better Auth's admin update API
- keeps all editable fields in one request path

Cons:

- still relies on a local adapter type unless the typing is tightened at the same time

## 2. Use `setRole` only when the role field changes

Keep general field updates in one request, but call a separate role endpoint for role changes.

Pros:

- explicit mapping to Better Auth's dedicated role endpoint

Cons:

- adds orchestration and partial-failure complexity
- does not match the current one-button editing model as cleanly
- solves more than this bug requires

## 3. Introduce a richer admin-user service wrapper

Build an app-local abstraction that delegates to `adminUpdateUser` and `setRole` internally.

Pros:

- can centralize future admin-user mutation logic

Cons:

- larger scope than needed for this bug
- adds abstraction before there is a demonstrated need

## Chosen Design

Use approach 1.

### Server Adapter

In [apps/admin/src/admin/users.server.ts](/Users/sfung/.codex/worktrees/78aa/sass-starter-template/apps/admin/src/admin/users.server.ts):

- rename the local API contract from `updateUser` to `adminUpdateUser`
- call `api.adminUpdateUser(...)`
- keep sending the same normalized `data` object, including `role`

This fits Better Auth's admin plugin behavior, where `adminUpdateUser` accepts a record-like `data` payload and supports `role` updates.

### UI and Form Behavior

No UI changes are needed in [apps/admin/src/components/admin/admin-user-form.tsx](/Users/sfung/.codex/worktrees/78aa/sass-starter-template/apps/admin/src/components/admin/admin-user-form.tsx).

The existing single-submit form remains correct because:

- it already gathers all editable fields together
- the server function schema already validates the full payload
- the issue is at the adapter boundary, not in the form design

### Typing

Prefer tightening the local adapter type in [apps/admin/src/admin/users.server.ts](/Users/sfung/.codex/worktrees/78aa/sass-starter-template/apps/admin/src/admin/users.server.ts) so it reflects the actual Better Auth admin API method names.

This will not fully eliminate casting risk, but it will at least make future mistakes around method naming less likely.

## Testing Strategy

### Targeted Regression Coverage

Add or update tests so the role-change path is explicitly covered.

Priority checks:

1. a unit test for [apps/admin/src/admin/users.server.ts](/Users/sfung/.codex/worktrees/78aa/sass-starter-template/apps/admin/src/admin/users.server.ts) that verifies `updateAdminUser` delegates to `api.adminUpdateUser`
2. a form-level integration test for [apps/admin/src/components/admin/admin-user-form.tsx](/Users/sfung/.codex/worktrees/78aa/sass-starter-template/apps/admin/src/components/admin/admin-user-form.tsx) that changes `role` and submits successfully

### Verification Commands

Start with the smallest relevant scope:

- `pnpm --filter @workspace/admin-web test -- admin/users`
- `pnpm --filter @workspace/admin-web test -- admin-user-management-flow`

If test naming or filters differ, run the closest targeted Admin test command available in the package.

## Risks and Tradeoffs

- If other code paths also assume nonexistent Better Auth API names, this bug may reveal a broader adapter-typing weakness
- Fixing only the method name is intentionally narrow; it avoids unrelated refactoring but leaves the general `unknown`-cast pattern in place
- Using `adminUpdateUser` keeps the single-save UX intact, which is desirable here, but it means the route remains dependent on Better Auth's generic record payload contract

## Expected Outcome

After the fix:

- changing a user's role from `user` to `admin` in the Admin app should succeed through the existing save action
- the Admin app should stop showing the invalid body error for this workflow
- regression tests should protect the adapter boundary that caused the issue
