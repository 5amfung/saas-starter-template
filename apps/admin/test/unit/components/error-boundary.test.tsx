// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';
import { AppErrorBoundary } from '@/components/error-boundary';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

function Boom(): never {
  throw new Error('boom');
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('captures rendering failures and shows a fallback', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>
    );

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });
});
