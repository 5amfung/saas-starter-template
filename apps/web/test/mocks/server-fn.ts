/**
 * Factory for mocking the createServerFn builder pattern from @tanstack/react-start.
 * Simulates the chained .inputValidator().handler() API used by server functions.
 */
export function createServerFnMock() {
  return {
    createServerFn: () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      let handler: Function;
      const builder = {
        inputValidator: () => builder,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        handler: (fn: Function) => {
          handler = fn;
          const callable = (...args: Array<unknown>) => handler(...args);
          callable.inputValidator = () => builder;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
          callable.handler = (fn2: Function) => {
            handler = fn2;
            return callable;
          };
          return callable;
        },
      };
      const callable = (...args: Array<unknown>) => handler(...args);
      callable.inputValidator = () => builder;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      callable.handler = (fn: Function) => {
        handler = fn;
        return callable;
      };
      return callable;
    },
  };
}
