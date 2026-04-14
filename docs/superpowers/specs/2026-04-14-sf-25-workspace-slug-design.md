# SF-25 Workspace Slug Design

## Summary

Centralize workspace slug generation behind a shared auth utility used by every
workspace creation flow. The utility will be generalized as `generateSlug()`
and will generate opaque slugs using the default `random-word-slugs` output and
append a four-character lowercase alphanumeric suffix.

Example shape:

- `ancient-frog-whispers-k4z2`

This replaces the current split behavior where:

- signup auto-creates a workspace with a `ws-<hex>` slug
- manual workspace creation in the web app uses a name-derived slug

## Goals

- Use one shared slug-generation rule for all workspace creation flows.
- Adopt `random-word-slugs` for workspace slug generation.
- Append a four-character lowercase alphanumeric suffix to reduce collision
  risk.
- Keep slugs opaque and independent of workspace names.

## Non-Goals

- Changing database schema or constraints.
- Making slugs user-editable.
- Making slugs match workspace IDs.
- Adding a broader workspace creation refactor beyond centralizing slug
  generation.

## Current State

There are two different slug formats in the codebase today:

1. `packages/auth/src/auth.server.ts` auto-creates a default workspace during
   signup with `ws-${crypto.randomUUID().slice(0, 8)}`.
2. `apps/web/src/components/workspace-switcher.tsx` creates workspaces with
   `buildWorkspaceSlug(name)`, which comes from
   `apps/web/src/workspace/workspace.ts` and derives the slug from the
   workspace name.

This produces inconsistent slugs depending on which creation path is used.

## Proposed Design

### Shared Utility

Introduce a single shared auth utility:

- `generateSlug(): string`

Responsibilities:

- call `random-word-slugs` with its default configuration
- append `-` plus a four-character lowercase alphanumeric suffix
- return a URL-safe lowercase slug

For SF-25, this utility will be used for workspace slug generation. The helper
is intentionally named generically so it is defensible as an auth-side utility
instead of a workspace-specific helper placed in `packages/auth`.

Expected format:

- `<three-word-default-slug>-<base36-4>`

Example:

- `ancient-frog-whispers-k4z2`

This utility should be the only place in the repository that defines the slug
format used for newly created workspaces.

### Ownership

The utility should live in `packages/auth` in a shared, client-safe utility
module that both `packages/auth` and `apps/web` can import without violating
repository boundaries.

This is defensible because:

- `packages/auth` already owns organization creation behavior that spans apps
- the utility is framed as a generic opaque slug generator, not a
  workspace-specific formatter

The utility should not remain owned by `apps/web/src/workspace/workspace.ts`
because workspace slug generation is shared creation behavior, not just a
client-side UI concern.

### Call Sites

Update both workspace creation flows to use the helper:

1. `packages/auth/src/auth.server.ts`
   Use `generateSlug()` when auto-creating the default workspace during user
   signup.
2. `apps/web/src/components/workspace-switcher.tsx`
   Use `generateSlug()` when creating a workspace from the UI.

### Existing Name-Based Utility

If no other code depends on the current name-based slug helpers, remove them.
If part of the utility module is still needed for unrelated behavior, keep only
the unrelated pieces and delete the name-derived slug generation code.

## Collision Strategy

For SF-25, keep collision handling simple:

- generate a slug once
- rely on the existing unique database constraint for `organization.slug`
- preserve current error behavior unless implementation reveals a concrete need
  for retry logic

Rationale:

- the default three-word slug plus a four-character base36 suffix provides a
  much larger suffix space than four digits
- retry behavior is a separate concern and would broaden the scope of this
  ticket

## Testing Strategy

Update and add targeted unit tests for the changed behavior.

### Helper Tests

Add tests that verify:

- generated slugs match the expected structural pattern
- suffix is exactly four lowercase alphanumeric characters
- output is lowercase and hyphen-separated
- repeated calls produce different values in normal operation

### Auth Tests

Update auth tests to stop expecting `ws-<hex>` and instead assert the new shared
slug shape when the default workspace is created during signup.

### Web Tests

Update web tests to stop expecting name-derived slugs and instead assert the new
shared slug shape or shared helper usage for workspace creation.

### Verification Commands

Run the smallest relevant verification first:

- package-level/unit tests covering the helper and auth flow
- affected web unit tests for workspace creation behavior

If the shared helper crosses package boundaries, also run:

- `pnpm run check:boundaries`

## Tradeoffs

### Benefits

- one consistent slug format across all workspace creation paths
- readable but opaque slugs
- lower collision probability than the originally proposed four-digit suffix
- no schema changes and no multi-step create/update workaround

### Costs

- adds a new dependency on `random-word-slugs`
- removes any semantic relationship between workspace name and slug
- still relies on uniqueness constraints rather than proactive retries

## Decision

Approved direction:

- centralize workspace slug generation behind `generateSlug()` in `packages/auth`
- use `random-word-slugs` default output
- append a four-character lowercase alphanumeric suffix
- apply the utility to both signup-created and user-created workspaces
