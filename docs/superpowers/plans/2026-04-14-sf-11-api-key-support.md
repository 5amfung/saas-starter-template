# SF-11 API Key Support Implementation Plan

## Goal

Deliver the approved, narrowed scope of `SF-11`:

- Better Auth API key plugin wiring for organization-owned keys
- organization RBAC for API key access
- no automatic key provisioning from Stripe subscription webhooks

## Scope

In scope:

- [packages/auth/src/auth.server.ts](/Users/sfung/.codex/worktrees/1f1c/sass-starter-template/packages/auth/src/auth.server.ts)
- [packages/auth/src/permissions.ts](/Users/sfung/.codex/worktrees/1f1c/sass-starter-template/packages/auth/src/permissions.ts)
- focused auth package unit tests
- spec and plan documentation alignment

Out of scope:

- `api-keys.server.ts` lifecycle helpers
- webhook-driven provisioning or disabling
- schema indexes for lifecycle queries
- customer-managed key config
- UI

## Implementation Steps

### 1. Permissions

Update [permissions.ts](/Users/sfung/.codex/worktrees/1f1c/sass-starter-template/packages/auth/src/permissions.ts) so it is the source of truth for organization API key permissions:

- define `apiKey: ["create", "read", "update", "delete"]` statements
- keep `owner` explicit in the roles map
- grant `admin` full API key CRUD
- grant `member` read-only API key access

### 2. Better Auth Wiring

Update [auth.server.ts](/Users/sfung/.codex/worktrees/1f1c/sass-starter-template/packages/auth/src/auth.server.ts):

- register the Better Auth API key plugin
- configure a single organization-owned key config:
  - `configId: "system-managed"`
  - `references: "organization"`
- leave subscription hooks free of API key provisioning behavior

### 3. Tests

Keep auth package test coverage aligned with the narrowed scope:

- [permissions.test.ts](/Users/sfung/.codex/worktrees/1f1c/sass-starter-template/packages/auth/test/unit/permissions.test.ts)
  - assert owner/admin/member API key permissions
- [auth.server.test.ts](/Users/sfung/.codex/worktrees/1f1c/sass-starter-template/packages/auth/test/unit/auth.server.test.ts)
  - assert API key plugin registration
  - assert organization plugin receives the access-control setup
  - do not assert webhook-side provisioning

### 4. Documentation

Keep the planning trail honest:

- update the design spec to say provisioning strategy is deferred
- update this plan to remove lifecycle-helper and webhook-provisioning tasks

## Verification

Run:

```bash
pnpm --filter @workspace/auth test -- test/unit/permissions.test.ts test/unit/auth.server.test.ts
pnpm --filter @workspace/auth typecheck
```

Expected result:

- auth tests pass
- auth package typecheck passes
- no remaining docs in this change set describe webhook-based key provisioning as approved scope

## Follow-Up Work

Create a separate design for system-managed key lifecycle before implementing any of the following:

- key creation trigger
- raw key delivery/storage strategy
- rotation and disablement rules
- billing and entitlement coupling
