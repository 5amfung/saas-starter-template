import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSessionResponse } from '@workspace/test-utils';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/account/notification-preferences.functions';

const {
  requireVerifiedSessionMock,
  getNotificationPreferencesForUserMock,
  upsertNotificationPreferencesForUserMock,
} = vi.hoisted(() => ({
  requireVerifiedSessionMock: vi.fn(),
  getNotificationPreferencesForUserMock: vi.fn(),
  upsertNotificationPreferencesForUserMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    let handler: Function;
    const builder = {
      inputValidator: () => builder,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      handler: (fn: Function) => {
        handler = fn;
        const callable = (...args: Array<unknown>) => handler(...args);
        callable.inputValidator = () => builder;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        callable.handler = (fn2: Function) => {
          handler = fn2;
          return callable;
        };
        return callable;
      },
    };
    const callable = (...args: Array<unknown>) => handler(...args);
    callable.inputValidator = () => builder;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    callable.handler = (fn: Function) => {
      handler = fn;
      return callable;
    };
    return callable;
  },
}));

vi.mock('@/account/notification-preferences.server', () => ({
  requireVerifiedSession: requireVerifiedSessionMock,
  getNotificationPreferencesForUser: getNotificationPreferencesForUserMock,
  upsertNotificationPreferencesForUser:
    upsertNotificationPreferencesForUserMock,
}));

describe('getNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getNotificationPreferences()).rejects.toThrow('Unauthorized');
  });

  it('calls getNotificationPreferencesForUser with user ID', async () => {
    const session = createMockSessionResponse();
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    getNotificationPreferencesForUserMock.mockResolvedValueOnce({
      emailUpdates: true,
      marketingEmails: false,
    });
    await getNotificationPreferences();
    expect(getNotificationPreferencesForUserMock).toHaveBeenCalledWith(
      session.user.id
    );
  });

  it('returns the preferences', async () => {
    const prefs = { emailUpdates: true, marketingEmails: true };
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    getNotificationPreferencesForUserMock.mockResolvedValueOnce(prefs);
    const result = await getNotificationPreferences();
    expect(result).toEqual(prefs);
  });
});

describe('updateNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when session not verified', async () => {
    requireVerifiedSessionMock.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(
      updateNotificationPreferences({ data: { marketingEmails: true } })
    ).rejects.toThrow('Unauthorized');
  });

  it('passes user ID and data to upsertNotificationPreferencesForUser', async () => {
    const session = createMockSessionResponse();
    const input = { marketingEmails: true };
    requireVerifiedSessionMock.mockResolvedValueOnce(session);
    upsertNotificationPreferencesForUserMock.mockResolvedValueOnce({});
    await updateNotificationPreferences({ data: input });
    expect(upsertNotificationPreferencesForUserMock).toHaveBeenCalledWith(
      session.user.id,
      input
    );
  });

  it('returns the upsert result', async () => {
    const result = { emailUpdates: true, marketingEmails: true };
    requireVerifiedSessionMock.mockResolvedValueOnce(
      createMockSessionResponse()
    );
    upsertNotificationPreferencesForUserMock.mockResolvedValueOnce(result);
    const actual = await updateNotificationPreferences({
      data: { marketingEmails: true },
    });
    expect(actual).toEqual(result);
  });
});
