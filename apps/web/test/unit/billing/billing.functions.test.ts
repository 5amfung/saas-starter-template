import { createMockSessionResponse } from '@workspace/test-utils';
import { createServerFnMock } from '../../mocks/server-fn';
import {
  cancelWorkspaceSubscription,
  checkWorkspaceEntitlement,
  createWorkspaceCheckoutSession,
  createWorkspacePortalSession,
  downgradeWorkspaceSubscription,
  getWorkspaceBillingData,
  getWorkspaceInvoices,
  reactivateWorkspaceSubscription,
} from '@/billing/billing.functions';

const {
  startSpanMock,
  loggerInfoMock,
  loggerErrorMock,
  getAuthMock,
  requireVerifiedSessionMock,
  requireWorkspaceCapabilityForUserMock,
  getRequestHeadersMock,
  createCheckoutForWorkspaceMock,
  createWorkspaceBillingPortalMock,
  cancelWorkspaceSubscriptionMock,
  getWorkspaceBillingDataMock,
  downgradeWorkspaceSubscriptionMock,
  reactivateWorkspaceSubscriptionMock,
  checkWorkspaceEntitlementMock,
  getInvoicesForWorkspaceMock,
} = vi.hoisted(() => ({
  startSpanMock: vi.fn((_, callback) => callback()),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  getAuthMock: vi.fn(),
  requireVerifiedSessionMock: vi.fn(),
  requireWorkspaceCapabilityForUserMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
  createCheckoutForWorkspaceMock: vi.fn(),
  createWorkspaceBillingPortalMock: vi.fn(),
  cancelWorkspaceSubscriptionMock: vi.fn(),
  getWorkspaceBillingDataMock: vi.fn(),
  downgradeWorkspaceSubscriptionMock: vi.fn(),
  reactivateWorkspaceSubscriptionMock: vi.fn(),
  checkWorkspaceEntitlementMock: vi.fn(),
  getInvoicesForWorkspaceMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => createServerFnMock());

vi.mock('@sentry/tanstackstart-react', () => ({
  startSpan: startSpanMock,
  logger: {
    info: loggerInfoMock,
    error: loggerErrorMock,
  },
}));

vi.mock('@/observability/server', () => ({
  OPERATIONS: {
    BILLING_CHECKOUT_CREATE_SESSION: 'billing.checkout.create_session',
    BILLING_PORTAL_CREATE_SESSION: 'billing.portal.create_session',
    BILLING_SUBSCRIPTION_CANCEL: 'billing.subscription.cancel',
    BILLING_SUBSCRIPTION_DOWNGRADE: 'billing.subscription.downgrade',
    BILLING_SUBSCRIPTION_REACTIVATE: 'billing.subscription.reactivate',
  },
  buildWorkflowAttributes: (
    operation: string,
    attributes: Record<string, unknown>
  ) => ({
    operation,
    operationFamily: operation.split('.')[0],
    ...attributes,
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/billing/billing.server', () => ({
  requireVerifiedSession: requireVerifiedSessionMock,
  cancelWorkspaceSubscription: cancelWorkspaceSubscriptionMock,
  createCheckoutForWorkspace: createCheckoutForWorkspaceMock,
  createWorkspaceBillingPortal: createWorkspaceBillingPortalMock,
  downgradeWorkspaceSubscription: downgradeWorkspaceSubscriptionMock,
  getWorkspaceBillingData: getWorkspaceBillingDataMock,
  reactivateWorkspaceSubscription: reactivateWorkspaceSubscriptionMock,
  checkWorkspaceEntitlement: checkWorkspaceEntitlementMock,
}));

vi.mock('@/policy/workspace-capabilities.server', () => ({
  requireWorkspaceCapabilityForUser: requireWorkspaceCapabilityForUserMock,
}));

vi.mock('@/init.server', () => ({
  getAuth: getAuthMock,
}));

beforeEach(() => {
  getAuthMock.mockReturnValue({
    billing: {
      getInvoicesForWorkspace: getInvoicesForWorkspaceMock,
    },
  });
});

vi.mock('@/billing/core', () => ({
  PLANS: [
    { id: 'starter', stripeEnabled: true, isEnterprise: false },
    { id: 'pro', stripeEnabled: true, isEnterprise: false },
    { id: 'enterprise', stripeEnabled: true, isEnterprise: true },
  ],
}));

const TEST_WORKSPACE_ID = 'ws-1';

/** Sets up mocks so the current user passes the workspace capability guard. */
function mockAuthorizedSession() {
  const session = createMockSessionResponse();
  requireVerifiedSessionMock.mockResolvedValueOnce(session);
  requireWorkspaceCapabilityForUserMock.mockResolvedValueOnce({
    canManageBilling: true,
  });
  return session;
}

describe('getWorkspaceInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(
      getWorkspaceInvoices({ data: { workspaceId: TEST_WORKSPACE_ID } })
    ).rejects.toMatchObject({ message: 'Unauthorized' });
  });

  it('rejects when billing view capability is missing', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    requireWorkspaceCapabilityForUserMock.mockRejectedValueOnce(
      new Error('forbidden: missing workspace capability canViewBilling')
    );
    await expect(
      getWorkspaceInvoices({ data: { workspaceId: TEST_WORKSPACE_ID } })
    ).rejects.toMatchObject({
      message: 'forbidden: missing workspace capability canViewBilling',
    });
  });

  it('calls getInvoicesForWorkspace with workspace ID', async () => {
    const session = mockAuthorizedSession();
    getInvoicesForWorkspaceMock.mockResolvedValueOnce([]);
    await getWorkspaceInvoices({ data: { workspaceId: TEST_WORKSPACE_ID } });
    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      expect.any(Headers),
      TEST_WORKSPACE_ID,
      session.user.id,
      'canViewBilling'
    );
    expect(getInvoicesForWorkspaceMock).toHaveBeenCalledWith(TEST_WORKSPACE_ID);
  });

  it('returns the invoice list', async () => {
    const invoices = [{ id: 'inv-1', amount: 4900 }];
    mockAuthorizedSession();
    getInvoicesForWorkspaceMock.mockResolvedValueOnce(invoices);
    const result = await getWorkspaceInvoices({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
    expect(result).toEqual(invoices);
  });
});

describe('createWorkspaceCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(
      createWorkspaceCheckoutSession({
        data: {
          workspaceId: TEST_WORKSPACE_ID,
          planId: 'pro',
          annual: false,
        },
      })
    ).rejects.toMatchObject({ message: 'Unauthorized' });
  });

  it('rejects when billing management capability is missing', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    requireWorkspaceCapabilityForUserMock.mockRejectedValueOnce(
      new Error('forbidden: missing workspace capability canManageBilling')
    );
    await expect(
      createWorkspaceCheckoutSession({
        data: {
          workspaceId: TEST_WORKSPACE_ID,
          planId: 'pro',
          annual: false,
        },
      })
    ).rejects.toMatchObject({
      message: 'forbidden: missing workspace capability canManageBilling',
    });
  });

  it('passes workspaceId, planId, annual, and headers to createCheckoutForWorkspace', async () => {
    const headers = new Headers({ 'x-test': '1' });
    const session = mockAuthorizedSession();
    getRequestHeadersMock.mockReturnValue(headers);
    createCheckoutForWorkspaceMock.mockResolvedValueOnce({
      url: 'https://stripe.com',
    });
    await createWorkspaceCheckoutSession({
      data: {
        workspaceId: TEST_WORKSPACE_ID,
        planId: 'pro',
        annual: true,
      },
    });
    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID,
      session.user.id,
      'canManageBilling'
    );
    expect(createCheckoutForWorkspaceMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID,
      'pro',
      true,
      undefined
    );
  });

  it('returns the checkout result', async () => {
    const checkout = { url: 'https://stripe.com/checkout' };
    mockAuthorizedSession();
    createCheckoutForWorkspaceMock.mockResolvedValueOnce(checkout);
    const result = await createWorkspaceCheckoutSession({
      data: {
        workspaceId: TEST_WORKSPACE_ID,
        planId: 'starter',
        annual: false,
      },
    });
    expect(result).toEqual(checkout);
    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'billing.checkout.create_session',
        name: 'Create billing checkout session',
        attributes: expect.objectContaining({
          operation: 'billing.checkout.create_session',
          workspaceId: TEST_WORKSPACE_ID,
          planId: 'starter',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Billing checkout session created',
      expect.objectContaining({
        operation: 'billing.checkout.create_session',
        workspaceId: TEST_WORKSPACE_ID,
        planId: 'starter',
        result: 'success',
      })
    );
  });

  it('rejects checkout for enterprise plans', async () => {
    mockAuthorizedSession();
    createCheckoutForWorkspaceMock.mockRejectedValueOnce(
      new Error(
        'Checkout is not available for plan "enterprise". Contact sales for enterprise plans.'
      )
    );

    await expect(
      createWorkspaceCheckoutSession({
        data: {
          workspaceId: TEST_WORKSPACE_ID,
          planId: 'enterprise',
          annual: false,
        },
      })
    ).rejects.toMatchObject({
      message:
        'Checkout is not available for plan "enterprise". Contact sales for enterprise plans.',
    });
    expect(createCheckoutForWorkspaceMock).toHaveBeenCalledWith(
      expect.any(Headers),
      TEST_WORKSPACE_ID,
      'enterprise',
      false,
      undefined
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Billing checkout session failed',
      expect.objectContaining({
        operation: 'billing.checkout.create_session',
        workspaceId: TEST_WORKSPACE_ID,
        planId: 'enterprise',
        result: 'failure',
      })
    );
  });
});

describe('createWorkspacePortalSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(
      createWorkspacePortalSession({
        data: { workspaceId: TEST_WORKSPACE_ID },
      })
    ).rejects.toMatchObject({ message: 'Unauthorized' });
  });

  it('rejects when billing management capability is missing', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    requireWorkspaceCapabilityForUserMock.mockRejectedValueOnce(
      new Error('forbidden: missing workspace capability canManageBilling')
    );
    await expect(
      createWorkspacePortalSession({
        data: { workspaceId: TEST_WORKSPACE_ID },
      })
    ).rejects.toMatchObject({
      message: 'forbidden: missing workspace capability canManageBilling',
    });
  });

  it('calls createWorkspaceBillingPortal with headers and workspaceId', async () => {
    const headers = new Headers();
    const session = mockAuthorizedSession();
    getRequestHeadersMock.mockReturnValue(headers);
    createWorkspaceBillingPortalMock.mockResolvedValueOnce({
      url: 'https://portal.stripe.com',
    });
    await createWorkspacePortalSession({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID,
      session.user.id,
      'canManageBilling'
    );
    expect(createWorkspaceBillingPortalMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID
    );
  });

  it('returns the portal URL', async () => {
    const portal = { url: 'https://portal.stripe.com' };
    mockAuthorizedSession();
    createWorkspaceBillingPortalMock.mockResolvedValueOnce(portal);
    const result = await createWorkspacePortalSession({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
    expect(result).toEqual(portal);
    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'billing.portal.create_session',
        name: 'Create billing portal session',
        attributes: expect.objectContaining({
          operation: 'billing.portal.create_session',
          workspaceId: TEST_WORKSPACE_ID,
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Billing portal session created',
      expect.objectContaining({
        operation: 'billing.portal.create_session',
        workspaceId: TEST_WORKSPACE_ID,
        result: 'success',
      })
    );
  });
});

describe('getWorkspaceBillingData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(
      getWorkspaceBillingData({ data: { workspaceId: TEST_WORKSPACE_ID } })
    ).rejects.toMatchObject({ message: 'Unauthorized' });
  });

  it('rejects when billing view capability is missing', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    requireWorkspaceCapabilityForUserMock.mockRejectedValueOnce(
      new Error('forbidden: missing workspace capability canViewBilling')
    );
    await expect(
      getWorkspaceBillingData({ data: { workspaceId: TEST_WORKSPACE_ID } })
    ).rejects.toMatchObject({
      message: 'forbidden: missing workspace capability canViewBilling',
    });
  });

  it('passes headers and workspaceId to getWorkspaceBillingData', async () => {
    const headers = new Headers();
    const session = mockAuthorizedSession();
    getRequestHeadersMock.mockReturnValue(headers);
    getWorkspaceBillingDataMock.mockResolvedValueOnce({});
    await getWorkspaceBillingData({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID,
      session.user.id,
      'canViewBilling'
    );
    expect(getWorkspaceBillingDataMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID
    );
  });

  it('returns billing data', async () => {
    const billingData = {
      plan: { id: 'free', name: 'Free' },
      subscription: null,
    };
    mockAuthorizedSession();
    getWorkspaceBillingDataMock.mockResolvedValueOnce(billingData);
    const result = await getWorkspaceBillingData({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
    expect(result).toEqual(billingData);
  });
});

describe('reactivateWorkspaceSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(
      reactivateWorkspaceSubscription({
        data: { workspaceId: TEST_WORKSPACE_ID },
      })
    ).rejects.toMatchObject({ message: 'Unauthorized' });
  });

  it('rejects when billing management capability is missing', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    requireWorkspaceCapabilityForUserMock.mockRejectedValueOnce(
      new Error('forbidden: missing workspace capability canManageBilling')
    );
    await expect(
      reactivateWorkspaceSubscription({
        data: { workspaceId: TEST_WORKSPACE_ID },
      })
    ).rejects.toMatchObject({
      message: 'forbidden: missing workspace capability canManageBilling',
    });
  });

  it('calls reactivateWorkspaceSubscription with headers and workspaceId', async () => {
    const headers = new Headers();
    const session = mockAuthorizedSession();
    getRequestHeadersMock.mockReturnValue(headers);
    reactivateWorkspaceSubscriptionMock.mockResolvedValueOnce({});
    await reactivateWorkspaceSubscription({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID,
      session.user.id,
      'canManageBilling'
    );
    expect(reactivateWorkspaceSubscriptionMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID
    );
  });

  it('returns the reactivation result', async () => {
    const result = { status: 'active' };
    mockAuthorizedSession();
    reactivateWorkspaceSubscriptionMock.mockResolvedValueOnce(result);
    const actual = await reactivateWorkspaceSubscription({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
    expect(actual).toEqual(result);
    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'billing.subscription.reactivate',
        name: 'Reactivate billing subscription',
        attributes: expect.objectContaining({
          operation: 'billing.subscription.reactivate',
          workspaceId: TEST_WORKSPACE_ID,
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Billing subscription reactivated',
      expect.objectContaining({
        operation: 'billing.subscription.reactivate',
        workspaceId: TEST_WORKSPACE_ID,
        result: 'success',
      })
    );
  });
});

describe('checkWorkspaceEntitlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(
      checkWorkspaceEntitlement({
        data: { workspaceId: TEST_WORKSPACE_ID, key: 'members' },
      })
    ).rejects.toMatchObject({ message: 'Unauthorized' });
  });

  it('rejects when billing management capability is missing', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    requireWorkspaceCapabilityForUserMock.mockRejectedValueOnce(
      new Error('forbidden: missing workspace capability canManageBilling')
    );
    await expect(
      checkWorkspaceEntitlement({
        data: { workspaceId: TEST_WORKSPACE_ID, key: 'members' },
      })
    ).rejects.toMatchObject({
      message: 'forbidden: missing workspace capability canManageBilling',
    });
  });

  it('passes headers, workspaceId, and key to checkWorkspaceEntitlement', async () => {
    const headers = new Headers();
    const session = mockAuthorizedSession();
    getRequestHeadersMock.mockReturnValue(headers);
    checkWorkspaceEntitlementMock.mockResolvedValueOnce({ allowed: true });
    await checkWorkspaceEntitlement({
      data: { workspaceId: TEST_WORKSPACE_ID, key: 'members' },
    });
    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID,
      session.user.id,
      'canManageBilling'
    );
    expect(checkWorkspaceEntitlementMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID,
      'members'
    );
  });

  it('returns the entitlement check result', async () => {
    const limitResult = { allowed: false, limit: 1, current: 1 };
    mockAuthorizedSession();
    checkWorkspaceEntitlementMock.mockResolvedValueOnce(limitResult);
    const result = await checkWorkspaceEntitlement({
      data: { workspaceId: TEST_WORKSPACE_ID, key: 'members' },
    });
    expect(result).toEqual(limitResult);
  });
});

describe('downgradeWorkspaceSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when billing management capability is missing', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    requireWorkspaceCapabilityForUserMock.mockRejectedValueOnce(
      new Error('forbidden: missing workspace capability canManageBilling')
    );

    await expect(
      downgradeWorkspaceSubscription({
        data: {
          workspaceId: TEST_WORKSPACE_ID,
          planId: 'starter',
          annual: false,
          subscriptionId: 'sub_123',
        },
      })
    ).rejects.toMatchObject({
      message: 'forbidden: missing workspace capability canManageBilling',
    });
  });

  it('passes billing management through to the downgrade server helper', async () => {
    const headers = new Headers();
    const session = mockAuthorizedSession();
    getRequestHeadersMock.mockReturnValue(headers);
    downgradeWorkspaceSubscriptionMock.mockResolvedValueOnce({ ok: true });

    await downgradeWorkspaceSubscription({
      data: {
        workspaceId: TEST_WORKSPACE_ID,
        planId: 'starter',
        annual: false,
        subscriptionId: 'sub_123',
      },
    });

    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID,
      session.user.id,
      'canManageBilling'
    );
    expect(downgradeWorkspaceSubscriptionMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID,
      'starter',
      false,
      'sub_123'
    );
    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'billing.subscription.downgrade',
        name: 'Schedule billing downgrade',
        attributes: expect.objectContaining({
          operation: 'billing.subscription.downgrade',
          workspaceId: TEST_WORKSPACE_ID,
          planId: 'starter',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Billing subscription downgrade scheduled',
      expect.objectContaining({
        operation: 'billing.subscription.downgrade',
        workspaceId: TEST_WORKSPACE_ID,
        planId: 'starter',
        result: 'success',
      })
    );
  });
});

describe('cancelWorkspaceSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('rejects when billing management capability is missing', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    requireWorkspaceCapabilityForUserMock.mockRejectedValueOnce(
      new Error('forbidden: missing workspace capability canManageBilling')
    );

    await expect(
      cancelWorkspaceSubscription({
        data: { workspaceId: TEST_WORKSPACE_ID },
      })
    ).rejects.toMatchObject({
      message: 'forbidden: missing workspace capability canManageBilling',
    });
  });

  it('passes billing management through to the cancel server helper', async () => {
    const headers = new Headers();
    const session = mockAuthorizedSession();
    getRequestHeadersMock.mockReturnValue(headers);
    cancelWorkspaceSubscriptionMock.mockResolvedValueOnce({ ok: true });

    await cancelWorkspaceSubscription({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });

    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID,
      session.user.id,
      'canManageBilling'
    );
    expect(cancelWorkspaceSubscriptionMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID
    );
    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: 'billing.subscription.cancel',
        name: 'Cancel billing subscription',
        attributes: expect.objectContaining({
          operation: 'billing.subscription.cancel',
          workspaceId: TEST_WORKSPACE_ID,
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Billing subscription cancellation scheduled',
      expect.objectContaining({
        operation: 'billing.subscription.cancel',
        workspaceId: TEST_WORKSPACE_ID,
        result: 'success',
      })
    );
  });
});
