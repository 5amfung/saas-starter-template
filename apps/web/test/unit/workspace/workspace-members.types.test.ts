import { describe, expect, it, vi } from 'vitest';
import { withPendingId } from '@/workspace/workspace-members.types';

describe('withPendingId', () => {
  it('sets pending ID before action runs', async () => {
    const setter = vi.fn();
    const actionOrder: Array<string> = [];

    setter.mockImplementation((value: string | null) => {
      if (value !== null) actionOrder.push('set');
    });

    await withPendingId(setter, 'id-1', async () => {
      actionOrder.push('action');
    });

    expect(actionOrder).toEqual(['set', 'action']);
    expect(setter).toHaveBeenCalledWith('id-1');
  });

  it('clears pending ID after successful action', async () => {
    const setter = vi.fn();
    await withPendingId(setter, 'id-1', async () => {});
    expect(setter).toHaveBeenCalledTimes(2);
    expect(setter).toHaveBeenLastCalledWith(null);
  });

  it('clears pending ID even when action throws', async () => {
    const setter = vi.fn();
    const error = new Error('boom');

    await expect(
      withPendingId(setter, 'id-1', async () => {
        throw error;
      })
    ).rejects.toThrow('boom');

    expect(setter).toHaveBeenCalledTimes(2);
    expect(setter).toHaveBeenLastCalledWith(null);
  });
});
