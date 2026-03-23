/** Type for captured middleware server functions. */
export type CapturedServerFns = Record<
  string,
  (opts: { next: () => Promise<unknown> }) => Promise<unknown>
>;

/**
 * Creates a createMiddleware mock that captures server functions into the provided record.
 * The capturedServerFns object should be created in vi.hoisted() and passed here.
 */
export function createMiddlewareMock(capturedServerFns: CapturedServerFns) {
  return {
    createMiddleware: () => ({
      server: (
        fn: (opts: { next: () => Promise<unknown> }) => Promise<unknown>
      ) => {
        const index = Object.keys(capturedServerFns).length;
        const key = `middleware_${index}`;
        capturedServerFns[key] = fn;
        return { _key: key };
      },
    }),
  };
}
