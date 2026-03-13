// src/test/render.tsx
import type {ReactNode} from 'react';
import {  render } from '@testing-library/react';
import type {RenderOptions} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface ProvidersProps {
  children: ReactNode;
}

function TestProviders({ children }: ProvidersProps) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/**
 * Renders a component wrapped in all required providers (QueryClient, etc.).
 * Creates a fresh QueryClient per render to prevent cache leakage between tests.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: TestProviders, ...options });
}

/**
 * Creates a wrapper for use with renderHook from @testing-library/react.
 */
export function createHookWrapper() {
  const queryClient = createTestQueryClient();
  return function HookWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}
