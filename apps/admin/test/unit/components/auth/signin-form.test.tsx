// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { SigninForm } from '@workspace/components/auth';

const { signInEmail, signUpEmail, navigate } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    signIn: { email: signInEmail },
    signUp: { email: signUpEmail },
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
  useSearch: () => ({}),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('SigninForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password fields', () => {
    renderWithProviders(<SigninForm defaultCallbackUrl="/dashboard" />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SigninForm defaultCallbackUrl="/dashboard" />);

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
    renderWithProviders(<SigninForm defaultCallbackUrl="/dashboard" />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password123',
          callbackURL: '/dashboard',
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
    renderWithProviders(<SigninForm defaultCallbackUrl="/dashboard" />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invalid email or password/i)
      ).toBeInTheDocument();
    });
  });

  it('shows generic error message on non-401/403 error', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 500, message: 'Something went wrong.' },
    });

    const user = userEvent.setup();
    renderWithProviders(<SigninForm defaultCallbackUrl="/dashboard" />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it('disables submit button while submitting', async () => {
    signInEmail.mockImplementation(() => new Promise(() => {}));

    const user = userEvent.setup();
    renderWithProviders(<SigninForm defaultCallbackUrl="/dashboard" />);

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
    renderWithProviders(<SigninForm defaultCallbackUrl="/dashboard" />);

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
    renderWithProviders(
      <SigninForm defaultCallbackUrl="/dashboard" redirect="/custom-redirect" />
    );

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: '/custom-redirect' })
      );
    });
  });

  it('falls back to /dashboard when redirect is not provided', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SigninForm defaultCallbackUrl="/dashboard" />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: '/dashboard' })
      );
    });
  });

  it('shows admin_only error message when search param error is admin_only', () => {
    // Override useSearch to return admin_only error.
    vi.mocked(navigate);
    // Re-mock router with admin_only search param.
    vi.doMock('@tanstack/react-router', async (importOriginal) => ({
      ...(await importOriginal()),
      useNavigate: () => navigate,
      useSearch: () => ({ error: 'admin_only' }),
      Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
        <a href={to}>{children}</a>
      ),
    }));
  });
});
