import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkUserPlanLimit,
  createCheckoutForPlan,
  createUserBillingPortal,
  getBillingData,
  getInvoicesForUser,
  getUserPlanContext,
  reactivateUserSubscription,
  resolveSubscriptionDetails,
} from '@/billing/billing.server';
import { mockDbChain } from '@/test/mocks/db';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  listActiveSubscriptionsMock,
  createBillingPortalMock,
  upgradeSubscriptionMock,
  restoreSubscriptionMock,
  getSessionMock,
  dbSelectMock,
  stripeInvoicesListMock,
} = vi.hoisted(() => ({
  listActiveSubscriptionsMock: vi.fn(),
  createBillingPortalMock: vi.fn(),
  upgradeSubscriptionMock: vi.fn(),
  restoreSubscriptionMock: vi.fn(),
  getSessionMock: vi.fn(),
  dbSelectMock: vi.fn(),
  stripeInvoicesListMock: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@/auth/auth.server', () => ({
  auth: {
    api: {
      listActiveSubscriptions: listActiveSubscriptionsMock,
      createBillingPortal: createBillingPortalMock,
      upgradeSubscription: upgradeSubscriptionMock,
      restoreSubscription: restoreSubscriptionMock,
      getSession: getSessionMock,
    },
  },
}));

vi.mock('@/db', () => ({
  db: { select: dbSelectMock },
}));

vi.mock('@/db/schema', () => ({
  member: 'member',
  subscription: 'subscription',
  user: 'user',
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: Array<unknown>) => args),
  count: vi.fn(() => 'count'),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

vi.mock('stripe', () => {
  // Stripe is imported as a default export and called with `new Stripe(...)`.
  // The mock must be a real constructor function.
  function StripeMock() {
    // @ts-expect-error -- mock constructor assigns invoices property.
    this.invoices = { list: stripeInvoicesListMock };
  }
  return { default: StripeMock };
});

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn(),
}));

const TEST_HEADERS = new Headers();
const TEST_USER_ID = 'user_123';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('billing.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getUserPlanContext ──────────────────────────────────────────────────

  describe('getUserPlanContext', () => {
    it('returns free context when no subscriptions exist', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([]);

      const ctx = await getUserPlanContext(TEST_HEADERS, TEST_USER_ID);

      expect(ctx.planId).toBe('free');
      expect(ctx.planName).toBe('Free');
      expect(ctx.limits.maxWorkspaces).toBe(1);
      expect(ctx.limits.maxMembersPerWorkspace).toBe(1);
      expect(ctx.upgradePlan).not.toBeNull();
      expect(ctx.upgradePlan?.id).toBe('starter');
    });

    it('returns pro context for active pro subscription', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'active' },
      ]);

      const ctx = await getUserPlanContext(TEST_HEADERS, TEST_USER_ID);

      expect(ctx.planId).toBe('pro');
      expect(ctx.planName).toBe('Pro');
      expect(ctx.limits.maxWorkspaces).toBe(25);
      expect(ctx.limits.maxMembersPerWorkspace).toBe(25);
      expect(ctx.upgradePlan).toBeNull();
    });

    it('returns pro context for trialing subscription', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'trialing' },
      ]);

      const ctx = await getUserPlanContext(TEST_HEADERS, TEST_USER_ID);

      expect(ctx.planId).toBe('pro');
      expect(ctx.planName).toBe('Pro');
    });

    it('falls back to free plan for unknown plan', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'unknown_plan', status: 'active' },
      ]);

      const ctx = await getUserPlanContext(TEST_HEADERS, TEST_USER_ID);

      expect(ctx.planId).toBe('free');
      expect(ctx.planName).toBe('Free');
    });

    it('passes headers to listActiveSubscriptions', async () => {
      const customHeaders = new Headers({ 'x-custom': 'test' });
      listActiveSubscriptionsMock.mockResolvedValue([]);

      await getUserPlanContext(customHeaders, TEST_USER_ID);

      expect(listActiveSubscriptionsMock).toHaveBeenCalledWith({
        headers: customHeaders,
        query: { referenceId: TEST_USER_ID },
      });
    });
  });

  // ── resolveSubscriptionDetails ────────────────────────────────────────

  describe('resolveSubscriptionDetails', () => {
    it('returns null when no matching subscription exists', () => {
      const result = resolveSubscriptionDetails([], 'starter');
      expect(result).toBeNull();
    });

    it('returns null when subscription plan does not match', () => {
      const result = resolveSubscriptionDetails(
        [{ plan: 'pro', status: 'active' }],
        'starter',
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
        'pro',
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
        'pro',
      );
      expect(result).toEqual({
        status: 'trialing',
        periodEnd: null,
        cancelAtPeriodEnd: false,
        cancelAt: null,
      });
    });
  });

  // ── getBillingData ─────────────────────────────────────────────────────

  describe('getBillingData', () => {
    it('returns plan and null subscription for free user', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([]);

      const data = await getBillingData(TEST_HEADERS, TEST_USER_ID);

      expect(data.planId).toBe('free');
      expect(data.plan.id).toBe('free');
      expect(data.subscription).toBeNull();
      // Verify no DB call was made — subscription details derived from API response.
      expect(dbSelectMock).not.toHaveBeenCalled();
    });

    it('returns plan and subscription for pro user', async () => {
      const periodEnd = new Date('2026-04-12');
      listActiveSubscriptionsMock.mockResolvedValue([
        {
          plan: 'pro',
          status: 'active',
          periodEnd,
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      ]);

      const data = await getBillingData(TEST_HEADERS, TEST_USER_ID);

      expect(data.planId).toBe('pro');
      expect(data.plan.id).toBe('pro');
      expect(data.subscription).toEqual({
        status: 'active',
        periodEnd,
        cancelAtPeriodEnd: false,
        cancelAt: null,
      });
      // Single API call, no DB round trip.
      expect(dbSelectMock).not.toHaveBeenCalled();
    });
  });

  // ── checkUserPlanLimit - workspace ─────────────────────────────────────

  describe('checkUserPlanLimit - workspace', () => {
    it('allows when under limit (free, 0 workspaces)', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([]);
      mockDbChain(dbSelectMock, [{ count: 0 }]);

      const result = await checkUserPlanLimit(
        TEST_HEADERS,
        TEST_USER_ID,
        'workspace',
      );

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(1);
    });

    it('blocks when at limit (free, 1 workspace)', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([]);
      mockDbChain(dbSelectMock, [{ count: 1 }]);

      const result = await checkUserPlanLimit(
        TEST_HEADERS,
        TEST_USER_ID,
        'workspace',
      );

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(1);
      expect(result.planName).toBe('Free');
    });

    it('pro has limit of 25', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'active' },
      ]);
      mockDbChain(dbSelectMock, [{ count: 3 }]);

      const result = await checkUserPlanLimit(
        TEST_HEADERS,
        TEST_USER_ID,
        'workspace',
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(25);
    });
  });

  // ── checkUserPlanLimit - edge cases ──────────────────────────────────

  describe('checkUserPlanLimit - edge cases', () => {
    it('blocks at exactly max workspace limit for pro (boundary)', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'active' },
      ]);
      mockDbChain(dbSelectMock, [{ count: 25 }]);

      const result = await checkUserPlanLimit(
        TEST_HEADERS,
        TEST_USER_ID,
        'workspace',
      );

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(25);
      expect(result.limit).toBe(25);
      expect(result.planName).toBe('Pro');
    });

    it('falls back to free limits for past_due subscription', async () => {
      // past_due is not in the active statuses list, so resolveUserPlanId
      // should ignore it and fall back to the free plan.
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'past_due' },
      ]);
      mockDbChain(dbSelectMock, [{ count: 0 }]);

      const result = await checkUserPlanLimit(
        TEST_HEADERS,
        TEST_USER_ID,
        'workspace',
      );

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(1);
      expect(result.planName).toBe('Free');
    });
  });

  // ── checkUserPlanLimit - member ────────────────────────────────────────

  describe('checkUserPlanLimit - member', () => {
    it('throws when workspaceId is missing', async () => {
      await expect(
        checkUserPlanLimit(TEST_HEADERS, TEST_USER_ID, 'member'),
      ).rejects.toThrow('workspaceId is required for member limit check.');
    });

    it('allows when no owner found (personal workspace fallback)', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([]);
      // getWorkspaceOwnerUserId returns empty array (no owner).
      mockDbChain(dbSelectMock, []);

      const result = await checkUserPlanLimit(
        TEST_HEADERS,
        TEST_USER_ID,
        'member',
        'ws_123',
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });

    it("checks member limit against workspace owner's plan", async () => {
      const ownerId = 'owner_456';

      // First DB call: getWorkspaceOwnerUserId — returns owner.
      const whereOwner = vi.fn().mockResolvedValue([{ userId: ownerId }]);
      const fromOwner = vi.fn().mockReturnValue({ where: whereOwner });

      // Second DB call: countWorkspaceMembers — returns count.
      const whereMembers = vi.fn().mockResolvedValue([{ count: 3 }]);
      const fromMembers = vi.fn().mockReturnValue({ where: whereMembers });

      dbSelectMock
        .mockReturnValueOnce({ from: fromOwner })
        .mockReturnValueOnce({ from: fromMembers });

      // Owner has starter plan.
      listActiveSubscriptionsMock.mockResolvedValue([]);

      const result = await checkUserPlanLimit(
        TEST_HEADERS,
        TEST_USER_ID,
        'member',
        'ws_123',
      );

      // Free plan limit is 1, current is 3, so should be blocked.
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
      expect(result.limit).toBe(1);
    });
  });

  // ── reactivateUserSubscription ─────────────────────────────────────────

  describe('reactivateUserSubscription', () => {
    it('restores highest-tier active subscription', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        {
          id: 'rec_starter',
          stripeSubscriptionId: 'sub_starter',
          plan: 'starter',
          status: 'active',
        },
        {
          id: 'rec_pro',
          stripeSubscriptionId: 'sub_pro',
          plan: 'pro',
          status: 'active',
        },
      ]);
      restoreSubscriptionMock.mockResolvedValue({});

      const result = await reactivateUserSubscription(
        TEST_HEADERS,
        TEST_USER_ID,
      );

      expect(result).toEqual({ success: true });
      expect(restoreSubscriptionMock).toHaveBeenCalledWith({
        headers: TEST_HEADERS,
        body: { subscriptionId: 'sub_pro' },
      });
    });

    it('throws when no active subscriptions exist', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { id: 'sub_1', plan: 'pro', status: 'canceled' },
      ]);

      await expect(
        reactivateUserSubscription(TEST_HEADERS, TEST_USER_ID),
      ).rejects.toThrow('No active subscription found.');
    });
  });

  // ── createCheckoutForPlan ──────────────────────────────────────────────

  describe('createCheckoutForPlan', () => {
    it('calls upgradeSubscription with correct params', async () => {
      upgradeSubscriptionMock.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_123',
        redirect: true,
      });

      const result = await createCheckoutForPlan(TEST_HEADERS, 'pro', true);

      expect(result.url).toBe('https://checkout.stripe.com/session_123');
      expect(result.redirect).toBe(true);
      expect(upgradeSubscriptionMock).toHaveBeenCalledWith({
        headers: TEST_HEADERS,
        body: {
          plan: 'pro',
          annual: true,
          successUrl: expect.stringContaining('/billing?success=true'),
          cancelUrl: expect.stringContaining('/billing'),
        },
      });
    });
  });

  // ── createUserBillingPortal ────────────────────────────────────────────

  describe('createUserBillingPortal', () => {
    it('calls createBillingPortal with correct params', async () => {
      createBillingPortalMock.mockResolvedValue({
        url: 'https://billing.stripe.com/portal_123',
        redirect: true,
      });

      const result = await createUserBillingPortal(TEST_HEADERS);

      expect(result.url).toBe('https://billing.stripe.com/portal_123');
      expect(result.redirect).toBe(true);
      expect(createBillingPortalMock).toHaveBeenCalledWith({
        headers: TEST_HEADERS,
        body: {
          returnUrl: expect.stringContaining('/billing'),
        },
      });
    });
  });

  // ── getInvoicesForUser ─────────────────────────────────────────────────

  describe('getInvoicesForUser', () => {
    it('returns empty array when no stripeCustomerId', async () => {
      mockDbChain(dbSelectMock, [{ stripeCustomerId: null }]);

      const result = await getInvoicesForUser(TEST_USER_ID);

      expect(result).toEqual([]);
      expect(stripeInvoicesListMock).not.toHaveBeenCalled();
    });
  });
});
