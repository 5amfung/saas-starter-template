// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { getPlanById } from '@workspace/billing';
import { BillingDowngradeConfirmDialog } from '@/components/billing/billing-downgrade-confirm-dialog';

const PRO = getPlanById('pro')!;
const STARTER = getPlanById('starter')!;

describe('BillingDowngradeConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    currentPlan: PRO,
    targetPlan: STARTER,
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

  it('shows lost features from computePlanDiff', () => {
    renderWithProviders(<BillingDowngradeConfirmDialog {...defaultProps} />);
    // Pro has Priority Support enabled; Starter does not.
    expect(screen.getByText(/priority support/i)).toBeInTheDocument();
  });

  it('shows limit changes from computePlanDiff', () => {
    renderWithProviders(<BillingDowngradeConfirmDialog {...defaultProps} />);
    // LIMIT_METADATA.members.label is "Members".
    expect(screen.getByText(/members/i)).toBeInTheDocument();
    expect(screen.getByText(/25/)).toBeInTheDocument();
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it('shows member count warning when current members exceed target limit', () => {
    renderWithProviders(
      <BillingDowngradeConfirmDialog
        {...defaultProps}
        currentMemberCount={12}
      />
    );
    expect(screen.getByText(/12 members/i)).toBeInTheDocument();
    expect(screen.getByText(/remove members/i)).toBeInTheDocument();
  });

  it('does not show member warning when within limit', () => {
    renderWithProviders(
      <BillingDowngradeConfirmDialog {...defaultProps} currentMemberCount={3} />
    );
    expect(screen.queryByText(/remove members/i)).not.toBeInTheDocument();
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
