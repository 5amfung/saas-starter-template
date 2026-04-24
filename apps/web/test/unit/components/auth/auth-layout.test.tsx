// @vitest-environment jsdom
// apps/web/test/unit/components/auth/auth-layout.test.tsx
import { render, screen } from '@testing-library/react';
import { AuthLayout } from '@/auth';

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
