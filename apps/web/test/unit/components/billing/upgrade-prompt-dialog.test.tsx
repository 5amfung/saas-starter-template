// @vitest-environment jsdom
// apps/web/test/unit/components/billing/upgrade-prompt-dialog.test.tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import type { PlanDefinition } from '@workspace/auth/plans';
import { UpgradePromptDialog } from '@/components/billing/upgrade-prompt-dialog';

const STARTER_PLAN: PlanDefinition = {
  id: 'starter',
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

describe('UpgradePromptDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Upgrade Required',
    description: 'You have reached the limit of your current plan.',
    action: { type: 'checkout' as const, plan: STARTER_PLAN },
    isUpgrading: false,
    onAction: vi.fn(),
    isAnnual: false,
    onToggleInterval: vi.fn(),
    workspaceName: 'Test Workspace',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when checkout action is provided', () => {
    it('shows plan name and description', () => {
      renderWithProviders(<UpgradePromptDialog {...defaultProps} />);
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(
        screen.getByText('You have reached the limit of your current plan.')
      ).toBeInTheDocument();
    });

    it('shows "Maybe later" cancel button', () => {
      renderWithProviders(<UpgradePromptDialog {...defaultProps} />);
      expect(
        screen.getByRole('button', { name: /maybe later/i })
      ).toBeInTheDocument();
    });

    it('shows upgrade button and calls onAction when clicked', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      renderWithProviders(
        <UpgradePromptDialog {...defaultProps} onAction={onAction} />
      );
      await user.click(
        screen.getByRole('button', { name: /upgrade to starter/i })
      );
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('disables upgrade and cancel buttons when isUpgrading', () => {
      renderWithProviders(
        <UpgradePromptDialog {...defaultProps} isUpgrading={true} />
      );
      expect(
        screen.getByRole('button', { name: /upgrade to starter/i })
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: /maybe later/i })
      ).toBeDisabled();
    });

    it('calls onToggleInterval with true when Annual toggle is clicked', async () => {
      const user = userEvent.setup();
      const onToggleInterval = vi.fn();
      renderWithProviders(
        <UpgradePromptDialog
          {...defaultProps}
          isAnnual={false}
          onToggleInterval={onToggleInterval}
        />
      );
      await user.click(screen.getByRole('button', { name: /annual billing/i }));
      expect(onToggleInterval).toHaveBeenCalledWith(true);
    });

    it('calls onToggleInterval with false when Monthly toggle is clicked', async () => {
      const user = userEvent.setup();
      const onToggleInterval = vi.fn();
      renderWithProviders(
        <UpgradePromptDialog
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
  });

  describe('when there is no action', () => {
    it('shows "Got it" button instead of "Maybe later"', () => {
      renderWithProviders(
        <UpgradePromptDialog {...defaultProps} action={null} />
      );
      expect(
        screen.getByRole('button', { name: /got it/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /maybe later/i })
      ).not.toBeInTheDocument();
    });

    it('shows limit-reached message with no upgrade button', () => {
      renderWithProviders(
        <UpgradePromptDialog {...defaultProps} action={null} />
      );
      expect(
        screen.getByText(/reached the limits of your current plan/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /upgrade to/i })
      ).not.toBeInTheDocument();
    });
  });

  it('renders a contact-sales link for enterprise plans', () => {
    renderWithProviders(
      <UpgradePromptDialog
        {...defaultProps}
        action={{
          type: 'contact_sales',
          plan: {
            ...STARTER_PLAN,
            id: 'enterprise',
            name: 'Enterprise',
            pricing: null,
            isEnterprise: true,
          },
        }}
      />
    );

    expect(
      screen.getByRole('link', { name: /contact sales/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /upgrade to/i })
    ).not.toBeInTheDocument();
  });
});
