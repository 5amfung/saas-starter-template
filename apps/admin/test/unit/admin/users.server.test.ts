import { updateAdminUser } from '@/admin/users.server';

const { getRequestHeadersMock, adminUpdateUserMock } = vi.hoisted(() => ({
  getRequestHeadersMock: vi.fn(
    () => new Headers({ cookie: 'admin-session=1' })
  ),
  adminUpdateUserMock: vi.fn(),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: getRequestHeadersMock,
}));

vi.mock('@/auth/validators', () => ({
  getVerifiedAdminSession: vi.fn(),
}));

vi.mock('@/init', () => ({
  getAuth: () => ({
    api: {
      adminUpdateUser: adminUpdateUserMock,
    },
  }),
}));

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
