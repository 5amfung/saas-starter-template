// @vitest-environment jsdom
// apps/web/test/unit/components/billing/billing-plan-cards.test.tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import type { Entitlements, PlanDefinition } from '@workspace/auth/plans';
import { BillingPlanCards } from '@/components/billing/billing-plan-cards';

const FREE_PLAN: PlanDefinition = {
  id: 'free',
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

const STARTER_PLAN: PlanDefinition = {
  id: 'starter',
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

const PRO_PLAN: PlanDefinition = {
  id: 'pro',
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

const ENTERPRISE_PLAN: PlanDefinition = {
  id: 'enterprise',
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

const ENTERPRISE_OVERRIDE_ENTITLEMENTS: Entitlements = {
  limits: { members: 42, projects: -1, apiKeys: 2 },
  features: {
    sso: true,
    auditLogs: false,
    apiAccess: true,
    prioritySupport: true,
  },
  quotas: { storageGb: 500, apiCallsMonthly: -1 },
};

describe('BillingPlanCards', () => {
  const defaultProps = {
    currentPlan: FREE_PLAN,
    currentEntitlements: FREE_PLAN.entitlements,
    upgradePlans: [STARTER_PLAN],
    nextBillingDate: null,
    annualByPlan: {},
    onToggleInterval: vi.fn(),
    onManagePlan: vi.fn(),
    onUpgrade: vi.fn(),
    onBillingPortal: vi.fn(),
    isManaging: false,
    isBillingPortalLoading: false,
    upgradingPlanId: null,
    workspaceName: 'Test Workspace',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('current plan card', () => {
    it('shows current plan label and name', () => {
      renderWithProviders(<BillingPlanCards {...defaultProps} />);
      expect(screen.getByText('Current plan')).toBeInTheDocument();
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    it('shows "Free forever" for free plan', () => {
      renderWithProviders(<BillingPlanCards {...defaultProps} />);
      expect(screen.getByText('Free forever')).toBeInTheDocument();
    });

    it('shows custom pricing for enterprise current plan', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={ENTERPRISE_PLAN}
          currentEntitlements={ENTERPRISE_OVERRIDE_ENTITLEMENTS}
          upgradePlans={[]}
        />
      );

      expect(screen.getByText('Custom pricing')).toBeInTheDocument();
      expect(screen.queryByText('Free forever')).not.toBeInTheDocument();
    });

    it('shows formatted price for paid plan', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={STARTER_PLAN}
          upgradePlans={[PRO_PLAN]}
        />
      );
      // formatPlanPrice(STARTER_PLAN, false) = "$5/mo".
      expect(screen.getByText('$5/mo')).toBeInTheDocument();
    });

    it('shows current plan features from resolved entitlements', () => {
      const currentEntitlements: Entitlements = {
        ...FREE_PLAN.entitlements,
        limits: {
          ...FREE_PLAN.entitlements.limits,
          members: 3,
        },
      };

      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentEntitlements={currentEntitlements}
        />
      );
      expect(screen.getByText(/up to 3 members/i)).toBeInTheDocument();
    });

    it('shows renewal date when nextBillingDate is provided', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={STARTER_PLAN}
          upgradePlans={[PRO_PLAN]}
          nextBillingDate={new Date('2026-05-15T12:00:00Z')}
        />
      );
      expect(screen.getByText(/Renews on/)).toBeInTheDocument();
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });

    it('does not show renewal date when nextBillingDate is null', () => {
      renderWithProviders(<BillingPlanCards {...defaultProps} />);
      expect(screen.queryByText(/Renews on/)).not.toBeInTheDocument();
    });

    it('does not show manage button for free plan', () => {
      renderWithProviders(<BillingPlanCards {...defaultProps} />);
      expect(
        screen.queryByRole('button', { name: /manage plan/i })
      ).not.toBeInTheDocument();
    });

    it('shows manage plan button for paid plan', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={STARTER_PLAN}
          upgradePlans={[PRO_PLAN]}
        />
      );
      expect(
        screen.getByRole('button', { name: /manage plan/i })
      ).toBeInTheDocument();
    });

    it('calls onManagePlan when manage button is clicked', async () => {
      const user = userEvent.setup();
      const onManagePlan = vi.fn();
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={STARTER_PLAN}
          upgradePlans={[PRO_PLAN]}
          onManagePlan={onManagePlan}
        />
      );
      await user.click(screen.getByRole('button', { name: /manage plan/i }));
      expect(onManagePlan).toHaveBeenCalledTimes(1);
    });

    it('disables manage button and shows loading text when isManaging', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={STARTER_PLAN}
          upgradePlans={[PRO_PLAN]}
          isManaging={true}
        />
      );
      expect(screen.getByRole('button', { name: /opening/i })).toBeDisabled();
    });

    it('shows billing portal link for paid plan', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={STARTER_PLAN}
          upgradePlans={[PRO_PLAN]}
        />
      );
      expect(
        screen.getByRole('button', { name: /billing portal/i })
      ).toBeInTheDocument();
    });

    it('calls onBillingPortal when billing portal link is clicked', async () => {
      const user = userEvent.setup();
      const onBillingPortal = vi.fn();
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={STARTER_PLAN}
          upgradePlans={[PRO_PLAN]}
          onBillingPortal={onBillingPortal}
        />
      );
      await user.click(screen.getByRole('button', { name: /billing portal/i }));
      expect(onBillingPortal).toHaveBeenCalledTimes(1);
    });
  });

  describe('upgrade plan card', () => {
    it('shows "Upgrade to" label and upgrade plan name', () => {
      renderWithProviders(<BillingPlanCards {...defaultProps} />);
      expect(screen.getByText('Upgrade to')).toBeInTheDocument();
      expect(screen.getByText('Starter')).toBeInTheDocument();
    });

    it('shows monthly price by default', () => {
      renderWithProviders(
        <BillingPlanCards {...defaultProps} annualByPlan={{}} />
      );
      // formatPlanPrice(STARTER_PLAN, false) = "$5/mo".
      expect(screen.getByText('$5/mo')).toBeInTheDocument();
    });

    it('shows annual price when annualByPlan has plan set to true', () => {
      renderWithProviders(
        <BillingPlanCards {...defaultProps} annualByPlan={{ starter: true }} />
      );
      // formatPlanPrice(STARTER_PLAN, true) = annual price / 12 / 100 ~ $4.17/mo.
      expect(screen.getByText(/\$4/)).toBeInTheDocument();
    });

    it('calls onToggleInterval with planId and false when Monthly toggle is clicked', async () => {
      const user = userEvent.setup();
      const onToggleInterval = vi.fn();
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          annualByPlan={{ starter: true }}
          onToggleInterval={onToggleInterval}
        />
      );
      await user.click(
        screen.getByRole('button', { name: /monthly billing/i })
      );
      expect(onToggleInterval).toHaveBeenCalledWith('starter', false);
    });

    it('calls onToggleInterval with planId and true when Annual toggle is clicked', async () => {
      const user = userEvent.setup();
      const onToggleInterval = vi.fn();
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          annualByPlan={{}}
          onToggleInterval={onToggleInterval}
        />
      );
      await user.click(screen.getByRole('button', { name: /annual billing/i }));
      expect(onToggleInterval).toHaveBeenCalledWith('starter', true);
    });

    it('shows entitlement-derived features for upgrade plan', () => {
      renderWithProviders(
        <BillingPlanCards {...defaultProps} annualByPlan={{ starter: true }} />
      );
      // describeEntitlements for STARTER_PLAN produces "Up to 5 members".
      expect(screen.getByText(/up to 5 members/i)).toBeInTheDocument();
    });

    it('calls onUpgrade with the upgrade plan id and annual state when upgrade button is clicked', async () => {
      const user = userEvent.setup();
      const onUpgrade = vi.fn();
      renderWithProviders(
        <BillingPlanCards {...defaultProps} onUpgrade={onUpgrade} />
      );
      await user.click(
        screen.getByRole('button', { name: /upgrade to starter/i })
      );
      expect(onUpgrade).toHaveBeenCalledWith('starter', false);
    });

    it('disables upgrade button and shows loading text when upgradingPlanId matches', () => {
      renderWithProviders(
        <BillingPlanCards {...defaultProps} upgradingPlanId="starter" />
      );
      expect(
        screen.getByRole('button', { name: /redirecting/i })
      ).toBeDisabled();
    });

    it('disables all upgrade buttons when any plan is upgrading', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          upgradePlans={[STARTER_PLAN, PRO_PLAN]}
          upgradingPlanId="starter"
        />
      );
      // The starter button shows "Redirecting..." and is disabled.
      expect(
        screen.getByRole('button', { name: /redirecting/i })
      ).toBeDisabled();
      // The pro button is also disabled because upgradingPlanId is non-null.
      expect(
        screen.getByRole('button', { name: /upgrade to pro/i })
      ).toBeDisabled();
    });

    it('renders multiple upgrade plan cards', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          upgradePlans={[STARTER_PLAN, PRO_PLAN]}
        />
      );
      expect(screen.getAllByText('Upgrade to')).toHaveLength(2);
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Pro')).toBeInTheDocument();
    });
  });

  describe('enterprise plan card', () => {
    it('shows "Custom pricing" and "Contact Sales" link for enterprise plan', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={PRO_PLAN}
          upgradePlans={[ENTERPRISE_PLAN]}
        />
      );
      expect(screen.getByText('Custom pricing')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /contact sales/i })
      ).toBeInTheDocument();
    });

    it('does not show monthly/annual toggle for enterprise plan', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={PRO_PLAN}
          upgradePlans={[ENTERPRISE_PLAN]}
        />
      );
      // Only the current plan card has no toggle; enterprise upgrade card also has none.
      expect(
        screen.queryByRole('button', { name: /monthly billing/i })
      ).not.toBeInTheDocument();
    });

    it('enterprise Contact Sales link has mailto href with workspace name', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={PRO_PLAN}
          upgradePlans={[ENTERPRISE_PLAN]}
          workspaceName="Acme Corp"
        />
      );
      const link = screen.getByRole('link', { name: /contact sales/i });
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining('mailto:sales@example.com')
      );
      expect(link).toHaveAttribute(
        'href',
        expect.stringContaining('Acme%20Corp')
      );
    });
  });

  describe('no upgrade plan (highest tier)', () => {
    it('shows custom plan card when upgradePlans is empty', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={ENTERPRISE_PLAN}
          upgradePlans={[]}
        />
      );
      expect(screen.getByText('Need more?')).toBeInTheDocument();
      expect(screen.getByText('Custom plan')).toBeInTheDocument();
      expect(
        screen.getByText(/contact us for a custom plan/i)
      ).toBeInTheDocument();
    });
  });
});
