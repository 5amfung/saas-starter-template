// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import type { Entitlements, PlanDefinition } from '@/billing/core';
import { evaluateWorkspaceProductPolicy } from '@/billing/core';
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
  const buildProductPolicy = (
    currentPlan: PlanDefinition,
    currentEntitlements: Entitlements
  ) =>
    evaluateWorkspaceProductPolicy({
      currentPlan,
      resolvedEntitlements: currentEntitlements,
      subscriptionState: {
        status: null,
        stripeSubscriptionId: null,
        stripeScheduleId: null,
        periodEnd: null,
        cancelAtPeriodEnd: false,
        cancelAt: null,
      },
      scheduledTargetPlanId: null,
    });

  const defaultProps = {
    currentPlan: FREE_PLAN,
    currentEntitlements: FREE_PLAN.entitlements,
    productPolicy: buildProductPolicy(FREE_PLAN, FREE_PLAN.entitlements),
    nextBillingDate: null,
    onManagePlan: vi.fn(),
    onBillingPortal: vi.fn(),
    isBillingPortalLoading: false,
    workspaceName: 'Test Workspace',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows current plan details', () => {
    renderWithProviders(<BillingPlanCards {...defaultProps} />);

    expect(screen.getByText('Current plan')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Free forever')).toBeInTheDocument();
  });

  it('shows manage plan for free and hides billing portal', async () => {
    const user = userEvent.setup();
    const onManagePlan = vi.fn();

    renderWithProviders(
      <BillingPlanCards {...defaultProps} onManagePlan={onManagePlan} />
    );

    await user.click(screen.getByRole('button', { name: /manage plan/i }));
    expect(onManagePlan).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: /billing portal/i })
    ).not.toBeInTheDocument();
  });

  it('shows billing portal only for paid self-serve plans', async () => {
    const user = userEvent.setup();
    const onBillingPortal = vi.fn();

    renderWithProviders(
      <BillingPlanCards
        {...defaultProps}
        currentPlan={STARTER_PLAN}
        currentEntitlements={STARTER_PLAN.entitlements}
        productPolicy={buildProductPolicy(
          STARTER_PLAN,
          STARTER_PLAN.entitlements
        )}
        onBillingPortal={onBillingPortal}
      />
    );

    await user.click(screen.getByRole('button', { name: /billing portal/i }));
    expect(onBillingPortal).toHaveBeenCalledTimes(1);
  });

  it('shows enterprise contact sales and hides self-serve controls', () => {
    renderWithProviders(
      <BillingPlanCards
        {...defaultProps}
        currentPlan={ENTERPRISE_PLAN}
        currentEntitlements={ENTERPRISE_OVERRIDE_ENTITLEMENTS}
        productPolicy={buildProductPolicy(
          ENTERPRISE_PLAN,
          ENTERPRISE_OVERRIDE_ENTITLEMENTS
        )}
        workspaceName="Acme Corp"
      />
    );

    expect(screen.getByText('Custom pricing')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /contact sales/i })
    ).toHaveAttribute('href', expect.stringContaining('Acme%20Corp'));
    expect(
      screen.queryByRole('button', { name: /manage plan/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /billing portal/i })
    ).not.toBeInTheDocument();
  });

  it('shows renewal date for paid plans when provided', () => {
    renderWithProviders(
      <BillingPlanCards
        {...defaultProps}
        currentPlan={STARTER_PLAN}
        currentEntitlements={STARTER_PLAN.entitlements}
        productPolicy={buildProductPolicy(
          STARTER_PLAN,
          STARTER_PLAN.entitlements
        )}
        nextBillingDate={new Date('2026-05-15T12:00:00Z')}
      />
    );

    expect(screen.getByText(/renews on/i)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});
