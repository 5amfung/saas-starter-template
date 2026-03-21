import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_INVITE_ROLES,
  INVITATION_PAGE_SIZE_DEFAULT,
  MEMBER_PAGE_SIZE_DEFAULT,
  VALID_ORG_ROLES,
  emailSchema,
  withPendingId,
} from '@/workspace/workspace-members.types';

describe('constants', () => {
  it('MEMBER_PAGE_SIZE_DEFAULT is 10', () => {
    expect(MEMBER_PAGE_SIZE_DEFAULT).toBe(10);
  });

  it('INVITATION_PAGE_SIZE_DEFAULT is 10', () => {
    expect(INVITATION_PAGE_SIZE_DEFAULT).toBe(10);
  });

  it('DEFAULT_INVITE_ROLES contains member and admin', () => {
    expect(DEFAULT_INVITE_ROLES).toEqual(['member', 'admin']);
  });

  it('VALID_ORG_ROLES contains member, admin, and owner', () => {
    expect(VALID_ORG_ROLES).toEqual(['member', 'admin', 'owner']);
  });
});

describe('emailSchema', () => {
  it('accepts a valid email', () => {
    const result = emailSchema.safeParse('user@example.com');
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = emailSchema.safeParse('not-an-email');
    expect(result.success).toBe(false);
  });

  it('provides a custom error message', () => {
    const result = emailSchema.safeParse('bad');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Please enter a valid email address.');
    }
  });

  it('rejects an empty string', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});

describe('withPendingId', () => {
  it('sets pending ID before action and clears on success', async () => {
    const setPendingId = vi.fn();
    const action = vi.fn().mockResolvedValue(undefined);

    await withPendingId(setPendingId, 'item-1', action);

    expect(setPendingId).toHaveBeenCalledTimes(2);
    expect(setPendingId).toHaveBeenNthCalledWith(1, 'item-1');
    expect(setPendingId).toHaveBeenNthCalledWith(2, null);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('clears pending ID even when action throws', async () => {
    const setPendingId = vi.fn();
    const action = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(withPendingId(setPendingId, 'item-2', action)).rejects.toThrow(
      'fail'
    );

    expect(setPendingId).toHaveBeenCalledTimes(2);
    expect(setPendingId).toHaveBeenNthCalledWith(1, 'item-2');
    expect(setPendingId).toHaveBeenNthCalledWith(2, null);
  });

  it('sets pending ID before calling the action', async () => {
    const callOrder: Array<string> = [];
    const setPendingId = vi.fn().mockImplementation((id) => {
      callOrder.push(id === null ? 'clear' : 'set');
    });
    const action = vi.fn().mockImplementation(async () => {
      callOrder.push('action');
    });

    await withPendingId(setPendingId, 'item-3', action);

    expect(callOrder).toEqual(['set', 'action', 'clear']);
  });
});
