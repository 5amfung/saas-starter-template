// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { createRouterLinkMock } from '../../../mocks/router';
import { createGoogleSignInButtonMock } from '../../../mocks/google-sign-in-button';
import { SignupForm } from '@/components/auth/signup-form';

const { signInEmail, signUpEmail, navigate } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/auth/admin-auth-client', () => ({
  authClient: {
    signIn: { email: signInEmail },
    signUp: { email: signUpEmail },
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
  Link: createRouterLinkMock(),
}));

vi.mock('@/components/auth/google-sign-in-button', () =>
  createGoogleSignInButtonMock()
);

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
    await user.tab();

    await waitFor(() => {
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
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });
  });

  it('validates password at exact minimum length boundary (8 chars)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm />);

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, '12345678');
    await user.tab();

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
          callbackURL: '/dashboard',
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
  });
});
