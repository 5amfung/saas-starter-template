// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import {
  FREE_PLAN_FIXTURE,
  PRO_PLAN_FIXTURE,
  buildWorkspaceBillingDataFixture,
} from '../../../mocks/billing-fixtures';
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

function setupBillingData(overrides = {}) {
  getWorkspaceBillingDataMock.mockResolvedValue(
    buildWorkspaceBillingDataFixture({
      plan: FREE_PLAN_FIXTURE,
      ...overrides,
    })
  );
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

  it('calls createWorkspaceCheckoutSession when upgrade is clicked in manage dialog', async () => {
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

    await user.click(screen.getByRole('button', { name: /manage plan/i }));
    await user.click(screen.getAllByRole('button', { name: /^upgrade$/i })[1]);

    await waitFor(() => {
      expect(createWorkspaceCheckoutSessionMock).toHaveBeenCalledWith({
        data: {
          workspaceId: TEST_WORKSPACE_ID,
          planId: 'pro',
          annual: false,
          subscriptionId: undefined,
        },
      });
    });
  });

  it('shows error toast when checkout fails from manage dialog', async () => {
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

    await user.click(screen.getByRole('button', { name: /manage plan/i }));
    await user.click(screen.getAllByRole('button', { name: /^upgrade$/i })[1]);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Checkout failed');
    });
  });

  it('calls createWorkspacePortalSession when billing portal link is clicked on paid plan', async () => {
    const user = userEvent.setup();
    getWorkspaceBillingDataMock.mockResolvedValue(
      buildWorkspaceBillingDataFixture({
        plan: PRO_PLAN_FIXTURE,
        entitlements: PRO_PLAN_FIXTURE.entitlements,
        planId: 'pro',
        memberCount: 3,
        subscription: { periodEnd: new Date('2026-04-20').toISOString() },
      })
    );
    getWorkspaceInvoicesMock.mockResolvedValue([]);
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
    getWorkspaceBillingDataMock.mockResolvedValue(
      buildWorkspaceBillingDataFixture({
        plan: PRO_PLAN_FIXTURE,
        entitlements: PRO_PLAN_FIXTURE.entitlements,
        planId: 'pro',
        memberCount: 3,
        subscription: {
          periodEnd: new Date('2026-04-20').toISOString(),
          cancelAtPeriodEnd: true,
        },
      })
    );
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
    getWorkspaceBillingDataMock.mockResolvedValue(
      buildWorkspaceBillingDataFixture({
        plan: PRO_PLAN_FIXTURE,
        entitlements: PRO_PLAN_FIXTURE.entitlements,
        planId: 'pro',
        memberCount: 3,
        subscription: {
          periodEnd: new Date('2026-04-20').toISOString(),
          cancelAtPeriodEnd: true,
        },
      })
    );
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
