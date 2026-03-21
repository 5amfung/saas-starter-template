// @vitest-environment jsdom
// apps/web/test/unit/components/billing/billing-downgrade-banner.test.tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { BillingDowngradeBanner } from '@/components/billing/billing-downgrade-banner';

describe('BillingDowngradeBanner', () => {
  const defaultProps = {
    periodEnd: new Date('2026-04-15T00:00:00Z'),
    onReactivate: vi.fn(),
    isReactivating: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows downgrade date in formatted text', () => {
    renderWithProviders(<BillingDowngradeBanner {...defaultProps} />);
    expect(screen.getByText(/April/)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('calls onReactivate when button clicked', async () => {
    const user = userEvent.setup();
    const onReactivate = vi.fn();
    renderWithProviders(
      <BillingDowngradeBanner {...defaultProps} onReactivate={onReactivate} />
    );

    await user.click(
      screen.getByRole('button', { name: /keep subscription/i })
    );
    expect(onReactivate).toHaveBeenCalledTimes(1);
  });

  it('disables button and shows spinner when isReactivating', () => {
    renderWithProviders(
      <BillingDowngradeBanner {...defaultProps} isReactivating={true} />
    );
    expect(
      screen.getByRole('button', { name: /keep subscription/i })
    ).toBeDisabled();
  });
});
