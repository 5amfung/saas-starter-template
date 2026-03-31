// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { SetPasswordDialog } from '@/components/account/set-password-dialog';

const { requestPasswordResetMock, signOutMock } = vi.hoisted(() => ({
  requestPasswordResetMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    requestPasswordReset: requestPasswordResetMock,
    signOut: signOutMock,
  },
}));

const TEST_EMAIL = 'user@example.com';

describe('SetPasswordDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders set password trigger button', () => {
    renderWithProviders(<SetPasswordDialog email={TEST_EMAIL} />);

    expect(
      screen.getByRole('button', { name: /set password/i })
    ).toBeInTheDocument();
  });

  it('opens confirmation dialog on trigger click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SetPasswordDialog email={TEST_EMAIL} />);

    await user.click(screen.getByRole('button', { name: /set password/i }));

    expect(
      screen.getByText(/set password/i, { selector: 'h2' })
    ).toBeInTheDocument();
    expect(screen.getByText(/password reset link/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /log out now/i })
    ).toBeInTheDocument();
  });

  it('closes dialog on cancel without calling auth methods', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SetPasswordDialog email={TEST_EMAIL} />);

    await user.click(screen.getByRole('button', { name: /set password/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /log out now/i })
      ).not.toBeInTheDocument();
    });
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('calls requestPasswordReset and signOut on log out click', async () => {
    requestPasswordResetMock.mockResolvedValue({ error: null });
    signOutMock.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderWithProviders(<SetPasswordDialog email={TEST_EMAIL} />);

    await user.click(screen.getByRole('button', { name: /set password/i }));
    await user.click(screen.getByRole('button', { name: /log out now/i }));

    await waitFor(() => {
      expect(requestPasswordResetMock).toHaveBeenCalledWith({
        email: TEST_EMAIL,
        redirectTo: '/reset-password',
      });
    });

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
    });
  });
});
