// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { BillingPage } from '@/components/billing/billing-page';

const {
  getWorkspaceBillingDataMock,
  getWorkspaceInvoicesMock,
  createWorkspaceCheckoutSessionMock,
  createWorkspacePortalSessionMock,
  reactivateWorkspaceSubscriptionMock,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  getWorkspaceBillingDataMock: vi.fn(),
  getWorkspaceInvoicesMock: vi.fn(),
  createWorkspaceCheckoutSessionMock: vi.fn(),
  createWorkspacePortalSessionMock: vi.fn(),
  reactivateWorkspaceSubscriptionMock: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/billing/billing.functions', () => ({
  getWorkspaceBillingData: getWorkspaceBillingDataMock,
  getWorkspaceInvoices: getWorkspaceInvoicesMock,
  createWorkspaceCheckoutSession: createWorkspaceCheckoutSessionMock,
  createWorkspacePortalSession: createWorkspacePortalSessionMock,
  reactivateWorkspaceSubscription: reactivateWorkspaceSubscriptionMock,
}));

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock('@workspace/components/hooks', () => ({
  SESSION_QUERY_KEY: ['session', 'current'] as const,
}));

const TEST_WORKSPACE_ID = 'ws_integration_test';

const freePlan = {
  id: 'free',
  name: 'Free',
  tier: 0,
  pricing: null,
  entitlements: {
    limits: { members: 1, projects: 1, workspaces: 1, apiKeys: 0 },
    features: {
      sso: false,
      auditLogs: false,
      apiAccess: false,
      prioritySupport: false,
    },
    quotas: { storageGb: 1, apiCallsMonthly: 0 },
  },
  stripeEnabled: false,
  isEnterprise: false,
};

const proPlan = {
  id: 'pro',
  name: 'Pro',
  tier: 2,
  pricing: { monthly: { price: 4900 }, annual: { price: 49000 } },
  entitlements: {
    limits: { members: 25, projects: 100, workspaces: 10, apiKeys: 5 },
    features: {
      sso: false,
      auditLogs: true,
      apiAccess: true,
      prioritySupport: true,
    },
    quotas: { storageGb: 50, apiCallsMonthly: 1000 },
  },
  stripeEnabled: true,
  isEnterprise: false,
};

vi.mock('@workspace/auth/plans', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    getUpgradePlans: vi.fn().mockReturnValue([
      {
        id: 'pro',
        name: 'Pro',
        tier: 2,
        pricing: { monthly: { price: 4900 }, annual: { price: 49000 } },
        entitlements: {
          limits: { members: 25, projects: 100, workspaces: 10, apiKeys: 5 },
          features: {
            sso: false,
            auditLogs: true,
            apiAccess: true,
            prioritySupport: true,
          },
          quotas: { storageGb: 50, apiCallsMonthly: 1000 },
        },
        stripeEnabled: true,
        isEnterprise: false,
      },
    ]),
  };
});

function setupBillingData(overrides = {}) {
  getWorkspaceBillingDataMock.mockResolvedValue({
    plan: freePlan,
    entitlements: freePlan.entitlements,
    subscription: null,
    ...overrides,
  });
  getWorkspaceInvoicesMock.mockResolvedValue([]);
}

describe('BillingPage integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: '',
    } as Location);
  });

  it('renders current plan details after data loads', async () => {
    setupBillingData();
    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    expect(screen.getByText(/current plan/i)).toBeInTheDocument();
  });

  it('calls createWorkspaceCheckoutSession when upgrade is clicked', async () => {
    const user = userEvent.setup();
    setupBillingData();
    createWorkspaceCheckoutSessionMock.mockResolvedValueOnce({
      url: 'https://stripe.com/checkout',
    });
    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /upgrade to pro/i }));

    await waitFor(() => {
      expect(createWorkspaceCheckoutSessionMock).toHaveBeenCalledWith({
        data: { workspaceId: TEST_WORKSPACE_ID, planId: 'pro', annual: false },
      });
    });
  });

  it('shows error toast when checkout fails', async () => {
    const user = userEvent.setup();
    setupBillingData();
    createWorkspaceCheckoutSessionMock.mockRejectedValueOnce(
      new Error('Checkout failed')
    );
    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /upgrade to pro/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Checkout failed');
    });
  });

  it('calls createWorkspacePortalSession when billing portal link is clicked on paid plan', async () => {
    const user = userEvent.setup();
    getWorkspaceBillingDataMock.mockResolvedValue({
      plan: proPlan,
      entitlements: proPlan.entitlements,
      subscription: { periodEnd: new Date('2026-04-20').toISOString() },
    });
    getWorkspaceInvoicesMock.mockResolvedValue([]);
    const { getUpgradePlans } = await import('@workspace/auth/plans');
    (getUpgradePlans as ReturnType<typeof vi.fn>).mockReturnValue([]);
    createWorkspacePortalSessionMock.mockResolvedValueOnce({
      url: 'https://portal.stripe.com',
    });

    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /billing portal/i }));

    await waitFor(() => {
      expect(createWorkspacePortalSessionMock).toHaveBeenCalledTimes(1);
    });
  });

  it('reactivates canceled subscription on Keep subscription click', async () => {
    const user = userEvent.setup();
    getWorkspaceBillingDataMock.mockResolvedValue({
      plan: proPlan,
      entitlements: proPlan.entitlements,
      subscription: {
        periodEnd: new Date('2026-04-20').toISOString(),
        cancelAtPeriodEnd: true,
      },
    });
    getWorkspaceInvoicesMock.mockResolvedValue([]);
    reactivateWorkspaceSubscriptionMock.mockResolvedValueOnce({});

    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/will downgrade/i)).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /keep subscription/i })
    );

    await waitFor(() => {
      expect(reactivateWorkspaceSubscriptionMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Subscription reactivated.'
      );
    });
  });

  it('shows error toast when reactivation fails', async () => {
    const user = userEvent.setup();
    getWorkspaceBillingDataMock.mockResolvedValue({
      plan: proPlan,
      entitlements: proPlan.entitlements,
      subscription: {
        periodEnd: new Date('2026-04-20').toISOString(),
        cancelAtPeriodEnd: true,
      },
    });
    getWorkspaceInvoicesMock.mockResolvedValue([]);
    reactivateWorkspaceSubscriptionMock.mockRejectedValueOnce(
      new Error('Reactivation failed')
    );

    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

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
