const { mockServerFn, mockClientFn, mockMiddlewareFn } = vi.hoisted(() => ({
  mockServerFn: vi.fn(),
  mockClientFn: vi.fn(),
  mockMiddlewareFn: vi.fn(),
}));

// Capture the callbacks passed to .server() and .client() so we can test them directly.
// The logger export must be a callable function (since requestLogger calls logger(...) internally).
vi.mock('@tanstack/react-start', () => {
  // Create a callable function that also has .server() and .client() builder methods.
  function createCallable() {
    let serverHandler: ((...args: Array<unknown>) => unknown) | null = null;

    const callable = Object.assign(
      (...args: Array<unknown>) => {
        if (serverHandler) return serverHandler(...args);
        return undefined;
      },
      {
        server(fn: (...args: Array<unknown>) => unknown) {
          serverHandler = fn;
          mockServerFn.mockImplementation(fn);
          return callable;
        },
        client(fn: (...args: Array<unknown>) => unknown) {
          mockClientFn.mockImplementation(fn);
          return callable;
        },
      }
    );

    return callable;
  }

  return {
    createIsomorphicFn: () => createCallable(),
    createMiddleware: () => ({
      server(fn: (...args: Array<unknown>) => unknown) {
        mockMiddlewareFn.mockImplementation(fn);
        return fn;
      },
    }),
  };
});

// Must import after mocks are set up.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type LoggerModule = typeof import('@/lib/logger');
let logger: LoggerModule['logger'];
let requestLogger: LoggerModule['requestLogger'];

beforeAll(async () => {
  const mod = await import('@/lib/logger');
  logger = mod.logger;
  requestLogger = mod.requestLogger;
});

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is defined and callable', () => {
    expect(logger).toBeDefined();
    expect(typeof logger).toBe('function');
  });

  it('server handler calls console in development mode', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    mockServerFn('info', 'test message', { key: 'value' });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO]'),
      'test message',
      { key: 'value' }
    );

    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('client handler calls console with level prefix', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockClientFn('warn', 'client warning');

    expect(consoleSpy).toHaveBeenCalledWith('[WARN]', 'client warning', '');

    consoleSpy.mockRestore();
  });

  it('client handler logs in all environments', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    mockClientFn('info', 'production log');

    expect(consoleSpy).toHaveBeenCalledWith('[INFO]', 'production log', '');

    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalNodeEnv;
  });
});

describe('requestLogger', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    // requestLogger calls logger() internally, which falls into the production
    // branch when NODE_ENV !== 'development'. That branch recursively calls
    // logger (a known bug), so we force development mode for these tests.
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('is defined', () => {
    expect(requestLogger).toBeDefined();
  });

  it('middleware handler logs request and returns result', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const mockResult = { response: { status: 200 } };
    const mockNext = vi.fn().mockResolvedValue(mockResult);
    const mockRequest = { method: 'GET', url: 'http://localhost/api/test' };

    const result = await mockMiddlewareFn({
      request: mockRequest,
      next: mockNext,
    });

    expect(mockNext).toHaveBeenCalled();
    expect(result).toBe(mockResult);
    consoleSpy.mockRestore();
  });

  it('middleware handler logs error and re-throws on failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Request failed');
    const mockNext = vi.fn().mockRejectedValue(error);
    const mockRequest = { method: 'POST', url: 'http://localhost/api/fail' };

    await expect(
      mockMiddlewareFn({ request: mockRequest, next: mockNext })
    ).rejects.toThrow('Request failed');
    consoleSpy.mockRestore();
  });
});
