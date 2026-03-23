import { createMockSessionResponse } from '@workspace/test-utils';
import { createServerFnMock } from '../../mocks/server-fn';
import {
  checkPlanLimit,
  createCheckoutSession,
  createPortalSession,
  getInvoices,
  getUserBillingData,
  reactivateSubscription,
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

vi.mock('@tanstack/react-start', () => createServerFnMock());

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
