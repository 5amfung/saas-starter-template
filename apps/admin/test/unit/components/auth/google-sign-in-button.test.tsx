// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { GoogleSignInButton } from '@workspace/components/auth';

const { signInSocial } = vi.hoisted(() => ({
  signInSocial: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    signIn: { social: signInSocial },
  },
}));

// Mock the GoogleIcon SVG component.
vi.mock('@workspace/components/icons', () => ({
  GoogleIcon: (props: React.ComponentProps<'svg'>) => (
    <svg data-testid="google-icon" {...props} />
  ),
}));

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Google icon and button text', () => {
    signInSocial.mockResolvedValue({ data: null, error: null });
    renderWithProviders(<GoogleSignInButton callbackURL="/dashboard" />);
    expect(
      screen.getByRole('button', { name: /sign in with google/i })
    ).toBeInTheDocument();
  });

  it('calls authClient.signIn.social with google provider on click', async () => {
    const user = userEvent.setup();
    signInSocial.mockResolvedValue({ data: null, error: null });
    renderWithProviders(<GoogleSignInButton callbackURL="/dashboard" />);

    await user.click(
      screen.getByRole('button', { name: /sign in with google/i })
    );

    await waitFor(() => {
      expect(signInSocial).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google' })
      );
    });
  });

  it('uses default callbackURL /dashboard when no prop provided', async () => {
    const user = userEvent.setup();
    signInSocial.mockResolvedValue({ data: null, error: null });
    renderWithProviders(<GoogleSignInButton callbackURL="/dashboard" />);
    await user.click(
      screen.getByRole('button', { name: /sign in with google/i })
    );
    await waitFor(() => {
      expect(signInSocial).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: '/dashboard' })
      );
    });
  });

  it('uses custom callbackURL when provided', async () => {
    const user = userEvent.setup();
    signInSocial.mockResolvedValue({ data: null, error: null });
    renderWithProviders(<GoogleSignInButton callbackURL="/custom-path" />);
    await user.click(
      screen.getByRole('button', { name: /sign in with google/i })
    );
    await waitFor(() => {
      expect(signInSocial).toHaveBeenCalledWith(
        expect.objectContaining({ callbackURL: '/custom-path' })
      );
    });
  });
});
