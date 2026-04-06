import { createServerFnMock } from '../../mocks/server-fn';
import {
  deleteUser,
  getUser,
  listUsers,
  updateUser,
} from '@/admin/users.functions';

const {
  requireCurrentAdminAppCapabilityMock,
  listAdminUsersMock,
  getAdminUserDetailMock,
  updateAdminUserMock,
  deleteAdminUserMock,
} = vi.hoisted(() => ({
  requireCurrentAdminAppCapabilityMock: vi.fn(),
  listAdminUsersMock: vi.fn(),
  getAdminUserDetailMock: vi.fn(),
  updateAdminUserMock: vi.fn(),
  deleteAdminUserMock: vi.fn(),
}));

vi.mock('@tanstack/react-start', () => createServerFnMock());

vi.mock('@/policy/admin-app-capabilities.server', () => ({
  requireCurrentAdminAppCapability: requireCurrentAdminAppCapabilityMock,
}));

vi.mock('@/admin/users.server', () => ({
  listAdminUsers: listAdminUsersMock,
  getAdminUserDetail: getAdminUserDetailMock,
  updateAdminUser: updateAdminUserMock,
  deleteAdminUser: deleteAdminUserMock,
}));

describe('listUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires canViewUsers', async () => {
    requireCurrentAdminAppCapabilityMock.mockRejectedValueOnce(
      new Error('Forbidden')
    );

    await expect(
      listUsers({ data: { limit: 10, offset: 0 } })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('delegates to listAdminUsers with validated input', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    listAdminUsersMock.mockResolvedValueOnce({ users: [], total: 0 });

    await listUsers({
      data: { limit: 10, offset: 0, searchValue: 'alice' },
    });

    expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
      'canViewUsers'
    );
    expect(listAdminUsersMock).toHaveBeenCalledWith({
      limit: 10,
      offset: 0,
      searchValue: 'alice',
    });
  });
});

describe('getUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires canViewUsers', async () => {
    requireCurrentAdminAppCapabilityMock.mockRejectedValueOnce(
      new Error('Forbidden')
    );

    await expect(getUser({ data: { userId: 'user-1' } })).rejects.toMatchObject(
      { message: 'Forbidden' }
    );
  });

  it('delegates to getAdminUserDetail', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    getAdminUserDetailMock.mockResolvedValueOnce({ id: 'user-1' });

    await getUser({ data: { userId: 'user-1' } });

    expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
      'canViewUsers'
    );
    expect(getAdminUserDetailMock).toHaveBeenCalledWith('user-1');
  });
});

describe('updateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires canManageUsers', async () => {
    requireCurrentAdminAppCapabilityMock.mockRejectedValueOnce(
      new Error('Forbidden')
    );

    await expect(
      updateUser({
        data: {
          userId: 'user-1',
          name: 'Alice',
          email: 'alice@example.com',
          emailVerified: true,
          image: '',
          role: 'user',
          banned: false,
          banReason: '',
          banExpires: '',
        },
      })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('delegates to updateAdminUser', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    updateAdminUserMock.mockResolvedValueOnce({ success: true });

    await updateUser({
      data: {
        userId: 'user-1',
        name: 'Alice',
        email: 'alice@example.com',
        emailVerified: true,
        image: '',
        role: 'user',
        banned: false,
        banReason: '',
        banExpires: '',
      },
    });

    expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
      'canManageUsers'
    );
    expect(updateAdminUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
      })
    );
  });
});

describe('deleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires canDeleteUsers', async () => {
    requireCurrentAdminAppCapabilityMock.mockRejectedValueOnce(
      new Error('Forbidden')
    );

    await expect(
      deleteUser({ data: { userId: 'user-1' } })
    ).rejects.toMatchObject({ message: 'Forbidden' });
  });

  it('delegates to deleteAdminUser', async () => {
    requireCurrentAdminAppCapabilityMock.mockResolvedValueOnce({});
    deleteAdminUserMock.mockResolvedValueOnce({ success: true });

    await deleteUser({ data: { userId: 'user-1' } });

    expect(requireCurrentAdminAppCapabilityMock).toHaveBeenCalledWith(
      'canDeleteUsers'
    );
    expect(deleteAdminUserMock).toHaveBeenCalledWith('user-1');
  });
});
