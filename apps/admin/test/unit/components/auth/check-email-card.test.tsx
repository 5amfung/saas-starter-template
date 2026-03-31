// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { CheckEmailCard } from '@/components/auth/check-email-card';

describe('CheckEmailCard', () => {
  it('renders title and description', () => {
    render(
      <CheckEmailCard
        title="Check your email"
        description="We sent a link to your email."
      />
    );
    expect(screen.getByText('Check your email')).toBeInTheDocument();
    expect(
      screen.getByText('We sent a link to your email.')
    ).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <CheckEmailCard
        title="Title"
        description="Desc"
        actions={<button>Open Gmail</button>}
      />
    );
    expect(
      screen.getByRole('button', { name: /open gmail/i })
    ).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(
      <CheckEmailCard
        title="Title"
        description="Desc"
        footer={<a href="/signin">Back to sign in</a>}
      />
    );
    expect(screen.getByText('Back to sign in')).toBeInTheDocument();
  });
});
