// @vitest-environment jsdom
import { act, render, renderHook, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@workspace/components/layout';

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// jsdom does not implement matchMedia — provide a minimal stub.
function mockMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: prefersDark && query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  mockMatchMedia(false);
});

describe('ThemeProvider', () => {
  it('renders children', () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Hello</div>
      </ThemeProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('provides default theme of system', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('system');
  });

  it('provides a custom defaultTheme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
      ),
    });
    expect(result.current.theme).toBe('dark');
  });

  it('setTheme updates the theme and persists to localStorage', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('app-theme')).toBe('dark');
  });

  it('setTheme respects a custom storageKey', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider storageKey="my-custom-key">{children}</ThemeProvider>
      ),
    });

    act(() => {
      result.current.setTheme('light');
    });

    expect(localStorage.getItem('my-custom-key')).toBe('light');
  });

  it('resolvedTheme returns light when theme is light', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
      ),
    });
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('resolvedTheme returns dark when theme is dark', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
      ),
    });
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('applies theme class to document root', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('reads stored theme from localStorage on mount', () => {
    localStorage.setItem('app-theme', 'light');

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe('light');
  });

  it('throws when useTheme is used outside ThemeProvider', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTheme());
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleError.mockRestore();
  });
});
