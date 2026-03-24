import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBillingHelpers,
  resolveSubscriptionDetails,
} from '../../src/billing.server';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { dbSelectMock, stripeInvoicesListMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  stripeInvoicesListMock: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@workspace/db/schema', () => ({
  member: 'member',
  organization: 'organization',
  subscription: 'subscription',
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    and: vi.fn((...args: Array<unknown>) => args),
    count: vi.fn(() => 'count'),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  };
});

vi.mock('stripe', () => {
  function StripeMock() {
    // @ts-expect-error -- mock constructor assigns invoices property.
    this.invoices = { list: stripeInvoicesListMock };
  }
  return { default: StripeMock };
});

/**
 * Creates a chainable mock for Drizzle ORM's query patterns.
 */
function mockDbChain(
  selectMock: ReturnType<typeof vi.fn>,
  result: Array<unknown>
) {
  const limitMock = vi.fn().mockResolvedValue(result);
  const whereResult = Object.assign(Promise.resolve(result), {
    limit: limitMock,
  });
  const whereMock = vi.fn().mockReturnValue(whereResult);
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  selectMock.mockReturnValue({ from: fromMock });
  return { fromMock, whereMock, limitMock };
}

const TEST_WORKSPACE_ID = 'ws_123';
const TEST_USER_ID = 'user_123';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('resolveSubscriptionDetails', () => {
  it('returns null when no matching subscription exists', () => {
    const result = resolveSubscriptionDetails([], 'starter');
    expect(result).toBeNull();
  });

  it('returns null when subscription plan does not match', () => {
    const result = resolveSubscriptionDetails(
      [{ plan: 'pro', status: 'active' }],
      'starter'
    );
    expect(result).toBeNull();
  });

  it('extracts details from matching active subscription', () => {
    const periodEnd = new Date('2026-04-12');
    const result = resolveSubscriptionDetails(
      [
        {
          plan: 'pro',
          status: 'active',
          periodEnd,
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      ],
      'pro'
    );
    expect(result).toEqual({
      status: 'active',
      periodEnd,
      cancelAtPeriodEnd: false,
      cancelAt: null,
    });
  });

  it('defaults missing optional fields to null/false', () => {
    const result = resolveSubscriptionDetails(
      [{ plan: 'pro', status: 'trialing' }],
      'pro'
    );
    expect(result).toEqual({
      status: 'trialing',
      periodEnd: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
    });
  });
});

describe('createBillingHelpers', () => {
  let helpers: ReturnType<typeof createBillingHelpers>;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockDb = { select: dbSelectMock } as never;
    helpers = createBillingHelpers(mockDb, 'sk_test_fake');
  });

  describe('resolveWorkspacePlanIdFromDb', () => {
    it('returns free when no subscriptions exist', async () => {
      mockDbChain(dbSelectMock, []);

      const planId =
        await helpers.resolveWorkspacePlanIdFromDb(TEST_WORKSPACE_ID);
      expect(planId).toBe('free');
    });

    it('returns pro for active pro subscription', async () => {
      mockDbChain(dbSelectMock, [{ plan: 'pro', status: 'active' }]);

      const planId =
        await helpers.resolveWorkspacePlanIdFromDb(TEST_WORKSPACE_ID);
      expect(planId).toBe('pro');
    });

    it('filters out rows with null status', async () => {
      mockDbChain(dbSelectMock, [{ plan: 'pro', status: null }]);

      const planId =
        await helpers.resolveWorkspacePlanIdFromDb(TEST_WORKSPACE_ID);
      expect(planId).toBe('free');
    });
  });

  describe('countOwnedWorkspaces', () => {
    it('returns the count from the database', async () => {
      mockDbChain(dbSelectMock, [{ count: 3 }]);

      const result = await helpers.countOwnedWorkspaces(TEST_USER_ID);
      expect(result).toBe(3);
    });
  });

  describe('getWorkspaceOwnerUserId', () => {
    it('returns null when no owner found', async () => {
      mockDbChain(dbSelectMock, []);

      const result = await helpers.getWorkspaceOwnerUserId('ws_123');
      expect(result).toBeNull();
    });

    it('returns owner userId', async () => {
      mockDbChain(dbSelectMock, [{ userId: 'owner_456' }]);

      const result = await helpers.getWorkspaceOwnerUserId('ws_123');
      expect(result).toBe('owner_456');
    });
  });

  describe('countWorkspaceMembers', () => {
    it('returns the count from the database', async () => {
      mockDbChain(dbSelectMock, [{ count: 5 }]);

      const result = await helpers.countWorkspaceMembers('ws_123');
      expect(result).toBe(5);
    });
  });

  describe('getInvoicesForWorkspace', () => {
    it('returns empty array when no stripeCustomerId', async () => {
      mockDbChain(dbSelectMock, [{ stripeCustomerId: null }]);

      const result = await helpers.getInvoicesForWorkspace(TEST_WORKSPACE_ID);

      expect(result).toEqual([]);
      expect(stripeInvoicesListMock).not.toHaveBeenCalled();
    });

    it('returns mapped invoices when workspace has stripeCustomerId', async () => {
      mockDbChain(dbSelectMock, [{ stripeCustomerId: 'cus_123' }]);
      stripeInvoicesListMock.mockResolvedValue({
        data: [
          {
            id: 'inv_1',
            created: 1700000000,
            status: 'paid',
            amount_paid: 2000,
            currency: 'usd',
            hosted_invoice_url: 'https://stripe.com/inv/1',
            invoice_pdf: 'https://stripe.com/inv/1.pdf',
          },
        ],
      });

      const result = await helpers.getInvoicesForWorkspace(TEST_WORKSPACE_ID);

      expect(stripeInvoicesListMock).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_123',
          limit: 100,
        })
      );
      expect(result).toEqual([
        {
          id: 'inv_1',
          date: 1700000000,
          status: 'paid',
          amount: 2000,
          currency: 'usd',
          invoiceUrl: 'https://stripe.com/inv/1',
          invoicePdf: 'https://stripe.com/inv/1.pdf',
        },
      ]);
    });
  });

  describe('composability — resolveWorkspacePlanIdFromDb + countOwnedWorkspaces', () => {
    it('resolveWorkspacePlanIdFromDb + countOwnedWorkspaces compose correctly', async () => {
      // First call: resolve plan (free).
      const where1 = vi.fn().mockResolvedValue([]);
      const from1 = vi.fn().mockReturnValue({ where: where1 });

      // Second call: count workspaces (1 — at free limit).
      const whereResult2 = Object.assign(Promise.resolve([{ count: 1 }]), {
        limit: vi.fn().mockResolvedValue([{ count: 1 }]),
      });
      const where2 = vi.fn().mockReturnValue(whereResult2);
      const from2 = vi.fn().mockReturnValue({ where: where2 });

      dbSelectMock
        .mockReturnValueOnce({ from: from1 })
        .mockReturnValueOnce({ from: from2 });

      const planId =
        await helpers.resolveWorkspacePlanIdFromDb(TEST_WORKSPACE_ID);
      expect(planId).toBe('free');

      const count = await helpers.countOwnedWorkspaces(TEST_USER_ID);
      expect(count).toBe(1);
    });
  });
});
