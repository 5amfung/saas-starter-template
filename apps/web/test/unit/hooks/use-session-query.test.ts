// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@workspace/test-utils';
import { SESSION_QUERY_KEY, useSessionQuery } from '@/hooks/use-session-query';

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    getSession,
  },
}));

describe('useSessionQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns session data on success', async () => {
    const mockSession = { user: { id: 'user-1' }, session: { id: 'sess-1' } };
    getSession.mockResolvedValue({ data: mockSession, error: null });

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(mockSession);
  });

  it('returns null when session data is null', async () => {
    getSession.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it('throws error when auth returns an error', async () => {
    getSession.mockResolvedValue({
      data: null,
      error: { message: 'Unauthorized' },
    });

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Unauthorized');
  });

  it('exports correct query key', () => {
    expect(SESSION_QUERY_KEY).toEqual(['session', 'current']);
  });
});
