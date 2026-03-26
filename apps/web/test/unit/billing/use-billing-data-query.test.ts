// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@workspace/test-utils';
import {
  BILLING_DATA_QUERY_KEY,
  useBillingDataQuery,
} from '@/billing/use-billing-data-query';

const { getWorkspaceBillingDataMock } = vi.hoisted(() => ({
  getWorkspaceBillingDataMock: vi.fn(),
}));

vi.mock('@/billing/billing.functions', () => ({
  getWorkspaceBillingData: getWorkspaceBillingDataMock,
}));

const WORKSPACE_ID = 'ws-1';

describe('useBillingDataQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches billing data for the workspace', async () => {
    const mockData = { planId: 'pro', subscription: { status: 'active' } };
    getWorkspaceBillingDataMock.mockResolvedValue(mockData);

    const { result } = renderHook(() => useBillingDataQuery(WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    expect(getWorkspaceBillingDataMock).toHaveBeenCalledWith({
      data: { workspaceId: WORKSPACE_ID },
    });
  });

  it('does not fetch when enabled is false', () => {
    renderHook(() => useBillingDataQuery(WORKSPACE_ID, false), {
      wrapper: createHookWrapper(),
    });

    expect(getWorkspaceBillingDataMock).not.toHaveBeenCalled();
  });

  it('exports correct query key factory', () => {
    expect(BILLING_DATA_QUERY_KEY(WORKSPACE_ID)).toEqual([
      'billing',
      'data',
      'ws-1',
    ]);
  });
});
