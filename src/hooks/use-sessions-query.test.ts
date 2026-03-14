// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test/render';
import {
  SESSIONS_QUERY_KEY,
  useSessionsQuery,
} from '@/hooks/use-sessions-query';

const { listSessions } = vi.hoisted(() => ({
  listSessions: vi.fn(),
}));

vi.mock('@/auth/auth-client', () => ({
  authClient: {
    listSessions,
  },
}));

describe('useSessionsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns active sessions on success', async () => {
    const mockSessions = [
      { id: 'sess-1', userAgent: 'Chrome' },
      { id: 'sess-2', userAgent: 'Firefox' },
    ];
    listSessions.mockResolvedValue({ data: mockSessions, error: null });

    const { result } = renderHook(() => useSessionsQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(mockSessions);
  });

  it('handles error state', async () => {
    listSessions.mockResolvedValue({
      data: null,
      error: { message: 'Session error' },
    });

    const { result } = renderHook(() => useSessionsQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Session error');
  });

  it('exports correct query key', () => {
    expect(SESSIONS_QUERY_KEY).toEqual(['user_active_sessions']);
  });
});
