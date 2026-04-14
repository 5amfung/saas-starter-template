// @vitest-environment jsdom
// apps/web/test/unit/components/auth/forgot-password-form.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OPERATIONS } from '@workspace/logging/client';
import { renderWithProviders } from '@workspace/test-utils';
import { ForgotPasswordForm } from '@workspace/components/auth';
import type * as LoggingClient from '@workspace/logging/client';

const { requestPasswordReset } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
}));

const { startSpanMock, loggerInfoMock, loggerErrorMock } = vi.hoisted(() => ({
  startSpanMock: vi.fn(async (_options, callback: () => Promise<unknown>) =>
    callback()
  ),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    requestPasswordReset,
  },
}));

vi.mock('@workspace/logging/client', async (importActual) => {
  const actual = await importActual<typeof LoggingClient>();
  return {
    ...actual,
    startWorkflowSpan: startSpanMock,
    workflowLogger: {
      info: loggerInfoMock,
      error: loggerErrorMock,
    },
  };
});

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

    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: OPERATIONS.AUTH_PASSWORD_RESET_REQUEST,
        name: 'Request password reset',
        attributes: expect.objectContaining({
          operation: OPERATIONS.AUTH_PASSWORD_RESET_REQUEST,
          route: '/forgot-password',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Password reset requested',
      expect.objectContaining({
        operation: OPERATIONS.AUTH_PASSWORD_RESET_REQUEST,
        route: '/forgot-password',
        result: 'success',
      })
    );
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

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Password reset request failed',
      expect.objectContaining({
        operation: OPERATIONS.AUTH_PASSWORD_RESET_REQUEST,
        route: '/forgot-password',
        result: 'failure',
        failureCategory: 'reset_request_failed',
      })
    );
    expect(loggerErrorMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'test@example.com' })
    );
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
