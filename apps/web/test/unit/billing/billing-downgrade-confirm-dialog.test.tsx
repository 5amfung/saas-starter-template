// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { formatPlanPrice, getPlanById } from '@/billing/core';
import { BillingDowngradeConfirmDialog } from '@/components/billing/billing-downgrade-confirm-dialog';

const PRO = getPlanById('pro')!;
const STARTER = getPlanById('starter')!;

describe('BillingDowngradeConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    currentPlan: PRO,
    targetPlan: STARTER,
    targetAnnual: false,
    periodEnd: new Date('2026-04-15'),
    currentMemberCount: 3,
    onConfirm: vi.fn(),
    isProcessing: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows target plan name in title', () => {
    renderWithProviders(<BillingDowngradeConfirmDialog {...defaultProps} />);
    expect(screen.getByText(/downgrade to starter/i)).toBeInTheDocument();
  });

  it('shows period end date', () => {
    renderWithProviders(<BillingDowngradeConfirmDialog {...defaultProps} />);
    expect(screen.getByText(/april 15, 2026/i)).toBeInTheDocument();
  });

  it('uses the updated downgrade copy', () => {
    renderWithProviders(<BillingDowngradeConfirmDialog {...defaultProps} />);
    expect(
      screen.getByText(/after that, you will downgrade to:/i)
    ).toBeInTheDocument();
  });

  it('shows a target plan card summary', () => {
    renderWithProviders(<BillingDowngradeConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText(/up to 5 members/i)).toBeInTheDocument();
    expect(
      screen.getByText(formatPlanPrice(STARTER, false), { exact: false })
    ).toBeInTheDocument();
    expect(
      document.body.querySelectorAll('[role="alertdialog"] li svg')
    ).not.toHaveLength(0);
  });

  it('shows annual target plan price when annual downgrade is selected', () => {
    renderWithProviders(
      <BillingDowngradeConfirmDialog {...defaultProps} targetAnnual={true} />
    );
    expect(
      screen.getByText(formatPlanPrice(STARTER, true), { exact: false })
    ).toBeInTheDocument();
  });

  it('shows member count warning when current members exceed target limit', () => {
    renderWithProviders(
      <BillingDowngradeConfirmDialog
        {...defaultProps}
        currentMemberCount={12}
      />
    );
    expect(
      screen.getByText(
        /any areas exceeding the new plan limits will stop working after the downgrade takes effect/i
      )
    ).toBeInTheDocument();
  });

  it('does not show member warning when within limit', () => {
    renderWithProviders(
      <BillingDowngradeConfirmDialog {...defaultProps} currentMemberCount={3} />
    );
    expect(
      screen.queryByText(/any areas exceeding the new plan limits/i)
    ).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithProviders(
      <BillingDowngradeConfirmDialog {...defaultProps} onConfirm={onConfirm} />
    );
    await user.click(
      screen.getByRole('button', { name: /confirm downgrade/i })
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('has a cancel button', () => {
    renderWithProviders(<BillingDowngradeConfirmDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('disables confirm button when isProcessing', () => {
    renderWithProviders(
      <BillingDowngradeConfirmDialog {...defaultProps} isProcessing={true} />
    );
    expect(
      screen.getByRole('button', { name: /confirm downgrade/i })
    ).toBeDisabled();
  });
});
