import { mockDbChain, mockDbInsertChain } from '../../mocks/db';

const {
  getDbMock,
  requireWorkspaceCapabilityForUserMock,
  encryptIntegrationSecretMock,
  decryptIntegrationSecretMock,
  maskIntegrationSecretMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  requireWorkspaceCapabilityForUserMock: vi.fn(),
  encryptIntegrationSecretMock: vi.fn(),
  decryptIntegrationSecretMock: vi.fn(),
  maskIntegrationSecretMock: vi.fn(),
}));

vi.mock('@/init', () => ({
  getDb: getDbMock,
  workspaceIntegrationSecrets: {
    id: 'id',
    workspaceId: 'workspaceId',
    integration: 'integration',
    key: 'key',
    encryptedValue: 'encryptedValue',
    iv: 'iv',
    authTag: 'authTag',
    encryptionVersion: 'encryptionVersion',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('@/policy/workspace-capabilities.server', () => ({
  requireWorkspaceCapabilityForUser: requireWorkspaceCapabilityForUserMock,
}));

vi.mock('@/integrations/integration-crypto.server', () => ({
  encryptIntegrationSecret: encryptIntegrationSecretMock,
  decryptIntegrationSecret: decryptIntegrationSecretMock,
  maskIntegrationSecret: maskIntegrationSecretMock,
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    and: vi.fn((...conditions) => ({ conditions })),
    eq: vi.fn((field, value) => ({ field, value })),
  };
});

describe('getWorkspaceIntegrationsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns display-safe integration summaries with masked values', async () => {
    const dbSelectMock = vi.fn();
    getDbMock.mockReturnValue({ select: dbSelectMock });
    requireWorkspaceCapabilityForUserMock.mockResolvedValueOnce({
      canViewIntegrations: true,
    });
    mockDbChain(dbSelectMock, [
      {
        integration: 'slack',
        key: 'clientId',
        encryptedValue: 'enc-id',
        iv: 'iv-id',
        authTag: 'tag-id',
        encryptionVersion: 1,
      },
    ]);
    decryptIntegrationSecretMock.mockReturnValueOnce('client-id-123456');
    maskIntegrationSecretMock.mockReturnValueOnce('client*********');

    const { getWorkspaceIntegrationsSummary } =
      await import('@/integrations/integration-secrets.server');

    const result = await getWorkspaceIntegrationsSummary(
      new Headers(),
      'ws-1',
      'user-1'
    );

    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      expect.any(Headers),
      'ws-1',
      'user-1',
      'canViewIntegrations'
    );
    expect(result).toEqual([
      {
        integration: 'slack',
        label: 'Slack',
        fields: [
          {
            key: 'clientId',
            label: 'Client ID',
            hasValue: true,
            maskedValue: 'client*********',
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            hasValue: false,
            maskedValue: null,
          },
        ],
      },
    ]);
  });
});

describe('revealWorkspaceIntegrationSecretValue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires integration management capability before revealing values', async () => {
    requireWorkspaceCapabilityForUserMock.mockRejectedValueOnce(
      new Error('forbidden')
    );

    const { revealWorkspaceIntegrationSecretValue } =
      await import('@/integrations/integration-secrets.server');

    await expect(
      revealWorkspaceIntegrationSecretValue(
        new Headers(),
        'ws-1',
        'user-1',
        'slack',
        'clientSecret'
      )
    ).rejects.toMatchObject({ message: 'forbidden' });
  });

  it('reveals one decrypted value', async () => {
    const dbSelectMock = vi.fn();
    getDbMock.mockReturnValue({ select: dbSelectMock });
    requireWorkspaceCapabilityForUserMock.mockResolvedValueOnce({
      canManageIntegrations: true,
    });
    mockDbChain(dbSelectMock, [
      {
        encryptedValue: 'enc-secret',
        iv: 'iv-secret',
        authTag: 'tag-secret',
        encryptionVersion: 1,
      },
    ]);
    decryptIntegrationSecretMock.mockReturnValueOnce('plain-secret');

    const { revealWorkspaceIntegrationSecretValue } =
      await import('@/integrations/integration-secrets.server');

    await expect(
      revealWorkspaceIntegrationSecretValue(
        new Headers(),
        'ws-1',
        'user-1',
        'slack',
        'clientSecret'
      )
    ).resolves.toEqual({ value: 'plain-secret' });
  });
});

describe('updateWorkspaceIntegrationSecretValues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('encrypts/upserts saved values and deletes cleared values', async () => {
    const dbSelectMock = vi.fn();
    const dbInsertMock = vi.fn();
    const dbDeleteMock = vi.fn();
    const deleteWhereMock = vi.fn().mockResolvedValue([]);
    const transactionMock = vi.fn(async (callback) =>
      callback({
        insert: dbInsertMock,
        delete: dbDeleteMock.mockReturnValue({ where: deleteWhereMock }),
      })
    );

    getDbMock.mockReturnValue({
      select: dbSelectMock,
      insert: dbInsertMock,
      delete: dbDeleteMock.mockReturnValue({ where: deleteWhereMock }),
      transaction: transactionMock,
    });
    requireWorkspaceCapabilityForUserMock.mockResolvedValueOnce({
      canManageIntegrations: true,
    });
    mockDbInsertChain(dbInsertMock);
    encryptIntegrationSecretMock.mockReturnValueOnce({
      encryptedValue: 'enc-value',
      iv: 'iv-value',
      authTag: 'tag-value',
      encryptionVersion: 1,
    });
    mockDbChain(dbSelectMock, [
      {
        integration: 'slack',
        key: 'clientId',
        encryptedValue: 'enc-value',
        iv: 'iv-value',
        authTag: 'tag-value',
        encryptionVersion: 1,
      },
    ]);
    decryptIntegrationSecretMock.mockReturnValueOnce('client-id-1');
    maskIntegrationSecretMock.mockReturnValueOnce('client********');

    const { updateWorkspaceIntegrationSecretValues } =
      await import('@/integrations/integration-secrets.server');

    const result = await updateWorkspaceIntegrationSecretValues(
      new Headers(),
      'ws-1',
      'user-1',
      'slack',
      [
        { key: 'clientId', value: 'client-id-1' },
        { key: 'clientSecret', value: '' },
      ]
    );

    expect(requireWorkspaceCapabilityForUserMock).toHaveBeenCalledWith(
      expect.any(Headers),
      'ws-1',
      'user-1',
      'canManageIntegrations'
    );
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(encryptIntegrationSecretMock).toHaveBeenCalledWith('client-id-1');
    expect(dbInsertMock).toHaveBeenCalled();
    expect(dbDeleteMock).toHaveBeenCalled();
    expect(deleteWhereMock).toHaveBeenCalled();
    expect(result).toEqual([
      {
        integration: 'slack',
        label: 'Slack',
        fields: [
          {
            key: 'clientId',
            label: 'Client ID',
            hasValue: true,
            maskedValue: 'client********',
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            hasValue: false,
            maskedValue: null,
          },
        ],
      },
    ]);
  });
});
