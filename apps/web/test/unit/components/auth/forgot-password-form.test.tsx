// @vitest-environment jsdom
// apps/web/test/unit/components/auth/forgot-password-form.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { ForgotPasswordForm } from '@workspace/components/auth';

const { requestPasswordReset } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    requestPasswordReset,
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email input and submit button', () => {
    renderWithProviders(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /send reset link/i })
    ).toBeInTheDocument();
  });

  it('shows validation error on blur with invalid email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordForm />);

    await user.click(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('calls authClient.requestPasswordReset on submit', async () => {
    const user = userEvent.setup();
    requestPasswordReset.mockResolvedValue({ error: null });
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' })
      );
    });
  });

  it('shows success card with check your email message', async () => {
    const user = userEvent.setup();
    requestPasswordReset.mockResolvedValue({ error: null });
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it('shows Back to sign in link on success card', async () => {
    const user = userEvent.setup();
    requestPasswordReset.mockResolvedValue({ error: null });
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/back to sign in/i)).toBeInTheDocument();
    });
  });

  it('shows form error when API returns error', async () => {
    const user = userEvent.setup();
    requestPasswordReset.mockResolvedValue({
      error: { message: 'Rate limited' },
    });
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
    });
  });

  it('disables button while submitting', async () => {
    const user = userEvent.setup();
    requestPasswordReset.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /send reset link/i })
      ).toBeDisabled();
    });
  });
});
