# SF-46 Experimental API Design

## Summary

Implement Linear issue `SF-46` by adding a small experimental API endpoint to `apps/web` at `/api/hello`.

The endpoint accepts two headers:

- `x-api-key`
- `x-api-workspace-id`

It verifies the API key with Better Auth using the existing workspace-owned API key configuration (`configId: "system-managed"`), confirms the verified key belongs to the same workspace ID passed in `x-api-workspace-id`, and returns:

- `200` with `{ "message": "hello" }` when valid
- the Better Auth invalid-key status when the key is missing or invalid
- `400` when `x-api-workspace-id` is missing
- `403` when the key is valid but belongs to a different workspace

## Problem

The repository already supports workspace-owned API keys, but `apps/web` does not yet expose a simple server endpoint that demonstrates how those keys should be authenticated and authorized for API access.

Without this endpoint:

- there is no example of how to verify a workspace API key in `apps/web`
- future API routes could duplicate auth logic inconsistently
- the team lacks a small, testable reference for the desired `400` / invalid-key / `403` behavior split

## Goals

- Add `/api/hello` to `apps/web`
- Verify `x-api-key` with `auth.api.verifyApiKey`
- Scope verification to `configId: "system-managed"`
- Compare the verified key workspace reference against `x-api-workspace-id`
- Return `403 Forbidden` for workspace mismatch
- Keep the route implementation small and reusable for future `/api/*` routes
- Add focused unit tests for the verifier and the route handler

## Non-Goals

- Add a customer-facing API platform
- Add rate-limit policy, per-route permissions, or API versioning
- Move this behavior into `packages/auth` before there is a second consumer
- Create a generic middleware abstraction for all web API routes
- Add new Better Auth key configurations

## Current Architecture

### Existing API Route Shape

`apps/web` already serves API endpoints through TanStack Start file routes under `apps/web/src/routes/api/`.

Relevant examples:

- [apps/web/src/routes/api/test/emails.ts](/Users/sfung/.codex/worktrees/2806/sass-starter-template/apps/web/src/routes/api/test/emails.ts)
- [apps/web/src/routes/api/sentry-example.ts](/Users/sfung/.codex/worktrees/2806/sass-starter-template/apps/web/src/routes/api/sentry-example.ts)

These routes keep transport concerns in the file-route handler and avoid mixing them with unrelated app state.

### Existing Auth Ownership Model

The Better Auth setup already registers the API key plugin with an organization-owned configuration:

- `configId: "system-managed"`
- `references: "organization"`

Relevant source files:

- [packages/auth/src/auth.server.ts](/Users/sfung/.codex/worktrees/2806/sass-starter-template/packages/auth/src/auth.server.ts)
- [apps/admin/src/admin/workspaces.server.ts](/Users/sfung/.codex/worktrees/2806/sass-starter-template/apps/admin/src/admin/workspaces.server.ts)
- [packages/db-schema/src/auth.schema.ts](/Users/sfung/.codex/worktrees/2806/sass-starter-template/packages/db-schema/src/auth.schema.ts)

This means the verified API key should resolve to a key record whose `referenceId` is the owning workspace ID.

## Chosen Design

### 1. Add A Thin Route At `/api/hello`

Create a new file route at [apps/web/src/routes/api/hello.ts](/Users/sfung/.codex/worktrees/2806/sass-starter-template/apps/web/src/routes/api/hello.ts).

The route should:

- read `x-api-key`
- read `x-api-workspace-id`
- call a small server-only verifier helper
- translate verifier results into HTTP responses
- return `Response.json({ message: 'hello' })` on success

The route should not contain Better Auth object-shape parsing inline beyond wiring request headers into the helper.

### 2. Keep Verification In A Web-Local Server Helper

Create a server-only helper in `apps/web` rather than `packages/auth`, for example:

- [apps/web/src/api/api-key-auth.server.ts](/Users/sfung/.codex/worktrees/2806/sass-starter-template/apps/web/src/api/api-key-auth.server.ts)

This helper should own:

- header extraction normalization
- Better Auth verification call
- workspace reference comparison
- a small discriminated result shape for the route

This is the recommended scope because the verification logic is reusable within `apps/web`, while the HTTP contract is still app-local.

### 3. Treat Workspace Mismatch As Authorization Failure

Behavior should be:

- missing or invalid key: invalid-key response from the verification path
- missing workspace header: `400 Bad Request`
- valid key + mismatched workspace: `403 Forbidden`
- valid key + matching workspace: success

The reason for `403` is that a mismatched workspace means the credential is authentic but not authorized for the requested workspace.

### 4. Use Better Auth `verifyApiKey` Result Directly

Per Better Auth’s API key docs, `verifyApiKey` returns a result shaped like:

- `valid`
- `error`
- `key`

And the returned key object is the API key record without the raw secret, including the owner reference. For this repository’s organization-owned configuration, that owner reference is expected to be `referenceId`.

Sources:

- [Better Auth API Key docs](https://better-auth.com/docs/plugins/api-key)
- [Better Auth API Key reference](https://better-auth.com/docs/plugins/api-key/reference)

This means the verifier can compare:

- `result.key.referenceId`
- `x-api-workspace-id`

without adding a second database lookup.

## Error Handling

- If `x-api-workspace-id` is missing or blank, return JSON error payload with `400`
- If `x-api-key` is missing, call verification through the same invalid-key path so missing and invalid credentials stay aligned
- If `verifyApiKey` returns `valid: false`, return an invalid-key response
- If `verifyApiKey` returns `valid: true` but no `key`, treat it as invalid verification state and return invalid-key response
- If `referenceId !== x-api-workspace-id`, return JSON error payload with `403`

## Testing Strategy

### Verifier Tests

Add unit tests for the helper that cover:

- missing workspace header
- invalid key
- valid key with missing key payload
- valid key with mismatched workspace
- valid key with matching workspace

### Route Tests

Add route-level tests that cover:

- success response from `POST /api/hello`
- `403` translation for workspace mismatch
- `400` translation for missing workspace header

## Acceptance Criteria

- `POST /api/hello` exists in `apps/web`
- the route verifies keys with `auth.api.verifyApiKey`
- verification is scoped to `configId: "system-managed"`
- workspace mismatch returns `403 Forbidden`
- success returns `{ "message": "hello" }`
- focused tests cover the verifier and route behavior
