# SF-39 Admin Workspace API Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a workspace-owned API Keys section to the Admin workspace details page so platform admins can support manual Enterprise onboarding by listing, creating, copying the ID of, and hard-deleting `system-managed` workspace keys without showing secret values.

**Architecture:** Extend the existing Admin workspace detail read path so the route receives workspace-scoped API key metadata alongside billing data, then add admin-only server functions for create/delete operations that always target the workspace organization reference. Keep the UI inside the current stacked-card workspace detail page, using a focused API-keys card component plus small dialogs for create/delete, and invalidate the canonical workspace detail query after each mutation.

**Tech Stack:** TanStack Start server functions, TanStack Query, React 19, Zod, Better Auth API key plugin, Drizzle-backed Better Auth tables, Vitest, Testing Library.

---

## File Map

### Existing files to modify

- `apps/admin/src/admin/workspaces.server.ts`
  - Extend `WorkspaceDetail` with API-key rows.
  - Add server helpers that list/create/delete workspace-owned API keys through the Better Auth surface or DB-backed auth APIs, always scoped to `organizationId = workspaceId`.
- `apps/admin/src/admin/workspaces-query.functions.ts`
  - Keep `getWorkspace()` as the route read entrypoint after the new API-key fields are added.
- `apps/admin/src/admin/workspaces.functions.ts`
  - Add admin mutations for API key creation and deletion with workflow logging.
- `apps/admin/src/admin/workspaces.schemas.ts`
  - Add Zod schemas for create/delete API key inputs.
- `apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx`
  - Render the new API Keys section after `Subscription`.
- `apps/admin/src/admin/workspaces.queries.ts`
  - Reuse the existing detail query key for invalidation after API-key mutations.
- `apps/admin/test/unit/admin/workspaces.server.test.ts`
  - Cover new server-side workspace API-key list/create/delete behavior.
- `apps/admin/test/unit/admin/workspaces.functions.test.ts`
  - Cover capability checks, mutation wiring, and success/error logging for create/delete.
- `apps/admin/test/unit/admin/workspaces.schemas.test.ts`
  - Cover the new create/delete schemas.

### New files to create

- `apps/admin/src/components/admin/admin-workspace-api-keys-card.tsx`
  - Focused UI component for the API Keys card, empty state, ID copy action, and mutation dialog coordination.
- `apps/admin/src/components/admin/admin-generate-workspace-api-key-dialog.tsx`
  - Dialog with exactly two access modes: `Read only` and `Read and Write`.
- `apps/admin/src/components/admin/admin-delete-workspace-api-key-dialog.tsx`
  - Confirmation dialog for hard delete.
- `apps/admin/test/unit/components/admin/admin-workspace-api-keys-card.test.tsx`
  - Unit tests for rendering, empty state, `Copy ID`, and action wiring.
- `apps/admin/test/unit/components/admin/admin-generate-workspace-api-key-dialog.test.tsx`
  - Unit tests for access-mode selection and submit behavior.
- `apps/admin/test/unit/components/admin/admin-delete-workspace-api-key-dialog.test.tsx`
  - Unit tests for delete confirmation behavior.

## Shared Implementation Rules

- Keep all keys workspace-owned.
  - Every read must filter `referenceId = workspaceId` and `configId = "system-managed"`.
  - Every create/delete must operate on the workspace organization reference, never the acting admin user.
- Do not render raw key values or masked key fragments in the Admin UI.
- The create dialog accepts only an access mode, not freeform name/notes.
- The created key name is derived from the access mode:
  - `Read only` -> `Read only`
  - `Read and Write` -> `Read and Write`
- If Better Auth supports per-key permissions in the current surface, map them from the selected mode in the server layer. If the current API surface does not support that cleanly, ship deterministic naming first and document permission follow-up in the final summary instead of inventing a leaky workaround.

### Task 1: Extend Admin Workspace Data Model For API Keys

**Files:**

- Modify: `apps/admin/src/admin/workspaces.server.ts`
- Modify: `apps/admin/src/admin/workspaces-query.functions.ts`
- Modify: `apps/admin/src/admin/workspaces.schemas.ts`
- Test: `apps/admin/test/unit/admin/workspaces.server.test.ts`
- Test: `apps/admin/test/unit/admin/workspaces.schemas.test.ts`

- [ ] **Step 1: Define the API-key row shape in the Admin server layer**

Add an API-key row type to `apps/admin/src/admin/workspaces.server.ts` and embed it into `WorkspaceDetail`.

```ts
export interface WorkspaceApiKeyRow {
  id: string;
  name: string | null;
  configId: string;
  createdAt: Date;
}

export interface WorkspaceDetail {
  // existing fields...
  apiKeys: Array<WorkspaceApiKeyRow>;
}
```

- [ ] **Step 2: Add schema inputs for API-key creation and deletion**

Extend `apps/admin/src/admin/workspaces.schemas.ts` with narrow Zod inputs.

```ts
export const workspaceApiKeyAccessModeSchema = z.enum([
  'read_only',
  'read_write',
]);

export const createWorkspaceApiKeySchema = z.object({
  workspaceId: z.string(),
  accessMode: workspaceApiKeyAccessModeSchema,
});

export const deleteWorkspaceApiKeySchema = z.object({
  workspaceId: z.string(),
  apiKeyId: z.string(),
});
```

- [ ] **Step 3: Write the failing server tests for workspace API-key reads**

Add tests in `apps/admin/test/unit/admin/workspaces.server.test.ts` that verify:

```ts
it('returns only system-managed keys for the workspace detail payload', async () => {
  // Arrange an auth/db adapter response with mixed configIds/referenceIds
  // Act getWorkspaceDetail('ws-1')
  // Assert result?.apiKeys equals only ws-1 + system-managed rows
});

it('returns an empty apiKeys array when no workspace keys exist', async () => {
  // Assert result?.apiKeys is []
});
```

Run: `pnpm --filter @workspace/admin-web test -- workspaces.server`
Expected: FAIL on missing `apiKeys` support.

- [ ] **Step 4: Implement workspace-scoped API-key list loading**

Update `getWorkspaceDetail()` so it appends `apiKeys` to the existing detail payload.

Recommended implementation shape:

```ts
const SYSTEM_MANAGED_CONFIG_ID = 'system-managed';

async function listWorkspaceApiKeys(
  workspaceId: string
): Promise<WorkspaceApiKeyRow[]> {
  const db = getDb();

  const rows = await db.query.apikey.findMany({
    where: (table, { and, eq }) =>
      and(
        eq(table.referenceId, workspaceId),
        eq(table.configId, SYSTEM_MANAGED_CONFIG_ID)
      ),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? null,
    configId: row.configId,
    createdAt: row.createdAt,
  }));
}
```

Then merge the rows into the billing-backed workspace detail result:

```ts
const detail = await getAdminWorkspaceDetail({ db: getDb(), workspaceId });
if (!detail) return null;

return {
  ...detail,
  apiKeys: await listWorkspaceApiKeys(workspaceId),
};
```

- [ ] **Step 5: Add schema tests**

In `apps/admin/test/unit/admin/workspaces.schemas.test.ts`, add:

```ts
it('accepts read_only and read_write access modes', () => {
  expect(
    createWorkspaceApiKeySchema.parse({
      workspaceId: 'ws-1',
      accessMode: 'read_only',
    })
  ).toBeTruthy();
});

it('rejects unknown access modes', () => {
  expect(() =>
    createWorkspaceApiKeySchema.parse({
      workspaceId: 'ws-1',
      accessMode: 'admin',
    })
  ).toThrow();
});
```

- [ ] **Step 6: Run the targeted tests**

Run:

- `pnpm --filter @workspace/admin-web test -- workspaces.server`
- `pnpm --filter @workspace/admin-web test -- workspaces.schemas`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/admin/workspaces.server.ts apps/admin/src/admin/workspaces.schemas.ts apps/admin/test/unit/admin/workspaces.server.test.ts apps/admin/test/unit/admin/workspaces.schemas.test.ts
git commit -m "feat(admin): load workspace api keys in detail view"
```

### Task 2: Add Admin Mutation Paths For Create/Delete Workspace API Keys

**Files:**

- Modify: `apps/admin/src/admin/workspaces.server.ts`
- Modify: `apps/admin/src/admin/workspaces.functions.ts`
- Modify: `apps/admin/src/admin/workspaces.schemas.ts`
- Test: `apps/admin/test/unit/admin/workspaces.server.test.ts`
- Test: `apps/admin/test/unit/admin/workspaces.functions.test.ts`

- [ ] **Step 1: Write the failing server tests for create/delete**

Add tests in `apps/admin/test/unit/admin/workspaces.server.test.ts`:

```ts
it('creates a workspace-owned api key for read_only mode', async () => {
  // Expect auth.api.createApiKey (or equivalent adapter) to receive:
  // organizationId/referenceId = 'ws-1'
  // name = 'Read only'
  // configId = 'system-managed'
});

it('deletes the requested workspace-owned api key', async () => {
  // Expect delete call to receive apiKeyId + workspace context
});
```

Run: `pnpm --filter @workspace/admin-web test -- workspaces.server`
Expected: FAIL on missing mutation helpers.

- [ ] **Step 2: Implement server helpers with deterministic naming**

Add helpers to `apps/admin/src/admin/workspaces.server.ts`.

```ts
const ACCESS_MODE_TO_NAME = {
  read_only: 'Read only',
  read_write: 'Read and Write',
} as const;

export async function createWorkspaceApiKey(input: {
  workspaceId: string;
  accessMode: 'read_only' | 'read_write';
}) {
  const auth = getAuth();
  const headers = getRequestHeaders();

  return auth.api.createApiKey({
    headers,
    body: {
      organizationId: input.workspaceId,
      name: ACCESS_MODE_TO_NAME[input.accessMode],
      configId: 'system-managed',
      // permissions: map if supported cleanly
    },
  });
}

export async function deleteWorkspaceApiKey(input: {
  workspaceId: string;
  apiKeyId: string;
}) {
  const auth = getAuth();
  const headers = getRequestHeaders();

  return auth.api.deleteApiKey({
    headers,
    body: {
      keyId: input.apiKeyId,
      organizationId: input.workspaceId,
    },
  });
}
```

If the exact Better Auth method names differ, adapt to the real auth surface but preserve the same ownership contract.

- [ ] **Step 3: Write the failing server-function tests**

Extend `apps/admin/test/unit/admin/workspaces.functions.test.ts` with:

```ts
it('requires the correct capability before creating a workspace api key', async () => {
  await createAdminWorkspaceApiKey({
    data: { workspaceId: 'ws-1', accessMode: 'read_only' },
  });

  expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
    'canViewWorkspaceBilling'
  );
});

it('passes validated delete input to the server helper', async () => {
  await deleteAdminWorkspaceApiKey({
    data: { workspaceId: 'ws-1', apiKeyId: 'key-1' },
  });

  expect(deleteWorkspaceApiKeyMock).toHaveBeenCalledWith({
    workspaceId: 'ws-1',
    apiKeyId: 'key-1',
  });
});
```

Run: `pnpm --filter @workspace/admin-web test -- workspaces.functions`
Expected: FAIL on missing server functions.

- [ ] **Step 4: Implement create/delete server functions with workflow logging**

In `apps/admin/src/admin/workspaces.functions.ts`, add two logged mutations mirroring the existing entitlement pattern.

```ts
export const createAdminWorkspaceApiKey = createServerFn()
  .inputValidator(createWorkspaceApiKeySchema)
  .handler(async ({ data }) => {
    await requireCurrentAdminAppCapability('canViewWorkspaceBilling');
    await createWorkspaceApiKey(data);
    return { success: true as const };
  });

export const deleteAdminWorkspaceApiKey = createServerFn()
  .inputValidator(deleteWorkspaceApiKeySchema)
  .handler(async ({ data }) => {
    await requireCurrentAdminAppCapability('canViewWorkspaceBilling');
    await deleteWorkspaceApiKey(data);
    return { success: true as const };
  });
```

Use dedicated `OPERATIONS.*` constants if they already exist for API-key mutations; otherwise add the smallest new constants in the logging package only if required.

- [ ] **Step 5: Run the targeted tests**

Run:

- `pnpm --filter @workspace/admin-web test -- workspaces.server`
- `pnpm --filter @workspace/admin-web test -- workspaces.functions`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/admin/workspaces.server.ts apps/admin/src/admin/workspaces.functions.ts apps/admin/test/unit/admin/workspaces.server.test.ts apps/admin/test/unit/admin/workspaces.functions.test.ts
git commit -m "feat(admin): add workspace api key mutations"
```

### Task 3: Build The Admin Workspace API Keys UI

**Files:**

- Create: `apps/admin/src/components/admin/admin-workspace-api-keys-card.tsx`
- Create: `apps/admin/src/components/admin/admin-generate-workspace-api-key-dialog.tsx`
- Create: `apps/admin/src/components/admin/admin-delete-workspace-api-key-dialog.tsx`
- Modify: `apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx`
- Modify: `apps/admin/src/admin/workspaces.queries.ts`
- Test: `apps/admin/test/unit/components/admin/admin-workspace-api-keys-card.test.tsx`
- Test: `apps/admin/test/unit/components/admin/admin-generate-workspace-api-key-dialog.test.tsx`
- Test: `apps/admin/test/unit/components/admin/admin-delete-workspace-api-key-dialog.test.tsx`

- [ ] **Step 1: Write the failing UI tests**

Create tests that cover:

```tsx
it('renders workspace-owned api keys and copy-id actions', () => {
  // Expect no Key column/value rendering
  // Expect Copy ID and Delete for each row
});

it('shows the empty state when there are no api keys', () => {
  // Expect helper copy + Generate new key button
});

it('copies the api key record id to the clipboard', async () => {
  // Mock navigator.clipboard.writeText('key-1')
});

it('offers exactly read-only and read-write options in the generate dialog', () => {
  // No freeform name or notes fields
});
```

Run:

- `pnpm --filter @workspace/admin-web test -- admin-workspace-api-keys-card`
- `pnpm --filter @workspace/admin-web test -- admin-generate-workspace-api-key-dialog`
- `pnpm --filter @workspace/admin-web test -- admin-delete-workspace-api-key-dialog`

Expected: FAIL.

- [ ] **Step 2: Implement the card component**

In `apps/admin/src/components/admin/admin-workspace-api-keys-card.tsx`, render:

```tsx
<Card>
  <CardHeader>
    <CardTitle>API Keys</CardTitle>
    <Button>Generate new key</Button>
  </CardHeader>
  <CardContent>
    {apiKeys.length === 0 ? (
      <p>No workspace-owned API keys yet.</p>
    ) : (
      <table>{/* Name | Configuration | Created | Actions */}</table>
    )}
  </CardContent>
</Card>
```

Use a client-side copy handler:

```ts
await navigator.clipboard.writeText(apiKey.id);
```

Keep the table record-focused:

- `Name`
- `Configuration`
- `Created`
- `Actions`

Do not render a `Key` column.

- [ ] **Step 3: Implement the generate dialog**

In `apps/admin/src/components/admin/admin-generate-workspace-api-key-dialog.tsx`, use a minimal controlled form with just the access-mode radio/select input.

```tsx
const ACCESS_OPTIONS = [
  { value: 'read_only', label: 'Read only' },
  { value: 'read_write', label: 'Read and Write' },
] as const;
```

Submit through `createAdminWorkspaceApiKey`, then invalidate:

```ts
await queryClient.invalidateQueries({
  queryKey: ADMIN_WORKSPACE_DETAIL_QUERY_KEY(workspaceId),
});
```

- [ ] **Step 4: Implement the delete dialog**

In `apps/admin/src/components/admin/admin-delete-workspace-api-key-dialog.tsx`, accept `workspaceId`, `apiKeyId`, and `apiKeyName`, call `deleteAdminWorkspaceApiKey`, then invalidate the same detail query.

- [ ] **Step 5: Insert the card into the route**

Update `apps/admin/src/routes/_protected/workspaces/$workspaceId.tsx` so the new card renders immediately after the `Subscription` card and before entitlement overrides.

```tsx
<AdminWorkspaceApiKeysCard
  workspaceId={workspace.id}
  apiKeys={workspace.apiKeys}
/>
```

- [ ] **Step 6: Run the targeted UI tests**

Run:

- `pnpm --filter @workspace/admin-web test -- admin-workspace-api-keys-card`
- `pnpm --filter @workspace/admin-web test -- admin-generate-workspace-api-key-dialog`
- `pnpm --filter @workspace/admin-web test -- admin-delete-workspace-api-key-dialog`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/components/admin/admin-workspace-api-keys-card.tsx apps/admin/src/components/admin/admin-generate-workspace-api-key-dialog.tsx apps/admin/src/components/admin/admin-delete-workspace-api-key-dialog.tsx apps/admin/src/routes/_protected/workspaces/\$workspaceId.tsx apps/admin/test/unit/components/admin/admin-workspace-api-keys-card.test.tsx apps/admin/test/unit/components/admin/admin-generate-workspace-api-key-dialog.test.tsx apps/admin/test/unit/components/admin/admin-delete-workspace-api-key-dialog.test.tsx
git commit -m "feat(admin): add workspace api keys section"
```

### Task 4: Verify The Admin Flow End-To-End At Package Scope

**Files:**

- Modify: any touched files from Tasks 1-3 if fixes are needed
- Test: `apps/admin/test/unit/admin/workspaces.server.test.ts`
- Test: `apps/admin/test/unit/admin/workspaces.functions.test.ts`
- Test: `apps/admin/test/unit/components/admin/admin-workspace-api-keys-card.test.tsx`
- Test: `apps/admin/test/unit/components/admin/admin-generate-workspace-api-key-dialog.test.tsx`
- Test: `apps/admin/test/unit/components/admin/admin-delete-workspace-api-key-dialog.test.tsx`

- [ ] **Step 1: Run the targeted admin API-key test set**

Run:

```bash
pnpm --filter @workspace/admin-web test -- workspaces.server workspaces.functions admin-workspace-api-keys-card admin-generate-workspace-api-key-dialog admin-delete-workspace-api-key-dialog
```

Expected: PASS.

- [ ] **Step 2: Run Admin typecheck**

Run:

```bash
pnpm --filter @workspace/admin-web typecheck
```

Expected: PASS.

- [ ] **Step 3: Run boundary checks if imports changed across packages**

Run:

```bash
pnpm run check:boundaries
```

Expected: PASS.

- [ ] **Step 4: Fix any failures and rerun**

If a command fails:

- read the exact failing assertion or type error
- apply the smallest fix in the owning file
- rerun only the failed command first
- rerun the broader verification after it passes

- [ ] **Step 5: Commit the final implementation state**

```bash
git add apps/admin/src apps/admin/test docs/superpowers/specs/2026-04-15-sf-39-admin-workspace-api-keys-design.md docs/superpowers/plans/2026-04-15-sf-39-admin-workspace-api-keys.md
git commit -m "feat(admin): manage workspace api keys"
```

## Self-Review

### Spec coverage

- API Keys section after Subscription: Task 3
- list workspace-owned `system-managed` keys: Task 1
- generate dialog with fixed access selection: Tasks 1-3
- hard delete confirmation: Tasks 2-3
- `Copy ID` instead of showing secret material: Task 3
- preserve workspace ownership semantics during Enterprise onboarding: Tasks 1-2
- targeted verification: Task 4

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain in the task steps.
- The only conditional language is around the exact Better Auth method signature; the task still constrains the required ownership behavior if the local API differs.

### Type consistency

- Access mode is consistently `read_only | read_write`.
- Create input uses `workspaceId` + `accessMode`.
- Delete input uses `workspaceId` + `apiKeyId`.
- UI rows consistently use `id`, `name`, `configId`, and `createdAt`.
