# Integrations Package Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the workspace integration secret domain from `apps/web` into a new shared `packages/integrations` package while preserving the current SF-33 behavior.

**Architecture:** Create a dedicated package that owns integration definitions, types, crypto, repository access, and secure workspace-integration operations behind a dependency-injected public API. Keep authorization, session lookup, server-function wrappers, route loaders, and UI inside apps, with `apps/web` refactored into a thin adapter over the new package.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, Drizzle ORM, Node `crypto`, TanStack Start server functions, Vitest, Dependency Cruiser

---

## File Structure

### New files

- `packages/integrations/package.json`
- `packages/integrations/tsconfig.json`
- `packages/integrations/src/index.ts`
- `packages/integrations/src/types.ts`
- `packages/integrations/src/definitions.ts`
- `packages/integrations/src/crypto.ts`
- `packages/integrations/src/repository.ts`
- `packages/integrations/src/workspace-integrations.ts`
- `packages/integrations/test/unit/crypto.test.ts`
- `packages/integrations/test/unit/workspace-integrations.test.ts`

### Existing files expected to change

- `apps/web/src/integrations/integration-definitions.ts`
- `apps/web/src/integrations/integration-crypto.server.ts`
- `apps/web/src/integrations/integration-secrets.types.ts`
- `apps/web/src/integrations/integration-secrets.server.ts`
- `apps/web/src/integrations/integration-secrets.functions.ts`
- `apps/web/src/init.ts`
- `apps/web/test/unit/integrations/integration-crypto.server.test.ts`
- `apps/web/test/unit/integrations/integration-secrets.server.test.ts`
- `apps/web/test/unit/integrations/integration-secrets.functions.test.ts`
- `apps/web/src/routes/_protected/ws/$workspaceId/integrations.tsx`
- `.dependency-cruiser.cjs` only if the new package introduces a needed explicit rule or exception

### Responsibility map

- `packages/integrations/src/definitions.ts`
  Owns integration keys, field metadata, and field-key validation helpers.
- `packages/integrations/src/types.ts`
  Owns shared types returned to apps.
- `packages/integrations/src/crypto.ts`
  Owns encryption, decryption, and masking helpers with explicit encryption-key input.
- `packages/integrations/src/repository.ts`
  Owns raw DB reads/writes for `workspaceIntegrationSecrets`.
- `packages/integrations/src/workspace-integrations.ts`
  Owns package-level list/reveal/update operations.
- `apps/web/src/integrations/integration-secrets.server.ts`
  Becomes a thin adapter that performs capability checks and then delegates to `@workspace/integrations`.

## Task 1: Scaffold the `@workspace/integrations` package

**Files:**

- Create: `packages/integrations/package.json`
- Create: `packages/integrations/tsconfig.json`
- Create: `packages/integrations/src/index.ts`

- [x] **Step 1: Create the package manifest**

Add `packages/integrations/package.json`:

```json
{
  "name": "@workspace/integrations",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "test:unit": "vitest run --passWithNoTests",
    "lint": "eslint",
    "lint:fix": "eslint --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@workspace/db": "workspace:*",
    "@workspace/db-schema": "workspace:*",
    "drizzle-orm": "^0.45.2"
  },
  "devDependencies": {
    "@workspace/eslint-config": "workspace:*",
    "typescript": "^5.9.3",
    "vitest": "^4.1.2"
  }
}
```

- [x] **Step 2: Create the package tsconfig**

Add `packages/integrations/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@workspace/integrations/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "eslint.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [x] **Step 3: Create the initial public barrel**

Add `packages/integrations/src/index.ts`:

```ts
export * from './definitions';
export * from './types';
export * from './workspace-integrations';
```

- [x] **Step 4: Verify the package is discovered**

Run:

```bash
pnpm --filter @workspace/integrations typecheck
```

Expected: the package resolves in the workspace; temporary failures should only be from modules not yet created.

- [x] **Step 5: Commit the scaffold**

```bash
git add packages/integrations
git commit -m "feat(integrations): scaffold shared integrations package"
```

## Task 2: Move definitions, types, and crypto into the package

**Files:**

- Create: `packages/integrations/src/definitions.ts`
- Create: `packages/integrations/src/types.ts`
- Create: `packages/integrations/src/crypto.ts`
- Create: `packages/integrations/test/unit/crypto.test.ts`
- Modify: `apps/web/src/integrations/integration-definitions.ts`
- Modify: `apps/web/src/integrations/integration-crypto.server.ts`
- Modify: `apps/web/src/integrations/integration-secrets.types.ts`

- [x] **Step 1: Add failing package crypto tests**

Create `packages/integrations/test/unit/crypto.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  maskIntegrationSecret,
} from '../../src/crypto';

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

describe('integration crypto', () => {
  it('round-trips plaintext through AES-256-GCM', () => {
    const encrypted = encryptIntegrationSecret(
      'xoxb-slack-secret',
      ENCRYPTION_KEY
    );

    expect(encrypted.encryptedValue).not.toBe('xoxb-slack-secret');
    expect(decryptIntegrationSecret(encrypted, ENCRYPTION_KEY)).toBe(
      'xoxb-slack-secret'
    );
  });

  it('masks all but the first six characters', () => {
    expect(maskIntegrationSecret('ro_ad8secret')).toBe('ro_ad8******');
  });
});
```

- [x] **Step 2: Implement shared definitions, types, and crypto**

Move the current app-local logic into:

- `packages/integrations/src/definitions.ts`
- `packages/integrations/src/types.ts`
- `packages/integrations/src/crypto.ts`

Use explicit key injection in `crypto.ts`, for example:

```ts
export function encryptIntegrationSecret(value: string, encryptionKey: string) {
  // ...
}
```

Do not read `process.env` directly inside the package.

- [x] **Step 3: Convert app-local files into thin re-exports or remove them**

Update these app-local files to become transitional wrappers, or delete them if callers can be switched immediately:

- `apps/web/src/integrations/integration-definitions.ts`
- `apps/web/src/integrations/integration-crypto.server.ts`
- `apps/web/src/integrations/integration-secrets.types.ts`

Preferred transitional shape:

```ts
export * from '@workspace/integrations';
```

only where that does not over-export unrelated APIs into app code.

- [x] **Step 4: Run focused package and web tests**

Run:

```bash
pnpm --filter @workspace/integrations test:unit
pnpm --filter @workspace/web test -- test/unit/integrations/integration-crypto.server.test.ts
```

Expected: package crypto tests pass and app-local crypto consumers still compile or pass after adapter updates.

- [x] **Step 5: Commit the shared definitions/crypto extraction**

```bash
git add packages/integrations apps/web/src/integrations apps/web/test/unit/integrations/integration-crypto.server.test.ts
git commit -m "refactor(integrations): move definitions and crypto into package"
```

## Task 3: Move repository and secure operations into the package

**Files:**

- Create: `packages/integrations/src/repository.ts`
- Create: `packages/integrations/src/workspace-integrations.ts`
- Create: `packages/integrations/test/unit/workspace-integrations.test.ts`
- Modify: `apps/web/src/integrations/integration-secrets.server.ts`
- Modify: `apps/web/test/unit/integrations/integration-secrets.server.test.ts`

- [x] **Step 1: Add failing package operation tests**

Create `packages/integrations/test/unit/workspace-integrations.test.ts` with mocked DB coverage for:

- masked summaries
- reveal one value
- update/upsert one value
- delete on clear
- transactional multi-field updates

Use dependency-injected inputs, for example:

```ts
await updateWorkspaceIntegrationValues({
  db,
  encryptionKey: ENCRYPTION_KEY,
  workspaceId: 'ws-1',
  integration: 'slack',
  values: [{ key: 'clientId', value: 'client-id-1' }],
});
```

- [x] **Step 2: Implement package repository and application operations**

In `packages/integrations/src/repository.ts`, own raw DB queries against `workspaceIntegrationSecrets`.

In `packages/integrations/src/workspace-integrations.ts`, compose:

- definitions
- crypto
- repository

Expose package APIs:

```ts
getWorkspaceIntegrationSummaries(input);
revealWorkspaceIntegrationValue(input);
updateWorkspaceIntegrationValues(input);
```

Each function should accept `db` and `encryptionKey` explicitly.

- [x] **Step 3: Thin down the web server adapter**

Refactor `apps/web/src/integrations/integration-secrets.server.ts` so it only:

- checks capabilities
- resolves `getDb()`
- reads `process.env.WORKSPACE_SECRET_ENCRYPTION_KEY!`
- delegates to `@workspace/integrations`

It should stop owning raw DB queries, crypto, and field-definition logic.

- [x] **Step 4: Update unit tests to match the thinner adapter seam**

Adjust `apps/web/test/unit/integrations/integration-secrets.server.test.ts` so it mocks package-level functions instead of DB internals where appropriate.

Run:

```bash
pnpm --filter @workspace/integrations test:unit
pnpm --filter @workspace/web test -- test/unit/integrations/integration-secrets.server.test.ts test/unit/integrations/integration-secrets.functions.test.ts
```

Expected: the package owns operation logic; the web app tests prove capability-enforcing delegation only.

- [x] **Step 5: Commit the shared operations extraction**

```bash
git add packages/integrations apps/web/src/integrations/integration-secrets.server.ts apps/web/test/unit/integrations
git commit -m "refactor(integrations): move secret operations into package"
```

## Task 4: Remove the app-local schema workaround and restore clean boundaries

**Files:**

- Modify: `apps/web/src/init.ts`
- Modify: `.dependency-cruiser.cjs` if needed
- Verify: `apps/web/src/integrations/integration-secrets.server.ts`

- [x] **Step 1: Remove the temporary schema re-export from init**

Delete the line:

```ts
export { workspaceIntegrationSecrets } from '@workspace/db-schema';
```

from `apps/web/src/init.ts`.

- [x] **Step 2: Confirm the app no longer imports raw db-schema for integrations**

Run:

```bash
rg -n "workspaceIntegrationSecrets|@workspace/db-schema" apps/web/src/integrations apps/admin/src apps/api-server/src
```

Expected: integration feature code imports `@workspace/integrations`, not `@workspace/db-schema`, except in explicitly allowed legacy modules unrelated to this refactor.

- [x] **Step 3: Run boundary verification**

Run:

```bash
pnpm run check:boundaries
```

Expected: PASS with no direct-app-to-db-schema violation for integrations.

- [x] **Step 4: Commit the boundary cleanup**

```bash
git add apps/web/src/init.ts apps/web/src/integrations .dependency-cruiser.cjs
git commit -m "fix(web): remove integration schema export workaround"
```

## Task 5: Run cross-cutting verification and document the handoff

**Files:**

- Verify: `packages/integrations/**`
- Verify: `apps/web/src/integrations/**`
- Verify: `apps/web/src/routes/_protected/ws/$workspaceId/integrations.tsx`
- Verify: `apps/web/src/components/integrations/**`

- [x] **Step 1: Run focused package and app tests together**

Run:

```bash
pnpm --filter @workspace/integrations test:unit
pnpm --filter @workspace/web test -- test/unit/integrations/integration-crypto.server.test.ts test/unit/integrations/integration-secrets.server.test.ts test/unit/integrations/integration-secrets.functions.test.ts test/unit/components/app-sidebar.test.tsx test/unit/routes/workspace-integrations-route.test.tsx test/integration/components/integrations/workspace-integrations-page.integration.test.tsx
```

Expected: PASS across package and app coverage.

- [x] **Step 2: Run repo-level type and boundary checks**

Run:

```bash
pnpm run typecheck
pnpm run check:boundaries
```

Expected: PASS.

- [x] **Step 3: Verify schema sync remains unchanged**

Run:

```bash
pnpm --filter @workspace/db-schema db:generate
git diff --exit-code packages/db-schema/drizzle packages/db-schema/src/app.schema.ts packages/db-schema/src/schema.ts
```

Expected: no schema drift and no new migration, because this refactor does not change the table.

- [x] **Step 4: Record the resulting ownership model**

Confirm in the implementation summary that:

- `packages/integrations` owns secure integration storage logic
- `apps/web` is now a thin adapter and UI consumer
- `apps/admin` and `apps/api-server` can adopt the same package API next without new schema exceptions

Implementation summary:

- `packages/integrations` now owns integration definitions, shared types, AES-256-GCM crypto helpers, repository access to `workspaceIntegrationSecrets`, and the secure list/reveal/update operations behind an explicit `db` + `encryptionKey` API.
- `apps/web` now consumes that package from thin server adapters that perform session-aware capability checks, resolve `getDb()`, read `WORKSPACE_SECRET_ENCRYPTION_KEY`, and delegate to the shared package, while the route and component layer remains unchanged as the UI consumer.
- `apps/admin` and `apps/api-server` can adopt `@workspace/integrations` next without introducing new direct `db-schema` imports or repeating secret-handling logic.

- [x] **Step 5: Commit any final verification-only adjustments**

```bash
git add .
git commit -m "test(integrations): verify package extraction"
```
