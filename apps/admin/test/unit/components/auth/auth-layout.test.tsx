// @vitest-environment jsdom
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

  it('renders Admin Portal branding', () => {
    render(
      <AuthLayout>
        <div />
      </AuthLayout>
    );
    expect(screen.getByText('Admin Portal')).toBeInTheDocument();
  });
});
