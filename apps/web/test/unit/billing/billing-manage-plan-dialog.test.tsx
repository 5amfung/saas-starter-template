// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getPlanById } from '@workspace/billing';
import { renderWithProviders } from '@workspace/test-utils';
import type { PlanDefinition } from '@workspace/billing';

import { BillingManagePlanDialog } from '@/components/billing/billing-manage-plan-dialog';

const PRO_PLAN = getPlanById('pro') as PlanDefinition;
const STARTER_PLAN = getPlanById('starter') as PlanDefinition;
const FREE_PLAN = getPlanById('free') as PlanDefinition;

describe('BillingManagePlanDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    currentPlan: PRO_PLAN,
    isPendingCancel: false,
    isPendingDowngrade: false,
    onUpgrade: vi.fn(),
    onDowngrade: vi.fn(),
    isProcessing: false,
    workspaceName: 'Test Workspace',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all plans as cards', () => {
    renderWithProviders(<BillingManagePlanDialog {...defaultProps} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('shows "Current plan" disabled button for current plan', () => {
    renderWithProviders(<BillingManagePlanDialog {...defaultProps} />);
    const currentBtn = screen.getByRole('button', { name: /current plan/i });
    expect(currentBtn).toBeDisabled();
  });

  it('shows "Upgrade" button for higher-tier plans', () => {
    renderWithProviders(
      <BillingManagePlanDialog {...defaultProps} currentPlan={STARTER_PLAN} />
    );
    expect(
      screen.getByRole('button', { name: /^upgrade$/i })
    ).toBeInTheDocument();
  });

  it('shows "Downgrade" button for lower-tier plans', () => {
    renderWithProviders(<BillingManagePlanDialog {...defaultProps} />);
    const downgradeBtns = screen.getAllByRole('button', {
      name: /^downgrade$/i,
    });
    // Starter + Free both show "Downgrade" (cancel action also has label "Downgrade").
    expect(downgradeBtns).toHaveLength(2);
  });

  it('calls onUpgrade when upgrade button is clicked', async () => {
    const user = userEvent.setup();
    const onUpgrade = vi.fn();
    renderWithProviders(
      <BillingManagePlanDialog
        {...defaultProps}
        currentPlan={FREE_PLAN}
        onUpgrade={onUpgrade}
      />
    );
    // Click the first Upgrade button (Starter).
    const upgradeBtns = screen.getAllByRole('button', {
      name: /^upgrade$/i,
    });
    await user.click(upgradeBtns[0]);
    expect(onUpgrade).toHaveBeenCalledWith('starter', false);
  });

  it('calls onDowngrade when downgrade button is clicked', async () => {
    const user = userEvent.setup();
    const onDowngrade = vi.fn();
    renderWithProviders(
      <BillingManagePlanDialog {...defaultProps} onDowngrade={onDowngrade} />
    );
    const downgradeBtns = screen.getAllByRole('button', {
      name: /^downgrade$/i,
    });
    // First downgrade button corresponds to Starter (plans render in order: Free, Starter, Pro).
    // Free has tier 0, Starter has tier 1 — both are below Pro. In PLANS order: Free first, then Starter.
    await user.click(downgradeBtns[0]);
    expect(onDowngrade).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'free' }),
      false
    );
  });

  it('shows monthly/annual toggle', () => {
    renderWithProviders(<BillingManagePlanDialog {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /monthly billing/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /annual billing/i })
    ).toBeInTheDocument();
  });

  it('disables downgrade buttons but allows upgrade when isPendingDowngrade is true', () => {
    renderWithProviders(
      <BillingManagePlanDialog
        {...defaultProps}
        currentPlan={STARTER_PLAN}
        isPendingDowngrade={true}
      />
    );
    // Upgrade to Pro should still be allowed.
    expect(
      screen.getByRole('button', { name: /^upgrade$/i })
    ).not.toBeDisabled();
    // Downgrade to Free should be blocked.
    const downgradeBtns = screen.getAllByRole('button', {
      name: /^downgrade$/i,
    });
    downgradeBtns.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('disables all action buttons when isPendingCancel is true', () => {
    renderWithProviders(
      <BillingManagePlanDialog {...defaultProps} isPendingCancel={true} />
    );
    const downgradeBtns = screen.getAllByRole('button', {
      name: /^downgrade$/i,
    });
    downgradeBtns.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('disables all action buttons when isProcessing is true', () => {
    renderWithProviders(
      <BillingManagePlanDialog
        {...defaultProps}
        currentPlan={STARTER_PLAN}
        isProcessing={true}
      />
    );
    expect(screen.getByRole('button', { name: /^upgrade$/i })).toBeDisabled();
    const downgradeBtns = screen.getAllByRole('button', {
      name: /^downgrade$/i,
    });
    downgradeBtns.forEach((btn) => expect(btn).toBeDisabled());
  });
});
