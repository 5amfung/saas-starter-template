# Integrations Package Extraction Design

**Date:** 2026-04-09
**Goal:** Extract the workspace integration secret domain from `apps/web` into a dedicated shared `packages/integrations` package so `web`, `admin`, and `api-server` can all consume one boundary-compliant integration API.
**Approach:** Move integration definitions, crypto, types, and secure workspace-integration operations into a new package with a small dependency-injected public API. Keep app-local session checks, capability checks, route loaders, server functions, and UI orchestration in each app.
**Scope exclusion:** This design does not add new integrations, change the current Slack feature behavior, move workspace authorization policy into the new package, or redesign the integrations UI.

---

## 1. Context

SF-33 is now implemented in `apps/web` with these pieces:

- shared policy flags in [`packages/policy/src/workspace.ts`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/packages/policy/src/workspace.ts)
- schema ownership in [`packages/db-schema/src/app.schema.ts`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/packages/db-schema/src/app.schema.ts)
- server-only integration logic in [`apps/web/src/integrations/`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/integrations)
- route/UI orchestration in [`apps/web/src/routes/_protected/ws/$workspaceId/integrations.tsx`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/routes/_protected/ws/$workspaceId/integrations.tsx) and [`apps/web/src/components/integrations/`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/components/integrations)

That first version works, but it also revealed an ownership problem:

- the integration table may need to be used by multiple apps,
- the secret-handling logic is currently owned by one app,
- a direct app import from `@workspace/db-schema` triggered the dependency-cruiser rule in [.dependency-cruiser.cjs](/Users/sfung/.codex/worktrees/357c/sass-starter-template/.dependency-cruiser.cjs),
- the current workaround re-exports `workspaceIntegrationSecrets` through [`apps/web/src/init.ts`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/init.ts), which is acceptable as a short-term boundary fix but not an ideal long-term ownership model.

The repo already prefers shared package APIs over app-by-app internal coupling:

- `packages/billing` owns billing domain and storage APIs
- `packages/policy` owns pure policy capability logic
- apps consume package public surfaces rather than package internals where possible

Integrations now belong in the same category: a shared server-side domain, not an app-local implementation detail.

## 2. Problem

The current `apps/web` implementation is a valid feature implementation but the wrong long-term ownership boundary.

If `apps/admin` and `apps/api-server` also need workspace integration data, secrets, or operations, the current structure creates four problems:

1. secret logic must either be duplicated across apps or imported from one app into another,
2. dependency-cruiser exceptions would multiply as more app files need raw schema access,
3. integration definitions and crypto behavior could drift between apps,
4. `apps/web/src/init.ts` risks becoming an implicit barrel for schema exports instead of a bootstrap module.

The problem is not that the current feature is wrong. The problem is that its logic is owned by the wrong layer.

## 3. Objectives

1. Create a new shared `packages/integrations` package.
2. Move integration definitions, shared types, encryption/decryption/masking, and secure workspace-integration operations into that package.
3. Keep schema ownership in `packages/db-schema`, but access it through the new package rather than through app-local exceptions.
4. Keep capability checks and session checks outside the package so apps still own authorization and framework integration.
5. Preserve the current SF-33 behavior and public app-facing routes/functions.
6. Make the package API usable by `apps/web`, `apps/admin`, and `apps/api-server`.
7. Remove the `workspaceIntegrationSecrets` re-export workaround from `apps/web/src/init.ts`.

## 4. Non-Goals

- Add Admin or API-server integration UI in this refactor
- Change the workspace integration data model
- Change Slack field definitions or current masking behavior
- Move `canViewIntegrations` / `canManageIntegrations` policy into the new package
- Introduce new encryption providers such as cloud KMS

## 5. Recommended Ownership Model

### `packages/integrations` should own

- integration definition metadata such as Slack fields
- shared integration types
- secret crypto helpers
- masked summary construction
- repository-level DB access for workspace integration secrets
- application-level operations for:
  - listing summaries
  - revealing a single saved value
  - updating one or more values

### Apps should continue to own

- session lookup and verified-user preconditions
- workspace capability enforcement
- route loaders and redirects
- `createServerFn()` wrappers
- query hooks, loaders, and UI state
- app-specific toasts and navigation

This keeps the new package responsible for secure storage and operations, while apps stay responsible for authorization and framework integration.

## 6. Why A Dedicated Package Is Preferred

### Rejected option: keep app-local DB seams in each app

This would mean creating app-specific wrappers such as:

- `apps/web/src/db/...`
- `apps/admin/src/db/...`
- `apps/api-server/src/db/...`

Rejected because:

- it duplicates the same ownership seam across multiple apps,
- it still spreads the integration secret domain across app code,
- it does not centralize crypto or integration definitions.

### Rejected option: expand dependency-cruiser allow-lists

This would allow more app modules to import `@workspace/db-schema` directly.

Rejected because:

- it increases raw schema coupling,
- it makes architectural drift easier,
- it avoids the ownership question instead of solving it.

### Recommended option: package-owned integration domain

This option makes integrations a first-class shared capability similar to billing or policy:

- schema remains in `db-schema`,
- secure operations move into a shared package,
- apps consume the new package through its public API.

## 7. Package Structure

Create a new package:

- `packages/integrations`

Recommended initial structure:

- `packages/integrations/package.json`
- `packages/integrations/tsconfig.json`
- `packages/integrations/src/index.ts`
- `packages/integrations/src/types.ts`
- `packages/integrations/src/definitions.ts`
- `packages/integrations/src/crypto.ts`
- `packages/integrations/src/repository.ts`
- `packages/integrations/src/workspace-integrations.ts`
- `packages/integrations/test/unit/*.test.ts`

### Responsibility split

#### `src/types.ts`

Owns:

- `IntegrationKey`
- `IntegrationFieldKey`
- `WorkspaceIntegrationSummary`
- field payload shapes returned to apps

#### `src/definitions.ts`

Owns:

- `INTEGRATION_KEYS`
- integration field metadata such as Slack `clientId` and `clientSecret`
- key-validation helpers

#### `src/crypto.ts`

Owns:

- `encryptIntegrationSecret`
- `decryptIntegrationSecret`
- `maskIntegrationSecret`

Should be dependency-injected via explicit encryption key input, not by reading app env directly in a way that ties the package to one app runtime.

#### `src/repository.ts`

Owns low-level DB reads/writes against `workspaceIntegrationSecrets`.

#### `src/workspace-integrations.ts`

Owns the package-level application API:

- `getWorkspaceIntegrationSummaries`
- `revealWorkspaceIntegrationValue`
- `updateWorkspaceIntegrationValues`

These functions compose definitions, crypto, and repository behavior.

## 8. Public API Design

The package API should be dependency-injected, not app-global.

Recommended shape:

```ts
type IntegrationSecretDeps = {
  db: Database;
  encryptionKey: string;
};

type GetWorkspaceIntegrationSummariesInput = IntegrationSecretDeps & {
  workspaceId: string;
};
```

Then expose functions such as:

```ts
getWorkspaceIntegrationSummaries(input);
revealWorkspaceIntegrationValue(input);
updateWorkspaceIntegrationValues(input);
```

Why this is preferred:

- easier to test
- reusable by multiple apps
- avoids package dependence on any one app’s `init.ts`
- keeps env/bootstrap ownership in the consuming app

## 9. App Integration Model After Extraction

### `apps/web`

`apps/web` keeps thin server adapters:

- fetch session/headers
- enforce `canViewIntegrations` / `canManageIntegrations`
- pass `getDb()` and `process.env.WORKSPACE_SECRET_ENCRYPTION_KEY!` into package functions
- return app-facing response shapes through existing server functions

The current route/UI behavior should not change.

### `apps/admin`

Future Admin use can consume the same package API with Admin-specific capability and route logic.

### `apps/api-server`

Future API-server use can also consume the same package API without importing from `apps/web`.

## 10. Boundary And Dependency Implications

After extraction, `apps/web` should stop importing the integration table through `init.ts`.

Instead:

- `packages/integrations` may depend on `@workspace/db-schema`
- apps depend on `@workspace/integrations`

That means the current workaround in [`apps/web/src/init.ts`](/Users/sfung/.codex/worktrees/357c/sass-starter-template/apps/web/src/init.ts) can be removed.

Dependency-cruiser should then remain satisfied because:

- app code no longer introduces new raw `db-schema` imports
- shared schema use is centralized in the package that owns the integration secret domain

## 11. Migration Strategy

This should be an extraction refactor, not a behavior rewrite.

### Phase 1

Create `packages/integrations` and copy the current shared logic into it with package-local tests.

### Phase 2

Update `apps/web/src/integrations/integration-secrets.server.ts` to become a thin adapter over the package.

### Phase 3

Update `apps/web` tests to reflect the thinner adapter seam and remove direct schema-table dependence.

### Phase 4

Remove the `workspaceIntegrationSecrets` re-export from `apps/web/src/init.ts`.

No database schema change is required for this extraction.

## 12. Risks And Tradeoffs

- The package must not absorb app-specific concerns such as redirects or capability enforcement, or it will become another app-shaped abstraction in package clothing.
- Dependency injection makes the public API slightly more verbose, but it is the right tradeoff for multi-app reuse and testability.
- There will be a short transitional period where both the package and the app-local wrappers exist, but that is preferable to a big-bang rewrite.

## 13. Expected Outcome

After this refactor:

- the integration secret domain is owned by `packages/integrations`
- `apps/web` becomes a thin orchestration consumer instead of the owner of crypto and DB operations
- `apps/admin` and `apps/api-server` can reuse the same secure operations when needed
- the current `init.ts` schema re-export workaround can be removed
- SF-33 behavior stays the same
