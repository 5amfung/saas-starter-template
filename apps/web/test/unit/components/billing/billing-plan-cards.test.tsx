// @vitest-environment jsdom
// apps/web/test/unit/components/billing/billing-plan-cards.test.tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import type { Plan } from '@workspace/auth/plans';
import { BillingPlanCards } from '@/components/billing/billing-plan-cards';

const FREE_PLAN: Plan = {
  id: 'free',
  name: 'Free',
  tier: 0,
  pricing: null,
  limits: { maxMembers: 1 },
  features: ['1 member'],
  annualBonusFeatures: [],
};

const STARTER_PLAN: Plan = {
  id: 'starter',
  name: 'Starter',
  tier: 1,
  pricing: {
    monthly: { price: 500 },
    annual: { price: 5000 },
  },
  limits: { maxMembers: 5 },
  features: ['Up to 5 members per workspace'],
  annualBonusFeatures: ['2 months free'],
};

const PRO_PLAN: Plan = {
  id: 'pro',
  name: 'Pro',
  tier: 2,
  pricing: {
    monthly: { price: 2000 },
    annual: { price: 20000 },
  },
  limits: { maxMembers: 25 },
  features: ['Up to 25 members per workspace'],
  annualBonusFeatures: ['2 months free'],
};

describe('BillingPlanCards', () => {
  const defaultProps = {
    currentPlan: FREE_PLAN,
    upgradePlans: [STARTER_PLAN],
    nextBillingDate: null,
    annualByPlan: {},
    onToggleInterval: vi.fn(),
    onManage: vi.fn(),
    onUpgrade: vi.fn(),
    isManaging: false,
    upgradingPlanId: null,
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

    it('shows formatted price for paid plan', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={STARTER_PLAN}
          upgradePlans={[PRO_PLAN]}
        />
      );
      // formatPlanPrice(STARTER_PLAN, false) = "$5/mo"
      expect(screen.getByText('$5/mo')).toBeInTheDocument();
    });

    it('shows current plan features', () => {
      renderWithProviders(<BillingPlanCards {...defaultProps} />);
      expect(screen.getByText('1 member')).toBeInTheDocument();
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
        screen.queryByRole('button', { name: /manage subscription/i })
      ).not.toBeInTheDocument();
    });

    it('shows manage subscription button for paid plan', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={STARTER_PLAN}
          upgradePlans={[PRO_PLAN]}
        />
      );
      expect(
        screen.getByRole('button', { name: /manage subscription/i })
      ).toBeInTheDocument();
    });

    it('calls onManage when manage button is clicked', async () => {
      const user = userEvent.setup();
      const onManage = vi.fn();
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={STARTER_PLAN}
          upgradePlans={[PRO_PLAN]}
          onManage={onManage}
        />
      );
      await user.click(
        screen.getByRole('button', { name: /manage subscription/i })
      );
      expect(onManage).toHaveBeenCalledTimes(1);
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
      expect(
        screen.getByRole('button', { name: /opening portal/i })
      ).toBeDisabled();
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
      // formatPlanPrice(STARTER_PLAN, false) = "$5/mo"
      expect(screen.getByText('$5/mo')).toBeInTheDocument();
    });

    it('shows annual price when annualByPlan has plan set to true', () => {
      renderWithProviders(
        <BillingPlanCards {...defaultProps} annualByPlan={{ starter: true }} />
      );
      // formatPlanPrice(STARTER_PLAN, true) = annual price / 12 / 100 ≈ $4.17/mo
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

    it('shows annual bonus features when annualByPlan has plan set to true', () => {
      renderWithProviders(
        <BillingPlanCards {...defaultProps} annualByPlan={{ starter: true }} />
      );
      expect(screen.getByText('2 months free')).toBeInTheDocument();
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

  describe('no upgrade plan (highest tier)', () => {
    it('shows custom plan card when upgradePlans is empty', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={PRO_PLAN}
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
