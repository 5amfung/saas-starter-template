import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getWorkspaceIntegrationSummaries,
  revealWorkspaceIntegrationValue,
  updateWorkspaceIntegrationValues,
} from '../../src/workspace-integrations';

const ENCRYPTION_KEY = Buffer.alloc(32, 13).toString('base64');

type TestDb = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
};

const {
  decryptIntegrationSecretMock,
  encryptIntegrationSecretMock,
  maskIntegrationSecretMock,
} = vi.hoisted(() => ({
  decryptIntegrationSecretMock: vi.fn(),
  encryptIntegrationSecretMock: vi.fn(),
  maskIntegrationSecretMock: vi.fn(),
}));

vi.mock('../../src/crypto', () => ({
  decryptIntegrationSecret: decryptIntegrationSecretMock,
  encryptIntegrationSecret: encryptIntegrationSecretMock,
  maskIntegrationSecret: maskIntegrationSecretMock,
}));

function createDbMock() {
  const selectMock = vi.fn();
  const insertMock = vi.fn();
  const deleteMock = vi.fn();
  const db: TestDb = {
    select: selectMock,
    insert: insertMock,
    delete: deleteMock,
    transaction: vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) =>
      callback(db)
    ),
  };

  return {
    db,
    selectMock,
    insertMock,
    deleteMock,
    transactionMock: db.transaction,
  };
}

function mockSelectRows(
  selectMock: ReturnType<typeof vi.fn>,
  rows: Array<unknown>
) {
  selectMock.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

function mockSelectRowsWithLimit(
  selectMock: ReturnType<typeof vi.fn>,
  rows: Array<unknown>
) {
  selectMock.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

describe('workspace integrations operations', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns masked summaries from encrypted rows', async () => {
    const { db, selectMock } = createDbMock();

    mockSelectRows(selectMock, [
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

    const result = await getWorkspaceIntegrationSummaries({
      db: db as Parameters<typeof getWorkspaceIntegrationSummaries>[0]['db'],
      encryptionKey: ENCRYPTION_KEY,
      workspaceId: 'ws-1',
    });

    expect(selectMock).toHaveBeenCalled();
    expect(decryptIntegrationSecretMock).toHaveBeenCalledWith(
      expect.objectContaining({
        integration: 'slack',
        key: 'clientId',
      }),
      ENCRYPTION_KEY
    );
    expect(maskIntegrationSecretMock).toHaveBeenCalledWith('client-id-123456');
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
            value: null,
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            hasValue: false,
            maskedValue: null,
            value: null,
          },
        ],
      },
    ]);
  });

  it('includes plaintext values when explicitly requested', async () => {
    const { db, selectMock } = createDbMock();

    mockSelectRows(selectMock, [
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

    const result = await getWorkspaceIntegrationSummaries({
      db: db as Parameters<typeof getWorkspaceIntegrationSummaries>[0]['db'],
      encryptionKey: ENCRYPTION_KEY,
      workspaceId: 'ws-1',
      includeValues: true,
    });

    expect(result[0]?.fields[0]).toEqual({
      key: 'clientId',
      label: 'Client ID',
      hasValue: true,
      maskedValue: 'client*********',
      value: 'client-id-123456',
    });
  });

  it('reveals one stored value', async () => {
    const { db, selectMock } = createDbMock();

    mockSelectRowsWithLimit(selectMock, [
      {
        integration: 'slack',
        key: 'clientSecret',
        encryptedValue: 'enc-secret',
        iv: 'iv-secret',
        authTag: 'tag-secret',
        encryptionVersion: 1,
      },
    ]);
    decryptIntegrationSecretMock.mockReturnValueOnce('client-secret-123');

    await expect(
      revealWorkspaceIntegrationValue({
        db: db as Parameters<typeof revealWorkspaceIntegrationValue>[0]['db'],
        encryptionKey: ENCRYPTION_KEY,
        workspaceId: 'ws-1',
        integration: 'slack',
        key: 'clientSecret',
      })
    ).resolves.toEqual({ value: 'client-secret-123' });
  });

  it('upserts saved values and deletes cleared values inside one transaction', async () => {
    const { db, insertMock, deleteMock, transactionMock, selectMock } =
      createDbMock();
    const valuesMock = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    });
    insertMock.mockReturnValue({ values: valuesMock });
    deleteMock.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    encryptIntegrationSecretMock.mockReturnValue({
      encryptedValue: 'enc-value',
      iv: 'iv-value',
      authTag: 'tag-value',
      encryptionVersion: 1,
    });
    mockSelectRows(selectMock, [
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

    const result = await updateWorkspaceIntegrationValues({
      db: db as Parameters<typeof updateWorkspaceIntegrationValues>[0]['db'],
      encryptionKey: ENCRYPTION_KEY,
      workspaceId: 'ws-1',
      integration: 'slack',
      values: [
        { key: 'clientId', value: 'client-id-1' },
        { key: 'clientSecret', value: '' },
      ],
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(encryptIntegrationSecretMock).toHaveBeenCalledWith(
      'client-id-1',
      ENCRYPTION_KEY
    );
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        integration: 'slack',
        key: 'clientId',
      })
    );
    expect(deleteMock).toHaveBeenCalled();
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
            value: 'client-id-1',
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            hasValue: false,
            maskedValue: null,
            value: null,
          },
        ],
      },
    ]);
  });
});
