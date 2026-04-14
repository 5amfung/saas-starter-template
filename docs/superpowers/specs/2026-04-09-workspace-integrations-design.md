# SF-33 Workspace Integrations Design

**Date:** 2026-04-09
**Goal:** Add a new workspace `Integrations` section between `Members` and `Billing`, starting with a Slack integration card that stores workspace-owned credentials securely and supports masked reveal/edit behavior.
**Approach:** Introduce first-class workspace integration capabilities, add a generic encrypted workspace-integration secrets table, and build a Slack-specific page UI on top of reusable secret-field editing behavior.
**Scope exclusion:** This design does not include Slack OAuth install flows, connection health checks, audit trails, secret rotation UX, or cloud-KMS-backed encryption.

---

## 1. Context

Workspace navigation in the Web app already exposes workspace-specific sections in [`apps/web/src/components/app-sidebar.tsx`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/components/app-sidebar.tsx), including:

- `Overview`
- `Projects`
- `Members`
- `Billing`
- `Settings`

Workspace-level route access and capability checks are already centralized through:

- [`packages/policy/src/workspace.ts`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/packages/policy/src/workspace.ts)
- [`apps/web/src/policy/workspace-capabilities.server.ts`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/policy/workspace-capabilities.server.ts)
- route loaders such as [`apps/web/src/routes/_protected/ws/$workspaceId/members.tsx`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/routes/_protected/ws/$workspaceId/members.tsx), [`apps/web/src/routes/_protected/ws/$workspaceId/billing.tsx`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/routes/_protected/ws/$workspaceId/billing.tsx), and [`apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx).

The app schema already stores workspace-owned application data in [`packages/db-schema/src/app.schema.ts`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/packages/db-schema/src/app.schema.ts), but there is no existing secret-storage abstraction or encryption helper for workspace integration credentials.

SF-33 adds a new `Integrations` workspace section with these initial constraints:

- the feature is workspace-owned
- saved values must be encrypted at rest
- the first integration is Slack
- the first Slack fields are `clientId` and `clientSecret`
- the UI should be extensible to future integrations without requiring another DB schema redesign

## 2. Problem

The workspace area currently has no dedicated place to manage workspace-owned third-party integration credentials.

That creates three gaps:

1. there is no navigation entry or protected route for integration management,
2. there is no secure persistence model for workspace-owned integration secrets,
3. there is no reusable UI pattern for masked reveal/edit/save/cancel behavior for secrets.

This is not only a page-layout task. The feature requires a coherent policy, storage, encryption, and UI design.

## 3. Objectives

1. Add a new `Integrations` section to workspace navigation between `Members` and `Billing`.
2. Introduce separate workspace capabilities for viewing and managing integrations.
3. Restrict integration access to workspace `owner` and `admin` roles only.
4. Restrict the feature to paid plans, meaning any plan where `planId !== 'free'`.
5. Store integration secrets encrypted at rest.
6. Start with a Slack card exposing `Client ID` and `Client Secret`.
7. Support masked display by default, explicit reveal, save-disabled-until-dirty behavior, and cancel-to-remask behavior.
8. Keep the persistence model generic enough for future integrations and keys without changing the table shape.

## 4. Non-Goals

- Implement Slack OAuth authorization or installation flows
- Verify Slack credentials against external APIs
- Add audit history or secret change logs
- Build a full generic integrations marketplace UI
- Introduce cloud KMS or external secret-manager integration in the first implementation

## 5. Recommended Design

Treat integrations as a first-class workspace feature with its own policy surface:

- `canViewIntegrations`
- `canManageIntegrations`

Keep storage generic:

- one row per workspace/integration/key secret
- encrypted value and crypto metadata stored in the database
- no plaintext value stored in the database

Keep the first UI specific:

- one dedicated Slack card
- two Slack fields
- reusable secret-field interaction logic for future cards

This gives the feature a clean policy boundary, secure persistence, and a UI that can expand later without redesigning the database.

## 6. Capability Model

### New Workspace Capabilities

Add two new booleans to the workspace capability surface in [`packages/policy/src/workspace.ts`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/packages/policy/src/workspace.ts):

- `canViewIntegrations`
- `canManageIntegrations`

These should flow through the existing capability evaluation and server wrappers so they can be reused consistently by:

- sidebar navigation
- integrations route loaders
- server functions for reveal and save actions

### Initial Policy Rules

Both capabilities should evaluate to `true` only when all are true:

- the workspace member role is `owner` or `admin`
- the workspace plan is not `free`

All other cases should evaluate to `false`.

### Why Separate Capabilities Are Preferred

Reusing `canViewSettings` and `canManageSettings` is no longer the right model because integrations now have business rules that diverge from general settings:

- they are plan-gated
- they are role-restricted
- they control secret material, not ordinary workspace metadata

Separate capability flags keep that rule explicit and allow future pricing or role changes without reworking route/UI/server authorization everywhere.

## 7. Data Model

Add a new workspace-owned table in [`packages/db-schema/src/app.schema.ts`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/packages/db-schema/src/app.schema.ts).

Recommended shape:

- `id`
- `workspaceId`
- `integration`
- `key`
- `encryptedValue`
- `iv`
- `authTag`
- `encryptionVersion`
- `createdAt`
- `updatedAt`

Constraints:

- foreign key from `workspaceId` to `organization.id`
- unique constraint on `(workspaceId, integration, key)`

Example Slack rows:

- `(workspaceId=abc, integration=slack, key=clientId)`
- `(workspaceId=abc, integration=slack, key=clientSecret)`

### Why A Row-Per-Key Model Is Preferred

This model keeps the table flexible without pushing secret structure into an opaque JSON blob.

Benefits:

- no schema migration is needed when a future integration adds new keys
- individual fields can be revealed and updated independently
- masking/reveal logic remains per-field instead of per-blob
- future per-key metadata is easier to support

Rejected alternative:

- storing one encrypted JSON payload per integration row

That would reduce row count but makes partial update, per-field reveal, and future metadata more awkward.

## 8. Encryption Design

Use server-side application-managed encryption with Node's built-in `crypto` module and `AES-256-GCM`.

### Key Management

Add a dedicated environment variable such as:

- `WORKSPACE_SECRET_ENCRYPTION_KEY`

The key should be:

- server-only
- 32 bytes for AES-256
- stored as a base64-encoded secret in the environment

### Stored Crypto Metadata

For each secret value, persist:

- ciphertext in `encryptedValue`
- a random IV in `iv`
- an authentication tag in `authTag`
- an integer or string `encryptionVersion`

### Encryption Flow

1. The client submits a changed field value to a server function.
2. The server verifies session and `canManageIntegrations`.
3. The server generates a fresh IV.
4. The server encrypts the plaintext with `AES-256-GCM`.
5. The database stores ciphertext plus IV, auth tag, and version metadata.

### Decryption Flow

1. The client requests reveal for a single saved field.
2. The server verifies session and `canManageIntegrations`.
3. The server loads the encrypted row, decrypts it server-side, and returns plaintext for that one field only.

### Masked Reads

Default page reads should not return plaintext.

Instead, the server should decrypt as needed to compute a masked display value, such as:

- first 6 characters visible
- remaining characters replaced by `*`

If a field has no saved value, return no masked value and `hasValue = false`.

## 9. Runtime Architecture

### Recommended Ownership

- schema definition in `packages/db-schema`
- runtime database access through server-only code
- route/UI orchestration in `apps/web`
- capability evaluation in `packages/policy`

This fits the monorepo's current ownership boundaries and avoids mixing secret storage concerns into generic organization metadata.

### Integration Definitions

Keep storage generic, but define integration-specific field metadata in code.

For Slack, define:

- integration id: `slack`
- fields:
  - `clientId`
  - `clientSecret`

Each field definition should include:

- label
- storage key
- description or helper text if needed
- whether the field is secret/masked
- validation rules
- display order

This code-level registry allows future integrations to add fields without changing the DB table.

## 10. Server Functions And Helpers

Add server-owned helpers/functions for integrations, following the existing `*.functions.ts` pattern used elsewhere in `apps/web`.

Recommended responsibilities:

### `getWorkspaceIntegrations`

Returns display-safe integration data for the page, including:

- integration id
- field definitions or field descriptors
- `hasValue`
- masked value when present

This function should require `canViewIntegrations`.

### `revealWorkspaceIntegrationValue`

Reveals plaintext for one saved field only.

This function should:

- require `canManageIntegrations`
- load a single row by workspace/integration/key
- decrypt server-side
- return plaintext only for that one field

### `updateWorkspaceIntegrationValues`

Persists one or more changed field values.

This function should:

- require `canManageIntegrations`
- validate integration-specific inputs
- encrypt changed values server-side
- upsert rows by `(workspaceId, integration, key)`

### Clear/Delete Semantics

If a user intentionally clears a saved field, the recommended behavior is to delete that row instead of storing a null-like encrypted value.

That keeps reads simpler:

- row exists => saved value exists
- row missing => no saved value

## 11. Route And Navigation Design

Add a new route:

- [`apps/web/src/routes/_protected/ws/$workspaceId/integrations.tsx`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/routes/_protected/ws/$workspaceId/integrations.tsx)

Route loader behavior:

- load workspace integration capabilities
- reject with `notFound` when `canViewIntegrations` is false
- prefetch display-safe integration data if useful for the page pattern

Update workspace navigation in [`apps/web/src/components/app-sidebar.tsx`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/components/app-sidebar.tsx):

- insert `Integrations` between `Members` and `Billing`
- render it only when `canViewIntegrations`

## 12. UI Design

### Page Layout

The `Integrations` page should follow the same centered card layout pattern used by workspace settings pages.

Initial content:

- one `Slack` card
- short description such as "Manage workspace Slack credentials."

### Slack Card

Render two editable rows:

- `Client ID`
- `Client Secret`

The first implementation can keep the card visually Slack-specific while the data/storage model remains generic underneath.

### Field Interaction Rules

For each saved field:

- display a masked value by default
- show only the first 6 characters, then replace the rest with `*`
- reveal the full plaintext only after an explicit eye-icon action

Buttons:

- `Save` is disabled until the field value changes
- `Cancel` restores the last saved value and remasks it

If a field has no saved value:

- render an empty editable input
- do not render a fake masked value

### Save Granularity

Use one `Save` / `Cancel` pair per field row rather than one form-wide save button for the entire card.

Why:

- supports partial updates cleanly
- avoids forcing unrelated fields to enter edit mode
- matches the reveal/edit lifecycle of secrets better
- makes cancel-to-remask behavior easier to reason about

### Reusable UI Boundary

Recommended component structure:

- page-level integrations route component
- `IntegrationCard`
- reusable `IntegrationSecretFieldRow`

The reusable row should own:

- masked vs revealed display state
- local edit state
- dirty tracking
- reveal action wiring
- save/cancel button state

It should not own:

- route-level access logic
- integration policy decisions
- database behavior

## 13. Validation Rules

Keep validation integration-specific even though storage is generic.

Initial Slack validation:

- `clientId`: required non-empty string
- `clientSecret`: required non-empty string

Future integrations can define their own field requirements in the integration definition layer without changing the underlying table schema.

## 14. Files Expected To Change

Primary areas:

- `packages/policy/src/workspace.ts`
- `apps/web/src/policy/workspace-capabilities.server.ts`
- `apps/web/src/components/app-sidebar.tsx`
- `apps/web/src/routes/_protected/ws/$workspaceId/integrations.tsx`
- `apps/web/src/...` server-only integration helper/functions module(s)
- `packages/db-schema/src/app.schema.ts`
- generated migration files for the new table

Possible supporting files:

- workspace capability query hooks if the client capability type surface needs to expand
- integration-specific components under `apps/web/src/components/`

## 15. Testing Strategy

### Policy Tests

Add coverage for the new capabilities:

- paid plan + owner => allowed
- paid plan + admin => allowed
- free plan + owner/admin => denied
- paid plan + member => denied

### Server Tests

Add tests for secret persistence behavior:

- save encrypts before persistence
- default reads return masked values only
- reveal decrypts only when authorized
- unauthorized reveal/save is rejected
- clearing a field removes the row

### UI And Route Tests

Add coverage for:

- sidebar visibility tied to `canViewIntegrations`
- route access rejection when the capability is false
- field starts masked when a saved value exists
- eye action reveals plaintext
- `Save` remains disabled until changed
- `Cancel` restores the saved masked state

### Verification Commands

Start with targeted commands relevant to changed areas:

- affected `apps/web` tests
- affected `packages/policy` tests
- typecheck
- boundary checks if new imports cross package seams
- schema generation or migration verification for the new table

Use the smallest relevant scope first, then widen if the change touches shared capability or schema surfaces.

## 16. Risks And Tradeoffs

- introducing separate integration capabilities increases the capability surface slightly, but that is justified because integrations have different pricing and role rules than settings
- application-managed encryption with an env key is simpler than KMS and fits this repo today, but future security requirements may justify moving the master key out of app config
- a Slack-specific first card is intentionally narrow; the reusable field-row pattern should prevent the first implementation from hardcoding Slack assumptions too deeply into the page structure
- computing masked values from decrypted data means the server must still access plaintext transiently during reads, which is acceptable here but should remain server-only

## 17. Expected Outcome

After SF-33 is implemented:

- eligible workspaces see a new `Integrations` item between `Members` and `Billing`
- only workspace owners/admins on paid plans can access and manage the page
- the page initially exposes a Slack card with `Client ID` and `Client Secret`
- saved values are encrypted at rest and masked by default in the UI
- reveal, save, and cancel behavior works per field row
- future integrations can add new key/value secrets without redesigning the table
