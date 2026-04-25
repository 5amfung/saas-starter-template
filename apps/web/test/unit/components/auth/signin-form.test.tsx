// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OPERATIONS } from '@workspace/logging/client';
import { renderWithProviders } from '@workspace/test-utils';
import type * as LoggingClient from '@workspace/logging/client';
import { SigninForm } from '@/auth';

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

vi.mock('@/auth/client/auth-client', () => ({
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
  useSearch: () => ({}),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock Google sign-in button to avoid OAuth setup.

describe('SigninForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password fields', () => {
    renderWithProviders(<SigninForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SigninForm />);

    // Blur each field to trigger onBlur validation (field errors only render when isBlurred=true).
    await user.click(screen.getByLabelText(/email/i));
    await user.tab();
    await user.tab();

    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid email/i)
      ).toBeInTheDocument();
    });
  });

  it('calls authClient.signIn.email with correct params on submit', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SigninForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password123',
          callbackURL: '/ws',
        })
      );
    });
  });

  it('shows error message on 401 response', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 401, message: 'Invalid credentials' },
    });
    renderWithProviders(<SigninForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invalid email or password/i)
      ).toBeInTheDocument();
    });

    expect(startSpanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        op: OPERATIONS.AUTH_SIGN_IN,
        name: 'Sign in',
        attributes: expect.objectContaining({
          operation: OPERATIONS.AUTH_SIGN_IN,
          route: '/signin',
          result: 'attempt',
        }),
      }),
      expect.any(Function)
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Auth sign-in failed',
      expect.objectContaining({
        operation: OPERATIONS.AUTH_SIGN_IN,
        route: '/signin',
        result: 'failure',
        failureCategory: 'invalid_credentials',
      })
    );
    expect(loggerErrorMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'test@example.com' })
    );
  });

  it('shows generic error message on non-401/403 error', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 500, message: 'Something went wrong.' },
    });

    const user = userEvent.setup();
    renderWithProviders(<SigninForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it('disables submit button while submitting', async () => {
    // Make signIn hang to test loading state.
    signInEmail.mockImplementation(() => new Promise(() => {}));

    const user = userEvent.setup();
    renderWithProviders(<SigninForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in$/i })).toBeDisabled();
    });
  });

  it('navigates to /verify on 403 (unverified email)', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 403, message: 'Email not verified' },
    });
    renderWithProviders(<SigninForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/verify',
          search: { email: 'test@example.com' },
        })
      );
    });
  });

  it('uses redirect as callbackURL when provided', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SigninForm redirect="/accept-invite?id=abc" />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: '/accept-invite?id=abc' })
      );
    });
  });

  it('falls back to /ws when redirect is not provided', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SigninForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: '/ws' })
      );
    });
  });
});
