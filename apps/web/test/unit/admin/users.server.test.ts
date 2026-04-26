import { isNotFound } from '@tanstack/react-router';
import { getAdminUserDetail, updateAdminUser } from '@/admin/users.server';

const { getRequestHeadersMock, getUserMock, adminUpdateUserMock } = vi.hoisted(
  () => ({
    getRequestHeadersMock: vi.fn(
      () => new Headers({ cookie: 'admin-session=1' })
    ),
    getUserMock: vi.fn(),
    adminUpdateUserMock: vi.fn(),
  })
);

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/init.server', () => ({
  getAuth: () => ({
    api: {
      getUser: getUserMock,
      adminUpdateUser: adminUpdateUserMock,
    },
  }),
}));

describe('getAdminUserDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to auth.api.getUser with headers and query id', async () => {
    const user = {
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice',
      emailVerified: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    };
    getUserMock.mockResolvedValueOnce({ data: user });

    await expect(getAdminUserDetail('user-1')).resolves.toEqual(user);

    expect(getUserMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      query: { id: 'user-1' },
    });
  });

  it('throws notFound when auth.api.getUser returns no user', async () => {
    getUserMock.mockResolvedValueOnce({ data: null });

    await expect(getAdminUserDetail('missing-user')).rejects.toSatisfy(
      isNotFound
    );
  });
});

describe('updateAdminUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to auth.api.adminUpdateUser with normalized payload', async () => {
    adminUpdateUserMock.mockResolvedValueOnce({ data: { id: 'user-1' } });

    await updateAdminUser({
      userId: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      emailVerified: true,
      image: '',
      role: 'admin',
      banned: false,
      banReason: '',
      banExpires: '',
    });

    expect(adminUpdateUserMock).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: {
        userId: 'user-1',
        data: {
          name: 'Alice',
          email: 'alice@example.com',
          emailVerified: true,
          image: null,
          role: 'admin',
          banned: false,
          banReason: null,
          banExpires: null,
        },
      },
    });
  });
});
