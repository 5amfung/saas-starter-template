// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OPERATIONS } from '@workspace/logging/client';
import { renderWithProviders } from '@workspace/test-utils';
import { SignupForm } from '@workspace/components/auth';
import type * as LoggingClient from '@workspace/logging/client';

const { signInEmail, signUpEmail, navigate } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  navigate: vi.fn(),
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
    signIn: { email: signInEmail },
    signUp: { email: signUpEmail },
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
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email, password, and confirm password fields', () => {
    renderWithProviders(<SignupForm />);
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows validation error for short password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/^password$/i), 'short');
    await user.tab(); // Trigger onBlur validation.

    await waitFor(() => {
      // Match the validation error specifically (not the static hint text).
      expect(
        screen.getByText('Password must be at least 8 characters.')
      ).toBeInTheDocument();
    });
  });

  it('shows validation error for mismatched passwords', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'different99');
    // Tab away to trigger blur — field errors only render when isBlurred=true.
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });
  });

  it('validates password at exact minimum length boundary (8 chars)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm />);

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, '12345678'); // Exactly 8 characters.
    await user.tab();

    // Should NOT show the validation error (the static hint text is always present).
    await waitFor(() => {
      expect(
        screen.queryByText('Password must be at least 8 characters.')
      ).not.toBeInTheDocument();
    });
  });

  it('calls authClient.signUp.email with correct params on valid submit', async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/^email$/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          password: 'password123',
          name: 'new',
          callbackURL: '/ws',
        })
      );
    });
  });

  it('navigates to /verify on successful signup', async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/^email$/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/verify',
          search: expect.objectContaining({ email: 'new@example.com' }),
        })
      );
    });
  });

  it('uses redirect as callbackURL when provided', async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SignupForm redirect="/accept-invite?id=abc" />);

    await user.type(screen.getByLabelText(/^email$/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: '/accept-invite?id=abc' })
      );
    });
  });

  it('navigates to /verify with redirect on successful signup', async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SignupForm redirect="/accept-invite?id=abc" />);

    await user.type(screen.getByLabelText(/^email$/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/verify',
          search: {
            email: 'new@example.com',
            redirect: '/accept-invite?id=abc',
          },
        })
      );
    });
  });

  it('falls back to /ws when redirect is not provided', async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/^email$/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: '/ws' })
      );
    });
  });

  it('shows error message on 422 (email exists)', async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({
      data: null,
      error: { status: 422, message: 'User already exists' },
    });
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/^email$/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });

    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: OPERATIONS.AUTH_SIGN_UP,
        name: 'Sign up',
        attributes: expect.objectContaining({
          operation: OPERATIONS.AUTH_SIGN_UP,
          route: '/signup',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Auth sign-up failed',
      expect.objectContaining({
        operation: OPERATIONS.AUTH_SIGN_UP,
        route: '/signup',
        result: 'failure',
        failureCategory: 'account_exists',
      })
    );
    expect(loggerErrorMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'existing@example.com' })
    );
  });
});
