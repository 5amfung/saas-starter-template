# SF-25 Workspace Slug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize workspace slug generation behind a client-safe `generateSlug()` auth utility that uses `random-word-slugs` default output plus a four-character lowercase alphanumeric suffix, and use it in both workspace creation flows.

**Architecture:** Add a pure slug utility under `packages/auth/src` and export it from the client-safe `@workspace/auth` barrel so both `packages/auth/src/auth.server.ts` and `apps/web/src/components/workspace-switcher.tsx` can share one contract. Replace the existing `ws-<hex>` and name-derived slug formats, keep database/schema behavior unchanged, and verify the new behavior with targeted unit tests plus boundary checks.

**Tech Stack:** TypeScript, pnpm workspaces, Better Auth, TanStack Start, Vitest, random-word-slugs, dependency-cruiser

---

### Task 1: Add Shared Auth Slug Utility

**Files:**

- Modify: `package.json`
- Modify: `packages/auth/package.json`
- Modify: `packages/auth/src/index.ts`
- Create: `packages/auth/src/slug.ts`
- Create: `packages/auth/test/unit/slug.test.ts`

- [x] **Step 1: Write the failing utility test**

Create `packages/auth/test/unit/slug.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { generateSlug } from '../../src/slug';

describe('generateSlug', () => {
  it('returns three random-word-slugs words plus a 4-char base36 suffix', () => {
    const slug = generateSlug();
    expect(slug).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[a-z0-9]{4}$/);
  });

  it('returns lowercase output', () => {
    expect(generateSlug()).toEqual(generateSlug().toLowerCase());
  });

  it('produces different values across calls', () => {
    const slug1 = generateSlug();
    const slug2 = generateSlug();
    expect(slug1).not.toBe(slug2);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @workspace/auth test -- test/unit/slug.test.ts`
Expected: FAIL with module-not-found or export-not-found errors for `../../src/slug`

- [x] **Step 3: Add the dependency and utility module**

Update the root `package.json` and `packages/auth/package.json` so `random-word-slugs` is available to `@workspace/auth`.

Create `packages/auth/src/slug.ts` with:

```ts
import { generateSlug as generateRandomWordSlug } from 'random-word-slugs';

const SUFFIX_LENGTH = 4;

function generateBase36Suffix() {
  return Math.random()
    .toString(36)
    .slice(2, 2 + SUFFIX_LENGTH)
    .padEnd(SUFFIX_LENGTH, '0');
}

export function generateSlug() {
  return `${generateRandomWordSlug()}-${generateBase36Suffix()}`;
}
```

Update `packages/auth/src/index.ts` with:

```ts
export { generateSlug } from './slug';
```

- [x] **Step 4: Run the utility test to verify it passes**

Run: `pnpm --filter @workspace/auth test -- test/unit/slug.test.ts`
Expected: PASS with 3 passing assertions

- [x] **Step 5: Commit the utility slice**

Run:

```bash
git add package.json packages/auth/package.json packages/auth/src/index.ts packages/auth/src/slug.ts packages/auth/test/unit/slug.test.ts
git commit -m "feat(auth): add shared slug generator"
```

### Task 2: Migrate Signup Workspace Creation to Shared Utility

**Files:**

- Modify: `packages/auth/src/auth.server.ts:221-244`
- Modify: `packages/auth/test/unit/auth.server.test.ts:233-253`

- [x] **Step 1: Write the failing auth test assertion**

In `packages/auth/test/unit/auth.server.test.ts`, replace the old slug expectation:

```ts
slug: expect.stringMatching(/^ws-[a-f0-9]{8}$/),
```

with:

```ts
slug: expect.stringMatching(/^[a-z]+-[a-z]+-[a-z]+-[a-z0-9]{4}$/),
```

- [x] **Step 2: Run the auth test to verify it fails**

Run: `pnpm --filter @workspace/auth test -- test/unit/auth.server.test.ts`
Expected: FAIL because `packages/auth/src/auth.server.ts` still sends `ws-<hex>`

- [x] **Step 3: Replace the signup slug generation**

Update `packages/auth/src/auth.server.ts` to import the shared utility and use it:

```ts
import { generateSlug } from './slug';
```

Replace:

```ts
const slug = `ws-${crypto.randomUUID().slice(0, 8)}`;
```

with:

```ts
const slug = generateSlug();
```

- [x] **Step 4: Run the auth test to verify it passes**

Run: `pnpm --filter @workspace/auth test -- test/unit/auth.server.test.ts`
Expected: PASS, including the updated workspace-creation assertion

- [x] **Step 5: Commit the auth migration**

Run:

```bash
git add packages/auth/src/auth.server.ts packages/auth/test/unit/auth.server.test.ts
git commit -m "refactor(auth): use shared slug generator for signup workspaces"
```

### Task 3: Migrate Web Workspace Creation and Remove Name-Derived Slug Logic

**Files:**

- Modify: `apps/web/src/components/workspace-switcher.tsx:41,126-131`
- Modify: `apps/web/src/workspace/workspace.ts:1-30`
- Modify: `apps/web/test/unit/components/workspace-switcher.test.tsx:343-400`
- Modify: `apps/web/test/unit/workspace/workspace.test.ts:1-60`

- [ ] **Step 1: Write the failing web tests**

In `apps/web/test/unit/components/workspace-switcher.test.tsx`, add an assertion inside `it('creates workspace and navigates on success', ...)`:

```ts
await waitFor(() => {
  expect(createOrgMock).toHaveBeenCalledWith({
    name: 'New Workspace',
    slug: expect.stringMatching(/^[a-z]+-[a-z]+-[a-z]+-[a-z0-9]{4}$/),
  });
});
```

In `apps/web/test/unit/workspace/workspace.test.ts`, remove the old slug-builder tests and keep only the default-workspace helper coverage:

```ts
import { pickDefaultWorkspace } from '@/workspace/workspace';

describe('pickDefaultWorkspace', () => {
  it('returns null for empty array', () => {
    expect(pickDefaultWorkspace([])).toBeNull();
  });

  it('returns the first workspace', () => {
    const workspaces = [{ id: 'ws_1' }, { id: 'ws_2' }];
    expect(pickDefaultWorkspace(workspaces)?.id).toBe('ws_1');
  });
});
```

- [ ] **Step 2: Run the affected web tests to verify they fail**

Run: `pnpm --filter @workspace/web test -- test/unit/components/workspace-switcher.test.tsx test/unit/workspace/workspace.test.ts`
Expected: FAIL because `workspace-switcher.tsx` still uses `buildWorkspaceSlug(name)` and the workspace utility test file still references removed slug helpers

- [ ] **Step 3: Switch the web app to the shared utility**

Update `apps/web/src/components/workspace-switcher.tsx` imports to use the auth utility:

```ts
import { authClient } from '@workspace/auth/client';
import { generateSlug } from '@workspace/auth';
```

Remove:

```ts
import { buildWorkspaceSlug } from '@/workspace/workspace';
```

Replace:

```ts
slug: buildWorkspaceSlug(name),
```

with:

```ts
slug: generateSlug(),
```

Reduce `apps/web/src/workspace/workspace.ts` to only the still-used helper:

```ts
// Pick the first workspace from the list.
export function pickDefaultWorkspace<T extends { id: string }>(
  workspaces: Array<T>
): T | null {
  return workspaces[0] ?? null;
}
```

- [ ] **Step 4: Run the affected web tests to verify they pass**

Run: `pnpm --filter @workspace/web test -- test/unit/components/workspace-switcher.test.tsx test/unit/workspace/workspace.test.ts`
Expected: PASS, including the new create-organization slug assertion

- [ ] **Step 5: Commit the web migration**

Run:

```bash
git add apps/web/src/components/workspace-switcher.tsx apps/web/src/workspace/workspace.ts apps/web/test/unit/components/workspace-switcher.test.tsx apps/web/test/unit/workspace/workspace.test.ts
git commit -m "refactor(web): use shared slug generator for workspace creation"
```

### Task 4: Verify Cross-Package Integration

**Files:**

- Verify only: `package.json`
- Verify only: `packages/auth/package.json`
- Verify only: `packages/auth/src/slug.ts`
- Verify only: `packages/auth/src/auth.server.ts`
- Verify only: `apps/web/src/components/workspace-switcher.tsx`

- [ ] **Step 1: Run package-level tests together**

Run: `pnpm --filter @workspace/auth test -- test/unit/slug.test.ts test/unit/auth.server.test.ts`
Expected: PASS

- [ ] **Step 2: Run affected web tests**

Run: `pnpm --filter @workspace/web test -- test/unit/components/workspace-switcher.test.tsx test/unit/workspace/workspace.test.ts`
Expected: PASS

- [ ] **Step 3: Run boundary checks**

Run: `pnpm run check:boundaries`
Expected: PASS with no new dependency-cruiser violations from importing `@workspace/auth` into `apps/web`

- [ ] **Step 4: Run targeted typechecking**

Run: `pnpm --filter @workspace/auth typecheck && pnpm --filter @workspace/web typecheck`
Expected: PASS

- [ ] **Step 5: Commit the verification checkpoint**

Run:

```bash
git add .
git commit -m "test: verify shared workspace slug integration"
```

## Self-Review

### Spec Coverage

- Shared utility in `packages/auth`: covered in Task 1.
- Use `random-word-slugs` default output plus 4 lowercase alphanumeric chars: covered in Task 1 tests and implementation.
- Apply to signup-created workspaces: covered in Task 2.
- Apply to user-created workspaces: covered in Task 3.
- Remove name-derived slug behavior: covered in Task 3.
- Verify with focused tests and boundary checks: covered in Task 4.

### Placeholder Scan

- No `TODO`, `TBD`, or “appropriate handling” placeholders remain.
- Every code-changing step includes concrete file paths and code snippets.
- Every verification step includes exact commands and expected outcomes.

### Type Consistency

- The shared API name is consistently `generateSlug()`.
- The slug format is consistently `^[a-z]+-[a-z]+-[a-z]+-[a-z0-9]{4}$`.
- The client-safe import path is consistently `@workspace/auth`.
