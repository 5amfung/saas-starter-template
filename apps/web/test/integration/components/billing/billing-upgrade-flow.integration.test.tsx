// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    // getUpgradePlans is re-configured per-test as needed; default returns proPlan.
    getUpgradePlans: vi.fn().mockReturnValue([
      {
        id: 'pro',
        name: 'Pro',
        tier: 1,
        pricing: { monthly: { price: 4900 }, annual: { price: 49000 } },
        limits: { maxWorkspaces: 5, maxMembersPerWorkspace: 5 },
        features: ['Up to 5 workspaces'],
        annualBonusFeatures: ['2 months free'],
      },
    ]),
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
