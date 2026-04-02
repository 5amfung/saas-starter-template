import { createMockSessionResponse } from '@workspace/test-utils';
import { createServerFnMock } from '../../mocks/server-fn';
import {
  checkWorkspaceEntitlement,
  createWorkspaceCheckoutSession,
  createWorkspacePortalSession,
  getWorkspaceBillingData,
  getWorkspaceInvoices,
  reactivateWorkspaceSubscription,
} from '@/billing/billing.functions';

const {
  requireVerifiedSessionMock,
  getRequestHeadersMock,
  createCheckoutForWorkspaceMock,
  createWorkspaceBillingPortalMock,
  getWorkspaceBillingDataMock,
  reactivateWorkspaceSubscriptionMock,
  checkWorkspaceEntitlementMock,
  getInvoicesForWorkspaceMock,
  getWorkspaceOwnerUserIdMock,
} = vi.hoisted(() => ({
  requireVerifiedSessionMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
  createCheckoutForWorkspaceMock: vi.fn(),
  createWorkspaceBillingPortalMock: vi.fn(),
  getWorkspaceBillingDataMock: vi.fn(),
  reactivateWorkspaceSubscriptionMock: vi.fn(),
  checkWorkspaceEntitlementMock: vi.fn(),
  getInvoicesForWorkspaceMock: vi.fn(),
  getWorkspaceOwnerUserIdMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => createServerFnMock());

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/billing/billing.server', () => ({
  requireVerifiedSession: requireVerifiedSessionMock,
  createCheckoutForWorkspace: createCheckoutForWorkspaceMock,
  createWorkspaceBillingPortal: createWorkspaceBillingPortalMock,
  getWorkspaceBillingData: getWorkspaceBillingDataMock,
  reactivateWorkspaceSubscription: reactivateWorkspaceSubscriptionMock,
  checkWorkspaceEntitlement: checkWorkspaceEntitlementMock,
}));

vi.mock('@/init', () => ({
  auth: {
    billing: {
      getInvoicesForWorkspace: getInvoicesForWorkspaceMock,
      getWorkspaceOwnerUserId: getWorkspaceOwnerUserIdMock,
    },
  },
}));

vi.mock('@workspace/auth/plans', () => ({
  PLANS: [{ id: 'starter' }, { id: 'pro' }],
}));

const TEST_WORKSPACE_ID = 'ws-1';

/** Sets up mocks so the current user is the workspace owner. */
function mockOwnerSession() {
  const session = createMockSessionResponse();
  requireVerifiedSessionMock.mockResolvedValueOnce(session);
  getWorkspaceOwnerUserIdMock.mockResolvedValueOnce(session.user.id);
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

  it('rejects when user is not the workspace owner', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getWorkspaceOwnerUserIdMock.mockResolvedValueOnce('other-user-id');
    await expect(
      getWorkspaceInvoices({ data: { workspaceId: TEST_WORKSPACE_ID } })
    ).rejects.toMatchObject({
      message: 'Only the workspace owner can manage billing.',
    });
  });

  it('calls getInvoicesForWorkspace with workspace ID', async () => {
    mockOwnerSession();
    getInvoicesForWorkspaceMock.mockResolvedValueOnce([]);
    await getWorkspaceInvoices({ data: { workspaceId: TEST_WORKSPACE_ID } });
    expect(getInvoicesForWorkspaceMock).toHaveBeenCalledWith(TEST_WORKSPACE_ID);
  });

  it('returns the invoice list', async () => {
    const invoices = [{ id: 'inv-1', amount: 4900 }];
    mockOwnerSession();
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

  it('rejects when user is not the workspace owner', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getWorkspaceOwnerUserIdMock.mockResolvedValueOnce('other-user-id');
    await expect(
      createWorkspaceCheckoutSession({
        data: {
          workspaceId: TEST_WORKSPACE_ID,
          planId: 'pro',
          annual: false,
        },
      })
    ).rejects.toMatchObject({
      message: 'Only the workspace owner can manage billing.',
    });
  });

  it('passes workspaceId, planId, annual, and headers to createCheckoutForWorkspace', async () => {
    const headers = new Headers({ 'x-test': '1' });
    mockOwnerSession();
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
    mockOwnerSession();
    createCheckoutForWorkspaceMock.mockResolvedValueOnce(checkout);
    const result = await createWorkspaceCheckoutSession({
      data: {
        workspaceId: TEST_WORKSPACE_ID,
        planId: 'starter',
        annual: false,
      },
    });
    expect(result).toEqual(checkout);
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

  it('rejects when user is not the workspace owner', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getWorkspaceOwnerUserIdMock.mockResolvedValueOnce('other-user-id');
    await expect(
      createWorkspacePortalSession({
        data: { workspaceId: TEST_WORKSPACE_ID },
      })
    ).rejects.toMatchObject({
      message: 'Only the workspace owner can manage billing.',
    });
  });

  it('calls createWorkspaceBillingPortal with headers and workspaceId', async () => {
    const headers = new Headers();
    mockOwnerSession();
    getRequestHeadersMock.mockReturnValue(headers);
    createWorkspaceBillingPortalMock.mockResolvedValueOnce({
      url: 'https://portal.stripe.com',
    });
    await createWorkspacePortalSession({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
    expect(createWorkspaceBillingPortalMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID
    );
  });

  it('returns the portal URL', async () => {
    const portal = { url: 'https://portal.stripe.com' };
    mockOwnerSession();
    createWorkspaceBillingPortalMock.mockResolvedValueOnce(portal);
    const result = await createWorkspacePortalSession({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
    expect(result).toEqual(portal);
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

  it('rejects when user is not the workspace owner', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getWorkspaceOwnerUserIdMock.mockResolvedValueOnce('other-user-id');
    await expect(
      getWorkspaceBillingData({ data: { workspaceId: TEST_WORKSPACE_ID } })
    ).rejects.toMatchObject({
      message: 'Only the workspace owner can manage billing.',
    });
  });

  it('passes headers and workspaceId to getWorkspaceBillingData', async () => {
    const headers = new Headers();
    mockOwnerSession();
    getRequestHeadersMock.mockReturnValue(headers);
    getWorkspaceBillingDataMock.mockResolvedValueOnce({});
    await getWorkspaceBillingData({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
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
    mockOwnerSession();
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

  it('rejects when user is not the workspace owner', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getWorkspaceOwnerUserIdMock.mockResolvedValueOnce('other-user-id');
    await expect(
      reactivateWorkspaceSubscription({
        data: { workspaceId: TEST_WORKSPACE_ID },
      })
    ).rejects.toMatchObject({
      message: 'Only the workspace owner can manage billing.',
    });
  });

  it('calls reactivateWorkspaceSubscription with headers and workspaceId', async () => {
    const headers = new Headers();
    mockOwnerSession();
    getRequestHeadersMock.mockReturnValue(headers);
    reactivateWorkspaceSubscriptionMock.mockResolvedValueOnce({});
    await reactivateWorkspaceSubscription({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
    expect(reactivateWorkspaceSubscriptionMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID
    );
  });

  it('returns the reactivation result', async () => {
    const result = { status: 'active' };
    mockOwnerSession();
    reactivateWorkspaceSubscriptionMock.mockResolvedValueOnce(result);
    const actual = await reactivateWorkspaceSubscription({
      data: { workspaceId: TEST_WORKSPACE_ID },
    });
    expect(actual).toEqual(result);
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

  it('rejects when user is not the workspace owner', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getWorkspaceOwnerUserIdMock.mockResolvedValueOnce('other-user-id');
    await expect(
      checkWorkspaceEntitlement({
        data: { workspaceId: TEST_WORKSPACE_ID, key: 'members' },
      })
    ).rejects.toMatchObject({
      message: 'Only the workspace owner can manage billing.',
    });
  });

  it('passes headers, workspaceId, and key to checkWorkspaceEntitlement', async () => {
    const headers = new Headers();
    mockOwnerSession();
    getRequestHeadersMock.mockReturnValue(headers);
    checkWorkspaceEntitlementMock.mockResolvedValueOnce({ allowed: true });
    await checkWorkspaceEntitlement({
      data: { workspaceId: TEST_WORKSPACE_ID, key: 'members' },
    });
    expect(checkWorkspaceEntitlementMock).toHaveBeenCalledWith(
      headers,
      TEST_WORKSPACE_ID,
      'members'
    );
  });

  it('returns the entitlement check result', async () => {
    const limitResult = { allowed: false, limit: 1, current: 1 };
    mockOwnerSession();
    checkWorkspaceEntitlementMock.mockResolvedValueOnce(limitResult);
    const result = await checkWorkspaceEntitlement({
      data: { workspaceId: TEST_WORKSPACE_ID, key: 'members' },
    });
    expect(result).toEqual(limitResult);
  });
});
