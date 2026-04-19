import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedE2EBaseline } from '../../src/seed/seed-e2e-baseline';

const {
  createDbMock,
  hashPasswordMock,
  resetE2EStateMock,
  dbExecuteMock,
  dbInsertMock,
  txExecuteMock,
  txInsertMock,
  txMock,
  transactionMock,
} = vi.hoisted(() => {
  const makeInsertMock = () =>
    vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    }));

  const hoistedTxExecuteMock = vi.fn().mockResolvedValue(undefined);
  const hoistedTxInsertMock = makeInsertMock();
  const hoistedTxMock = {
    execute: hoistedTxExecuteMock,
    insert: hoistedTxInsertMock,
  };
  const hoistedDbExecuteMock = vi.fn().mockResolvedValue(undefined);
  const hoistedDbInsertMock = makeInsertMock();
  const hoistedTransactionMock = vi.fn((callback: (tx: unknown) => unknown) =>
    callback(hoistedTxMock)
  );

  return {
    createDbMock: vi.fn(() => ({
      execute: hoistedDbExecuteMock,
      insert: hoistedDbInsertMock,
      transaction: hoistedTransactionMock,
    })),
    hashPasswordMock: vi.fn().mockResolvedValue('hashed-password'),
    resetE2EStateMock: vi.fn().mockResolvedValue(undefined),
    dbExecuteMock: hoistedDbExecuteMock,
    dbInsertMock: hoistedDbInsertMock,
    txExecuteMock: hoistedTxExecuteMock,
    txInsertMock: hoistedTxInsertMock,
    txMock: hoistedTxMock,
    transactionMock: hoistedTransactionMock,
  };
});

vi.mock('@workspace/db', () => ({
  createDb: createDbMock,
}));

vi.mock('better-auth/crypto', () => ({
  hashPassword: hashPasswordMock,
}));

vi.mock('../../src/seed/reset-e2e-state', () => ({
  resetE2EState: resetE2EStateMock,
}));

describe('seedE2EBaseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs reset and inserts under a transaction-scoped seed lock', async () => {
    await seedE2EBaseline({
      databaseUrl: 'postgres://example.test/db',
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(resetE2EStateMock).toHaveBeenCalledWith({
      db: txMock,
    });
    expect(txExecuteMock).toHaveBeenCalledTimes(1);
    expect(dbExecuteMock).not.toHaveBeenCalled();
    expect(txInsertMock).toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });
});
