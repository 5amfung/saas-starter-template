// @vitest-environment jsdom
// apps/web/test/unit/components/auth/reset-password-form.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { ResetPasswordForm } from '@workspace/components/auth';

const { resetPassword } = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    resetPassword,
  },
}));

// Do NOT mock resetPasswordSchema — use the real schema for end-to-end validation.

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Invalid reset link when no token provided', () => {
    renderWithProviders(<ResetPasswordForm />);
    expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
  });

  it('shows Invalid reset link when error prop is set', () => {
    renderWithProviders(
      <ResetPasswordForm token="tok_123" error="Token expired" />
    );
    expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
  });

  it('shows Request new reset link on invalid state', () => {
    renderWithProviders(<ResetPasswordForm />);
    expect(screen.getByText(/request new reset link/i)).toBeInTheDocument();
  });

  it('renders password fields with valid token', () => {
    renderWithProviders(<ResetPasswordForm token="tok_valid" />);
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('calls authClient.resetPassword with token on submit', async () => {
    const user = userEvent.setup();
    resetPassword.mockResolvedValue({ error: null });
    renderWithProviders(<ResetPasswordForm token="tok_valid" />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          newPassword: 'NewPass123!',
          token: 'tok_valid',
        })
      );
    });
  });

  it('shows Password updated success card after success', async () => {
    const user = userEvent.setup();
    resetPassword.mockResolvedValue({ error: null });
    renderWithProviders(<ResetPasswordForm token="tok_valid" />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/password updated/i)).toBeInTheDocument();
    });
  });

  it('shows form error when API returns error', async () => {
    const user = userEvent.setup();
    resetPassword.mockResolvedValue({
      error: { message: 'Token expired' },
    });
    renderWithProviders(<ResetPasswordForm token="tok_valid" />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/token expired/i)).toBeInTheDocument();
    });
  });

  it('disables button while submitting', async () => {
    const user = userEvent.setup();
    resetPassword.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<ResetPasswordForm token="tok_valid" />);

    await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /reset password/i })
      ).toBeDisabled();
    });
  });
});
