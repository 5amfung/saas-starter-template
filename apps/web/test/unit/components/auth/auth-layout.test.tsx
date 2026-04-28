// @vitest-environment jsdom
// apps/web/test/unit/components/auth/auth-layout.test.tsx
import { render, screen } from '@testing-library/react';
import { AuthLayout, WebAuthLogo } from '@/auth';

const webLogo = <a href="/">Acme Inc.</a>;

describe('AuthLayout', () => {
  it('renders children within layout', () => {
    render(
      <AuthLayout logo={webLogo}>
        <div data-testid="child-content">Hello</div>
      </AuthLayout>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders custom logo when provided', () => {
    render(
      <AuthLayout logo={webLogo}>
        <div />
      </AuthLayout>
    );
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
  });

  it('renders default Admin Portal branding when no logo provided', () => {
    render(
      <AuthLayout>
        <div />
      </AuthLayout>
    );
    expect(screen.getByText('Admin Portal')).toBeInTheDocument();
  });
});

describe('WebAuthLogo', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders VITE_APP_NAME as the web auth brand', () => {
    vi.stubEnv('VITE_APP_NAME', 'Doughy');

    render(<WebAuthLogo />);

    expect(screen.getByRole('link', { name: /Doughy/i })).toHaveAttribute(
      'href',
      '/'
    );
  });

  it('falls back to App when VITE_APP_NAME is not configured', () => {
    vi.stubEnv('VITE_APP_NAME', '');

    render(<WebAuthLogo />);

    expect(screen.getByRole('link', { name: /^App$/i })).toHaveAttribute(
      'href',
      '/'
    );
  });
});
