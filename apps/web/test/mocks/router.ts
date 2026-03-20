// test/mocks/router.ts

/**
 * Creates hoisted router mock functions.
 */
export function createRouterMocks() {
  return {
    navigate: vi.fn(),
    redirect: vi.fn((opts: unknown) => {
      throw opts;
    }),
  };
}
