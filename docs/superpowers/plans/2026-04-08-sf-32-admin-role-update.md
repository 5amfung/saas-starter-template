# SF-32 Admin Role Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Admin app role-change bug by switching the Better Auth adapter from `updateUser` to `adminUpdateUser` and adding regression coverage for the existing single-save user form.

**Architecture:** Keep the Admin user form and `updateUser` server function interface unchanged, and correct only the server-side adapter in `apps/admin/src/admin/users.server.ts` to match the installed Better Auth admin plugin contract. Add one focused server unit test for the adapter seam and one form-level integration assertion that exercises a role change through the current save flow.

**Tech Stack:** TanStack Start server functions, Better Auth admin plugin, Vitest, Testing Library, React Query

---

### Task 1: Lock down the Better Auth adapter seam with a failing unit test

**Files:**

- Create: `apps/admin/test/unit/admin/users.server.test.ts`
- Modify: `apps/admin/src/admin/users.server.ts`
- Reference: `apps/admin/test/unit/admin/admin.server.test.ts`

- [x] **Step 1: Write the failing adapter test**

Add a new test file at `apps/admin/test/unit/admin/users.server.test.ts` with the following structure:

```ts
import { updateAdminUser } from '@/admin/users.server';

const { getRequestHeadersMock, adminUpdateUserMock } = vi.hoisted(() => ({
  getRequestHeadersMock: vi.fn(
    () => new Headers({ cookie: 'admin-session=1' })
  ),
  adminUpdateUserMock: vi.fn(),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/auth/validators', () => ({
  getVerifiedAdminSession: vi.fn(),
}));

vi.mock('@/init', () => ({
  getAuth: () => ({
    api: {
      adminUpdateUser: adminUpdateUserMock,
    },
  }),
}));

describe('updateAdminUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to auth.api.adminUpdateUser with normalized payload', async () => {
    adminUpdateUserMock.mockResolvedValueOnce({ data: { id: 'user-1' } });

    await updateAdminUser({
      userId: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      emailVerified: true,
      image: '',
      role: 'admin',
      banned: false,
      banReason: '',
      banExpires: '',
    });

    expect(adminUpdateUserMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      userId: 'user-1',
      data: {
        name: 'Alice',
        email: 'alice@example.com',
        emailVerified: true,
        image: null,
        role: 'admin',
        banned: false,
        banReason: null,
        banExpires: null,
      },
    });
  });
});
```

- [x] **Step 2: Run the new test to verify it fails**

Run:

```bash
pnpm --filter @workspace/admin-web test -- test/unit/admin/users.server.test.ts
```

Expected: FAIL because `updateAdminUser` currently calls `api.updateUser`, while the mock only exposes `adminUpdateUser`.

- [x] **Step 3: Implement the minimal adapter fix**

In `apps/admin/src/admin/users.server.ts`, update the local admin API shape and call site:

```ts
interface AdminApiLike {
  listUsers: (input: {
    headers: Headers;
    query: AdminListUsersInput;
  }) => Promise<unknown>;
  adminUpdateUser: (input: {
    headers: Headers;
    userId: string;
    data: {
      name: string;
      email: string;
      emailVerified: boolean;
      image: string | null;
      role: string | null;
      banned: boolean;
      banReason: string | null;
      banExpires: Date | null;
    };
  }) => Promise<unknown>;
  removeUser: (input: { headers: Headers; userId: string }) => Promise<unknown>;
}

export async function updateAdminUser(input: AdminUpdateUserInput) {
  const headers = getRequestHeaders();
  const api = getAuth().api as unknown as AdminApiLike;
  const result = await api.adminUpdateUser({
    headers,
    userId: input.userId,
    data: {
      name: input.name,
      email: input.email,
      emailVerified: input.emailVerified,
      image: input.image || null,
      role: input.role || null,
      banned: input.banned,
      banReason: input.banReason || null,
      banExpires: input.banExpires ? new Date(input.banExpires) : null,
    },
  });

  unwrapBetterAuthResult(result);
  return { success: true as const };
}
```

- [x] **Step 4: Re-run the adapter test**

Run:

```bash
pnpm --filter @workspace/admin-web test -- test/unit/admin/users.server.test.ts
```

Expected: PASS with one passing test for `updateAdminUser`.

- [ ] **Step 5: Commit the adapter seam fix**

```bash
git add apps/admin/src/admin/users.server.ts apps/admin/test/unit/admin/users.server.test.ts
git commit -m "fix(admin): use admin update user api"
```

### Task 2: Add a form-level regression test for role changes

**Files:**

- Modify: `apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx`
- Reference: `apps/admin/src/components/admin/admin-user-form.tsx`

- [x] **Step 1: Add a failing role-change integration test**

In `apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx`, add this test inside the `edit user flow` block:

```tsx
it('submits a role change through the existing save flow', async () => {
  const user = userEvent.setup();
  adminUpdateUserMock.mockResolvedValue({});

  renderWithProviders(<AdminUserForm user={mockUser} />);

  await user.click(screen.getByRole('combobox', { name: /role/i }));
  await user.click(await screen.findByRole('option', { name: 'admin' }));

  const saveButton = screen.getByRole('button', { name: /save changes/i });
  await waitFor(() => expect(saveButton).toBeEnabled());
  await user.click(saveButton);

  await waitFor(() => {
    expect(adminUpdateUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          role: 'admin',
        }),
      })
    );
  });

  expect(mockToastSuccess).toHaveBeenCalledWith('User updated successfully.');
});
```

- [x] **Step 2: Run the integration test target**

Run:

```bash
pnpm --filter @workspace/admin-web test -- test/integration/components/admin/admin-user-management-flow.integration.test.tsx
```

Expected: PASS if the current component already submits the selected role correctly. If it fails because of select interaction details, adjust only the test interaction to match the existing Base UI/select behavior.

- [x] **Step 3: If needed, update the test interaction to match the actual select control**

If the role select uses a button-triggered listbox rather than a native `<select>`, keep the component unchanged and update only the test selectors. The final assertion must still verify that the mutation receives:

```ts
expect.objectContaining({
  data: expect.objectContaining({
    userId: 'user-1',
    role: 'admin',
  }),
});
```

- [x] **Step 4: Re-run the focused integration test**

Run:

```bash
pnpm --filter @workspace/admin-web test -- test/integration/components/admin/admin-user-management-flow.integration.test.tsx
```

Expected: PASS with the new role-change regression included.

- [ ] **Step 5: Commit the regression test**

```bash
git add apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx
git commit -m "test(admin): cover role updates in user form"
```

### Task 3: Run final targeted verification and summarize the outcome

**Files:**

- Verify: `apps/admin/src/admin/users.server.ts`
- Verify: `apps/admin/test/unit/admin/users.server.test.ts`
- Verify: `apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx`

- [x] **Step 1: Run the focused unit and integration checks together**

Run:

```bash
pnpm --filter @workspace/admin-web test -- test/unit/admin/users.server.test.ts test/integration/components/admin/admin-user-management-flow.integration.test.tsx
```

Expected: PASS with all targeted SF-32 regression coverage green.

- [x] **Step 2: Run the Admin package check if the targeted tests passed cleanly**

Run:

```bash
pnpm --filter @workspace/admin-web check
```

Expected: PASS for TypeScript and ESLint in the Admin app.

- [x] **Step 3: Inspect the final diff for scope control**

Run:

```bash
git diff -- apps/admin/src/admin/users.server.ts apps/admin/test/unit/admin/users.server.test.ts apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx
```

Expected: only the Better Auth adapter method change and the two focused regression tests.

- [ ] **Step 4: Stage the final verified change set**

```bash
git add apps/admin/src/admin/users.server.ts apps/admin/test/unit/admin/users.server.test.ts apps/admin/test/integration/components/admin/admin-user-management-flow.integration.test.tsx
```

- [ ] **Step 5: Commit the final verified fix**

```bash
git commit -m "fix(admin): use better auth admin update user api"
```

## Self-Review

- Spec coverage: the plan updates the adapter contract, preserves the single-save form, adds adapter-seam coverage, and adds role-change regression coverage for the existing form flow.
- Placeholder scan: all tasks include specific files, concrete assertions, and exact commands.
- Type consistency: the plan consistently uses `adminUpdateUser` as the Better Auth admin API method name and keeps the app-level server function name `updateAdminUser`.
