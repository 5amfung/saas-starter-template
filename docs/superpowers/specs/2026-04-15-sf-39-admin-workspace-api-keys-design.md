# SF-39 Admin Workspace API Keys Design

## Summary

Implement Linear issue `SF-39` by adding an `API Keys` section to the Admin app workspace details page, directly after the existing `Subscription` section.

The chosen design keeps the scope intentionally narrow:

- list API keys owned by the workspace
- allow admins to generate a new workspace key
- allow admins to hard-delete a workspace key with confirmation
- allow admins to copy the key record ID from the list
- derive the key name from the selected access mode
- do not display raw key values or masked key fragments in this admin table

This design uses the existing Better Auth API key support that was already approved under `SF-11`, where all workspace-owned keys are partitioned under `configId: "system-managed"`.

This issue specifically supports the manual Enterprise onboarding workflow: a platform admin may generate the key as part of onboarding, but the created key is still owned by the workspace organization, not by the platform admin.

## Problem

The Admin workspace details page currently shows workspace metadata and billing state, but it does not expose API key records for the workspace. That creates an operational gap:

- admins cannot inspect which keys belong to a workspace
- admins cannot generate a new key from the admin surface
- admins cannot delete obsolete keys from the admin surface
- support and operations users lack a lightweight identifier they can copy when coordinating around a key record

At the same time, showing the secret value in the Admin UI introduces extra product and security questions that are not necessary to solve this issue.

It is also important that the UI and implementation do not blur ownership boundaries. Platform admins are acting as operators on behalf of the customer workspace during onboarding; they are not the owners of the resulting key records.

## Goals

- Add an `API Keys` section to [apps/admin/src/routes/\_protected/workspaces/$workspaceId.tsx](/Users/sfung/.codex/worktrees/fe77/sass-starter-template/apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx) after the `Subscription` section
- Show API key records owned by the current workspace
- Support `Generate new key` from the Admin UI
- Support hard deletion through a confirmation dialog
- Let admins copy the API key record ID from the list
- Derive the created key name from a fixed access selection instead of freeform inputs
- Keep the implementation aligned with the existing admin card layout and server-function patterns
- Make workspace ownership explicit in both behavior and copy so the feature is clearly part of customer onboarding, not platform-admin key ownership

## Non-Goals

- Show the raw key value in the admin table
- Show masked key fragments in the admin table
- Allow arbitrary key names or freeform notes in the Admin create dialog
- Build key rotation, disable/enable, or expiration management
- Add multiple API key configurations beyond `system-managed`
- Redesign the rest of the workspace details page
- Resolve long-term raw-secret delivery or recovery strategy beyond what Better Auth already returns during creation

## Why Copy ID Instead Of Showing The Key

The admin list should show record identity, not secret material.

Using `Copy ID` instead of rendering the key value is the recommended design because it:

- simplifies the UI and the implementation
- avoids persisting or repeatedly rendering sensitive secret material in Admin
- still gives operators a stable identifier for support, logs, audits, or follow-up actions
- keeps SF-39 focused on manageable CRUD behavior instead of broadening into secret display policy

This is a deliberate tradeoff:

- admins lose inline visibility into a masked fragment that could help visually distinguish similar keys
- in exchange, the UI becomes safer and the implementation avoids opening a second design problem around secret display rules

## Current Architecture

### Admin Workspace Details Page

The current workspace details route lives at [apps/admin/src/routes/\_protected/workspaces/$workspaceId.tsx](/Users/sfung/.codex/worktrees/fe77/sass-starter-template/apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx).

Today it renders:

- `Workspace Info`
- `Subscription`
- `Entitlement Overrides` for eligible enterprise workspaces

The page already uses a simple stacked-card layout, so the new API keys section should be another `Card` inserted after `Subscription`.

### Admin Data Fetching And Mutations

The existing Admin app patterns are:

- query data through `*.query.functions.ts` and `*.queries.ts`
- perform mutations through `createServerFn()` wrappers in `*.functions.ts`
- keep privileged logic in `*.server.ts`

Relevant examples already exist in:

- [apps/admin/src/admin/workspaces-query.functions.ts](/Users/sfung/.codex/worktrees/fe77/sass-starter-template/apps/admin/src/admin/workspaces-query.functions.ts)
- [apps/admin/src/admin/workspaces.queries.ts](/Users/sfung/.codex/worktrees/fe77/sass-starter-template/apps/admin/src/admin/workspaces.queries.ts)
- [apps/admin/src/admin/workspaces.functions.ts](/Users/sfung/.codex/worktrees/fe77/sass-starter-template/apps/admin/src/admin/workspaces.functions.ts)
- [apps/admin/src/admin/workspaces.server.ts](/Users/sfung/.codex/worktrees/fe77/sass-starter-template/apps/admin/src/admin/workspaces.server.ts)

### API Key Ownership Model

The repository already established workspace-owned Better Auth API keys in `SF-11`.

Existing constraints:

- keys are organization-owned
- workspace ID maps to Better Auth `organizationId`
- all current keys in scope for this issue use `configId: "system-managed"`
- Better Auth owns the API key table and secret generation behavior

Operationally for `SF-39`:

- a platform admin may create or delete a key from the Admin app
- that action is part of manual Enterprise onboarding or support operations
- the resulting key record still belongs to the workspace organization
- the key must not be modeled, described, or displayed as platform-admin-owned

Relevant source-of-truth files:

- [packages/auth/src/auth.server.ts](/Users/sfung/.codex/worktrees/fe77/sass-starter-template/packages/auth/src/auth.server.ts)
- [packages/db-schema/src/auth.schema.ts](/Users/sfung/.codex/worktrees/fe77/sass-starter-template/packages/db-schema/src/auth.schema.ts)
- [docs/superpowers/specs/2026-04-14-sf-11-api-key-support-design.md](/Users/sfung/.codex/worktrees/fe77/sass-starter-template/docs/superpowers/specs/2026-04-14-sf-11-api-key-support-design.md)

## Chosen Design

### 1. Add An `API Keys` Card To The Admin Workspace Detail Page

Insert a new card after the existing `Subscription` card in [apps/admin/src/routes/\_protected/workspaces/$workspaceId.tsx](/Users/sfung/.codex/worktrees/fe77/sass-starter-template/apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx).

The card should contain:

- section title: `API Keys`
- short description that these keys belong to the workspace
- a `Generate new key` button in the card header
- a list or table of workspace-owned keys

This keeps the visual rhythm consistent with the rest of the page and matches the placement requested in the ticket.

Recommended helper copy for the section should reinforce ownership, for example:

- `Keys in this section are owned by the workspace and are used during Enterprise onboarding and support workflows.`

### 2. Show A Record-Focused Table

The list should show operational metadata, not secret material.

Recommended columns:

- `Name`
- `Configuration`
- `Created`
- `Actions`

Within `Actions`, provide:

- `Copy ID`
- `Delete`

The copy action should copy the API key record ID, not the secret key value.

The table should not include a `Key` column if the page no longer shows key material. If product still wants a visual slot where the first mockup showed `Key`, repurpose that space into an internal identifier field, but the cleaner design is to remove the column entirely.

### 3. Filter To `system-managed`

SF-39 should only show keys that belong to the workspace and match the currently approved configuration:

- `referenceId = workspaceId`
- `configId = "system-managed"`

This avoids exposing unrelated key types if additional configurations are introduced later.

### 4. Generate New Key Dialog

Clicking `Generate new key` should open a dialog.

Recommended contents:

- title: `Generate new key`
- access selection with exactly two options:
  - `Read only`
  - `Read and Write`
- helper copy explaining the key will be created for this workspace under `system-managed`
- `Cancel` and `Generate key` actions

Creation behavior:

- validate the input through an admin-side schema
- derive the key name from the selected access mode instead of accepting a user-entered name
- create the key on the server for the workspace organization
- close the dialog on success
- refresh or invalidate the workspace detail query so the new row appears

This issue does not require rendering the raw generated secret inside the dialog after creation. If Better Auth returns the raw key value as part of creation, the Admin app may ignore it for this issue.

The dialog copy should explicitly avoid implying platform-admin ownership. Preferred wording is along the lines of:

- `Create a workspace-owned key for this customer workspace.`

Avoid wording like:

- `Create an admin key`
- `Create a platform key`
- `Create a key for yourself`

Recommended derived names:

- `Read only` -> `Read only`
- `Read and Write` -> `Read and Write`

If the implementation later needs more backend-friendly labels, keep that translation internal to the server layer rather than reintroducing freeform naming into the dialog.

### 5. Delete Confirmation Dialog

Clicking `Delete` should open a confirmation dialog.

Recommended contents:

- title: `Delete API key`
- key name for confirmation context
- short warning that deletion is permanent
- `Cancel` and `Delete` actions

Deletion behavior:

- perform hard delete on confirmation
- remove the record permanently rather than soft-disabling it
- refresh or invalidate the workspace detail query after success

### 6. Copy ID Interaction

Each row should expose a `Copy ID` action.

Behavior:

- copy the API key record ID to clipboard
- give lightweight feedback, such as button-label swap or toast confirmation

This action is purely client-side and should not require a server round trip.

## Approaches Considered

## 1. Show masked key fragments in the table

Pros:

- matches the original mockup more closely
- helps visually differentiate keys

Cons:

- still surfaces secret-derived material in the Admin UI
- raises questions about where the fragment comes from and whether it should be persisted or queried
- is unnecessary once `Copy ID` exists

## 2. Show raw key value once after creation

Pros:

- useful if admin immediately needs to hand off the secret

Cons:

- expands SF-39 into secret-delivery policy
- requires stronger product decisions around reveal timing, copy behavior, and recovery expectations
- not needed to satisfy the current ticket after the `Copy ID` simplification

## 3. Do not show any copy action

Pros:

- smallest UI surface

Cons:

- removes a helpful operational affordance
- makes support and debugging less convenient when users need to reference a specific key record

## Recommended approach

Use the narrowed design represented by approach 1's rejection and approach 3's operational motivation:

- no key display
- yes `Copy ID`
- yes generate
- yes hard delete

This keeps the section useful while staying deliberately narrow.

## Data And Server Design

### Read Path

Extend the admin workspace detail read flow so the workspace detail response includes API key rows scoped to the workspace.

Preferred shape:

- add an app-local query in the Admin app layer rather than querying Better Auth directly from the route component
- return only the fields needed for this page

Recommended row fields:

- `id`
- `name`
- `configId`
- `createdAt`
- optional actor metadata only if already easy to obtain

If creator identity is not already stored or cheaply available, do not invent a new persistence requirement just to show `Created by ...` in this issue.

If actor metadata is shown, treat it as audit context only. For example, `Created by <platform admin>` is acceptable as an audit detail, but it must not change the core ownership model: the key still belongs to the workspace.

### Mutation Path

Add admin-specific server functions for:

- create workspace API key
- delete workspace API key

These should follow the same pattern as existing admin workspace mutations:

- input validation in `*.functions.ts`
- capability checks and Better Auth interaction in `*.server.ts`
- query invalidation in the client after success

For create specifically:

- accept the selected access mode as the mutation input
- map that mode to the fixed key name
- map that mode to the appropriate permission shape if Better Auth key permissions are being set during creation
- always create the key against the workspace organization reference, never against the current admin user

## Authorization

Admin app access should still be controlled by admin-app capabilities.

For this issue:

- only admins who can view workspace details should see the section
- only admins with the appropriate management capability should be allowed to create or delete keys

If there is not yet a dedicated admin capability for API key management, the implementation should either:

- reuse the narrowest existing workspace-management capability that is semantically correct, or
- add a dedicated capability if the current policy model would otherwise be misleading

The exact capability choice should be finalized during implementation, but authorization must remain server-enforced.

## UI Details

### Empty State

If the workspace has no API keys, show:

- a short empty-state message
- the `Generate new key` action

Do not render a fake empty table.

### Loading State

During workspace detail load:

- keep using the route’s existing skeleton pattern
- add API-key placeholders only if the detail query now includes key data

### Error State

If the broader workspace detail query fails, preserve the route’s current retry behavior.

For create and delete actions:

- surface a toast or inline error message
- keep the dialog open on failure when helpful

## Risks And Tradeoffs

- If Better Auth’s admin-facing API-key methods are awkward to call from the Admin app, the server adapter layer may need a small wrapper to keep the route clean
- Removing secret display simplifies SF-39, but it also means this issue does not solve “how does an admin obtain the actual new secret?” if that becomes a product requirement later
- If creator metadata is not readily available, the implemented table may be slightly simpler than the mockup, which is acceptable as long as the core actions are present
- Poor wording in the UI could imply the platform admin owns the key; copy and server-side naming should be reviewed carefully to preserve the workspace-ownership model

## Testing Strategy

Start with targeted Admin coverage.

Priority tests:

1. server-side tests for listing workspace-scoped `system-managed` keys
2. server-side tests for creating a workspace key through the admin mutation path
3. server-side tests for hard deletion
4. component or route tests covering:
   - section rendering
   - empty state
   - dialog open/close behavior
   - access-mode selection in the generate dialog
   - derived-name creation behavior
   - `Copy ID` interaction

If the implementation touches route-level data shape or policy wiring, add the smallest relevant regression coverage there as well.

## Verification Commands

Start with the smallest relevant Admin scope:

- `pnpm --filter @workspace/admin-web test`
- `pnpm --filter @workspace/admin-web typecheck`

If package boundaries or shared exports change, also run:

- `pnpm run check:boundaries`

## Acceptance Criteria

- Workspace details page shows a new `API Keys` section after `Subscription`
- The section lists only keys owned by the current workspace and scoped to `configId: "system-managed"`
- The feature supports manual Enterprise onboarding while preserving workspace ownership semantics
- Admin can open a `Generate new key` dialog and create a key
- Admin can open a delete confirmation dialog and hard-delete a key
- Each row exposes `Copy ID`
- The table does not display raw key values or masked fragments
- Relevant admin-side tests cover the new behavior

## Expected Outcome

After `SF-39` is implemented:

- Admin operators can manage workspace API key records from the workspace details page
- Enterprise onboarding can use the Admin app to provision workspace-owned keys without redefining those keys as platform-admin-owned
- the UI remains consistent with the existing Admin workspace detail layout
- the issue is solved without expanding the Admin app into a secret-viewing surface
