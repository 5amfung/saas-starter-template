// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@workspace/test-utils';
import {
  LINKED_ACCOUNTS_QUERY_KEY,
  useLinkedAccountsQuery,
} from '@/hooks/use-linked-accounts-query';

const { listAccounts } = vi.hoisted(() => ({
  listAccounts: vi.fn(),
}));

vi.mock('@workspace/auth/client', () => ({
  authClient: {
    listAccounts,
  },
}));

describe('useLinkedAccountsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns linked accounts on success', async () => {
    const mockAccounts = [{ provider: 'google', accountId: 'g-1' }];
    listAccounts.mockResolvedValue({ data: mockAccounts, error: null });

    const { result } = renderHook(() => useLinkedAccountsQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(mockAccounts);
  });

  it('handles empty accounts list', async () => {
    listAccounts.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useLinkedAccountsQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([]);
  });

  it('throws on error', async () => {
    listAccounts.mockResolvedValue({
      data: null,
      error: { message: 'Failed' },
    });

    const { result } = renderHook(() => useLinkedAccountsQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Failed');
  });

  it('exports correct query key', () => {
    expect(LINKED_ACCOUNTS_QUERY_KEY).toEqual(['linked_accounts']);
  });
});
