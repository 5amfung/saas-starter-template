# Admin Workspace API Key Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the over-modeled workspace API key access-mode workflow with one fixed workspace-owned key type that requires an admin-provided key name and generates `sk_` keys.

**Architecture:** Remove `accessMode` from the admin API key contract and make `workspaceId + trimmed name` the only create input. Keep workspace ownership, Better Auth `system-managed` scoping, query invalidation, and delete behavior intact while updating the modal, row display, and focused tests to use admin-provided names.

**Tech Stack:** TanStack Start server functions, TanStack Query, React 19, Zod, Better Auth API key plugin, Vitest, Testing Library, Playwright, pnpm.

---

## Source Spec

Read first:

- `docs/superpowers/specs/2026-04-26-admin-workspace-api-key-names-design.md`

## File Map

Modify production code:

- `apps/web/src/admin/workspaces.schemas.ts`
  - Remove `workspaceApiKeyAccessModeSchema`.
  - Make create input `{ workspaceId, name }`.
  - Trim and validate `name`.
  - Reject unknown keys with `.strict()`.
- `apps/web/src/admin/workspaces.server.ts`
  - Remove access-mode imports and maps.
  - Add fixed `WORKSPACE_API_KEY_PREFIX = 'sk_'`.
  - Use `input.name` for the Better Auth API key name.
- `apps/web/src/components/admin/admin-generate-workspace-api-key-dialog.tsx`
  - Remove radio options and `accessMode` state.
  - Add required key-name input.
  - Trim and validate before mutation.
- `apps/web/src/components/admin/admin-workspace-api-keys-card.tsx`
  - Continue rendering stored key names.
  - Keep fallback `API Key`.
  - Pass key name to delete dialog.
- `apps/web/src/components/admin/admin-delete-workspace-api-key-dialog.tsx`
  - Keep `apiKeyName` as confirmation context.
  - Fallback to `this workspace API key`.
- `apps/web/test/e2e/admin/workspaces/workspace-api-keys.spec.ts`
  - Remove access-mode interaction.
  - Fill key name.
  - Expect generated key prefix `sk_`.

Modify tests:

- `apps/web/test/unit/admin/workspaces.schemas.test.ts`
- `apps/web/test/unit/admin/workspaces.server.test.ts`
- `apps/web/test/unit/admin/workspaces.functions.test.ts`
- `apps/web/test/unit/components/admin/admin-generate-workspace-api-key-dialog.test.tsx`
- `apps/web/test/unit/components/admin/admin-workspace-api-keys-card.test.tsx`
- `apps/web/test/unit/components/admin/admin-delete-workspace-api-key-dialog.test.tsx`

## Guardrails

- Do not use `accessMode` anywhere in production code or tests, including rejection tests.
- Do not keep an ignored `accessMode` field for compatibility.
- Do not add API key permission levels.
- Do not add migration or compatibility logic for `sr_` or `srw_`.
- Do not change `system-managed` verification.
- Do not manually edit generated route tree files.
- Use `pnpm` only.
- Run commands from the repository root.

## Task 1: Tighten The Create Schema

**Files:**

- Modify: `apps/web/src/admin/workspaces.schemas.ts`
- Modify: `apps/web/test/unit/admin/workspaces.schemas.test.ts`

- [x] **Step 1: Replace access-mode tests with name-validation tests**

In `apps/web/test/unit/admin/workspaces.schemas.test.ts`, remove the `workspaceApiKeyAccessModeSchema` import and delete the `workspaceApiKeyAccessModeSchema` describe block.

Update the `workspaceApiKeyCreateSchema` tests to assert this behavior:

```ts
describe('workspaceApiKeyCreateSchema', () => {
  it('accepts a workspace id and trims the key name', () => {
    expect(
      workspaceApiKeyCreateSchema.parse({
        workspaceId: 'ws-1',
        name: '  Production support key  ',
      })
    ).toEqual({
      workspaceId: 'ws-1',
      name: 'Production support key',
    });
  });

  it('rejects missing workspace ids', () => {
    expect(() =>
      workspaceApiKeyCreateSchema.parse({
        name: 'Production support key',
      })
    ).toThrow();
  });

  it('rejects missing key names', () => {
    expect(() =>
      workspaceApiKeyCreateSchema.parse({
        workspaceId: 'ws-1',
      })
    ).toThrow();
  });

  it('rejects empty key names after trim', () => {
    expect(() =>
      workspaceApiKeyCreateSchema.parse({
        workspaceId: 'ws-1',
        name: '   ',
      })
    ).toThrow();
  });

  it('rejects key names longer than 80 characters', () => {
    expect(() =>
      workspaceApiKeyCreateSchema.parse({
        workspaceId: 'ws-1',
        name: 'a'.repeat(81),
      })
    ).toThrow();
  });

  it('rejects unknown create fields', () => {
    expect(() =>
      workspaceApiKeyCreateSchema.parse({
        workspaceId: 'ws-1',
        name: 'Production support key',
        extraField: 'not allowed',
      })
    ).toThrow();
  });
});
```

- [x] **Step 2: Run schema tests and verify they fail**

Run:

```bash
pnpm --filter @workspace/web test test/unit/admin/workspaces.schemas.test.ts
```

Expected: FAIL because the current schema still requires the old create shape and does not accept `name`.

- [x] **Step 3: Implement the schema change**

In `apps/web/src/admin/workspaces.schemas.ts`, delete the access-mode enum and replace the current create schema with:

```ts
const WORKSPACE_API_KEY_NAME_MAX_LENGTH = 80;

export const workspaceApiKeyCreateSchema = z
  .object({
    workspaceId: z.string(),
    name: z
      .string()
      .trim()
      .min(1, 'Key name is required.')
      .max(
        WORKSPACE_API_KEY_NAME_MAX_LENGTH,
        `Key name must be ${WORKSPACE_API_KEY_NAME_MAX_LENGTH} characters or fewer.`
      ),
  })
  .strict();
```

Remove the exported `WorkspaceApiKeyAccessMode` type.

- [x] **Step 4: Run schema tests and verify they pass**

Run:

```bash
pnpm --filter @workspace/web test test/unit/admin/workspaces.schemas.test.ts
```

Expected: PASS.

## Task 2: Update Server Key Creation

**Files:**

- Modify: `apps/web/src/admin/workspaces.server.ts`
- Modify: `apps/web/test/unit/admin/workspaces.server.test.ts`

- [x] **Step 1: Update server tests for named `sk_` keys**

In `apps/web/test/unit/admin/workspaces.server.test.ts`, replace the read-only/read-write create tests with:

```ts
it('creates a named workspace-owned api key via the workspace owner', async () => {
  getAdminWorkspaceDetailMock.mockResolvedValueOnce({
    ownerUserId: 'owner-1',
  });
  createApiKeyMock.mockResolvedValueOnce({
    id: 'key-1',
    key: 'sk_secret_123',
    start: 'secret',
    prefix: 'sk_',
  });

  const result = await createWorkspaceApiKey({
    workspaceId: 'ws-1',
    name: 'Production support key',
  });

  expect(createApiKeyMock).toHaveBeenCalledWith({
    body: {
      userId: 'owner-1',
      organizationId: 'ws-1',
      configId: 'system-managed',
      name: 'Production support key',
      prefix: 'sk_',
    },
  });
  expect(result).toEqual({
    id: 'key-1',
    key: 'sk_secret_123',
    start: 'secret',
    prefix: 'sk_',
  });
});
```

Update the missing-owner test input to:

```ts
createWorkspaceApiKey({
  workspaceId: 'ws-1',
  name: 'Production support key',
});
```

- [x] **Step 2: Run server tests and verify they fail**

Run:

```bash
pnpm --filter @workspace/web test test/unit/admin/workspaces.server.test.ts
```

Expected: FAIL because server code still expects the old create shape and derives old names/prefixes.

- [x] **Step 3: Implement fixed server creation**

In `apps/web/src/admin/workspaces.server.ts`, remove:

```ts
WorkspaceApiKeyAccessMode,
```

from the schema type imports.

Remove:

```ts
const API_KEY_NAME_BY_ACCESS_MODE: Record<WorkspaceApiKeyAccessMode, string> = {
  read_only: 'Read API Key',
  read_write: 'Read & Write API Key',
};
const API_KEY_PREFIX_BY_ACCESS_MODE: Record<WorkspaceApiKeyAccessMode, string> =
  {
    read_only: 'sr_',
    read_write: 'srw_',
  };
```

Add:

```ts
const WORKSPACE_API_KEY_PREFIX = 'sk_';
```

Update `createWorkspaceApiKey()` so the Better Auth call uses:

```ts
name: input.name,
prefix: WORKSPACE_API_KEY_PREFIX,
```

- [x] **Step 4: Run server tests and verify they pass**

Run:

```bash
pnpm --filter @workspace/web test test/unit/admin/workspaces.server.test.ts
```

Expected: PASS.

## Task 3: Update Server Function Contract Tests

**Files:**

- Modify: `apps/web/test/unit/admin/workspaces.functions.test.ts`
- Verify: `apps/web/src/admin/workspaces.functions.ts`

- [x] **Step 1: Update function tests to submit `name`**

In `apps/web/test/unit/admin/workspaces.functions.test.ts`, replace old create API key inputs with the new named shape.

```ts
data: { workspaceId: 'ws-1', name: 'Production support key' },
```

Update the assertion for `createWorkspaceApiKeyMock`:

```ts
expect(createWorkspaceApiKeyMock).toHaveBeenCalledWith({
  workspaceId: 'ws-1',
  name: 'Production support key',
});
```

Use `sk_` in mocked results:

```ts
createWorkspaceApiKeyMock.mockResolvedValueOnce({
  id: 'key-1',
  key: 'sk_secret_123',
  start: 'secret',
  prefix: 'sk_',
});
```

and expect:

```ts
expect(result).toEqual({
  success: true,
  apiKeyId: 'key-1',
  generatedKey: 'sk_secret_123',
  keyStart: 'secret',
  keyPrefix: 'sk_',
});
```

- [x] **Step 2: Run function tests**

Run:

```bash
pnpm --filter @workspace/web test test/unit/admin/workspaces.functions.test.ts
```

Expected: PASS after Task 1 because `workspaces.functions.ts` already passes validated `data` through to `createWorkspaceApiKey(data)`.

If it fails on schema validation, inspect the test input for any old create-shape fields.

## Task 4: Replace Access Selection With Key Name Input

**Files:**

- Modify: `apps/web/src/components/admin/admin-generate-workspace-api-key-dialog.tsx`
- Modify: `apps/web/test/unit/components/admin/admin-generate-workspace-api-key-dialog.test.tsx`

- [x] **Step 1: Update component tests for key-name input**

In `apps/web/test/unit/components/admin/admin-generate-workspace-api-key-dialog.test.tsx`, replace the radio-option test with:

```ts
it('renders a required key name field without access mode options', async () => {
  const user = userEvent.setup();
  renderDialog();

  await user.click(screen.getByRole('button', { name: /generate new key/i }));

  expect(screen.getByLabelText(/key name/i)).toBeRequired();
  expect(screen.getByLabelText(/key name/i)).toHaveAttribute('maxlength', '80');
  expect(screen.queryByRole('radio', { name: /read only/i })).toBeNull();
  expect(screen.queryByRole('radio', { name: /read and write/i })).toBeNull();
});
```

Replace the submit test with:

```ts
it('submits the trimmed key name and invalidates the workspace detail query', async () => {
  const user = userEvent.setup();
  const { invalidateQueriesSpy } = renderDialog();

  await user.click(screen.getByRole('button', { name: /generate new key/i }));
  await user.type(
    screen.getByLabelText(/key name/i),
    '  Production support key  '
  );
  await user.click(screen.getByRole('button', { name: /^save$/i }));

  await waitFor(() => {
    expect(createAdminWorkspaceApiKeyMock).toHaveBeenCalledWith({
      data: {
        workspaceId: 'ws-1',
        name: 'Production support key',
      },
    });
  });

  await waitFor(() => {
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ADMIN_WORKSPACE_DETAIL_QUERY_KEY('ws-1'),
    });
  });
});
```

Add a validation test:

```ts
it('blocks whitespace-only key names', async () => {
  const user = userEvent.setup();
  renderDialog();

  await user.click(screen.getByRole('button', { name: /generate new key/i }));
  await user.type(screen.getByLabelText(/key name/i), '   ');
  await user.click(screen.getByRole('button', { name: /^save$/i }));

  expect(createAdminWorkspaceApiKeyMock).not.toHaveBeenCalled();
  expect(screen.getByText(/key name is required/i)).toBeInTheDocument();
});
```

Update mocked generated key values to `sk_secret_123` and `sk_`.

- [x] **Step 2: Run component test and verify it fails**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/admin/admin-generate-workspace-api-key-dialog.test.tsx
```

Expected: FAIL because the current modal still renders access-mode radios.

- [x] **Step 3: Implement modal state and validation**

In `apps/web/src/components/admin/admin-generate-workspace-api-key-dialog.tsx`:

Remove:

```ts
import { Label } from '@workspace/ui/components/label';
type AccessMode = 'read_only' | 'read_write';
const ACCESS_MODE_OPTIONS = ...
const [accessMode, setAccessMode] = React.useState<AccessMode>('read_only');
```

Add an input import:

```ts
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
```

Add constants and state:

```ts
const WORKSPACE_API_KEY_NAME_MAX_LENGTH = 80;

const [name, setName] = React.useState('');
const [nameError, setNameError] = React.useState<string | null>(null);
```

Update mutation input:

```ts
mutationFn: async () => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    setNameError('Key name is required.');
    throw new Error('Key name is required.');
  }

  return createAdminWorkspaceApiKey({
    data: {
      workspaceId,
      name: trimmedName,
    },
  });
},
```

Do not show a duplicate toast for local validation errors. A clean pattern is to move validation out of `mutationFn`:

```ts
function handleSubmit() {
  const trimmedName = name.trim();

  if (!trimmedName) {
    setNameError('Key name is required.');
    return;
  }

  setNameError(null);
  mutation.mutate(trimmedName);
}
```

with:

```ts
const mutation = useMutation({
  mutationFn: async (trimmedName: string) =>
    createAdminWorkspaceApiKey({
      data: {
        workspaceId,
        name: trimmedName,
      },
    }),
  ...
});
```

Reset on success:

```ts
setName('');
setNameError(null);
```

Render the field where the old fieldset was:

```tsx
<div className="grid gap-2">
  <Label htmlFor="workspace-api-key-name">Key name</Label>
  <Input
    id="workspace-api-key-name"
    value={name}
    maxLength={WORKSPACE_API_KEY_NAME_MAX_LENGTH}
    required
    placeholder="Production support key"
    aria-invalid={nameError ? true : undefined}
    aria-describedby={nameError ? 'workspace-api-key-name-error' : undefined}
    onChange={(event) => {
      setName(event.target.value);
      if (nameError && event.target.value.trim()) {
        setNameError(null);
      }
    }}
  />
  {nameError ? (
    <p id="workspace-api-key-name-error" className="text-sm text-destructive">
      {nameError}
    </p>
  ) : null}
</div>
```

Update the save button handler:

```ts
onClick={(event) => {
  event.preventDefault();
  handleSubmit();
}}
```

- [x] **Step 4: Run component test and verify it passes**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/admin/admin-generate-workspace-api-key-dialog.test.tsx
```

Expected: PASS.

## Task 5: Keep Saved Names In Rows And Delete Confirmation

**Files:**

- Verify or modify: `apps/web/src/components/admin/admin-workspace-api-keys-card.tsx`
- Verify or modify: `apps/web/src/components/admin/admin-delete-workspace-api-key-dialog.tsx`
- Modify: `apps/web/test/unit/components/admin/admin-workspace-api-keys-card.test.tsx`
- Modify: `apps/web/test/unit/components/admin/admin-delete-workspace-api-key-dialog.test.tsx`

- [x] **Step 1: Update API keys card tests to use a named key**

In `apps/web/test/unit/components/admin/admin-workspace-api-keys-card.test.tsx`, replace test rows named `Read API Key` with:

```ts
name: 'Production support key',
prefix: 'sk_',
```

Expect:

```ts
expect(screen.getByText('Production support key')).toBeInTheDocument();
expect(screen.queryByText('Read API Key')).not.toBeInTheDocument();
expect(screen.queryByText('Read & Write API Key')).not.toBeInTheDocument();
```

Update generated key data:

```ts
key: 'sk_secret_123',
prefix: 'sk_',
```

and clipboard expectation:

```ts
expect(writeTextMock).toHaveBeenCalledWith('sk_secret_123');
```

- [x] **Step 2: Update delete dialog tests to use the saved key name**

In `apps/web/test/unit/components/admin/admin-delete-workspace-api-key-dialog.test.tsx`, render:

```tsx
<AdminDeleteWorkspaceApiKeyDialog
  workspaceId="ws-1"
  apiKeyId="key-1"
  apiKeyName="Production support key"
/>
```

Expect:

```ts
expect(await screen.findByText(/production support key/i)).toBeInTheDocument();
expect(screen.queryByText(/read api key/i)).not.toBeInTheDocument();
```

- [x] **Step 3: Verify production components need no structural change**

`apps/web/src/components/admin/admin-workspace-api-keys-card.tsx` already renders:

```tsx
{
  apiKey.name ?? 'Unnamed API Key';
}
```

Change fallback to:

```tsx
{
  apiKey.name ?? 'API Key';
}
```

Keep passing:

```tsx
apiKeyName={apiKey.name}
```

`apps/web/src/components/admin/admin-delete-workspace-api-key-dialog.tsx` already accepts `apiKeyName` and uses a fallback. Keep that prop.

- [x] **Step 4: Run row and delete dialog tests**

Run:

```bash
pnpm --filter @workspace/web test test/unit/components/admin/admin-workspace-api-keys-card.test.tsx test/unit/components/admin/admin-delete-workspace-api-key-dialog.test.tsx
```

Expected: PASS.

## Task 6: Update E2E Workflow

**Files:**

- Modify: `apps/web/test/e2e/admin/workspaces/workspace-api-keys.spec.ts`

- [x] **Step 1: Remove access-mode interaction**

Replace:

```ts
await page.getByLabel('Read and Write').check();
await page.getByRole('button', { name: 'Save' }).click();
```

with:

```ts
await page.getByLabel('Key name').fill('Production support key');
await page.getByRole('button', { name: 'Save' }).click();
```

Replace:

```ts
await expect(
  page.getByRole('textbox', { name: 'Generated API key' })
).toHaveValue(/^srw_/);
await expect(page.getByText('Read & Write API Key')).toBeVisible();
```

with:

```ts
await expect(
  page.getByRole('textbox', { name: 'Generated API key' })
).toHaveValue(/^sk_/);
await expect(page.getByText('Production support key')).toBeVisible();
```

- [x] **Step 2: Add a modal absence assertion**

After opening the modal, assert the obsolete options are gone:

```ts
await expect(page.getByLabel('Read and Write')).toHaveCount(0);
await expect(page.getByLabel('Read only')).toHaveCount(0);
```

- [x] **Step 3: Run the targeted E2E spec**

Run outside the Codex sandbox if browser verification is blocked:

```bash
pnpm --filter @workspace/web test:e2e test/e2e/admin/workspaces/workspace-api-keys.spec.ts
```

Expected: PASS if the local E2E environment is ready. If it fails due to database, auth seed, browser, or server startup setup, capture the exact failure and do not claim E2E coverage.

## Task 7: Sweep For Removed Concept And Run Focused Verification

**Files:**

- Search: `apps/web/src`
- Search: `apps/web/test`

- [x] **Step 1: Search for obsolete access-mode terms**

Run:

```bash
rg -n "accessMode|AccessMode|workspaceApiKeyAccessModeSchema|read_only|read_write|Read & Write API Key|Read API Key|srw_" apps/web/src apps/web/test
```

Expected: no matches related to workspace API key creation. Matches in unrelated historical docs are acceptable only outside `apps/web/src` and `apps/web/test`.

- [x] **Step 2: Run all focused unit tests**

Run:

```bash
pnpm --filter @workspace/web test test/unit/admin/workspaces.schemas.test.ts test/unit/admin/workspaces.server.test.ts test/unit/admin/workspaces.functions.test.ts test/unit/components/admin/admin-generate-workspace-api-key-dialog.test.tsx test/unit/components/admin/admin-workspace-api-keys-card.test.tsx test/unit/components/admin/admin-delete-workspace-api-key-dialog.test.tsx
```

Expected: PASS.

- [x] **Step 3: Confirm boundary check is not required**

Imports changed only within the existing web admin component and shared UI
surfaces, so no dependency boundary check is required. If import boundaries
changed beyond local component imports, run:

```bash
pnpm run check:boundaries
```

Expected: PASS.

- [x] **Step 4: Review the diff**

Run:

```bash
git diff -- apps/web/src/admin/workspaces.schemas.ts apps/web/src/admin/workspaces.server.ts apps/web/src/components/admin/admin-generate-workspace-api-key-dialog.tsx apps/web/src/components/admin/admin-workspace-api-keys-card.tsx apps/web/src/components/admin/admin-delete-workspace-api-key-dialog.tsx apps/web/test/unit/admin/workspaces.schemas.test.ts apps/web/test/unit/admin/workspaces.server.test.ts apps/web/test/unit/admin/workspaces.functions.test.ts apps/web/test/unit/components/admin/admin-generate-workspace-api-key-dialog.test.tsx apps/web/test/unit/components/admin/admin-workspace-api-keys-card.test.tsx apps/web/test/unit/components/admin/admin-delete-workspace-api-key-dialog.test.tsx apps/web/test/e2e/admin/workspaces/workspace-api-keys.spec.ts
```

Expected:

- no `accessMode` usage remains
- schema owns name trimming and validation
- UI trims before submit
- server creates `sk_` keys
- row and delete dialog use saved key names

## Completion Criteria

The implementation is ready to present when:

- `accessMode` no longer appears in `apps/web/src` or targeted tests.
- Create schema accepts only `workspaceId` and validated `name`.
- Server creation uses `prefix: 'sk_'`.
- Modal has a required `Key name` field and no access radio buttons.
- Workspace details displays the saved key name.
- Delete confirmation displays the saved key name.
- Focused unit tests pass.
- Targeted E2E either passes or has a documented environment blocker.
