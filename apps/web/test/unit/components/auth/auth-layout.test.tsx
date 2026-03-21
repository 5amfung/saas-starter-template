// @vitest-environment jsdom
// apps/web/test/unit/components/auth/auth-layout.test.tsx
import { render, screen } from '@testing-library/react';
import { AuthLayout } from '@/components/auth/auth-layout';

describe('AuthLayout', () => {
  it('renders children within layout', () => {
    render(
      <AuthLayout>
        <div data-testid="child-content">Hello</div>
      </AuthLayout>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders Acme Inc branding', () => {
    render(
      <AuthLayout>
        <div />
      </AuthLayout>
    );
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
  });
});
