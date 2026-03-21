// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { BillingPage } from '@/components/billing/billing-page';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  getUserBillingData,
  getInvoices,
  createCheckoutSession,
  createPortalSession,
  reactivateSubscription,
  toast,
} = vi.hoisted(() => ({
  getUserBillingData: vi.fn(),
  getInvoices: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  reactivateSubscription: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/billing/billing.functions', () => ({
  getUserBillingData,
  getInvoices,
  createCheckoutSession,
  createPortalSession,
  reactivateSubscription,
}));

vi.mock('sonner', () => ({ toast }));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FREE_PLAN = {
  id: 'free' as const,
  name: 'Free',
  tier: 0,
  pricing: null,
  limits: { maxWorkspaces: 1, maxMembersPerWorkspace: 1 },
  features: ['1 personal workspace', '1 member'],
  annualBonusFeatures: [],
};

const STARTER_PLAN = {
  id: 'starter' as const,
  name: 'Starter',
  tier: 1,
  pricing: {
    monthly: { price: 500 },
    annual: { price: 5000 },
  },
  limits: { maxWorkspaces: 5, maxMembersPerWorkspace: 5 },
  features: ['5 personal workspace', '5 member'],
  annualBonusFeatures: ['2 months free'],
};

const PRO_PLAN = {
  id: 'pro' as const,
  name: 'Pro',
  tier: 2,
  pricing: {
    monthly: { price: 2000 },
    annual: { price: 20000 },
  },
  limits: { maxWorkspaces: 25, maxMembersPerWorkspace: 25 },
  features: ['25 workspaces', '25 members per workspace'],
  annualBonusFeatures: ['2 months free'],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BillingPage', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    getInvoices.mockResolvedValue([]);

    // Capture the original location for cleanup.
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: 'http://localhost/' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('returns null while billing data is loading', () => {
    // Never resolves — keeps query in pending state.
    getUserBillingData.mockImplementation(() => new Promise(() => {}));

    const { container } = renderWithProviders(<BillingPage />);

    expect(container.firstChild).toBeNull();
  });

  it('renders plan cards once billing data loads', async () => {
    getUserBillingData.mockResolvedValue({
      planId: 'free',
      plan: FREE_PLAN,
      subscription: null,
    });

    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    // Upgrade plan card should also appear.
    expect(screen.getByText('Starter')).toBeInTheDocument();
  });

  it('renders invoice table section', async () => {
    getUserBillingData.mockResolvedValue({
      planId: 'free',
      plan: FREE_PLAN,
      subscription: null,
    });
    getInvoices.mockResolvedValue([]);

    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      // The invoice section renders an h3 with text "Invoices".
      expect(
        screen.getByText('Invoices', { selector: 'h3' })
      ).toBeInTheDocument();
    });
  });

  it('does not show downgrade banner when subscription is not pending cancel', async () => {
    getUserBillingData.mockResolvedValue({
      planId: 'starter',
      plan: STARTER_PLAN,
      subscription: {
        status: 'active',
        periodEnd: new Date('2026-04-01'),
        cancelAtPeriodEnd: false,
        cancelAt: null,
      },
    });

    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/your plan will downgrade/i)
    ).not.toBeInTheDocument();
  });

  it('shows downgrade banner when subscription is pending cancel', async () => {
    getUserBillingData.mockResolvedValue({
      planId: 'starter',
      plan: STARTER_PLAN,
      subscription: {
        status: 'active',
        periodEnd: new Date('2026-04-15'),
        cancelAtPeriodEnd: true,
        cancelAt: null,
      },
    });

    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/your plan will downgrade/i)).toBeInTheDocument();
    });
  });

  it('redirects via window.location.href on upgrade success', async () => {
    getUserBillingData.mockResolvedValue({
      planId: 'free',
      plan: FREE_PLAN,
      subscription: null,
    });
    createCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/test123',
    });

    const user = userEvent.setup();
    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/upgrade to starter/i)).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /upgrade to starter/i })
    );

    await waitFor(() => {
      expect(window.location.href).toBe('https://checkout.stripe.com/test123');
    });
  });

  it('redirects via window.location.href on manage subscription success', async () => {
    getUserBillingData.mockResolvedValue({
      planId: 'starter',
      plan: STARTER_PLAN,
      subscription: {
        status: 'active',
        periodEnd: new Date('2026-04-01'),
        cancelAtPeriodEnd: false,
        cancelAt: null,
      },
    });
    createPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/portal123',
    });

    const user = userEvent.setup();
    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /manage subscription/i })
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /manage subscription/i })
    );

    await waitFor(() => {
      expect(window.location.href).toBe('https://billing.stripe.com/portal123');
    });
  });

  it('shows success toast and does not redirect on reactivate success', async () => {
    getUserBillingData.mockResolvedValue({
      planId: 'starter',
      plan: STARTER_PLAN,
      subscription: {
        status: 'active',
        periodEnd: new Date('2026-04-15'),
        cancelAtPeriodEnd: true,
        cancelAt: null,
      },
    });
    reactivateSubscription.mockResolvedValue({ success: true });

    const user = userEvent.setup();
    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /keep subscription/i })
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /keep subscription/i })
    );

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Subscription reactivated.');
    });

    // Reactivation must not redirect.
    expect(window.location.href).toBe('http://localhost/');
  });

  it('shows error toast when upgrade fails', async () => {
    getUserBillingData.mockResolvedValue({
      planId: 'free',
      plan: FREE_PLAN,
      subscription: null,
    });
    createCheckoutSession.mockRejectedValue(
      new Error('Failed to start checkout.')
    );

    const user = userEvent.setup();
    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/upgrade to starter/i)).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /upgrade to starter/i })
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to start checkout.');
    });
  });

  it('shows custom plan card when user is on highest tier plan', async () => {
    getUserBillingData.mockResolvedValue({
      planId: 'pro',
      plan: PRO_PLAN,
      subscription: {
        status: 'active',
        periodEnd: new Date('2026-04-01'),
        cancelAtPeriodEnd: false,
        cancelAt: null,
      },
    });

    renderWithProviders(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    expect(screen.getByText('Custom plan')).toBeInTheDocument();
  });
});
