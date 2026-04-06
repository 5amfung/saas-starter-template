import { createMockSessionResponse } from '@workspace/test-utils';
import { mockDbChain, mockDbInsertChain } from '../../mocks/db';
import {
  getNotificationPreferencesForUser,
  requireVerifiedSession,
  upsertNotificationPreferencesForUser,
} from '@/account/notification-preferences.server';

const {
  getAuthMock,
  getDbMock,
  dbSelectMock,
  dbInsertMock,
  getSessionMock,
  getRequestHeadersMock,
} = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  getDbMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbInsertMock: vi.fn(),
  getSessionMock: vi.fn(),
  getRequestHeadersMock: vi.fn().mockReturnValue(new Headers()),
}));

vi.mock('@/init', () => ({
  getDb: getDbMock,
  getAuth: getAuthMock,
}));

vi.mock('@workspace/db/schema', () => ({
  notificationPreferences: {
    userId: 'userId',
    marketingEmails: 'marketingEmails',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    eq: vi.fn((a, b) => ({ field: a, value: b })),
  };
});

// Mock server-only dependencies that notification-preferences.server.ts imports.
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((opts: unknown) => {
    throw opts;
  }),
}));

describe('getNotificationPreferencesForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockReturnValue({ select: dbSelectMock, insert: dbInsertMock });
    getAuthMock.mockReturnValue({ api: { getSession: getSessionMock } });
  });

  it('returns defaults when no row exists', async () => {
    mockDbChain(dbSelectMock, []);

    const result = await getNotificationPreferencesForUser('user-1');
    expect(result).toEqual({
      emailUpdates: true,
      marketingEmails: false,
    });
  });

  it('returns stored preferences when row exists', async () => {
    mockDbChain(dbSelectMock, [{ marketingEmails: true }]);

    const result = await getNotificationPreferencesForUser('user-1');
    expect(result).toEqual({
      emailUpdates: true,
      marketingEmails: true,
    });
  });
});

describe('upsertNotificationPreferencesForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockReturnValue({ select: dbSelectMock, insert: dbInsertMock });
    getAuthMock.mockReturnValue({ api: { getSession: getSessionMock } });
  });

  it('returns current preferences when patch has no boolean marketingEmails', async () => {
    mockDbChain(dbSelectMock, [{ marketingEmails: false }]);

    const result = await upsertNotificationPreferencesForUser('user-1', {});
    expect(result).toEqual({
      emailUpdates: true,
      marketingEmails: false,
    });
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('upserts when marketingEmails is a boolean', async () => {
    mockDbInsertChain(dbInsertMock);
    // After upsert, it re-fetches.
    mockDbChain(dbSelectMock, [{ marketingEmails: true }]);

    const result = await upsertNotificationPreferencesForUser('user-1', {
      marketingEmails: true,
    });
    expect(dbInsertMock).toHaveBeenCalled();
    expect(result.marketingEmails).toBe(true);
  });
});

describe('requireVerifiedSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockReturnValue({ select: dbSelectMock, insert: dbInsertMock });
    getAuthMock.mockReturnValue({ api: { getSession: getSessionMock } });
    getRequestHeadersMock.mockReturnValue(new Headers());
  });

  it('returns session for verified user', async () => {
    const session = createMockSessionResponse();
    getSessionMock.mockResolvedValue(session);

    const result = await requireVerifiedSession();
    expect(result).toEqual(session);
  });

  it('redirects when no session', async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(requireVerifiedSession()).rejects.toEqual(
      expect.objectContaining({ to: '/signin' })
    );
  });
});
