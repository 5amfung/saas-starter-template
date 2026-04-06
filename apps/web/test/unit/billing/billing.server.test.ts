import {
  cancelWorkspaceSubscription,
  checkWorkspaceEntitlement,
  createCheckoutForWorkspace,
  createWorkspaceBillingPortal,
  downgradeWorkspaceSubscription,
  getWorkspaceActivePlanId,
  getWorkspaceBillingData,
  getWorkspaceEntitlements,
  reactivateWorkspaceSubscription,
  requireVerifiedSession,
} from '@/billing/billing.server';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  getAuthMock,
  getDbMock,
  listActiveSubscriptionsMock,
  createBillingPortalMock,
  upgradeSubscriptionMock,
  restoreSubscriptionMock,
  getSessionMock,
  countWorkspaceMembersMock,
  cancelSubscriptionAtPeriodEndMock,
  getSubscriptionScheduleMock,
  getPlanIdByPriceIdMock,
  releaseSubscriptionScheduleMock,
  getRequestHeadersMock,
  findFirstMock,
  dbSelectMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getDbMock: vi.fn(),
  listActiveSubscriptionsMock: vi.fn(),
  createBillingPortalMock: vi.fn(),
  upgradeSubscriptionMock: vi.fn(),
  restoreSubscriptionMock: vi.fn(),
  getSessionMock: vi.fn(),
  countWorkspaceMembersMock: vi.fn(),
  cancelSubscriptionAtPeriodEndMock: vi.fn(),
  getSubscriptionScheduleMock: vi.fn(),
  getPlanIdByPriceIdMock: vi.fn(),
  releaseSubscriptionScheduleMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
  findFirstMock: vi.fn(),
  dbSelectMock: vi.fn((fields?: Record<string, unknown>) => {
    const isCountQuery = !!fields && 'count' in fields;
    const builder = {
      from: vi.fn(() => builder),
      where: vi.fn(() => builder),
      limit: vi.fn(async (limit: number) => {
        const row = await findFirstMock();
        const rows = row ? [row] : [];
        return rows.slice(0, limit);
      }),
      then: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const rowsPromise = isCountQuery
          ? Promise.resolve(countWorkspaceMembersMock()).then((count) => [
              { count },
            ])
          : Promise.resolve(listActiveSubscriptionsMock()).then(
              (rows) => rows ?? []
            );
        return rowsPromise.then(onFulfilled, onRejected);
      },
    };
    return builder;
  }),
}));

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@/init', () => ({
  getAuth: getAuthMock.mockImplementation(() => ({
    api: {
      listActiveSubscriptions: listActiveSubscriptionsMock,
      createBillingPortal: createBillingPortalMock,
      upgradeSubscription: upgradeSubscriptionMock,
      restoreSubscription: restoreSubscriptionMock,
      getSession: getSessionMock,
    },
    billing: {
      countWorkspaceMembers: countWorkspaceMembersMock,
      cancelSubscriptionAtPeriodEnd: cancelSubscriptionAtPeriodEndMock,
      getSubscriptionSchedule: getSubscriptionScheduleMock,
      getPlanIdByPriceId: getPlanIdByPriceIdMock,
      releaseSubscriptionSchedule: releaseSubscriptionScheduleMock,
    },
  })),
  getDb: getDbMock.mockImplementation(() => ({
    select: dbSelectMock,
    query: {
      workspaceEntitlementOverrides: {
        findFirst: findFirstMock,
      },
    },
  })),
}));

vi.mock('@workspace/db-schema', async (importOriginal) => {
  const actual = await importOriginal();
  return Object.assign({}, actual, {
    workspaceEntitlementOverrides: { workspaceId: 'workspace_id' },
  });
});

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal();
  return Object.assign({}, actual, {
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  });
});

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
    listActiveSubscriptionsMock.mockResolvedValue([]);
    countWorkspaceMembersMock.mockResolvedValue(0);
  });

  // ── getWorkspaceEntitlements ─────────────────────────────────────────────

  describe('getWorkspaceEntitlements', () => {
    it('returns free context when no subscriptions exist', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([]);

      const ctx = await getWorkspaceEntitlements(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(ctx.planId).toBe('free');
      expect(ctx.plan.name).toBe('Free');
      expect(ctx.entitlements.limits.members).toBe(1);
      expect(ctx.upgradePlan).not.toBeNull();
      expect(ctx.upgradePlan?.id).toBe('starter');
    });

    it('returns pro context for active pro subscription', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'active' },
      ]);

      const ctx = await getWorkspaceEntitlements(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(ctx.planId).toBe('pro');
      expect(ctx.plan.name).toBe('Pro');
      expect(ctx.entitlements.limits.members).toBe(25);
      expect(ctx.upgradePlan).not.toBeNull();
      expect(ctx.upgradePlan?.id).toBe('enterprise');
    });

    it('returns pro context for trialing subscription', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'trialing' },
      ]);

      const ctx = await getWorkspaceEntitlements(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(ctx.planId).toBe('pro');
      expect(ctx.plan.name).toBe('Pro');
    });

    it('falls back to free plan for unknown plan', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'unknown_plan', status: 'active' },
      ]);

      const ctx = await getWorkspaceEntitlements(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(ctx.planId).toBe('free');
      expect(ctx.plan.name).toBe('Free');
    });

    it('passes headers to listActiveSubscriptions', async () => {
      const customHeaders = new Headers({ 'x-custom': 'test' });
      listActiveSubscriptionsMock.mockResolvedValue([]);

      await getWorkspaceEntitlements(customHeaders, TEST_WORKSPACE_ID);

      expect(listActiveSubscriptionsMock).toHaveBeenCalledWith({
        headers: customHeaders,
        query: { referenceId: TEST_WORKSPACE_ID, customerType: 'organization' },
      });
    });

    it('queries overrides for enterprise plans', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'enterprise', status: 'active' },
      ]);
      findFirstMock.mockResolvedValue({
        limits: { members: 500 },
        features: null,
        quotas: null,
      });

      const ctx = await getWorkspaceEntitlements(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(ctx.entitlements.limits.members).toBe(500);
      expect(findFirstMock).toHaveBeenCalled();
    });

    it('does not query overrides for non-enterprise plans', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'active' },
      ]);

      await getWorkspaceEntitlements(TEST_HEADERS, TEST_WORKSPACE_ID);

      expect(findFirstMock).not.toHaveBeenCalled();
    });
  });

  // ── getWorkspaceBillingData ─────────────────────────────────────────────

  describe('getWorkspaceBillingData', () => {
    it('returns plan, entitlements, and null subscription for free workspace', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([]);
      countWorkspaceMembersMock.mockResolvedValue(1);

      const data = await getWorkspaceBillingData(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(data.planId).toBe('free');
      expect(data.plan.id).toBe('free');
      expect(data.entitlements.limits.members).toBe(1);
      expect(data.subscription).toBeNull();
      expect(data.scheduledTargetPlanId).toBeNull();
      expect(data.memberCount).toBe(1);
      expect(data.productPolicy.currentPlanCta.type).toBe('manage_plan');
      expect(data.productPolicy.billingPortal.visible).toBe(false);
      expect(data.productPolicy.planChanges.starter.via).toBe('checkout');
    });

    it('returns plan and subscription for pro workspace', async () => {
      const periodEnd = new Date('2026-04-12');
      listActiveSubscriptionsMock.mockResolvedValue([
        {
          plan: 'pro',
          status: 'active',
          stripeSubscriptionId: 'sub_pro_123',
          periodEnd,
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      ]);
      countWorkspaceMembersMock.mockResolvedValue(3);

      const data = await getWorkspaceBillingData(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(data.planId).toBe('pro');
      expect(data.plan.id).toBe('pro');
      expect(data.entitlements.limits.members).toBe(25);
      expect(data.subscription).toEqual({
        status: 'active',
        stripeSubscriptionId: 'sub_pro_123',
        stripeScheduleId: null,
        periodEnd,
        cancelAtPeriodEnd: false,
        cancelAt: null,
      });
      expect(data.scheduledTargetPlanId).toBeNull();
      expect(data.memberCount).toBe(3);
      expect(data.productPolicy.billingPortal.visible).toBe(true);
      expect(data.productPolicy.featureAccess.sso.upgradeAction).toBe(
        'contact_sales'
      );
    });

    it('resolves scheduledTargetPlanId from subscription schedule', async () => {
      const periodEnd = new Date('2026-04-12');
      listActiveSubscriptionsMock.mockResolvedValue([
        {
          plan: 'pro',
          status: 'active',
          stripeSubscriptionId: 'sub_pro_123',
          stripeScheduleId: 'sub_sched_abc',
          periodEnd,
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      ]);
      getSubscriptionScheduleMock.mockResolvedValue({
        status: 'active',
        phases: [
          { items: [{ price: 'price_pro_monthly' }] },
          { items: [{ price: 'price_starter_monthly' }] },
        ],
      });
      getPlanIdByPriceIdMock.mockReturnValue('starter');
      countWorkspaceMembersMock.mockResolvedValue(2);

      const data = await getWorkspaceBillingData(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(data.scheduledTargetPlanId).toBe('starter');
      expect(getSubscriptionScheduleMock).toHaveBeenCalledWith('sub_sched_abc');
      expect(getPlanIdByPriceIdMock).toHaveBeenCalledWith(
        'price_starter_monthly'
      );
    });

    it('returns null scheduledTargetPlanId when getSubscriptionSchedule throws', async () => {
      const periodEnd = new Date('2026-04-12');
      listActiveSubscriptionsMock.mockResolvedValue([
        {
          plan: 'pro',
          status: 'active',
          stripeSubscriptionId: 'sub_pro_123',
          stripeScheduleId: 'sub_sched_abc',
          periodEnd,
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      ]);
      getSubscriptionScheduleMock.mockRejectedValue(
        new Error('Schedule fetch failed')
      );
      countWorkspaceMembersMock.mockResolvedValue(2);

      // The error is caught internally in resolveScheduledTargetPlanId,
      // so the function should resolve successfully with no scheduled plan.
      const data = await getWorkspaceBillingData(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(data.planId).toBe('pro');
      expect(data.scheduledTargetPlanId).toBeNull();
      expect(data.subscription?.stripeScheduleId).toBeNull();
    });
  });

  // ── checkWorkspaceEntitlement - members ─────────────────────────────────

  describe('checkWorkspaceEntitlement - members', () => {
    it('allows when under member limit on pro plan', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'active' },
      ]);
      countWorkspaceMembersMock.mockResolvedValue(10);

      const result = await checkWorkspaceEntitlement(
        TEST_HEADERS,
        TEST_WORKSPACE_ID,
        'members'
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(25);
      expect(result.current).toBe(10);
    });

    it('returns normalized upgrade action when member limit is exceeded', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'active' },
      ]);
      countWorkspaceMembersMock.mockResolvedValue(25);

      const result = await checkWorkspaceEntitlement(
        TEST_HEADERS,
        TEST_WORKSPACE_ID,
        'members'
      );

      expect(result.allowed).toBe(false);
      expect(result.upgradePlan?.id).toBe('enterprise');
      expect(result.upgradeAction).toBe('contact_sales');
    });

    it('resolves workspace plan directly for member check', async () => {
      countWorkspaceMembersMock.mockResolvedValue(3);

      // Workspace has no subscription (free plan).
      listActiveSubscriptionsMock.mockResolvedValue([]);

      const result = await checkWorkspaceEntitlement(
        TEST_HEADERS,
        TEST_WORKSPACE_ID,
        'members'
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

      const result = await checkWorkspaceEntitlement(
        TEST_HEADERS,
        TEST_WORKSPACE_ID,
        'members'
      );

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(1);
      expect(result.planName).toBe('Free');
    });

    it('returns unlimited for enterprise plan', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'enterprise', status: 'active' },
      ]);
      findFirstMock.mockResolvedValue(undefined);

      const result = await checkWorkspaceEntitlement(
        TEST_HEADERS,
        TEST_WORKSPACE_ID,
        'members'
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
      expect(result.current).toBe(0);
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
        body: {
          subscriptionId: 'sub_pro',
          referenceId: TEST_WORKSPACE_ID,
          customerType: 'organization',
        },
      });
    });

    it('throws when no active subscriptions exist', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { id: 'sub_1', plan: 'pro', status: 'canceled' },
      ]);

      await expect(
        reactivateWorkspaceSubscription(TEST_HEADERS, TEST_WORKSPACE_ID)
      ).rejects.toMatchObject({ message: 'No active subscription found.' });
    });

    it('calls restoreSubscription for pending cancellation (no schedule)', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        {
          id: 'rec_pro',
          stripeSubscriptionId: 'sub_pro_123',
          plan: 'pro',
          status: 'active',
          cancelAtPeriodEnd: true,
          stripeScheduleId: null,
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
        body: {
          subscriptionId: 'sub_pro_123',
          referenceId: TEST_WORKSPACE_ID,
          customerType: 'organization',
        },
      });
      expect(releaseSubscriptionScheduleMock).not.toHaveBeenCalled();
    });

    it('calls releaseSubscriptionSchedule for scheduled downgrade', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        {
          id: 'rec_pro',
          stripeSubscriptionId: 'sub_pro_123',
          plan: 'pro',
          status: 'active',
          cancelAtPeriodEnd: false,
          stripeScheduleId: 'sub_sched_123',
        },
      ]);
      releaseSubscriptionScheduleMock.mockResolvedValue({});

      const result = await reactivateWorkspaceSubscription(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(result).toEqual({ success: true });
      expect(releaseSubscriptionScheduleMock).toHaveBeenCalledWith(
        'sub_sched_123'
      );
      expect(restoreSubscriptionMock).not.toHaveBeenCalled();
    });

    it('propagates error when releaseSubscriptionSchedule throws', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        {
          id: 'rec_pro',
          stripeSubscriptionId: 'sub_pro_123',
          plan: 'pro',
          status: 'active',
          cancelAtPeriodEnd: false,
          stripeScheduleId: 'sub_sched_123',
        },
      ]);
      releaseSubscriptionScheduleMock.mockRejectedValue(
        new Error('Schedule release failed')
      );

      await expect(
        reactivateWorkspaceSubscription(TEST_HEADERS, TEST_WORKSPACE_ID)
      ).rejects.toMatchObject({ message: 'Schedule release failed' });
      expect(restoreSubscriptionMock).not.toHaveBeenCalled();
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
          referenceId: TEST_WORKSPACE_ID,
          customerType: 'organization',
          successUrl: expect.stringContaining(
            `/ws/${TEST_WORKSPACE_ID}/billing?success=true`
          ),
          cancelUrl: expect.stringContaining(
            `/ws/${TEST_WORKSPACE_ID}/billing`
          ),
        },
      });
    });

    it('propagates error when upgradeSubscription throws', async () => {
      upgradeSubscriptionMock.mockRejectedValue(new Error('Stripe API error'));

      await expect(
        createCheckoutForWorkspace(TEST_HEADERS, TEST_WORKSPACE_ID, 'pro', true)
      ).rejects.toMatchObject({ message: 'Stripe API error' });
    });

    it('rejects enterprise plans', async () => {
      await expect(
        createCheckoutForWorkspace(
          TEST_HEADERS,
          TEST_WORKSPACE_ID,
          'enterprise',
          true
        )
      ).rejects.toMatchObject({
        message:
          'Checkout is not available for plan "enterprise". Contact sales for enterprise plans.',
      });
      expect(upgradeSubscriptionMock).not.toHaveBeenCalled();
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
          referenceId: TEST_WORKSPACE_ID,
          customerType: 'organization',
          returnUrl: expect.stringContaining(
            `/ws/${TEST_WORKSPACE_ID}/billing`
          ),
        },
      });
    });

    it('propagates error when createBillingPortal throws', async () => {
      createBillingPortalMock.mockRejectedValue(
        new Error('Portal unavailable')
      );

      await expect(
        createWorkspaceBillingPortal(TEST_HEADERS, TEST_WORKSPACE_ID)
      ).rejects.toMatchObject({ message: 'Portal unavailable' });
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

  // ── downgradeWorkspaceSubscription ──────────────────────────────────

  describe('downgradeWorkspaceSubscription', () => {
    it('calls upgradeSubscription with scheduleAtPeriodEnd: true', async () => {
      // Current plan is pro.
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'active' },
      ]);
      upgradeSubscriptionMock.mockResolvedValue({});

      const result = await downgradeWorkspaceSubscription(
        TEST_HEADERS,
        TEST_WORKSPACE_ID,
        'starter',
        false,
        'sub_pro_123'
      );

      expect(result).toEqual({ success: true });
      expect(upgradeSubscriptionMock).toHaveBeenCalledWith({
        headers: TEST_HEADERS,
        body: {
          plan: 'starter',
          annual: false,
          referenceId: TEST_WORKSPACE_ID,
          customerType: 'organization',
          subscriptionId: 'sub_pro_123',
          scheduleAtPeriodEnd: true,
        },
      });
    });

    it('throws if target tier >= current tier', async () => {
      // Current plan is starter (tier 1), target is pro (tier 2).
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'starter', status: 'active' },
      ]);

      await expect(
        downgradeWorkspaceSubscription(
          TEST_HEADERS,
          TEST_WORKSPACE_ID,
          'pro',
          false,
          'sub_starter_123'
        )
      ).rejects.toMatchObject({
        message: 'Target plan must be a lower tier than the current plan.',
      });
    });

    it('throws if target plan has no pricing', async () => {
      // Current plan is starter (tier 1), target is free (no pricing).
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'starter', status: 'active' },
      ]);

      await expect(
        downgradeWorkspaceSubscription(
          TEST_HEADERS,
          TEST_WORKSPACE_ID,
          'free',
          false,
          'sub_starter_123'
        )
      ).rejects.toMatchObject({
        message: 'Cannot downgrade to a plan without pricing.',
      });
    });
  });

  // ── cancelWorkspaceSubscription ───────────────────────────────────────

  describe('cancelWorkspaceSubscription', () => {
    it('calls cancelSubscriptionAtPeriodEnd for the active subscription', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        {
          plan: 'pro',
          status: 'active',
          stripeSubscriptionId: 'sub_pro_456',
        },
      ]);
      cancelSubscriptionAtPeriodEndMock.mockResolvedValue({});

      const result = await cancelWorkspaceSubscription(
        TEST_HEADERS,
        TEST_WORKSPACE_ID
      );

      expect(result).toEqual({ success: true });
      expect(cancelSubscriptionAtPeriodEndMock).toHaveBeenCalledWith(
        'sub_pro_456'
      );
    });

    it('throws when no active subscription exists', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        { plan: 'pro', status: 'canceled' },
      ]);

      await expect(
        cancelWorkspaceSubscription(TEST_HEADERS, TEST_WORKSPACE_ID)
      ).rejects.toMatchObject({ message: 'No active subscription found.' });
    });

    it('propagates error when cancelSubscriptionAtPeriodEnd throws', async () => {
      listActiveSubscriptionsMock.mockResolvedValue([
        {
          plan: 'pro',
          status: 'active',
          stripeSubscriptionId: 'sub_pro_456',
        },
      ]);
      cancelSubscriptionAtPeriodEndMock.mockRejectedValue(
        new Error('Stripe cancel error')
      );

      await expect(
        cancelWorkspaceSubscription(TEST_HEADERS, TEST_WORKSPACE_ID)
      ).rejects.toMatchObject({ message: 'Stripe cancel error' });
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
        query: { referenceId: TEST_WORKSPACE_ID, customerType: 'organization' },
      });
    });
  });
});
