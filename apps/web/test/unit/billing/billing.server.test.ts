import {
  checkWorkspacePlanLimit,
  createCheckoutForWorkspace,
  createWorkspaceBillingPortal,
  getWorkspaceActivePlanId,
  getWorkspaceBillingData,
  getWorkspacePlanContext,
  reactivateWorkspaceSubscription,
  requireVerifiedSession,
} from '@/billing/billing.server';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  listActiveSubscriptionsMock,
  createBillingPortalMock,
  upgradeSubscriptionMock,
  restoreSubscriptionMock,
  getSessionMock,
  countWorkspaceMembersMock,
  getRequestHeadersMock,
} = vi.hoisted(() => ({
  listActiveSubscriptionsMock: vi.fn(),
  createBillingPortalMock: vi.fn(),
  upgradeSubscriptionMock: vi.fn(),
  restoreSubscriptionMock: vi.fn(),
  getSessionMock: vi.fn(),
  countWorkspaceMembersMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
}));

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@/init', () => ({
  auth: {
    api: {
      listActiveSubscriptions: listActiveSubscriptionsMock,
      createBillingPortal: createBillingPortalMock,
      upgradeSubscription: upgradeSubscriptionMock,
      restoreSubscription: restoreSubscriptionMock,
      getSession: getSessionMock,
    },
    billing: {
      countWorkspaceMembers: countWorkspaceMembersMock,
    },
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

const TEST_HEADERS = new Headers();
const TEST_WORKSPACE_ID = 'ws_123';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('billing.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getWorkspacePlanContext ──────────────────────────────────────────────

  describe('getWorkspacePlanContext', () => {
    it('returns free context when no subscriptions exist', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([]);

      const ctx = await getWorkspacePlanContext(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(ctx.planId).toBe('free');
      expect(ctx.planName).toBe('Free');
      expect(ctx.limits.maxMembers).toBe(1);
      expect(ctx.upgradePlan).not.toBeNull();
      expect(ctx.upgradePlan?.id).toBe('starter');
    });

    it('returns pro context for active pro subscription', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'active' },
      ]);

      const ctx = await getWorkspacePlanContext(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(ctx.planId).toBe('pro');
      expect(ctx.planName).toBe('Pro');
      expect(ctx.limits.maxMembers).toBe(25);
      expect(ctx.upgradePlan).toBeNull();
    });

    it('returns pro context for trialing subscription', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'trialing' },
      ]);

      const ctx = await getWorkspacePlanContext(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(ctx.planId).toBe('pro');
      expect(ctx.planName).toBe('Pro');
    });

    it('falls back to free plan for unknown plan', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'unknown_plan', status: 'active' },
      ]);

      const ctx = await getWorkspacePlanContext(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(ctx.planId).toBe('free');
      expect(ctx.planName).toBe('Free');
    });

    it('passes headers to listActiveSubscriptions', async () => {
      const customHeaders = new Headers({ 'x-custom': 'test' });
      listActiveSubscriptionsMock.mockResolvedValue([]);

      await getWorkspacePlanContext(customHeaders, TEST_WORKSPACE_ID);

      expect(listActiveSubscriptionsMock).toHaveBeenCalledWith({
        headers: customHeaders,
        query: { referenceId: TEST_WORKSPACE_ID },
      });
    });
  });

  // ── getWorkspaceBillingData ─────────────────────────────────────────────

  describe('getWorkspaceBillingData', () => {
    it('returns plan and null subscription for free workspace', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([]);

      const data = await getWorkspaceBillingData(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(data.planId).toBe('free');
      expect(data.plan.id).toBe('free');
      expect(data.subscription).toBeNull();
    });

    it('returns plan and subscription for pro workspace', async () => {
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

      const data = await getWorkspaceBillingData(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(data.planId).toBe('pro');
      expect(data.plan.id).toBe('pro');
      expect(data.subscription).toEqual({
        status: 'active',
        periodEnd,
        cancelAtPeriodEnd: false,
        cancelAt: null,
      });
    });
  });

  // ── checkWorkspacePlanLimit - member ────────────────────────────────────

  describe('checkWorkspacePlanLimit - member', () => {
    it('allows when under member limit on pro plan', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'active' },
      ]);
      countWorkspaceMembersMock.mockResolvedValue(10);

      const result = await checkWorkspacePlanLimit(
        TEST_HEADERS,
        TEST_WORKSPACE_ID,
        'member'
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(25);
      expect(result.current).toBe(10);
    });

    it('resolves workspace plan directly for member check', async () => {
      countWorkspaceMembersMock.mockResolvedValue(3);

      // Workspace has no subscription (free plan).
      listActiveSubscriptionsMock.mockResolvedValue([]);

      const result = await checkWorkspacePlanLimit(
        TEST_HEADERS,
        TEST_WORKSPACE_ID,
        'member'
      );

      // Free plan limit is 1, current is 3, so should be blocked.
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
      expect(result.limit).toBe(1);
    });

    it('falls back to free limits for past_due subscription', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'past_due' },
      ]);
      countWorkspaceMembersMock.mockResolvedValue(0);

      const result = await checkWorkspacePlanLimit(
        TEST_HEADERS,
        TEST_WORKSPACE_ID,
        'member'
      );

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(1);
      expect(result.planName).toBe('Free');
    });
  });

  // ── reactivateWorkspaceSubscription ─────────────────────────────────────

  describe('reactivateWorkspaceSubscription', () => {
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

      const result = await reactivateWorkspaceSubscription(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
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
        reactivateWorkspaceSubscription(TEST_HEADERS, TEST_WORKSPACE_ID)
      ).rejects.toThrow('No active subscription found.');
    });
  });

  // ── createCheckoutForWorkspace ──────────────────────────────────────────

  describe('createCheckoutForWorkspace', () => {
    it('calls upgradeSubscription with correct params', async () => {
      upgradeSubscriptionMock.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_123',
        redirect: true,
      });

      const result = await createCheckoutForWorkspace(
        TEST_HEADERS,
        TEST_WORKSPACE_ID,
        'pro',
        true
      );

      expect(result.url).toBe('https://checkout.stripe.com/session_123');
      expect(result.redirect).toBe(true);
      expect(upgradeSubscriptionMock).toHaveBeenCalledWith({
        headers: TEST_HEADERS,
        body: {
          plan: 'pro',
          annual: true,
          successUrl: expect.stringContaining(
            `/ws/${TEST_WORKSPACE_ID}/billing?success=true`
          ),
          cancelUrl: expect.stringContaining(
            `/ws/${TEST_WORKSPACE_ID}/billing`
          ),
        },
      });
    });
  });

  // ── createWorkspaceBillingPortal ────────────────────────────────────────

  describe('createWorkspaceBillingPortal', () => {
    it('calls createBillingPortal with correct params', async () => {
      createBillingPortalMock.mockResolvedValue({
        url: 'https://billing.stripe.com/portal_123',
        redirect: true,
      });

      const result = await createWorkspaceBillingPortal(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(result.url).toBe('https://billing.stripe.com/portal_123');
      expect(result.redirect).toBe(true);
      expect(createBillingPortalMock).toHaveBeenCalledWith({
        headers: TEST_HEADERS,
        body: {
          returnUrl: expect.stringContaining(
            `/ws/${TEST_WORKSPACE_ID}/billing`
          ),
        },
      });
    });
  });

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

  // ── getWorkspaceActivePlanId ─────────────────────────────────────────

  describe('getWorkspaceActivePlanId', () => {
    it('returns free plan when no subscriptions', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([]);

      const planId = await getWorkspaceActivePlanId(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(planId).toBe('free');
    });

    it('delegates to resolveWorkspacePlanId with subscription array', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'active' },
      ]);

      const planId = await getWorkspaceActivePlanId(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(planId).toBe('pro');
      expect(listActiveSubscriptionsMock).toHaveBeenCalledWith({
        headers: TEST_HEADERS,
        query: { referenceId: TEST_WORKSPACE_ID },
      });
    });
  });
});
