// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { createRouterLinkMock } from '../../../mocks/router';
import { createGoogleSignInButtonMock } from '../../../mocks/google-sign-in-button';
import { SigninForm } from '@/components/auth/signin-form';

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
  Link: createRouterLinkMock(),
}));

vi.mock('@/components/auth/google-sign-in-button', () =>
  createGoogleSignInButtonMock()
);

describe('SigninForm integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes full sign-in flow: fill -> submit -> navigate', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SigninForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledTimes(1);
    });
  });

  it('recovers from error: bad credentials -> fix -> retry succeeds', async () => {
    const user = userEvent.setup();
    signInEmail
      .mockResolvedValueOnce({
        data: null,
        error: { status: 401, message: 'Invalid credentials' },
      })
      .mockResolvedValueOnce({ data: {}, error: null });

    renderWithProviders(<SigninForm />);

    // First attempt: wrong password.
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/invalid email or password/i)
      ).toBeInTheDocument();
    });

    // Second attempt: correct password.
    await user.clear(screen.getByLabelText(/password/i));
    await user.type(screen.getByLabelText(/password/i), 'correct123');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledTimes(2);
    });
  });
});
