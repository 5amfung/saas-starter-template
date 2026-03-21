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
  limits: { maxWorkspaces: 1, maxMembersPerWorkspace: 1 },
  features: ['1 personal workspace', '1 member'],
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
  limits: { maxWorkspaces: 5, maxMembersPerWorkspace: 5 },
  features: ['5 personal workspace', '5 member'],
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
  limits: { maxWorkspaces: 25, maxMembersPerWorkspace: 25 },
  features: ['25 workspaces', '25 members per workspace'],
  annualBonusFeatures: ['2 months free'],
};

describe('BillingPlanCards', () => {
  const defaultProps = {
    currentPlan: FREE_PLAN,
    upgradePlan: STARTER_PLAN,
    nextBillingDate: null,
    isAnnual: false,
    onToggleInterval: vi.fn(),
    onManage: vi.fn(),
    onUpgrade: vi.fn(),
    isManaging: false,
    isUpgrading: false,
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
          upgradePlan={PRO_PLAN}
        />
      );
      // formatPlanPrice(STARTER_PLAN, false) = "$5/mo"
      expect(screen.getByText('$5/mo')).toBeInTheDocument();
    });

    it('shows current plan features', () => {
      renderWithProviders(<BillingPlanCards {...defaultProps} />);
      expect(screen.getByText('1 personal workspace')).toBeInTheDocument();
      expect(screen.getByText('1 member')).toBeInTheDocument();
    });

    it('shows renewal date when nextBillingDate is provided', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={STARTER_PLAN}
          upgradePlan={PRO_PLAN}
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
          upgradePlan={PRO_PLAN}
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
          upgradePlan={PRO_PLAN}
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
          upgradePlan={PRO_PLAN}
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
        <BillingPlanCards {...defaultProps} isAnnual={false} />
      );
      // formatPlanPrice(STARTER_PLAN, false) = "$5/mo"
      expect(screen.getByText('$5/mo')).toBeInTheDocument();
    });

    it('shows annual price when isAnnual is true', () => {
      renderWithProviders(
        <BillingPlanCards {...defaultProps} isAnnual={true} />
      );
      // formatPlanPrice(STARTER_PLAN, true) = annual price / 12 / 100 = 5000/12/100 ≈ $4.17/mo
      expect(screen.getByText(/\$4/)).toBeInTheDocument();
    });

    it('calls onToggleInterval with false when Monthly toggle is clicked', async () => {
      const user = userEvent.setup();
      const onToggleInterval = vi.fn();
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          isAnnual={true}
          onToggleInterval={onToggleInterval}
        />
      );
      await user.click(
        screen.getByRole('button', { name: /monthly billing/i })
      );
      expect(onToggleInterval).toHaveBeenCalledWith(false);
    });

    it('calls onToggleInterval with true when Annual toggle is clicked', async () => {
      const user = userEvent.setup();
      const onToggleInterval = vi.fn();
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          isAnnual={false}
          onToggleInterval={onToggleInterval}
        />
      );
      await user.click(screen.getByRole('button', { name: /annual billing/i }));
      expect(onToggleInterval).toHaveBeenCalledWith(true);
    });

    it('shows annual bonus features when isAnnual is true', () => {
      renderWithProviders(
        <BillingPlanCards {...defaultProps} isAnnual={true} />
      );
      expect(screen.getByText('2 months free')).toBeInTheDocument();
    });

    it('calls onUpgrade with the upgrade plan id when upgrade button is clicked', async () => {
      const user = userEvent.setup();
      const onUpgrade = vi.fn();
      renderWithProviders(
        <BillingPlanCards {...defaultProps} onUpgrade={onUpgrade} />
      );
      await user.click(
        screen.getByRole('button', { name: /upgrade to starter/i })
      );
      expect(onUpgrade).toHaveBeenCalledWith('starter');
    });

    it('disables upgrade button and shows loading text when isUpgrading', () => {
      renderWithProviders(
        <BillingPlanCards {...defaultProps} isUpgrading={true} />
      );
      expect(
        screen.getByRole('button', { name: /redirecting/i })
      ).toBeDisabled();
    });
  });

  describe('no upgrade plan (highest tier)', () => {
    it('shows custom plan card when upgradePlan is null', () => {
      renderWithProviders(
        <BillingPlanCards
          {...defaultProps}
          currentPlan={PRO_PLAN}
          upgradePlan={null}
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
