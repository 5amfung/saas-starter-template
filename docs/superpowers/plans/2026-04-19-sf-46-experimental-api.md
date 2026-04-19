# SF-46 Experimental API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a workspace-authenticated `/api/hello` endpoint in `apps/web` that verifies a Better Auth API key and returns `403` when the verified key does not belong to the requested workspace.

**Architecture:** Keep the route transport-focused and move Better Auth API-key verification into a small `apps/web` server helper. The helper will normalize the verification result into app-specific outcomes that the route translates into `400`, invalid-key failure, `403`, or success.

**Tech Stack:** TanStack Start file routes, Better Auth API key plugin, TypeScript, Vitest.

---

## File Map

### New files

- `apps/web/src/api/api-key-auth.server.ts`
  - Verifies the API key against `configId: "system-managed"` and returns a small discriminated result.
- `apps/web/src/routes/api/hello.ts`
  - GET route that reads headers, delegates verification, and returns the HTTP response.
- `apps/web/test/unit/api/api-key-auth.server.test.ts`
  - Verifier tests for invalid key, missing workspace header, mismatch, and success.
- `apps/web/test/unit/routes/api/hello.test.ts`
  - Route tests for status and payload translation.

### Existing files to modify

- none required beyond creating the new endpoint and tests

## Task 1: Build The Verifier With Test-First Coverage

**Files:**

- Create: `apps/web/src/api/api-key-auth.server.ts`
- Test: `apps/web/test/unit/api/api-key-auth.server.test.ts`

- [ ] **Step 1: Write the failing verifier tests**

Add tests that describe the desired helper contract:

```ts
it('returns missing-workspace when the workspace header is blank', async () => {
  await expect(
    verifyWorkspaceApiKey({
      apiKey: 'sr_secret',
      workspaceId: '',
    })
  ).resolves.toEqual({ ok: false, reason: 'missing-workspace' });
});

it('returns forbidden when the verified key belongs to another workspace', async () => {
  verifyApiKeyMock.mockResolvedValueOnce({
    valid: true,
    error: null,
    key: { id: 'key_1', referenceId: 'ws_other' },
  });

  await expect(
    verifyWorkspaceApiKey({
      apiKey: 'sr_secret',
      workspaceId: 'ws_1',
    })
  ).resolves.toEqual({
    ok: false,
    reason: 'forbidden',
    keyId: 'key_1',
  });
});
```

- [ ] **Step 2: Run the verifier test file and confirm RED**

Run: `pnpm --filter @workspace/web test -- test/unit/api/api-key-auth.server.test.ts`

Expected: FAIL because `verifyWorkspaceApiKey` does not exist yet.

- [ ] **Step 3: Implement the minimal verifier**

Create the helper with a narrow result shape:

```ts
export async function verifyWorkspaceApiKey(input: {
  apiKey: string | null;
  workspaceId: string | null;
}): Promise<
  | { ok: true; keyId: string; workspaceId: string }
  | { ok: false; reason: 'invalid-key' }
  | { ok: false; reason: 'missing-workspace' }
  | { ok: false; reason: 'forbidden'; keyId: string }
> {
  // call getAuth().api.verifyApiKey(...)
}
```

- [ ] **Step 4: Re-run the verifier tests and confirm GREEN**

Run: `pnpm --filter @workspace/web test -- test/unit/api/api-key-auth.server.test.ts`

Expected: PASS.

## Task 2: Add The `/api/hello` Route With Route-Level Tests

**Files:**

- Create: `apps/web/src/routes/api/hello.ts`
- Test: `apps/web/test/unit/routes/api/hello.test.ts`

- [ ] **Step 1: Write the failing route tests**

Add tests for success and error translation:

```ts
it('returns hello payload on success', async () => {
  verifyWorkspaceApiKeyMock.mockResolvedValueOnce({
    ok: true,
    keyId: 'key_1',
    workspaceId: 'ws_1',
  });

  const response = await handler({
    request: new Request('http://localhost/api/hello', {
      headers: {
        'x-api-key': 'sr_secret',
        'x-api-workspace-id': 'ws_1',
      },
    }),
  });

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ message: 'hello' });
});
```

- [ ] **Step 2: Run the route test file and confirm RED**

Run: `pnpm --filter @workspace/web test -- test/unit/routes/api/hello.test.ts`

Expected: FAIL because the route does not exist yet.

- [ ] **Step 3: Implement the route**

Use the repo’s API file-route pattern:

```ts
export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const verification = await verifyWorkspaceApiKey({
          apiKey: request.headers.get('x-api-key'),
          workspaceId: request.headers.get('x-api-workspace-id'),
        });

        // map result to HTTP response
      },
    },
  },
});
```

- [ ] **Step 4: Re-run the route tests and confirm GREEN**

Run: `pnpm --filter @workspace/web test -- test/unit/routes/api/hello.test.ts`

Expected: PASS.

## Task 3: Run Focused Verification

**Files:**

- Test: `apps/web/test/unit/api/api-key-auth.server.test.ts`
- Test: `apps/web/test/unit/routes/api/hello.test.ts`

- [ ] **Step 1: Run both targeted test files together**

Run: `pnpm --filter @workspace/web test -- test/unit/api/api-key-auth.server.test.ts test/unit/routes/api/hello.test.ts`

Expected: PASS.

- [ ] **Step 2: Run app typecheck if exports/types changed unexpectedly**

Run: `pnpm --filter @workspace/web typecheck`

Expected: PASS.

- [ ] **Step 3: Summarize any verification gaps**

Record whether the route was covered only by unit tests or also by broader checks before marking work complete.
