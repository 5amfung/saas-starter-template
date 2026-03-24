// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@workspace/test-utils';
import type { Plan } from '@workspace/auth/plans';
import { useUpgradePrompt } from '@/hooks/use-upgrade-prompt';

const { mockCreateWorkspaceCheckoutSession, mockToastError } = vi.hoisted(
  () => ({
    mockCreateWorkspaceCheckoutSession: vi.fn(),
    mockToastError: vi.fn(),
  })
);

vi.mock('@/billing/billing.functions', () => ({
  createWorkspaceCheckoutSession: mockCreateWorkspaceCheckoutSession,
}));

vi.mock('sonner', () => ({
  toast: { error: mockToastError },
}));

const TEST_WORKSPACE_ID = 'ws_123';

const mockPlan: Plan = {
  id: 'pro',
  name: 'Pro',
  tier: 1,
  pricing: {
    monthly: { price: 49_00 },
    annual: { price: 490_00 },
  },
  limits: { maxMembers: 25 },
  features: ['Up to 25 members per workspace'],
  annualBonusFeatures: ['2 months free'],
};

describe('useUpgradePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with dialog closed', () => {
    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('show() populates dialog props', () => {
    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'You need more', mockPlan);
    });

    expect(result.current.dialogProps.open).toBe(true);
    expect(result.current.dialogProps.title).toBe('Upgrade');
    expect(result.current.dialogProps.description).toBe('You need more');
    expect(result.current.dialogProps.upgradePlan).toBe(mockPlan);
  });

  it('onOpenChange(false) closes dialog', () => {
    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', mockPlan);
    });
    expect(result.current.dialogProps.open).toBe(true);

    act(() => {
      result.current.dialogProps.onOpenChange(false);
    });
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('onUpgrade() fires mutation with correct workspaceId, planId and annual', async () => {
    const locationHrefSpy = vi
      .spyOn(window, 'location', 'get')
      .mockReturnValue({
        ...window.location,
        href: '',
      } as Location);

    mockCreateWorkspaceCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
    });

    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', mockPlan);
    });

    act(() => {
      result.current.dialogProps.onUpgrade();
    });

    await waitFor(() => {
      expect(mockCreateWorkspaceCheckoutSession).toHaveBeenCalledWith({
        data: { workspaceId: TEST_WORKSPACE_ID, planId: 'pro', annual: false },
      });
    });

    locationHrefSpy.mockRestore();
  });

  it('onUpgrade() is no-op when upgradePlan is null', () => {
    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Limit Reached', 'Max tier', null);
    });

    act(() => {
      result.current.dialogProps.onUpgrade();
    });

    expect(mockCreateWorkspaceCheckoutSession).not.toHaveBeenCalled();
  });

  it('shows toast on checkout error', async () => {
    mockCreateWorkspaceCheckoutSession.mockRejectedValue(
      new Error('Checkout failed')
    );

    const { result } = renderHook(() => useUpgradePrompt(TEST_WORKSPACE_ID), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', mockPlan);
    });

    act(() => {
      result.current.dialogProps.onUpgrade();
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Checkout failed');
    });
  });
});
