const { mockLogger, mockRequestLogger } = vi.hoisted(() => ({
  mockLogger: vi.fn(),
  mockRequestLogger: vi.fn(),
}));

vi.mock('@workspace/components/lib', () => ({
  createLogger: vi.fn(() => mockLogger),
  createRequestLogger: vi.fn(() => mockRequestLogger),
}));

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
  it('is the logger created by createLogger with service name "admin"', async () => {
    const { createLogger } = await import('@workspace/components/lib');
    expect(createLogger).toHaveBeenCalledWith('admin');
    expect(logger).toBe(mockLogger);
  });
});

describe('requestLogger', () => {
  it('is the request logger created by createRequestLogger with the admin logger', async () => {
    const { createRequestLogger } = await import('@workspace/components/lib');
    expect(createRequestLogger).toHaveBeenCalledWith(mockLogger);
    expect(requestLogger).toBe(mockRequestLogger);
  });
});
