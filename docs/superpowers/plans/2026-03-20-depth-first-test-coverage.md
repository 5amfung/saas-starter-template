# Depth-First Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-risk test coverage gaps with ~86 new test cases across 9 test files.

**Architecture:** Unit tests for server functions and hooks mock at the module boundary using `vi.hoisted()` + `vi.mock()`. Integration tests render full component trees with `renderWithProviders()` and simulate user flows. All tests follow the existing patterns established in `apps/web/test/`.

**Tech Stack:** Vitest, Testing Library, `@workspace/test-utils` factories

**Spec:** `docs/superpowers/specs/2026-03-20-depth-first-test-coverage-design.md`

---

## Shared: `createServerFn` Mock

All server function tests reuse the same `createServerFn` mock. Copy this block from `apps/web/test/unit/workspace/workspace.functions.test.ts` lines 27-55 into each new server function test file.

```ts
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    let handler: Function;
    const builder = {
      inputValidator: () => builder,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      handler: (fn: Function) => {
        handler = fn;
        const callable = (...args: Array<unknown>) => handler(...args);
        callable.inputValidator = () => builder;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        callable.handler = (fn2: Function) => {
          handler = fn2;
          return callable;
        };
        return callable;
      },
    };
    const callable = (...args: Array<unknown>) => handler(...args);
    callable.inputValidator = () => builder;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    callable.handler = (fn: Function) => {
      handler = fn;
      return callable;
    };
    return callable;
  },
}));
```

---

## Chunk 1: Server Function Unit Tests

### Task 1: Admin Server Functions Test

**Files:**

- Create: `apps/web/test/unit/admin/admin.functions.test.ts`
- Reference: `apps/web/src/admin/admin.functions.ts`
- Reference: `apps/web/test/unit/workspace/workspace.functions.test.ts` (mock pattern)

- [ ] **Step 1: Write test file with all 9 test cases**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAdminDashboardMetrics,
  getSignupChartData,
  getMauChartData,
} from '@/admin/admin.functions';

const {
  requireAdminMock,
  queryDashboardMetricsMock,
  querySignupChartDataMock,
  queryMauChartDataMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  queryDashboardMetricsMock: vi.fn(),
  querySignupChartDataMock: vi.fn(),
  queryMauChartDataMock: vi.fn(),
}));

// <-- paste createServerFn mock here (see Shared section above)

vi.mock('@/admin/admin.server', () => ({
  requireAdmin: requireAdminMock,
  queryDashboardMetrics: queryDashboardMetricsMock,
  querySignupChartData: querySignupChartDataMock,
  queryMauChartData: queryMauChartDataMock,
}));

describe('getAdminDashboardMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when requireAdmin throws', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(
      getAdminDashboardMetrics({ data: { timezoneOffset: -300 } })
    ).rejects.toThrow('Forbidden');
  });

  it('passes timezoneOffset to queryDashboardMetrics', async () => {
    requireAdminMock.mockResolvedValueOnce({});
    queryDashboardMetricsMock.mockResolvedValueOnce({ users: 10 });
    await getAdminDashboardMetrics({ data: { timezoneOffset: -300 } });
    expect(queryDashboardMetricsMock).toHaveBeenCalledWith(-300);
  });

  it('returns the query result', async () => {
    const metrics = { users: 42, signups: 5 };
    requireAdminMock.mockResolvedValueOnce({});
    queryDashboardMetricsMock.mockResolvedValueOnce(metrics);
    const result = await getAdminDashboardMetrics({
      data: { timezoneOffset: 0 },
    });
    expect(result).toEqual(metrics);
  });
});

describe('getSignupChartData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when requireAdmin throws', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(
      getSignupChartData({ data: { days: 7, timezoneOffset: -300 } })
    ).rejects.toThrow('Forbidden');
  });

  it('passes days and timezoneOffset to querySignupChartData', async () => {
    requireAdminMock.mockResolvedValueOnce({});
    querySignupChartDataMock.mockResolvedValueOnce([]);
    await getSignupChartData({ data: { days: 30, timezoneOffset: -300 } });
    expect(querySignupChartDataMock).toHaveBeenCalledWith(30, -300);
  });

  it('returns the query result', async () => {
    const chartData = [{ date: '2026-03-01', count: 3 }];
    requireAdminMock.mockResolvedValueOnce({});
    querySignupChartDataMock.mockResolvedValueOnce(chartData);
    const result = await getSignupChartData({
      data: { days: 7, timezoneOffset: 0 },
    });
    expect(result).toEqual(chartData);
  });
});

describe('getMauChartData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when requireAdmin throws', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(
      getMauChartData({ data: { days: 7, timezoneOffset: -300 } })
    ).rejects.toThrow('Forbidden');
  });

  it('passes days and timezoneOffset to queryMauChartData', async () => {
    requireAdminMock.mockResolvedValueOnce({});
    queryMauChartDataMock.mockResolvedValueOnce([]);
    await getMauChartData({ data: { days: 30, timezoneOffset: -300 } });
    expect(queryMauChartDataMock).toHaveBeenCalledWith(30, -300);
  });

  it('returns the query result', async () => {
    const chartData = [{ date: '2026-03-01', mau: 100 }];
    requireAdminMock.mockResolvedValueOnce({});
    queryMauChartDataMock.mockResolvedValueOnce(chartData);
    const result = await getMauChartData({
      data: { days: 7, timezoneOffset: 0 },
    });
    expect(result).toEqual(chartData);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/admin/admin.functions.test.ts`
Expected: 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/admin/admin.functions.test.ts
git commit -m "test: add admin server function tests (9 cases)"
```

---

### Task 2: Billing Server Functions Test

**Files:**

- Create: `apps/web/test/unit/billing/billing.functions.test.ts`
- Reference: `apps/web/src/billing/billing.functions.ts`

- [ ] **Step 1: Write test file with all 18 test cases**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSessionResponse } from '@workspace/test-utils';
import {
  getInvoices,
  createCheckoutSession,
  createPortalSession,
  getUserBillingData,
  reactivateSubscription,
  checkPlanLimit,
} from '@/billing/billing.functions';

const {
  requireVerifiedSessionMock,
  getRequestHeadersMock,
  createCheckoutForPlanMock,
  createUserBillingPortalMock,
  getBillingDataMock,
  reactivateUserSubscriptionMock,
  checkUserPlanLimitMock,
  getInvoicesForUserMock,
} = vi.hoisted(() => ({
  requireVerifiedSessionMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
  createCheckoutForPlanMock: vi.fn(),
  createUserBillingPortalMock: vi.fn(),
  getBillingDataMock: vi.fn(),
  reactivateUserSubscriptionMock: vi.fn(),
  checkUserPlanLimitMock: vi.fn(),
  getInvoicesForUserMock: vi.fn(),
}));

// <-- paste createServerFn mock here (see Shared section above)

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/billing/billing.server', () => ({
  requireVerifiedSession: requireVerifiedSessionMock,
  createCheckoutForPlan: createCheckoutForPlanMock,
  createUserBillingPortal: createUserBillingPortalMock,
  getBillingData: getBillingDataMock,
  reactivateUserSubscription: reactivateUserSubscriptionMock,
  checkUserPlanLimit: checkUserPlanLimitMock,
}));

vi.mock('@/init', () => ({
  auth: { billing: { getInvoicesForUser: getInvoicesForUserMock } },
}));

vi.mock('@workspace/auth/plans', () => ({
  PLANS: [{ id: 'starter' }, { id: 'pro' }],
}));

describe('getInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getInvoices()).rejects.toThrow('Unauthorized');
  });

  it('calls getInvoicesForUser with user ID', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getInvoicesForUserMock.mockResolvedValueOnce([]);
    await getInvoices();
    expect(getInvoicesForUserMock).toHaveBeenCalledWith(session.user.id);
  });

  it('returns the invoice list', async () => {
    const invoices = [{ id: 'inv-1', amount: 4900 }];
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    getInvoicesForUserMock.mockResolvedValueOnce(invoices);
    const result = await getInvoices();
    expect(result).toEqual(invoices);
  });
});

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(
      createCheckoutSession({ data: { planId: 'pro', annual: false } })
    ).rejects.toThrow('Unauthorized');
  });

  it('passes planId, annual, and headers to createCheckoutForPlan', async () => {
    const headers = new Headers({ 'x-test': '1' });
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    getRequestHeadersMock.mockReturnValue(headers);
    createCheckoutForPlanMock.mockResolvedValueOnce({
      url: 'https://stripe.com',
    });
    await createCheckoutSession({ data: { planId: 'pro', annual: true } });
    expect(createCheckoutForPlanMock).toHaveBeenCalledWith(
      headers,
      'pro',
      true
    );
  });

  it('returns the checkout result', async () => {
    const checkout = { url: 'https://stripe.com/checkout' };
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    createCheckoutForPlanMock.mockResolvedValueOnce(checkout);
    const result = await createCheckoutSession({
      data: { planId: 'starter', annual: false },
    });
    expect(result).toEqual(checkout);
  });
});

describe('createPortalSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(createPortalSession()).rejects.toThrow('Unauthorized');
  });

  it('calls createUserBillingPortal with headers', async () => {
    const headers = new Headers();
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    getRequestHeadersMock.mockReturnValue(headers);
    createUserBillingPortalMock.mockResolvedValueOnce({
      url: 'https://portal.stripe.com',
    });
    await createPortalSession();
    expect(createUserBillingPortalMock).toHaveBeenCalledWith(headers);
  });

  it('returns the portal URL', async () => {
    const portal = { url: 'https://portal.stripe.com' };
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    createUserBillingPortalMock.mockResolvedValueOnce(portal);
    const result = await createPortalSession();
    expect(result).toEqual(portal);
  });
});

describe('getUserBillingData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getUserBillingData()).rejects.toThrow('Unauthorized');
  });

  it('passes headers and user ID to getBillingData', async () => {
    const session = createMockSessionResponse();
    const headers = new Headers();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getRequestHeadersMock.mockReturnValue(headers);
    getBillingDataMock.mockResolvedValueOnce({});
    await getUserBillingData();
    expect(getBillingDataMock).toHaveBeenCalledWith(headers, session.user.id);
  });

  it('returns billing data', async () => {
    const billingData = {
      plan: { id: 'free', name: 'Free' },
      subscription: null,
    };
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    getBillingDataMock.mockResolvedValueOnce(billingData);
    const result = await getUserBillingData();
    expect(result).toEqual(billingData);
  });
});

describe('reactivateSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(reactivateSubscription()).rejects.toThrow('Unauthorized');
  });

  it('calls reactivateUserSubscription with headers and user ID', async () => {
    const session = createMockSessionResponse();
    const headers = new Headers();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getRequestHeadersMock.mockReturnValue(headers);
    reactivateUserSubscriptionMock.mockResolvedValueOnce({});
    await reactivateSubscription();
    expect(reactivateUserSubscriptionMock).toHaveBeenCalledWith(
      headers,
      session.user.id
    );
  });

  it('returns the reactivation result', async () => {
    const result = { status: 'active' };
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    reactivateUserSubscriptionMock.mockResolvedValueOnce(result);
    const actual = await reactivateSubscription();
    expect(actual).toEqual(result);
  });
});

describe('checkPlanLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(
      checkPlanLimit({ data: { feature: 'workspace' } })
    ).rejects.toThrow('Unauthorized');
  });

  it('passes headers, user ID, feature, and workspaceId to checkUserPlanLimit', async () => {
    const session = createMockSessionResponse();
    const headers = new Headers();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getRequestHeadersMock.mockReturnValue(headers);
    checkUserPlanLimitMock.mockResolvedValueOnce({ allowed: true });
    await checkPlanLimit({ data: { feature: 'member', workspaceId: 'ws-1' } });
    expect(checkUserPlanLimitMock).toHaveBeenCalledWith(
      headers,
      session.user.id,
      'member',
      'ws-1'
    );
  });

  it('returns the plan limit check result', async () => {
    const limitResult = { allowed: false, limit: 1, current: 1 };
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    checkUserPlanLimitMock.mockResolvedValueOnce(limitResult);
    const result = await checkPlanLimit({ data: { feature: 'workspace' } });
    expect(result).toEqual(limitResult);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/billing/billing.functions.test.ts`
Expected: 18 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/billing/billing.functions.test.ts
git commit -m "test: add billing server function tests (18 cases)"
```

---

### Task 3: Notification Preferences Server Functions Test

**Files:**

- Create: `apps/web/test/unit/account/notification-preferences.functions.test.ts`
- Reference: `apps/web/src/account/notification-preferences.functions.ts`

- [ ] **Step 1: Write test file with all 6 test cases**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSessionResponse } from '@workspace/test-utils';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/account/notification-preferences.functions';

const {
  requireVerifiedSessionMock,
  getNotificationPreferencesForUserMock,
  upsertNotificationPreferencesForUserMock,
} = vi.hoisted(() => ({
  requireVerifiedSessionMock: vi.fn(),
  getNotificationPreferencesForUserMock: vi.fn(),
  upsertNotificationPreferencesForUserMock: vi.fn(),
}));

// <-- paste createServerFn mock here (see Shared section above)

vi.mock('@/account/notification-preferences.server', () => ({
  requireVerifiedSession: requireVerifiedSessionMock,
  getNotificationPreferencesForUser: getNotificationPreferencesForUserMock,
  upsertNotificationPreferencesForUser:
    upsertNotificationPreferencesForUserMock,
}));

describe('getNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getNotificationPreferences()).rejects.toThrow('Unauthorized');
  });

  it('calls getNotificationPreferencesForUser with user ID', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getNotificationPreferencesForUserMock.mockResolvedValueOnce({
      emailUpdates: true,
      marketingEmails: false,
    });
    await getNotificationPreferences();
    expect(getNotificationPreferencesForUserMock).toHaveBeenCalledWith(
      session.user.id
    );
  });

  it('returns the preferences', async () => {
    const prefs = { emailUpdates: true, marketingEmails: true };
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    getNotificationPreferencesForUserMock.mockResolvedValueOnce(prefs);
    const result = await getNotificationPreferences();
    expect(result).toEqual(prefs);
  });
});

describe('updateNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(
      updateNotificationPreferences({ data: { marketingEmails: true } })
    ).rejects.toThrow('Unauthorized');
  });

  it('passes user ID and data to upsertNotificationPreferencesForUser', async () => {
    const session = createMockSessionResponse();
    const input = { marketingEmails: true };
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    upsertNotificationPreferencesForUserMock.mockResolvedValueOnce({});
    await updateNotificationPreferences({ data: input });
    expect(upsertNotificationPreferencesForUserMock).toHaveBeenCalledWith(
      session.user.id,
      input
    );
  });

  it('returns the upsert result', async () => {
    const result = { emailUpdates: true, marketingEmails: true };
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    upsertNotificationPreferencesForUserMock.mockResolvedValueOnce(result);
    const actual = await updateNotificationPreferences({
      data: { marketingEmails: true },
    });
    expect(actual).toEqual(result);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/account/notification-preferences.functions.test.ts`
Expected: 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/account/notification-preferences.functions.test.ts
git commit -m "test: add notification preferences server function tests (6 cases)"
```

---

### Task 4: Utility Test — `withPendingId`

**Files:**

- Create: `apps/web/test/unit/workspace/workspace-members.types.test.ts`
- Reference: `apps/web/src/workspace/workspace-members.types.ts`

- [ ] **Step 1: Write test file with 3 test cases**

```ts
import { describe, expect, it, vi } from 'vitest';
import { withPendingId } from '@/workspace/workspace-members.types';

describe('withPendingId', () => {
  it('sets pending ID before action runs', async () => {
    const setter = vi.fn();
    const actionOrder: Array<string> = [];

    setter.mockImplementation((value: string | null) => {
      if (value !== null) actionOrder.push('set');
    });

    await withPendingId(setter, 'id-1', async () => {
      actionOrder.push('action');
    });

    expect(actionOrder).toEqual(['set', 'action']);
    expect(setter).toHaveBeenCalledWith('id-1');
  });

  it('clears pending ID after successful action', async () => {
    const setter = vi.fn();
    await withPendingId(setter, 'id-1', async () => {});
    expect(setter).toHaveBeenCalledTimes(2);
    expect(setter).toHaveBeenLastCalledWith(null);
  });

  it('clears pending ID even when action throws', async () => {
    const setter = vi.fn();
    const error = new Error('boom');

    await expect(
      withPendingId(setter, 'id-1', async () => {
        throw error;
      })
    ).rejects.toThrow('boom');

    expect(setter).toHaveBeenCalledTimes(2);
    expect(setter).toHaveBeenLastCalledWith(null);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/workspace/workspace-members.types.test.ts`
Expected: 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/workspace/workspace-members.types.test.ts
git commit -m "test: add withPendingId utility tests (3 cases)"
```

---

## Chunk 2: Workspace Hook Tests

### Task 5: `useInvitationsTable` Hook Test

**Files:**

- Create: `apps/web/test/unit/workspace/use-invitations-table.test.ts`
- Reference: `apps/web/src/workspace/use-invitations-table.ts`
- Reference: `apps/web/test/unit/hooks/use-upgrade-prompt.test.ts` (hook test pattern)

- [ ] **Step 1: Write test file with all test cases**

```ts
// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHookWrapper } from '@workspace/test-utils';
import { useInvitationsTable } from '@/workspace/use-invitations-table';

const {
  listInvitationsMock,
  inviteMemberMock,
  cancelInvitationMock,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  listInvitationsMock: vi.fn(),
  inviteMemberMock: vi.fn(),
  cancelInvitationMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      listInvitations: listInvitationsMock,
      inviteMember: inviteMemberMock,
      cancelInvitation: cancelInvitationMock,
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

const WORKSPACE_ID = 'ws-1';

const mockInvitations = [
  {
    id: 'inv-1',
    email: 'a@example.com',
    role: 'member',
    status: 'pending',
    createdAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'inv-2',
    email: 'b@example.com',
    role: 'admin',
    status: 'pending',
    createdAt: '2026-03-05T00:00:00Z',
  },
  {
    id: 'inv-3',
    email: 'c@example.com',
    role: 'member',
    status: 'accepted',
    createdAt: '2026-03-02T00:00:00Z',
  },
];

function setupQuery(data = mockInvitations) {
  listInvitationsMock.mockResolvedValue({ data, error: null });
}

describe('useInvitationsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query & data', () => {
    it('filters to pending invitations only', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      const emails = result.current.data.map((row) => row.email);
      expect(emails).not.toContain('c@example.com');
    });

    it('maps to WorkspaceInvitationRow shape', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBeGreaterThan(0);
      });

      const row = result.current.data[0];
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('email');
      expect(row).toHaveProperty('role');
      expect(row).toHaveProperty('invitedAt');
    });

    it('returns isLoading true while query is pending', () => {
      listInvitationsMock.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('pagination', () => {
    it('defaults to page 1', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });
      expect(result.current.page).toBe(1);
    });

    it('resets page to 1 when pageSize changes', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.onPageChange(2);
      });
      expect(result.current.page).toBe(2);

      act(() => {
        result.current.onPageSizeChange(25);
      });
      expect(result.current.page).toBe(1);
    });

    it('resets page to 1 when sorting changes', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.onPageChange(2);
      });
      act(() => {
        result.current.onSortingChange([{ id: 'email', desc: false }]);
      });
      expect(result.current.page).toBe(1);
    });

    it('calculates totalPages correctly (minimum 1)', async () => {
      setupQuery([]);
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.totalPages).toBe(1);
    });
  });

  describe('sorting', () => {
    it('sorts by invitedAt descending', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      act(() => {
        result.current.onSortingChange([{ id: 'invitedAt', desc: true }]);
      });

      const dates = result.current.data.map((row) => row.invitedAt);
      expect(new Date(dates[0]).getTime()).toBeGreaterThanOrEqual(
        new Date(dates[1]).getTime()
      );
    });

    it('sorts by email ascending by default sort', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      act(() => {
        result.current.onSortingChange([{ id: 'email', desc: false }]);
      });

      const emails = result.current.data.map((row) => row.email);
      expect(emails).toEqual([...emails].sort());
    });

    it('does not sort when sorting state is empty', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      // Sorting is empty by default — data should be in original order.
      const emailsBefore = result.current.data.map((row) => row.email);

      act(() => {
        result.current.onSortingChange([]);
      });

      const emailsAfter = result.current.data.map((row) => row.email);
      expect(emailsAfter).toEqual(emailsBefore);
    });
  });

  describe('submitInvite', () => {
    it('shows error toast when email is empty', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });
      expect(mockToastError).toHaveBeenCalledWith('Email address is required.');
    });

    it('shows error toast for invalid email format', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.inviteDialog.setDraft({
          email: 'not-an-email',
          role: 'member',
        });
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });
      expect(mockToastError).toHaveBeenCalledWith(
        'Please enter a valid email address.'
      );
    });

    it('shows error toast when role is not in DEFAULT_INVITE_ROLES', async () => {
      setupQuery();
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.inviteDialog.setDraft({
          email: 'valid@example.com',
          role: 'superadmin' as any,
        });
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });
      expect(mockToastError).toHaveBeenCalledWith('Invalid role selected.');
    });

    it('calls inviteMember with lowercase trimmed email', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.inviteDialog.setDraft({
          email: '  Test@Example.COM  ',
          role: 'member',
        });
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });

      expect(inviteMemberMock).toHaveBeenCalledWith({
        email: 'test@example.com',
        role: 'member',
        organizationId: WORKSPACE_ID,
      });
    });

    it('on success: shows toast, closes dialog, resets draft', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.inviteDialog.onOpenChange(true);
        result.current.inviteDialog.setDraft({
          email: 'new@example.com',
          role: 'admin',
        });
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Invitation sent.');
      expect(result.current.inviteDialog.open).toBe(false);
      expect(result.current.inviteDialog.draft.email).toBe('');
    });

    it('on mutation error: shows error toast', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({
        error: { message: 'Already invited' },
      });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.inviteDialog.setDraft({
          email: 'dup@example.com',
          role: 'member',
        });
      });

      await act(async () => {
        await result.current.inviteDialog.onSubmit();
      });
      expect(mockToastError).toHaveBeenCalledWith('Already invited');
    });
  });

  describe('removeInvitation', () => {
    it('calls cancelInvitation and shows success toast', async () => {
      setupQuery();
      cancelInvitationMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        await result.current.onRemoveInvitation('inv-1');
      });
      expect(cancelInvitationMock).toHaveBeenCalledWith({
        invitationId: 'inv-1',
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Invitation removed.');
    });

    it('shows error toast on failure', async () => {
      setupQuery();
      cancelInvitationMock.mockResolvedValueOnce({
        error: { message: 'Not found' },
      });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        try {
          await result.current.onRemoveInvitation('inv-99');
        } catch {}
      });
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('resendInvitation', () => {
    it('calls inviteMember with resend: true', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        await result.current.onResendInvitation({
          id: 'inv-1',
          email: 'a@example.com',
          role: 'member',
        });
      });

      expect(inviteMemberMock).toHaveBeenCalledWith({
        email: 'a@example.com',
        role: 'member',
        organizationId: WORKSPACE_ID,
        resend: true,
      });
    });

    it('falls back invalid role to member', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        await result.current.onResendInvitation({
          id: 'inv-1',
          email: 'a@example.com',
          role: 'invalid-role',
        });
      });

      expect(inviteMemberMock).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'member' })
      );
    });

    it('shows success toast on resend', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        await result.current.onResendInvitation({
          id: 'inv-1',
          email: 'a@example.com',
          role: 'member',
        });
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Invitation resent.');
    });

    it('shows error toast on resend failure', async () => {
      setupQuery();
      inviteMemberMock.mockResolvedValueOnce({
        error: { message: 'Rate limited' },
      });
      const { result } = renderHook(() => useInvitationsTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      await act(async () => {
        try {
          await result.current.onResendInvitation({
            id: 'inv-1',
            email: 'a@example.com',
            role: 'member',
          });
        } catch {}
      });

      expect(mockToastError).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/workspace/use-invitations-table.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/workspace/use-invitations-table.test.ts
git commit -m "test: add useInvitationsTable hook tests"
```

---

### Task 6: `useMembersTable` Hook Test

**Files:**

- Create: `apps/web/test/unit/workspace/use-members-table.test.ts`
- Reference: `apps/web/src/workspace/use-members-table.ts`

- [ ] **Step 1: Write test file with all test cases**

```ts
// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHookWrapper,
  createMockSessionResponse,
} from '@workspace/test-utils';
import { useMembersTable } from '@/workspace/use-members-table';

const {
  listMembersMock,
  getActiveMemberRoleMock,
  leaveMock,
  removeMemberMock,
  navigateMock,
  mockToastSuccess,
  mockToastError,
  useSessionQueryMock,
} = vi.hoisted(() => ({
  listMembersMock: vi.fn(),
  getActiveMemberRoleMock: vi.fn(),
  leaveMock: vi.fn(),
  removeMemberMock: vi.fn(),
  navigateMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  useSessionQueryMock: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    organization: {
      listMembers: listMembersMock,
      getActiveMemberRole: getActiveMemberRoleMock,
      leave: leaveMock,
      removeMember: removeMemberMock,
    },
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
}));

vi.mock('@/hooks/use-session-query', () => ({
  useSessionQuery: useSessionQueryMock,
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

const WORKSPACE_ID = 'ws-1';
const mockSession = createMockSessionResponse();

const mockMembersResponse = {
  data: {
    members: [
      {
        id: 'mem-1',
        userId: 'user-1',
        role: 'owner',
        user: { email: 'owner@example.com' },
      },
      {
        id: 'mem-2',
        userId: 'user-2',
        role: 'member',
        user: { email: 'member@example.com' },
      },
    ],
    total: 2,
  },
  error: null,
};

function setupDefaults() {
  useSessionQueryMock.mockReturnValue({ data: mockSession });
  listMembersMock.mockResolvedValue(mockMembersResponse);
  getActiveMemberRoleMock.mockResolvedValue({
    data: { role: 'owner' },
    error: null,
  });
}

describe('useMembersTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  describe('query & data', () => {
    it('fetches members and maps to WorkspaceMemberRow shape', async () => {
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data.length).toBe(2);
      });

      expect(result.current.data[0]).toEqual({
        id: 'mem-1',
        userId: 'user-1',
        role: 'owner',
        email: 'owner@example.com',
      });
    });

    it('returns currentUserId from session', async () => {
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      expect(result.current.currentUserId).toBe(mockSession.user.id);
    });

    it('fetches current user role', async () => {
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.currentUserRole).toBe('owner');
      });
    });
  });

  describe('pagination', () => {
    it('resets page to 1 when pageSize changes', async () => {
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.onPageChange(2);
      });
      expect(result.current.page).toBe(2);

      act(() => {
        result.current.onPageSizeChange(25);
      });
      expect(result.current.page).toBe(1);
    });

    it('resets page to 1 when sorting changes', async () => {
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      act(() => {
        result.current.onPageChange(3);
      });
      act(() => {
        result.current.onSortingChange([{ id: 'email', desc: false }]);
      });
      expect(result.current.page).toBe(1);
    });
  });

  describe('leave workspace', () => {
    it('calls organization.leave with organizationId', async () => {
      leaveMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        await result.current.onLeave();
      });

      expect(leaveMock).toHaveBeenCalledWith({ organizationId: WORKSPACE_ID });
    });

    it('on success: shows toast and navigates to /ws', async () => {
      leaveMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        await result.current.onLeave();
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'You have left the workspace.'
      );
      expect(navigateMock).toHaveBeenCalledWith({ to: '/ws' });
    });

    it('on error: shows error toast', async () => {
      leaveMock.mockResolvedValueOnce({ error: { message: 'Cannot leave' } });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        try {
          await result.current.onLeave();
        } catch {}
      });

      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('remove member', () => {
    it('calls removeMember with memberIdOrEmail and organizationId', async () => {
      removeMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        await result.current.onRemoveMember('mem-2');
      });

      expect(removeMemberMock).toHaveBeenCalledWith({
        memberIdOrEmail: 'mem-2',
        organizationId: WORKSPACE_ID,
      });
    });

    it('on success: shows toast and refetches', async () => {
      removeMemberMock.mockResolvedValueOnce({ error: null });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        await result.current.onRemoveMember('mem-2');
      });

      expect(mockToastSuccess).toHaveBeenCalledWith('Membership removed.');
    });

    it('on error: shows error toast', async () => {
      removeMemberMock.mockResolvedValueOnce({
        error: { message: 'Forbidden' },
      });
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      await act(async () => {
        try {
          await result.current.onRemoveMember('mem-2');
        } catch {}
      });

      expect(mockToastError).toHaveBeenCalled();
    });

    it('tracks removingMemberId during mutation', async () => {
      // Create a deferred promise so we can inspect state mid-mutation.
      let resolve: () => void;
      removeMemberMock.mockReturnValueOnce(
        new Promise<{ error: null }>((r) => {
          resolve = () => r({ error: null });
        })
      );
      const { result } = renderHook(() => useMembersTable(WORKSPACE_ID), {
        wrapper: createHookWrapper(),
      });

      expect(result.current.removingMemberId).toBeNull();

      // Start the mutation without awaiting it.
      let mutationPromise: Promise<void>;
      act(() => {
        mutationPromise = result.current.onRemoveMember('mem-2');
      });

      // Mid-mutation: removingMemberId should be set.
      await waitFor(() => {
        expect(result.current.removingMemberId).toBe('mem-2');
      });

      // Resolve the mutation.
      await act(async () => {
        resolve!();
        await mutationPromise;
      });

      // After mutation: removingMemberId should be cleared.
      expect(result.current.removingMemberId).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/workspace/use-members-table.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/unit/workspace/use-members-table.test.ts
git commit -m "test: add useMembersTable hook tests"
```

---

## Chunk 3: Integration Tests

### Task 7: Workspace Invite Flow Integration Test

**Files:**

- Create: `apps/web/test/integration/components/workspace/workspace-invite-flow.integration.test.tsx`
- Reference: `apps/web/src/components/workspace/workspace-invite-dialog.tsx`
- Reference: `apps/web/src/components/workspace/workspace-invitations-table.tsx`
- Reference: `apps/web/test/integration/components/auth/signin-form.integration.test.tsx` (pattern)

This test renders `WorkspaceInviteDialog` with controlled props. The spec envisioned full-flow tests (validation errors, API errors, remove/resend), but validation and API logic live entirely in `useInvitationsTable` (tested in Task 5). The dialog is a pure controlled component — it receives data and callbacks as props. This integration test validates the component's UI behavior: rendering, user input, and callback invocations. The hook unit tests provide the deeper flow coverage.

- [ ] **Step 1: Read the `WorkspaceInvitationsTable` component to understand its props interface**

Read: `apps/web/src/components/workspace/workspace-invitations-table.tsx`

This is needed to understand the exact props and ARIA labels for assertions.

- [ ] **Step 2: Write integration test file**

The test renders `WorkspaceInviteDialog` directly with controlled props (since the dialog is a standalone component with a well-defined interface). Mock callbacks verify that user interactions trigger the expected handlers.

```tsx
// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@workspace/test-utils';
import { WorkspaceInviteDialog } from '@/components/workspace/workspace-invite-dialog';
import type { InviteRole } from '@/workspace/workspace-members.types';

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  email: '',
  role: 'member' as InviteRole,
  roles: ['member', 'admin'] as const,
  isPending: false,
  onEmailChange: vi.fn(),
  onRoleChange: vi.fn(),
  onSubmit: vi.fn(),
};

describe('WorkspaceInviteDialog integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with email input and role select', () => {
    renderWithProviders(<WorkspaceInviteDialog {...defaultProps} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
  });

  it('calls onEmailChange when user types email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceInviteDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');

    expect(defaultProps.onEmailChange).toHaveBeenCalled();
  });

  it('calls onSubmit when Send Invitation is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceInviteDialog {...defaultProps} email="test@example.com" />
    );

    await user.click(screen.getByRole('button', { name: /send invitation/i }));

    expect(defaultProps.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when isPending is true', () => {
    renderWithProviders(
      <WorkspaceInviteDialog {...defaultProps} isPending={true} />
    );

    expect(
      screen.getByRole('button', { name: /send invitation/i })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('calls onOpenChange when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceInviteDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/integration/components/workspace/workspace-invite-flow.integration.test.tsx`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/integration/components/workspace/workspace-invite-flow.integration.test.tsx
git commit -m "test: add workspace invite dialog integration tests"
```

---

### Task 8: Billing Upgrade Flow Integration Test

**Files:**

- Create: `apps/web/test/integration/components/billing/billing-upgrade-flow.integration.test.tsx`
- Reference: `apps/web/src/components/billing/billing-page.tsx`
- Reference: `apps/web/src/components/billing/billing-plan-cards.tsx`

- [ ] **Step 1: Write integration test file**

```tsx
// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@workspace/test-utils';
import { BillingPage } from '@/components/billing/billing-page';

const {
  getUserBillingDataMock,
  getInvoicesMock,
  createCheckoutSessionMock,
  createPortalSessionMock,
  reactivateSubscriptionMock,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  getUserBillingDataMock: vi.fn(),
  getInvoicesMock: vi.fn(),
  createCheckoutSessionMock: vi.fn(),
  createPortalSessionMock: vi.fn(),
  reactivateSubscriptionMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/billing/billing.functions', () => ({
  getUserBillingData: getUserBillingDataMock,
  getInvoices: getInvoicesMock,
  createCheckoutSession: createCheckoutSessionMock,
  createPortalSession: createPortalSessionMock,
  reactivateSubscription: reactivateSubscriptionMock,
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock('@/hooks/use-session-query', () => ({
  SESSION_QUERY_KEY: ['session'],
}));

const freePlan = {
  id: 'free',
  name: 'Free',
  tier: 0,
  pricing: null,
  limits: { maxWorkspaces: 1, maxMembersPerWorkspace: 1 },
  features: ['1 workspace'],
  annualBonusFeatures: [],
};

const proPlan = {
  id: 'pro',
  name: 'Pro',
  tier: 1,
  pricing: { monthly: { price: 4900 }, annual: { price: 49000 } },
  limits: { maxWorkspaces: 5, maxMembersPerWorkspace: 5 },
  features: ['Up to 5 workspaces'],
  annualBonusFeatures: ['2 months free'],
};

vi.mock('@workspace/auth/plans', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@workspace/auth/plans')>();
  return {
    ...original,
    getUpgradePlans: vi.fn().mockReturnValue([proPlan]),
  };
});

function setupBillingData(overrides = {}) {
  getUserBillingDataMock.mockResolvedValue({
    plan: freePlan,
    subscription: null,
    ...overrides,
  });
  getInvoicesMock.mockResolvedValue([]);
}

describe('BillingPage integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on window.location to prevent navigation errors in jsdom.
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: '',
    } as Location);
  });

  it('renders current plan details after data loads', async () => {
    setupBillingData();
    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    expect(screen.getByText(/current plan/i)).toBeInTheDocument();
  });

  it('calls createCheckoutSession when upgrade is clicked', async () => {
    const user = userEvent.setup();
    setupBillingData();
    createCheckoutSessionMock.mockResolvedValueOnce({
      url: 'https://stripe.com/checkout',
    });
    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /upgrade to pro/i }));

    await waitFor(() => {
      expect(createCheckoutSessionMock).toHaveBeenCalledWith({
        data: { planId: 'pro', annual: false },
      });
    });
  });

  it('shows error toast when checkout fails', async () => {
    const user = userEvent.setup();
    setupBillingData();
    createCheckoutSessionMock.mockRejectedValueOnce(
      new Error('Checkout failed')
    );
    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /upgrade to pro/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Checkout failed');
    });
  });

  it('calls createPortalSession when manage is clicked on paid plan', async () => {
    const user = userEvent.setup();
    getUserBillingDataMock.mockResolvedValue({
      plan: proPlan,
      subscription: { periodEnd: new Date('2026-04-20').toISOString() },
    });
    getInvoicesMock.mockResolvedValue([]);
    // No upgrade plans for the highest tier.
    const { getUpgradePlans } = await import('@workspace/auth/plans');
    (getUpgradePlans as ReturnType<typeof vi.fn>).mockReturnValue([]);
    createPortalSessionMock.mockResolvedValueOnce({
      url: 'https://portal.stripe.com',
    });

    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /manage subscription/i })
    );

    await waitFor(() => {
      expect(createPortalSessionMock).toHaveBeenCalledTimes(1);
    });
  });

  it('reactivates canceled subscription on Keep subscription click', async () => {
    const user = userEvent.setup();
    getUserBillingDataMock.mockResolvedValue({
      plan: proPlan,
      subscription: {
        periodEnd: new Date('2026-04-20').toISOString(),
        cancelAtPeriodEnd: true,
      },
    });
    getInvoicesMock.mockResolvedValue([]);
    reactivateSubscriptionMock.mockResolvedValueOnce({});

    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/will downgrade/i)).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /keep subscription/i })
    );

    await waitFor(() => {
      expect(reactivateSubscriptionMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Subscription reactivated.'
      );
    });
  });

  it('shows error toast when reactivation fails', async () => {
    const user = userEvent.setup();
    getUserBillingDataMock.mockResolvedValue({
      plan: proPlan,
      subscription: {
        periodEnd: new Date('2026-04-20').toISOString(),
        cancelAtPeriodEnd: true,
      },
    });
    getInvoicesMock.mockResolvedValue([]);
    reactivateSubscriptionMock.mockRejectedValueOnce(
      new Error('Reactivation failed')
    );

    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/will downgrade/i)).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /keep subscription/i })
    );

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Reactivation failed');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/integration/components/billing/billing-upgrade-flow.integration.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/integration/components/billing/billing-upgrade-flow.integration.test.tsx
git commit -m "test: add billing upgrade flow integration tests"
```

---

### Task 9: Workspace Members Flow Integration Test

**Files:**

- Create: `apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx`
- Reference: `apps/web/src/components/workspace/workspace-members-table.tsx`

- [ ] **Step 1: Write integration test file**

```tsx
// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockMemberRow,
  renderWithProviders,
} from '@workspace/test-utils';
import { WorkspaceMembersTable } from '@/components/workspace/workspace-members-table';

const defaultProps = {
  data: [
    createMockMemberRow({
      id: 'mem-1',
      userId: 'user-1',
      email: 'owner@test.com',
      role: 'owner',
    }),
    createMockMemberRow({
      id: 'mem-2',
      userId: 'user-2',
      email: 'member@test.com',
      role: 'member',
    }),
  ],
  total: 2,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  sorting: [],
  isLoading: false,
  removingMemberId: null,
  leavingWorkspace: false,
  currentUserId: 'user-1',
  currentUserRole: 'owner',
  onSortingChange: vi.fn(),
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
  onRemoveMember: vi.fn(),
  onLeave: vi.fn(),
};

describe('WorkspaceMembersTable integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders member list from data', () => {
    renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);
    expect(screen.getByText('owner@test.com')).toBeInTheDocument();
    expect(screen.getByText('member@test.com')).toBeInTheDocument();
    expect(screen.getByText('2 members')).toBeInTheDocument();
  });

  it('shows Remove option for non-owner members when user is owner', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    // Second row (member@test.com) should have Remove.
    await user.click(actionButtons[1]);

    const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
    expect(removeItem).not.toBeDisabled();
  });

  it('calls onRemoveMember when Remove is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    await user.click(actionButtons[1]);

    const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
    await user.click(removeItem);

    expect(defaultProps.onRemoveMember).toHaveBeenCalledWith('mem-2');
  });

  it('shows Leave option for current user row', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    // First row (user-1 = currentUserId) should show Leave.
    await user.click(actionButtons[0]);

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    expect(leaveItem).toBeInTheDocument();
  });

  it('calls onLeave when Leave is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceMembersTable {...defaultProps} />);

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    await user.click(actionButtons[0]);

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    await user.click(leaveItem);

    expect(defaultProps.onLeave).toHaveBeenCalledTimes(1);
  });

  it('shows skeleton rows when isLoading is true', () => {
    renderWithProviders(
      <WorkspaceMembersTable {...defaultProps} data={[]} isLoading={true} />
    );

    expect(screen.queryByText('owner@test.com')).not.toBeInTheDocument();
    // Skeleton rows should be present (no "No team members found" message).
    expect(
      screen.queryByText(/no team members found/i)
    ).not.toBeInTheDocument();
  });

  it('disables remove button when removingMemberId matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceMembersTable {...defaultProps} removingMemberId="mem-2" />
    );

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    await user.click(actionButtons[1]);

    const removeItem = await screen.findByRole('menuitem', { name: /remove/i });
    expect(removeItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables leave option when leavingWorkspace is true', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceMembersTable {...defaultProps} leavingWorkspace={true} />
    );

    const actionButtons = screen.getAllByRole('button', {
      name: /row actions/i,
    });
    await user.click(actionButtons[0]);

    const leaveItem = await screen.findByRole('menuitem', { name: /leave/i });
    expect(leaveItem).toHaveAttribute('aria-disabled', 'true');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/integration/components/workspace/workspace-members-flow.integration.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/integration/components/workspace/workspace-members-flow.integration.test.tsx
git commit -m "test: add workspace members flow integration tests"
```

---

## Final Verification

### Task 10: Run All Tests

- [ ] **Step 1: Run the full test suite to ensure no regressions**

Run: `pnpm --filter @workspace/web test`
Expected: All tests PASS (existing + new)

- [ ] **Step 2: Run typecheck to ensure test files have no type errors**

Run: `pnpm run typecheck`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `pnpm run lint`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve any test/lint/type issues from new test files"
```
