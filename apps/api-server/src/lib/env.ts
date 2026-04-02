const DEFAULT_API_NAME = 'api-server';
const DEFAULT_CORS_ORIGIN = '*';
const DEFAULT_NODE_ENV = 'development';
const DEFAULT_PORT = 3002;

export function getApiName(): string {
  return process.env.API_NAME ?? DEFAULT_API_NAME;
}

export function getCorsOrigin(): string {
  return process.env.API_CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN;
}

export function getNodeEnv(): string {
  return process.env.NODE_ENV ?? DEFAULT_NODE_ENV;
}

export function getPort(): number {
  return Number(process.env.PORT ?? DEFAULT_PORT);
}

export function isTestEnv(): boolean {
  return getNodeEnv() === 'test';
}
