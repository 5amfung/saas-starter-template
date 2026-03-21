// @vitest-environment jsdom
// apps/web/test/unit/components/auth/google-sign-in-button.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@workspace/test-utils';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';

const { signInSocial } = vi.hoisted(() => ({
  signInSocial: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    signIn: { social: signInSocial },
  },
}));

// Mock the GoogleIcon SVG component.
vi.mock('@/components/icons/google-icon', () => ({
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
    renderWithProviders(<GoogleSignInButton />);
    expect(
      screen.getByRole('button', { name: /sign in with google/i })
    ).toBeInTheDocument();
  });

  it('calls authClient.signIn.social with google provider on click', async () => {
    const user = userEvent.setup();
    signInSocial.mockResolvedValue({ data: null, error: null });
    renderWithProviders(<GoogleSignInButton />);

    await user.click(
      screen.getByRole('button', { name: /sign in with google/i })
    );

    await waitFor(() => {
      expect(signInSocial).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google' })
      );
    });
  });
});
