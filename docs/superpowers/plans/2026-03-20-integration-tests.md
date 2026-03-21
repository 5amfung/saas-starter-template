# Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ~123 unit/integration tests across ~25 test files covering auth/access control, billing, password reset, and layout/navigation.

**Architecture:** Risk-prioritized approach. Each phase delivers a complete vertical of coverage for a domain. All tests use mocked DB and auth — no real database. Tests follow existing patterns: `vi.hoisted()` + `vi.mock()`, factory functions from `@workspace/test-utils`, `renderWithProviders` for React components.

**Tech Stack:** Vitest, Testing Library, userEvent, `@workspace/test-utils` (factories + renderWithProviders)

---

## Chunk 1: Auth & Workspace Access Control

### Task 1: Auth Validators (`packages/auth`)

**Files:**

- Create: `packages/auth/test/unit/validators.test.ts`
- Source: `packages/auth/src/validators.ts`

- [ ] **Step 1: Write test file**

```ts
// packages/auth/test/unit/validators.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getVerifiedSession,
  validateAdminSession,
  validateGuestSession,
} from '../../src/validators';

// Validators accept auth as a parameter — no need to mock @/init.
// However, redirect() from @tanstack/react-router must be mocked so
// the thrown value is a plain object we can assert against.
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((opts: unknown) => {
    throw opts;
  }),
}));

const mockSession = {
  user: {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    role: 'user',
  },
  session: { id: 'session-1' },
};

const createMockAuth = (session: unknown = mockSession) => ({
  api: { getSession: vi.fn().mockResolvedValue(session) },
});

describe('validators', () => {
  // ── getVerifiedSession ──────────────────────────────────────────────

  describe('getVerifiedSession', () => {
    it('returns session for verified user', async () => {
      const auth = createMockAuth();
      const result = await getVerifiedSession(new Headers(), auth as never);
      expect(result).toEqual(mockSession);
    });

    it('redirects to /signin when session is null', async () => {
      const auth = createMockAuth(null);
      await expect(
        getVerifiedSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });

    it('redirects to /signin when email is not verified', async () => {
      const auth = createMockAuth({
        user: { ...mockSession.user, emailVerified: false },
        session: mockSession.session,
      });
      await expect(
        getVerifiedSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });
  });

  // ── validateGuestSession ────────────────────────────────────────────

  describe('validateGuestSession', () => {
    it('redirects to /ws when user is authenticated and verified', async () => {
      const auth = createMockAuth();
      await expect(
        validateGuestSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/ws' }));
    });

    it('does nothing for unauthenticated user', async () => {
      const auth = createMockAuth(null);
      await expect(
        validateGuestSession(new Headers(), auth as never)
      ).resolves.toBeUndefined();
    });
  });

  // ── validateAdminSession ────────────────────────────────────────────

  describe('validateAdminSession', () => {
    it('returns session for admin user', async () => {
      const adminSession = {
        ...mockSession,
        user: { ...mockSession.user, role: 'admin' },
      };
      const auth = createMockAuth(adminSession);
      const result = await validateAdminSession(new Headers(), auth as never);
      expect(result).toEqual(adminSession);
    });

    it('redirects non-admin user', async () => {
      const auth = createMockAuth();
      await expect(
        validateAdminSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });

    it('redirects unverified admin', async () => {
      const auth = createMockAuth({
        user: { ...mockSession.user, role: 'admin', emailVerified: false },
        session: mockSession.session,
      });
      await expect(
        validateAdminSession(new Headers(), auth as never)
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @workspace/auth test test/unit/validators.test.ts`
Expected: 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/auth/test/unit/validators.test.ts
git commit -m "test: add auth validator tests (getVerifiedSession, validateGuestSession, validateAdminSession)"
```

---

### Task 2: Workspace Server Helpers (extend existing)

**Files:**

- Modify: `apps/web/test/unit/workspace/workspace.server.test.ts`
- Source: `apps/web/src/workspace/workspace.server.ts`

- [ ] **Step 1: Add new tests for `listUserWorkspaces` and `ensureWorkspaceMembership` happy path + empty list edge case**

Append these test suites to the existing file:

```ts
// Add inside the existing describe('workspace.server') block:

describe('listUserWorkspaces', () => {
  it('returns workspaces from auth API', async () => {
    const workspaces = [
      { id: 'org_1', name: 'WS 1' },
      { id: 'org_2', name: 'WS 2' },
    ];
    listOrganizationsMock.mockResolvedValueOnce(workspaces);

    const { listUserWorkspaces } = await import('@/workspace/workspace.server');
    const result = await listUserWorkspaces(new Headers());

    expect(result).toEqual(workspaces);
    expect(listOrganizationsMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    });
  });
});

describe('ensureWorkspaceMembership', () => {
  it('returns workspace when user is a member', async () => {
    listOrganizationsMock.mockResolvedValueOnce([
      { id: 'org_target', name: 'Target WS' },
    ]);

    const workspace = await ensureWorkspaceMembership(
      new Headers(),
      'org_target'
    );

    expect(workspace).toEqual({ id: 'org_target', name: 'Target WS' });
  });

  it('throws NOT_FOUND for empty workspace list', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    listOrganizationsMock.mockResolvedValueOnce([]);

    await expect(
      ensureWorkspaceMembership(new Headers(), 'org_missing')
    ).rejects.toBeInstanceOf(APIError);

    consoleSpy.mockRestore();
  });
});
```

Note: `listUserWorkspaces` is not currently imported in the test file. Add it to the import statement at the top:

```ts
import {
  ensureActiveWorkspaceForSession,
  ensureWorkspaceMembership,
  listUserWorkspaces,
} from '@/workspace/workspace.server';
```

- [ ] **Step 2: Run tests to verify all pass (existing + new)**

Run: `pnpm --filter @workspace/web test test/unit/workspace/workspace.server.test.ts`
Expected: 11 tests PASS (8 existing + 3 new)

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/workspace/workspace.server.test.ts
git commit -m "test: add listUserWorkspaces and ensureWorkspaceMembership tests"
```

---

### Task 3: Workspace Server Functions

**Files:**

- Create: `apps/web/test/unit/workspace/workspace.functions.test.ts`
- Source: `apps/web/src/workspace/workspace.functions.ts`

- [ ] **Step 1: Write test file**

```ts
// apps/web/test/unit/workspace/workspace.functions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSessionResponse } from '@workspace/test-utils';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  getSessionMock,
  getRequestHeadersMock,
  ensureWorkspaceMembershipMock,
  setActiveOrganizationMock,
  ensureActiveWorkspaceForSessionMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
  ensureWorkspaceMembershipMock: vi.fn(),
  setActiveOrganizationMock: vi.fn(),
  ensureActiveWorkspaceForSessionMock: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@/init', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
      setActiveOrganization: setActiveOrganizationMock,
    },
  },
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/workspace/workspace.server', () => ({
  ensureWorkspaceMembership: ensureWorkspaceMembershipMock,
  ensureActiveWorkspaceForSession: ensureActiveWorkspaceForSessionMock,
}));

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((opts: unknown) => {
    throw opts;
  }),
}));

// Handler extractors — createServerFn wraps the handler, so we call the
// exported server functions directly. They internally call getRequestHeaders().

// ── Tests ──────────────────────────────────────────────────────────────────

describe('workspace.functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  // ── resolveWorkspaceRouteAccess (tested via getWorkspaceById) ──────────

  describe('resolveWorkspaceRouteAccess', () => {
    // Import the module after mocks are set up.
    const importModule = () => import('@/workspace/workspace.functions');

    it('redirects to /signin when no session', async () => {
      getSessionMock.mockResolvedValue(null);
      const { getWorkspaceById } = await importModule();

      await expect(
        getWorkspaceById({ data: { workspaceId: 'ws-1' } })
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });

    it('redirects to /signin when email not verified', async () => {
      getSessionMock.mockResolvedValue(
        createMockSessionResponse({ emailVerified: false })
      );
      const { getWorkspaceById } = await importModule();

      await expect(
        getWorkspaceById({ data: { workspaceId: 'ws-1' } })
      ).rejects.toEqual(expect.objectContaining({ to: '/signin' }));
    });

    it('returns workspace when user is a member', async () => {
      const session = createMockSessionResponse(
        {},
        { activeOrganizationId: 'ws-1' }
      );
      getSessionMock.mockResolvedValue(session);
      ensureWorkspaceMembershipMock.mockResolvedValue({
        id: 'ws-1',
        name: 'My WS',
      });
      const { getWorkspaceById } = await importModule();

      const result = await getWorkspaceById({
        data: { workspaceId: 'ws-1' },
      });

      expect(result).toEqual({ id: 'ws-1', name: 'My WS' });
    });

    it('switches active workspace when different from current', async () => {
      const session = createMockSessionResponse(
        {},
        { activeOrganizationId: 'ws-old' }
      );
      getSessionMock.mockResolvedValue(session);
      ensureWorkspaceMembershipMock.mockResolvedValue({
        id: 'ws-new',
        name: 'New WS',
      });
      const { getWorkspaceById } = await importModule();

      await getWorkspaceById({ data: { workspaceId: 'ws-new' } });

      expect(setActiveOrganizationMock).toHaveBeenCalledWith({
        body: { organizationId: 'ws-new' },
        headers: expect.any(Headers),
      });
    });

    it('skips switching when already on correct workspace', async () => {
      const session = createMockSessionResponse(
        {},
        { activeOrganizationId: 'ws-1' }
      );
      getSessionMock.mockResolvedValue(session);
      ensureWorkspaceMembershipMock.mockResolvedValue({
        id: 'ws-1',
        name: 'Current WS',
      });
      const { getWorkspaceById } = await importModule();

      await getWorkspaceById({ data: { workspaceId: 'ws-1' } });

      expect(setActiveOrganizationMock).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when user is not a member', async () => {
      const session = createMockSessionResponse(
        {},
        { activeOrganizationId: 'ws-1' }
      );
      getSessionMock.mockResolvedValue(session);
      const { APIError } = await import('better-auth/api');
      ensureWorkspaceMembershipMock.mockRejectedValue(
        new APIError('NOT_FOUND', { message: 'Workspace not found.' })
      );
      const { getWorkspaceById } = await importModule();

      await expect(
        getWorkspaceById({ data: { workspaceId: 'ws-missing' } })
      ).rejects.toBeInstanceOf(APIError);
    });
  });

  // ── getActiveWorkspaceId ────────────────────────────────────────────────

  describe('getActiveWorkspaceId', () => {
    const importModule = () => import('@/workspace/workspace.functions');

    it('redirects to /signin when no session', async () => {
      getSessionMock.mockResolvedValue(null);
      const { getActiveWorkspaceId } = await importModule();

      await expect(getActiveWorkspaceId()).rejects.toEqual(
        expect.objectContaining({ to: '/signin' })
      );
    });

    it('returns activeOrganizationId when already set on session', async () => {
      const session = createMockSessionResponse(
        {},
        { activeOrganizationId: 'ws-active' }
      );
      getSessionMock.mockResolvedValue(session);
      const { getActiveWorkspaceId } = await importModule();

      const result = await getActiveWorkspaceId();

      expect(result).toBe('ws-active');
      expect(ensureActiveWorkspaceForSessionMock).not.toHaveBeenCalled();
    });

    it('falls back to ensureActiveWorkspaceForSession when no active ID', async () => {
      const session = createMockSessionResponse(
        {},
        { activeOrganizationId: null }
      );
      getSessionMock.mockResolvedValue(session);
      ensureActiveWorkspaceForSessionMock.mockResolvedValue({
        id: 'ws-fallback',
        name: 'Fallback',
      });
      const { getActiveWorkspaceId } = await importModule();

      const result = await getActiveWorkspaceId();

      expect(result).toBe('ws-fallback');
      expect(ensureActiveWorkspaceForSessionMock).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @workspace/web test test/unit/workspace/workspace.functions.test.ts`
Expected: 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/workspace/workspace.functions.test.ts
git commit -m "test: add workspace server function tests (resolveWorkspaceRouteAccess, getActiveWorkspaceId)"
```

---

### Task 4: Notification Preferences — Add `requireVerifiedSession` Tests (extend existing)

**Files:**

- Modify: `apps/web/test/unit/account/notification-preferences.server.test.ts` (already has 4 tests for get/upsert)
- Source: `apps/web/src/account/notification-preferences.server.ts`

Note: This file already exists with 4 tests. We extend it — do NOT overwrite. The existing file needs its hoisted mocks updated to include `getSessionMock`/`getRequestHeadersMock`, its `@/init` mock updated to include `auth.api.getSession`, and its `redirect` mock updated to throw opts (for redirect assertions).

- [ ] **Step 1: Update existing file mocks and add `requireVerifiedSession` tests**

```ts
// apps/web/test/unit/account/notification-preferences.server.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSessionResponse } from '@workspace/test-utils';
import { mockDbChain, mockDbInsertChain } from '../../mocks/db';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { getSessionMock, getRequestHeadersMock, dbSelectMock, dbInsertMock } =
  vi.hoisted(() => ({
    getSessionMock: vi.fn(),
    getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
    dbSelectMock: vi.fn(),
    dbInsertMock: vi.fn(),
  }));

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@/init', () => ({
  auth: {
    api: { getSession: getSessionMock },
  },
  db: {
    select: dbSelectMock,
    insert: dbInsertMock,
  },
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((opts: unknown) => {
    throw opts;
  }),
}));

// Drizzle helpers used in .from() and .where() — mock their return values.
vi.mock('@workspace/db/schema', () => ({
  notificationPreferences: {
    userId: 'userId',
    marketingEmails: 'marketingEmails',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe('notification-preferences.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  const importModule = () =>
    import('@/account/notification-preferences.server');

  // ── requireVerifiedSession ────────────────────────────────────────────

  describe('requireVerifiedSession', () => {
    it('returns session for verified user', async () => {
      const session = createMockSessionResponse();
      getSessionMock.mockResolvedValue(session);
      const { requireVerifiedSession } = await importModule();

      const result = await requireVerifiedSession();
      expect(result).toEqual(session);
    });

    it('redirects when no session', async () => {
      getSessionMock.mockResolvedValue(null);
      const { requireVerifiedSession } = await importModule();

      await expect(requireVerifiedSession()).rejects.toEqual(
        expect.objectContaining({ to: '/signin' })
      );
    });
  });

  // ── getNotificationPreferencesForUser ─────────────────────────────────

  describe('getNotificationPreferencesForUser', () => {
    it('returns defaults when no row exists', async () => {
      mockDbChain(dbSelectMock, []);
      const { getNotificationPreferencesForUser } = await importModule();

      const result = await getNotificationPreferencesForUser('user-1');

      expect(result).toEqual({
        emailUpdates: true,
        marketingEmails: false,
      });
    });

    it('returns stored marketingEmails value from DB', async () => {
      mockDbChain(dbSelectMock, [{ marketingEmails: true }]);
      const { getNotificationPreferencesForUser } = await importModule();

      const result = await getNotificationPreferencesForUser('user-1');

      // emailUpdates is always the constant true — never read from DB.
      expect(result).toEqual({
        emailUpdates: true,
        marketingEmails: true,
      });
    });
  });

  // ── upsertNotificationPreferencesForUser ──────────────────────────────

  describe('upsertNotificationPreferencesForUser', () => {
    it('inserts when no existing row', async () => {
      const { onConflictDoUpdateMock } = mockDbInsertChain(dbInsertMock);
      // The function calls getNotificationPreferencesForUser after upsert.
      mockDbChain(dbSelectMock, [{ marketingEmails: true }]);
      const { upsertNotificationPreferencesForUser } = await importModule();

      const result = await upsertNotificationPreferencesForUser('user-1', {
        marketingEmails: true,
      });

      expect(onConflictDoUpdateMock).toHaveBeenCalled();
      expect(result.marketingEmails).toBe(true);
    });

    it('skips write when patch has no boolean marketingEmails', async () => {
      mockDbChain(dbSelectMock, []);
      const { upsertNotificationPreferencesForUser } = await importModule();

      const result = await upsertNotificationPreferencesForUser('user-1', {});

      // Should not have called insert — returns defaults instead.
      expect(dbInsertMock).not.toHaveBeenCalled();
      expect(result).toEqual({
        emailUpdates: true,
        marketingEmails: false,
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @workspace/web test test/unit/account/notification-preferences.server.test.ts`
Expected: 6 tests PASS (4 existing + 2 new)

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/account/notification-preferences.server.test.ts
git commit -m "test: add requireVerifiedSession tests to notification preferences"
```

---

## Chunk 2: Billing

### Task 5: Billing Server Gaps (extend existing)

**Files:**

- Modify: `apps/web/test/unit/billing/billing.server.test.ts`
- Source: `apps/web/src/billing/billing.server.ts`

- [ ] **Step 1: Add `requireVerifiedSession` and `getUserActivePlanId` tests**

Add `getUserActivePlanId` to the import at top of file:

```ts
import {
  checkUserPlanLimit,
  createCheckoutForPlan,
  createUserBillingPortal,
  getBillingData,
  getUserActivePlanId,
  getUserPlanContext,
  reactivateUserSubscription,
  requireVerifiedSession,
} from '@/billing/billing.server';
```

Also update the existing `@tanstack/react-router` mock to throw opts (needed for redirect assertions):

```ts
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((opts: unknown) => {
    throw opts;
  }),
}));
```

And update the `@tanstack/react-start/server` mock to use a hoisted mock for `getRequestHeaders`:

Add to the hoisted block:

```ts
getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
```

```ts
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));
```

Append these test suites inside the existing `describe('billing.server')` block:

```ts
// ── requireVerifiedSession ────────────────────────────────────────────

describe('requireVerifiedSession', () => {
  it('returns session for verified user', async () => {
    getRequestHeadersMock.mockReturnValue(new Headers());
    getSessionMock.mockResolvedValue({
      user: { id: 'user_123', emailVerified: true },
      session: { id: 'session_1' },
    });

    const session = await requireVerifiedSession();

    expect(session.user.id).toBe('user_123');
  });

  it('throws redirect when no session', async () => {
    getRequestHeadersMock.mockReturnValue(new Headers());
    getSessionMock.mockResolvedValue(null);

    await expect(requireVerifiedSession()).rejects.toEqual(
      expect.objectContaining({ to: '/signin' })
    );
  });
});

// ── getUserActivePlanId ─────────────────────────────────────────────

describe('getUserActivePlanId', () => {
  it('returns free plan when no subscriptions', async () => {
    listActiveSubscriptionsMock.mockResolvedValue([]);

    const planId = await getUserActivePlanId(TEST_HEADERS, TEST_USER_ID);

    expect(planId).toBe('free');
  });

  it('delegates to resolveUserPlanId with subscription array', async () => {
    listActiveSubscriptionsMock.mockResolvedValue([
      { plan: 'pro', status: 'active' },
    ]);

    const planId = await getUserActivePlanId(TEST_HEADERS, TEST_USER_ID);

    expect(planId).toBe('pro');
    expect(listActiveSubscriptionsMock).toHaveBeenCalledWith({
      headers: TEST_HEADERS,
      query: { referenceId: TEST_USER_ID },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify all pass**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing.server.test.ts`
Expected: All tests PASS (existing + 4 new)

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/billing/billing.server.test.ts
git commit -m "test: add requireVerifiedSession and getUserActivePlanId tests"
```

---

### Task 6: Billing Downgrade Banner

**Files:**

- Create: `apps/web/test/unit/components/billing/billing-downgrade-banner.test.tsx`
- Source: `apps/web/src/components/billing/billing-downgrade-banner.tsx`

- [ ] **Step 1: Write test file**

```tsx
// @vitest-environment jsdom
// apps/web/test/unit/components/billing/billing-downgrade-banner.test.tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { BillingDowngradeBanner } from '@/components/billing/billing-downgrade-banner';

describe('BillingDowngradeBanner', () => {
  const defaultProps = {
    periodEnd: new Date('2026-04-15'),
    onReactivate: vi.fn(),
    isReactivating: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows downgrade date in formatted text', () => {
    renderWithProviders(<BillingDowngradeBanner {...defaultProps} />);
    expect(screen.getByText(/April 15, 2026/)).toBeInTheDocument();
  });

  it('calls onReactivate when button clicked', async () => {
    const user = userEvent.setup();
    const onReactivate = vi.fn();
    renderWithProviders(
      <BillingDowngradeBanner {...defaultProps} onReactivate={onReactivate} />
    );

    await user.click(
      screen.getByRole('button', { name: /keep subscription/i })
    );
    expect(onReactivate).toHaveBeenCalledTimes(1);
  });

  it('disables button and shows spinner when isReactivating', () => {
    renderWithProviders(
      <BillingDowngradeBanner {...defaultProps} isReactivating={true} />
    );
    expect(
      screen.getByRole('button', { name: /keep subscription/i })
    ).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/billing/billing-downgrade-banner.test.tsx`
Expected: 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/components/billing/billing-downgrade-banner.test.tsx
git commit -m "test: add BillingDowngradeBanner component tests"
```

---

### Task 7: Billing Plan Cards

**Files:**

- Create: `apps/web/test/unit/components/billing/billing-plan-cards.test.tsx`
- Source: `apps/web/src/components/billing/billing-plan-cards.tsx`

- [ ] **Step 1: Read source file carefully before writing tests**

The source component has complex props. Before writing, verify the exact prop interface, conditional rendering logic, and text content by reading the source file.

- [ ] **Step 2: Write test file**

The test file should cover: current plan display (name, features, free/paid price), upgrade card (features, toggle, pricing), manage/upgrade button interactions, loading states. Use `renderWithProviders` and `userEvent` patterns from signin-form.test.tsx.

- [ ] **Step 3: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/billing/billing-plan-cards.test.tsx`
Expected: 14 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/unit/components/billing/billing-plan-cards.test.tsx
git commit -m "test: add BillingPlanCards component tests"
```

---

### Task 8: Upgrade Prompt Dialog

**Files:**

- Create: `apps/web/test/unit/components/billing/upgrade-prompt-dialog.test.tsx`
- Source: `apps/web/src/components/billing/upgrade-prompt-dialog.tsx`

- [ ] **Step 1: Read source carefully before writing tests**

- [ ] **Step 2: Write test file**

Tests must distinguish: "Maybe later" button (upgradePlan non-null) vs "Got it" button (upgradePlan null). Cover upgrade interaction, loading state, annual toggle.

- [ ] **Step 3: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/billing/upgrade-prompt-dialog.test.tsx`
Expected: 7 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/unit/components/billing/upgrade-prompt-dialog.test.tsx
git commit -m "test: add UpgradePromptDialog component tests"
```

---

### Task 9: Billing Invoice Table

**Files:**

- Create: `apps/web/test/unit/components/billing/billing-invoice-table.test.tsx`
- Source: `apps/web/src/components/billing/billing-invoice-table.tsx`

- [ ] **Step 1: Read source carefully before writing tests**

- [ ] **Step 2: Write test file**

Cover: loading state, empty state, invoice row rendering (date, status badge, amount formatting cents→dollars, link), dash for missing URL, month filter interaction.

- [ ] **Step 3: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/billing/billing-invoice-table.test.tsx`
Expected: 7 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/unit/components/billing/billing-invoice-table.test.tsx
git commit -m "test: add BillingInvoiceTable component tests"
```

---

### Task 10: Billing Page

**Files:**

- Create: `apps/web/test/unit/components/billing/billing-page.test.tsx`
- Source: `apps/web/src/components/billing/billing-page.tsx`

- [ ] **Step 1: Read source carefully before writing tests**

Key: Mock `@/billing/billing.functions` (getUserBillingData, getInvoices, createCheckoutSession, createPortalSession, reactivateSubscription). Mock `sonner` (toast). Reactivate success path toasts + invalidates queries (does NOT redirect). Upgrade/manage success paths redirect via `window.location.href`.

- [ ] **Step 2: Write test file**

Cover: loading state (returns null), plan cards rendering, invoice table rendering, downgrade banner conditional, upgrade/manage redirects, reactivate toast+invalidate, error toast.

- [ ] **Step 3: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/billing/billing-page.test.tsx`
Expected: 9 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/unit/components/billing/billing-page.test.tsx
git commit -m "test: add BillingPage component tests"
```

---

## Chunk 3: Password Reset Flow

### Task 11: Form Error Component

**Files:**

- Create: `apps/web/test/unit/components/auth/form-error.test.tsx`
- Source: `apps/web/src/components/auth/form-error.tsx`

- [ ] **Step 1: Write test file**

```tsx
// @vitest-environment jsdom
// apps/web/test/unit/components/auth/form-error.test.tsx
import { render, screen } from '@testing-library/react';
import { FormError } from '@/components/auth/form-error';

describe('FormError', () => {
  it('renders nothing when errors array is empty', () => {
    const { container } = render(<FormError errors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when errors is undefined', () => {
    const { container } = render(<FormError />);
    expect(container.firstChild).toBeNull();
  });

  it('renders error messages joined by comma', () => {
    render(<FormError errors={['First error', 'Second error']} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'First error, Second error'
    );
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/form-error.test.tsx`
Expected: 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/components/auth/form-error.test.tsx
git commit -m "test: add FormError component tests"
```

---

### Task 12: Check Email Card

Note: The spec described "email provider" tests (recognized provider link, generic message). However, `CheckEmailCard` is a generic presentational card (`title`, `description`, `actions`, `footer` props) — it has no provider logic. The tests below match the actual component. The spec items about provider-specific behavior may apply to a consumer component that composes `CheckEmailCard`, not to the card itself.

**Files:**

- Create: `apps/web/test/unit/components/auth/check-email-card.test.tsx`
- Source: `apps/web/src/components/auth/check-email-card.tsx`

- [ ] **Step 1: Write test file**

```tsx
// @vitest-environment jsdom
// apps/web/test/unit/components/auth/check-email-card.test.tsx
import { render, screen } from '@testing-library/react';
import { CheckEmailCard } from '@/components/auth/check-email-card';

describe('CheckEmailCard', () => {
  it('renders title and description', () => {
    render(
      <CheckEmailCard
        title="Check your email"
        description="We sent a link to your email."
      />
    );
    expect(screen.getByText('Check your email')).toBeInTheDocument();
    expect(
      screen.getByText('We sent a link to your email.')
    ).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <CheckEmailCard
        title="Title"
        description="Desc"
        actions={<button>Open Gmail</button>}
      />
    );
    expect(
      screen.getByRole('button', { name: /open gmail/i })
    ).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(
      <CheckEmailCard
        title="Title"
        description="Desc"
        footer={<a href="/signin">Back to sign in</a>}
      />
    );
    expect(screen.getByText('Back to sign in')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/check-email-card.test.tsx`
Expected: 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/components/auth/check-email-card.test.tsx
git commit -m "test: add CheckEmailCard component tests"
```

---

### Task 13: Google Sign-In Button

**Files:**

- Create: `apps/web/test/unit/components/auth/google-sign-in-button.test.tsx`
- Source: `apps/web/src/components/auth/google-sign-in-button.tsx`

- [ ] **Step 1: Write test file**

```tsx
// @vitest-environment jsdom
// apps/web/test/unit/components/auth/google-sign-in-button.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';

const { signInSocial } = vi.hoisted(() => ({
  signInSocial: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    signIn: { social: signInSocial },
  },
}));

// Mock the GoogleIcon SVG component.
vi.mock('@/components/icons/google-icon', () => ({
  GoogleIcon: (props: React.ComponentProps<'svg'>) => (
    <svg data-testid="google-icon" {...props} />
  ),
}));

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Google icon and button text', () => {
    signInSocial.mockResolvedValue({ data: null, error: null });
    renderWithProviders(<GoogleSignInButton />);
    expect(
      screen.getByRole('button', { name: /sign in with google/i })
    ).toBeInTheDocument();
  });

  it('calls authClient.signIn.social with google provider on click', async () => {
    const user = userEvent.setup();
    signInSocial.mockResolvedValue({ data: null, error: null });
    renderWithProviders(<GoogleSignInButton />);

    await user.click(
      screen.getByRole('button', { name: /sign in with google/i })
    );

    await waitFor(() => {
      expect(signInSocial).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google' })
      );
    });
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/google-sign-in-button.test.tsx`
Expected: 2 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/components/auth/google-sign-in-button.test.tsx
git commit -m "test: add GoogleSignInButton component tests"
```

---

### Task 14: Auth Layout

**Files:**

- Create: `apps/web/test/unit/components/auth/auth-layout.test.tsx`
- Source: `apps/web/src/components/auth/auth-layout.tsx`

- [ ] **Step 1: Write test file**

```tsx
// @vitest-environment jsdom
// apps/web/test/unit/components/auth/auth-layout.test.tsx
import { render, screen } from '@testing-library/react';
import { AuthLayout } from '@/components/auth/auth-layout';

describe('AuthLayout', () => {
  it('renders children within layout', () => {
    render(
      <AuthLayout>
        <div data-testid="child-content">Hello</div>
      </AuthLayout>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders Acme Inc branding', () => {
    render(
      <AuthLayout>
        <div />
      </AuthLayout>
    );
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/auth-layout.test.tsx`
Expected: 2 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/components/auth/auth-layout.test.tsx
git commit -m "test: add AuthLayout component tests"
```

---

### Task 15: Forgot Password Form

**Files:**

- Create: `apps/web/test/unit/components/auth/forgot-password-form.test.tsx`
- Source: `apps/web/src/components/auth/forgot-password-form.tsx`

- [ ] **Step 1: Write test file**

```tsx
// @vitest-environment jsdom
// apps/web/test/unit/components/auth/forgot-password-form.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

const { requestPasswordReset } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    requestPasswordReset,
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email input and submit button', () => {
    renderWithProviders(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it('shows validation error on blur with invalid email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordForm />);

    await user.click(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('calls authClient.requestPasswordReset on submit', async () => {
    const user = userEvent.setup();
    requestPasswordReset.mockResolvedValue({ error: null });
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' })
      );
    });
  });

  it('shows success card with check your email message', async () => {
    const user = userEvent.setup();
    requestPasswordReset.mockResolvedValue({ error: null });
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it('shows Back to sign in link on success card', async () => {
    const user = userEvent.setup();
    requestPasswordReset.mockResolvedValue({ error: null });
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/back to sign in/i)).toBeInTheDocument();
    });
  });

  it('shows form error when API returns error', async () => {
    const user = userEvent.setup();
    requestPasswordReset.mockResolvedValue({
      error: { message: 'Rate limited' },
    });
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
    });
  });

  it('disables button while submitting', async () => {
    const user = userEvent.setup();
    requestPasswordReset.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /send reset link/i })
      ).toBeDisabled();
    });
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/forgot-password-form.test.tsx`
Expected: 7 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/components/auth/forgot-password-form.test.tsx
git commit -m "test: add ForgotPasswordForm component tests"
```

---

### Task 16: Reset Password Form

**Files:**

- Create: `apps/web/test/unit/components/auth/reset-password-form.test.tsx`
- Source: `apps/web/src/components/auth/reset-password-form.tsx`

- [ ] **Step 1: Write test file**

```tsx
// @vitest-environment jsdom
// apps/web/test/unit/components/auth/reset-password-form.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

const { resetPassword } = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    resetPassword,
  },
}));

// Do NOT mock resetPasswordSchema — use the real schema for end-to-end validation.

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Invalid reset link when no token provided', () => {
    renderWithProviders(<ResetPasswordForm />);
    expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
  });

  it('shows Invalid reset link when error prop is set', () => {
    renderWithProviders(
      <ResetPasswordForm token="tok_123" error="Token expired" />
    );
    expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
  });

  it('shows Request new reset link on invalid state', () => {
    renderWithProviders(<ResetPasswordForm />);
    expect(screen.getByText(/request new reset link/i)).toBeInTheDocument();
  });

  it('renders password fields with valid token', () => {
    renderWithProviders(<ResetPasswordForm token="tok_valid" />);
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('calls authClient.resetPassword with token on submit', async () => {
    const user = userEvent.setup();
    resetPassword.mockResolvedValue({ error: null });
    renderWithProviders(<ResetPasswordForm token="tok_valid" />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          newPassword: 'NewPass123!',
          token: 'tok_valid',
        })
      );
    });
  });

  it('shows Password updated success card after success', async () => {
    const user = userEvent.setup();
    resetPassword.mockResolvedValue({ error: null });
    renderWithProviders(<ResetPasswordForm token="tok_valid" />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/password updated/i)).toBeInTheDocument();
    });
  });

  it('shows form error when API returns error', async () => {
    const user = userEvent.setup();
    resetPassword.mockResolvedValue({
      error: { message: 'Token expired' },
    });
    renderWithProviders(<ResetPasswordForm token="tok_valid" />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/token expired/i)).toBeInTheDocument();
    });
  });

  it('disables button while submitting', async () => {
    const user = userEvent.setup();
    resetPassword.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<ResetPasswordForm token="tok_valid" />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /reset password/i })
      ).toBeDisabled();
    });
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/reset-password-form.test.tsx`
Expected: 8 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/components/auth/reset-password-form.test.tsx
git commit -m "test: add ResetPasswordForm component tests"
```

---

## Chunk 4: Layout & Navigation

### Task 17: Not Found Component

**Files:**

- Create: `apps/web/test/unit/components/not-found.test.tsx`
- Source: `apps/web/src/components/not-found.tsx`

- [ ] **Step 1: Write test file**

```tsx
// @vitest-environment jsdom
// apps/web/test/unit/components/not-found.test.tsx
import { render, screen } from '@testing-library/react';
import { NotFound } from '@/components/not-found';

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('NotFound', () => {
  it('renders 404 message and home link', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText(/go back home/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go back home/i })).toHaveAttribute(
      'href',
      '/'
    );
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/not-found.test.tsx`
Expected: 1 test PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/components/not-found.test.tsx
git commit -m "test: add NotFound component test"
```

---

### Task 18: Navigation Components (NavMain, NavAdmin, NavSecondary, NavUser)

**Files:**

- Create: `apps/web/test/unit/components/nav-main.test.tsx`
- Create: `apps/web/test/unit/components/nav-admin.test.tsx`
- Create: `apps/web/test/unit/components/nav-secondary.test.tsx`
- Create: `apps/web/test/unit/components/nav-user.test.tsx`
- Source: `apps/web/src/components/nav-*.tsx`

- [ ] **Step 1: Read all nav source files to understand props and structure**

- [ ] **Step 2: Write NavMain test file**

NavMain takes `workspaceId` prop and renders workspace navigation links. Mock `@tanstack/react-router` (Link, useMatchRoute). Verify items render with correct labels and hrefs. Verify active state based on current route.

- [ ] **Step 3: Write NavAdmin test file**

NavAdmin renders admin navigation items. Mock router. Verify items and links.

- [ ] **Step 4: Write NavSecondary test file**

NavSecondary renders secondary nav with help/home links and theme selector. Mock router.

- [ ] **Step 5: Write NavUser test file**

NavUser renders user avatar dropdown. Mock `@workspace/auth/client` (authClient.signOut). Verify name/email display, dropdown options, sign-out interaction.

- [ ] **Step 6: Run all nav tests**

Run: `pnpm --filter @workspace/web test test/unit/components/nav-`
Expected: ~10 tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/test/unit/components/nav-main.test.tsx \
       apps/web/test/unit/components/nav-admin.test.tsx \
       apps/web/test/unit/components/nav-secondary.test.tsx \
       apps/web/test/unit/components/nav-user.test.tsx
git commit -m "test: add navigation component tests (NavMain, NavAdmin, NavSecondary, NavUser)"
```

---

### Task 19: Workspace Switcher

**Files:**

- Create: `apps/web/test/unit/components/workspace-switcher.test.tsx`
- Source: `apps/web/src/components/workspace-switcher.tsx`

- [ ] **Step 1: Read source carefully**

Complex component with dropdown, create dialog, upgrade dialog. Calls `checkPlanLimit` as a direct async function. Mock `@workspace/auth/client`, `@/billing/billing.functions` (checkPlanLimit), `@tanstack/react-router` (useNavigate), `@workspace/ui/components/sidebar` (useSidebar), `sonner` (toast).

`checkPlanLimit` mock must return `Promise<{ allowed: boolean, current: number, limit: number, planName: string, upgradePlan: Plan | null }>`.

- [ ] **Step 2: Write test file**

Cover: active workspace display, dropdown with all workspaces, workspace switch (setActive + navigate), switch error toast, create dialog (plan allows), upgrade prompt (plan limit), name validation, create success, create error, loading states.

- [ ] **Step 3: Run test**

Run: `pnpm --filter @workspace/web test test/unit/components/workspace-switcher.test.tsx`
Expected: 10 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/unit/components/workspace-switcher.test.tsx
git commit -m "test: add WorkspaceSwitcher component tests"
```

---

### Task 20: Layout Components (AppSidebar, SiteHeader, DynamicBreadcrumb)

**Files:**

- Create: `apps/web/test/unit/components/app-sidebar.test.tsx`
- Create: `apps/web/test/unit/components/site-header.test.tsx`
- Create: `apps/web/test/unit/components/dynamic-breadcrumb.test.tsx`
- Source: `apps/web/src/components/app-sidebar.tsx`, `site-header.tsx`, `dynamic-breadcrumb.tsx`

- [ ] **Step 1: Read source files**

- [ ] **Step 2: Write AppSidebar test**

Mock child components (WorkspaceSwitcher, NavMain, NavAdmin, NavSecondary, NavUser) to keep this focused on composition. Verify all sections render.

- [ ] **Step 3: Write SiteHeader test**

Verify breadcrumb and sidebar trigger render.

- [ ] **Step 4: Write DynamicBreadcrumb test**

Mock `@tanstack/react-router` (useMatches). Verify breadcrumb generation from route matches.

- [ ] **Step 5: Run layout tests**

Run: `pnpm --filter @workspace/web test test/unit/components/app-sidebar.test.tsx test/unit/components/site-header.test.tsx test/unit/components/dynamic-breadcrumb.test.tsx`
Expected: ~5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/test/unit/components/app-sidebar.test.tsx \
       apps/web/test/unit/components/site-header.test.tsx \
       apps/web/test/unit/components/dynamic-breadcrumb.test.tsx
git commit -m "test: add layout component tests (AppSidebar, SiteHeader, DynamicBreadcrumb)"
```

---

### Task 21: Theme Provider and Data Table

**Files:**

- Create: `apps/web/test/unit/components/theme-provider.test.tsx`
- Create: `apps/web/test/unit/components/data-table.test.tsx`
- Source: `apps/web/src/components/theme-provider.tsx`, `data-table.tsx`

- [ ] **Step 1: Read source files**

- [ ] **Step 2: Write ThemeProvider test**

Verify context provides theme to children. Use `renderHook` with `useTheme` hook.

- [ ] **Step 3: Write DataTable test**

DataTable is complex (dnd-kit, drawers, charts). Focus on: renders headers from column definitions, renders rows, empty state. Mock `@dnd-kit/*` if needed.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @workspace/web test test/unit/components/theme-provider.test.tsx test/unit/components/data-table.test.tsx`
Expected: ~4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/unit/components/theme-provider.test.tsx \
       apps/web/test/unit/components/data-table.test.tsx
git commit -m "test: add ThemeProvider and DataTable component tests"
```

---

### Task 22: Final Verification

- [ ] **Step 1: Run all tests to verify nothing is broken**

Run: `pnpm test`
Expected: All existing + new tests PASS

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `pnpm run lint`
Expected: No errors
