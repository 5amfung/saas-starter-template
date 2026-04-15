# SF-11 API Key Support Design

## Summary

Implement the currently approved slice of Linear issue `SF-11` by enabling Better Auth API key support for workspace organizations and extending organization role permissions so workspace admins can manage API keys and members can read them.

Automatic creation, rotation, disabling, and delivery of system-managed keys is intentionally deferred. Subscription webhook handlers should not provision keys in this scope.

## Problem

The repository already models `apiKeys` as a billing entitlement, but Better Auth API key support was not configured yet. As a result:

- workspaces could not own API keys through Better Auth
- organization admins and members did not have explicit API key permissions in Better Auth organization RBAC
- the codebase had no approved strategy yet for how platform-managed keys should be created or surfaced

## Goals

- Enable Better Auth API key support for organization-owned workspace keys
- Configure a single `system-managed` key configuration owned by organizations
- Grant workspace `admin` full API key CRUD permissions
- Grant workspace `member` API key read permissions
- Keep workspace `owner` behavior aligned with Better Auth defaults, where owners already have full access
- Leave subscription lifecycle hooks neutral until key provisioning strategy is explicitly designed

## Non-Goals

- Automatically create keys from Stripe subscription webhooks
- Disable keys from Stripe subscription webhooks
- Add a `customer-managed` API key configuration
- Build customer-facing UI for listing or managing keys
- Introduce new database tables or schema indexes for key lifecycle automation
- Decide how raw system-managed key values are stored, delivered, rotated, or recovered

## External Constraints

The Better Auth docs establish these constraints for the narrowed scope:

- organization-owned keys use `references: "organization"`
- organization API key operations use `organizationId`
- organization owners already have full access to API key operations by default
- non-owner roles need explicit `apiKey` permissions through the organization plugin access-control setup
- `createApiKey` generates the raw key value; callers do not supply the secret value

Sources:

- [API Key docs](https://better-auth.com/docs/plugins/api-key)
- [Advanced API Key docs](https://better-auth.com/docs/plugins/api-key/advanced)
- [API Key reference](https://better-auth.com/docs/plugins/api-key/reference#schema)

## Current Architecture

1. [packages/auth/src/auth.server.ts](/Users/sfung/.codex/worktrees/1f1c/sass-starter-template/packages/auth/src/auth.server.ts) owns Better Auth setup, organization setup, and Stripe subscription lifecycle callbacks.
2. [packages/auth/src/permissions.ts](/Users/sfung/.codex/worktrees/1f1c/sass-starter-template/packages/auth/src/permissions.ts) is the auth package source of truth for custom organization RBAC.
3. Billing plan state and Enterprise status still flow through Better Auth Stripe subscription callbacks, but those callbacks are no longer responsible for API key lifecycle behavior in this issue.

## Chosen Design

Keep the implementation centered in `packages/auth`:

- register the Better Auth API key plugin in [auth.server.ts](/Users/sfung/.codex/worktrees/1f1c/sass-starter-template/packages/auth/src/auth.server.ts)
- configure a single organization-owned key config with `configId: "system-managed"`
- define API key statements and role permissions in [permissions.ts](/Users/sfung/.codex/worktrees/1f1c/sass-starter-template/packages/auth/src/permissions.ts)
- keep Stripe subscription hooks as logging/orchestration only for now

This keeps the approved work small and reversible while the team decides the actual system-managed key lifecycle.

## Role Model

- `owner`
  - no special customization required by product behavior
  - kept explicit in the configured roles map so the application role union still includes `owner`
- `admin`
  - `apiKey: ["create", "read", "update", "delete"]`
- `member`
  - `apiKey: ["read"]`

## API Key Configuration

The approved config for this issue is:

- `configId: "system-managed"`
- `references: "organization"`

`customer-managed` remains deferred until there is a real product use case.

## Deferred Decisions

The following require a separate design before implementation:

- what event should create system-managed keys
- whether keys should be created by platform automation, admin action, or an onboarding workflow
- how raw keys should be shown or delivered at creation time
- how disabled, rotated, or superseded keys should be handled
- whether billing entitlements should gate key visibility, creation, or usage

## Acceptance Criteria

- Better Auth API key plugin is registered for organization-owned keys
- workspace `admin` has API key CRUD permissions
- workspace `member` has API key read permission
- workspace `owner` remains fully capable when roles are explicitly configured
- Stripe subscription callbacks do not provision or disable API keys as part of this issue
- tests cover plugin wiring and RBAC behavior for the narrowed scope
