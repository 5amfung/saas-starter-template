// src/test/mocks/db.ts

/**
 * Creates a chainable mock for Drizzle ORM's query patterns.
 *
 * Supports two chain shapes:
 * - `db.select().from().where()` — resolves at `.where()`.
 * - `db.select().from().where().limit()` — resolves at `.limit()`.
 *
 * The `.where()` mock is thenable (resolves to `result`) so queries that
 * `await` at `.where()` work correctly. It also exposes a `.limit()` method
 * for queries that continue the chain.
 *
 * For queries that end with `.from()` (no where/limit), mock `.from()` directly.
 */
export function mockDbChain(
  dbSelectMock: ReturnType<typeof vi.fn>,
  result: Array<unknown>,
) {
  const limitMock = vi.fn().mockResolvedValue(result);
  const whereResult = Object.assign(Promise.resolve(result), {
    limit: limitMock,
  });
  const whereMock = vi.fn().mockReturnValue(whereResult);
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  dbSelectMock.mockReturnValue({ from: fromMock });
  return { fromMock, whereMock, limitMock };
}

/**
 * Creates a chainable mock for Drizzle ORM's `db.insert().values().onConflictDoUpdate()` pattern.
 */
export function mockDbInsertChain(
  dbInsertMock: ReturnType<typeof vi.fn>,
  result: Array<unknown> = [],
) {
  const onConflictDoUpdateMock = vi.fn().mockResolvedValue(result);
  const valuesMock = vi
    .fn()
    .mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
  dbInsertMock.mockReturnValue({ values: valuesMock });
  return { valuesMock, onConflictDoUpdateMock };
}
