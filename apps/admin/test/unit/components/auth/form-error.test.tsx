// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { FormError } from '@/components/auth/form-error';

describe('FormError', () => {
  it('renders nothing when errors array is empty', () => {
    const { container } = render(<FormError errors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when errors is undefined', () => {
    const { container } = render(<FormError />);
    expect(container.firstChild).toBeNull();
  });

  it('renders error messages joined by comma', () => {
    render(<FormError errors={['First error', 'Second error']} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'First error, Second error'
    );
  });
});
