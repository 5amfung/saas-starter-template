// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { evaluateWorkspaceProductPolicy } from '@workspace/billing';
import { renderWithProviders } from '@workspace/test-utils';
import { BillingPage } from '@/components/billing/billing-page';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  getWorkspaceBillingData,
  getWorkspaceInvoices,
  createWorkspaceCheckoutSession,
  createWorkspacePortalSession,
  downgradeWorkspaceSubscription,
  cancelWorkspaceSubscription,
  reactivateWorkspaceSubscription,
  toast,
} = vi.hoisted(() => ({
  getWorkspaceBillingData: vi.fn(),
  getWorkspaceInvoices: vi.fn(),
  createWorkspaceCheckoutSession: vi.fn(),
  createWorkspacePortalSession: vi.fn(),
  downgradeWorkspaceSubscription: vi.fn(),
  cancelWorkspaceSubscription: vi.fn(),
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
  downgradeWorkspaceSubscription,
  cancelWorkspaceSubscription,
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
    limits: { members: 1, projects: 1, apiKeys: 0 },
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
    limits: { members: 5, projects: 5, apiKeys: 0 },
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
    limits: { members: 25, projects: 100, apiKeys: 5 },
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

const ENTERPRISE_PLAN = {
  id: 'enterprise' as const,
  name: 'Enterprise',
  tier: 3,
  pricing: null,
  entitlements: {
    limits: { members: -1, projects: -1, apiKeys: -1 },
    features: {
      sso: true,
      auditLogs: true,
      apiAccess: true,
      prioritySupport: true,
    },
    quotas: { storageGb: -1, apiCallsMonthly: -1 },
  },
  stripeEnabled: true,
  isEnterprise: true,
};

function buildBillingData({
  plan,
  entitlements = plan.entitlements,
  subscription = null,
  scheduledTargetPlanId = null,
  memberCount = 0,
}: {
  plan:
    | typeof FREE_PLAN
    | typeof STARTER_PLAN
    | typeof PRO_PLAN
    | typeof ENTERPRISE_PLAN;
  entitlements?: typeof FREE_PLAN.entitlements;
  subscription?: {
    status: string | null;
    periodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    cancelAt: Date | null;
    stripeSubscriptionId?: string | null;
    stripeScheduleId?: string | null;
  } | null;
  scheduledTargetPlanId?: 'free' | 'starter' | 'pro' | 'enterprise' | null;
  memberCount?: number;
}) {
  return {
    planId: plan.id,
    plan,
    entitlements,
    subscription,
    scheduledTargetPlanId,
    memberCount,
    productPolicy: evaluateWorkspaceProductPolicy({
      currentPlan: plan,
      resolvedEntitlements: entitlements,
      subscriptionState: {
        status: subscription?.status ?? null,
        stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
        stripeScheduleId: subscription?.stripeScheduleId ?? null,
        periodEnd: subscription?.periodEnd ?? null,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
        cancelAt: subscription?.cancelAt ?? null,
      },
      scheduledTargetPlanId,
    }),
  };
}

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
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({ plan: FREE_PLAN })
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
  });

  it('renders invoice table section', async () => {
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({ plan: FREE_PLAN })
    );
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
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({
        plan: STARTER_PLAN,
        subscription: {
          status: 'active',
          periodEnd: new Date('2026-04-01'),
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      })
    );

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
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({
        plan: STARTER_PLAN,
        subscription: {
          status: 'active',
          periodEnd: new Date('2026-04-15'),
          cancelAtPeriodEnd: true,
          cancelAt: null,
        },
      })
    );

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
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({ plan: FREE_PLAN })
    );
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
      expect(
        screen.getByRole('button', { name: /manage plan/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /manage plan/i }));
    await user.click(screen.getAllByRole('button', { name: /^upgrade$/i })[0]);

    await waitFor(() => {
      expect(window.location.href).toBe('https://checkout.stripe.com/test123');
    });
  });

  it('redirects via window.location.href on billing portal click', async () => {
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({
        plan: STARTER_PLAN,
        subscription: {
          status: 'active',
          periodEnd: new Date('2026-04-01'),
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      })
    );
    createWorkspacePortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/portal123',
    });
    downgradeWorkspaceSubscription.mockResolvedValue({ success: true });
    cancelWorkspaceSubscription.mockResolvedValue({ success: true });

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
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({
        plan: STARTER_PLAN,
        subscription: {
          status: 'active',
          periodEnd: new Date('2026-04-15'),
          cancelAtPeriodEnd: true,
          cancelAt: null,
        },
      })
    );
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
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({ plan: FREE_PLAN })
    );
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
      expect(
        screen.getByRole('button', { name: /manage plan/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /manage plan/i }));
    await user.click(screen.getAllByRole('button', { name: /^upgrade$/i })[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to start checkout.');
    });
  });

  it('shows pro current-plan card without enterprise upsell card', async () => {
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({
        plan: PRO_PLAN,
        subscription: {
          status: 'active',
          periodEnd: new Date('2026-04-01'),
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      })
    );

    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('button', { name: /manage plan/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /billing portal/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /contact sales/i })
    ).not.toBeInTheDocument();
  });

  it('shows the downgrade banner immediately after scheduling a downgrade', async () => {
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({
        plan: PRO_PLAN,
        subscription: {
          status: 'active',
          periodEnd: new Date('2026-04-15'),
          cancelAtPeriodEnd: false,
          cancelAt: null,
          stripeSubscriptionId: 'sub_123',
        },
      })
    );
    downgradeWorkspaceSubscription.mockResolvedValue({ success: true });

    const user = userEvent.setup();
    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /manage plan/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /manage plan/i }));
    await user.click(screen.getAllByRole('button', { name: 'Downgrade' })[1]);
    await user.click(
      screen.getByRole('button', { name: /confirm downgrade/i })
    );

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Downgrade scheduled.');
    });

    expect(
      screen.getByText(/Your plan will downgrade to Starter on/i)
    ).toBeInTheDocument();
  });

  it('shows pending cancellation notice immediately after scheduling cancellation', async () => {
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({
        plan: STARTER_PLAN,
        subscription: {
          status: 'active',
          periodEnd: new Date('2026-04-15'),
          cancelAtPeriodEnd: false,
          cancelAt: null,
          stripeSubscriptionId: 'sub_456',
        },
      })
    );
    cancelWorkspaceSubscription.mockResolvedValue({ success: true });

    const user = userEvent.setup();
    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /manage plan/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /manage plan/i }));
    await user.click(screen.getByRole('button', { name: 'Downgrade' }));
    await user.click(
      screen.getByRole('button', { name: /confirm downgrade/i })
    );

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Subscription will cancel at period end.'
      );
    });

    await user.click(screen.getByRole('button', { name: /manage plan/i }));

    expect(screen.getByText(/pending cancellation/i)).toBeInTheDocument();
  });

  it('shows current enterprise entitlements and custom pricing language', async () => {
    getWorkspaceBillingData.mockResolvedValue(
      buildBillingData({
        plan: ENTERPRISE_PLAN,
        entitlements: {
          limits: { members: 42, projects: -1, apiKeys: 2 },
          features: {
            sso: true,
            auditLogs: false,
            apiAccess: true,
            prioritySupport: true,
          },
          quotas: { storageGb: 500, apiCallsMonthly: -1 },
        },
        subscription: {
          status: 'active',
          periodEnd: new Date('2026-04-01'),
          cancelAtPeriodEnd: false,
          cancelAt: null,
        },
      })
    );

    renderWithProviders(
      <BillingPage
        workspaceId={TEST_WORKSPACE_ID}
        workspaceName="Test Workspace"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Custom pricing').length).toBeGreaterThan(0);
    expect(screen.getByText(/up to 42 members/i)).toBeInTheDocument();
    expect(screen.queryByText('Free forever')).not.toBeInTheDocument();
  });
});
