// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { BillingPage } from '@/components/billing/billing-page';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  getWorkspaceBillingData,
  getWorkspaceInvoices,
  createWorkspaceCheckoutSession,
  createWorkspacePortalSession,
  reactivateWorkspaceSubscription,
  toast,
} = vi.hoisted(() => ({
  getWorkspaceBillingData: vi.fn(),
  getWorkspaceInvoices: vi.fn(),
  createWorkspaceCheckoutSession: vi.fn(),
  createWorkspacePortalSession: vi.fn(),
  reactivateWorkspaceSubscription: vi.fn(),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/billing/billing.functions', () => ({
  getWorkspaceBillingData,
  getWorkspaceInvoices,
  createWorkspaceCheckoutSession,
  createWorkspacePortalSession,
  reactivateWorkspaceSubscription,
}));

vi.mock('sonner', () => ({ toast }));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_WORKSPACE_ID = 'ws-test-123';

const FREE_PLAN = {
  id: 'free' as const,
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

const STARTER_PLAN = {
  id: 'starter' as const,
  name: 'Starter',
  tier: 1,
  pricing: {
    monthly: { price: 500 },
    annual: { price: 5000 },
  },
  entitlements: {
    limits: { members: 5, projects: 5, workspaces: 5, apiKeys: 0 },
    features: {
      sso: false,
      auditLogs: false,
      apiAccess: false,
      prioritySupport: false,
    },
    quotas: { storageGb: 10, apiCallsMonthly: 0 },
  },
  stripeEnabled: true,
  isEnterprise: false,
};

const PRO_PLAN = {
  id: 'pro' as const,
  name: 'Pro',
  tier: 2,
  pricing: {
    monthly: { price: 2000 },
    annual: { price: 20000 },
  },
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BillingPage', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceInvoices.mockResolvedValue([]);

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
    getWorkspaceBillingData.mockImplementation(() => new Promise(() => {}));

    const { container } = renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders plan cards once billing data loads', async () => {
    getWorkspaceBillingData.mockResolvedValue({
      planId: 'free',
      plan: FREE_PLAN,
      subscription: null,
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

    // Upgrade plan card should also appear.
    expect(screen.getByText('Starter')).toBeInTheDocument();
  });

  it('renders invoice table section', async () => {
    getWorkspaceBillingData.mockResolvedValue({
      planId: 'free',
      plan: FREE_PLAN,
      subscription: null,
    });
    getWorkspaceInvoices.mockResolvedValue([]);

    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      // The invoice section renders an h3 with text "Invoices".
      expect(
        screen.getByText('Invoices', { selector: 'h3' })
      ).toBeInTheDocument();
    });
  });

  it('does not show downgrade banner when subscription is not pending cancel', async () => {
    getWorkspaceBillingData.mockResolvedValue({
      planId: 'starter',
      plan: STARTER_PLAN,
      subscription: {
        status: 'active',
        periodEnd: new Date('2026-04-01'),
        cancelAtPeriodEnd: false,
        cancelAt: null,
      },
    });

    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/your plan will downgrade/i)
    ).not.toBeInTheDocument();
  });

  it('shows downgrade banner when subscription is pending cancel', async () => {
    getWorkspaceBillingData.mockResolvedValue({
      planId: 'starter',
      plan: STARTER_PLAN,
      subscription: {
        status: 'active',
        periodEnd: new Date('2026-04-15'),
        cancelAtPeriodEnd: true,
        cancelAt: null,
      },
    });

    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/your plan will downgrade/i)).toBeInTheDocument();
    });
  });

  it('redirects via window.location.href on upgrade success', async () => {
    getWorkspaceBillingData.mockResolvedValue({
      planId: 'free',
      plan: FREE_PLAN,
      subscription: null,
    });
    createWorkspaceCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/test123',
    });

    const user = userEvent.setup();
    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

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

  it('redirects via window.location.href on billing portal click', async () => {
    getWorkspaceBillingData.mockResolvedValue({
      planId: 'starter',
      plan: STARTER_PLAN,
      subscription: {
        status: 'active',
        periodEnd: new Date('2026-04-01'),
        cancelAtPeriodEnd: false,
        cancelAt: null,
      },
    });
    createWorkspacePortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/portal123',
    });

    const user = userEvent.setup();
    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /billing portal/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /billing portal/i }));

    await waitFor(() => {
      expect(window.location.href).toBe('https://billing.stripe.com/portal123');
    });
  });

  it('shows success toast and does not redirect on reactivate success', async () => {
    getWorkspaceBillingData.mockResolvedValue({
      planId: 'starter',
      plan: STARTER_PLAN,
      subscription: {
        status: 'active',
        periodEnd: new Date('2026-04-15'),
        cancelAtPeriodEnd: true,
        cancelAt: null,
      },
    });
    reactivateWorkspaceSubscription.mockResolvedValue({ success: true });

    const user = userEvent.setup();
    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

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
    getWorkspaceBillingData.mockResolvedValue({
      planId: 'free',
      plan: FREE_PLAN,
      subscription: null,
    });
    createWorkspaceCheckoutSession.mockRejectedValue(
      new Error('Failed to start checkout.')
    );

    const user = userEvent.setup();
    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

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

  it('shows enterprise card with Contact Sales when user is on Pro plan', async () => {
    getWorkspaceBillingData.mockResolvedValue({
      planId: 'pro',
      plan: PRO_PLAN,
      subscription: {
        status: 'active',
        periodEnd: new Date('2026-04-01'),
        cancelAtPeriodEnd: false,
        cancelAt: null,
      },
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

    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    expect(screen.getByText('Custom pricing')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /contact sales/i })
    ).toBeInTheDocument();
  });
});
