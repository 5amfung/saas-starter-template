import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { app } from '../../src/app';
import { errorHandler } from '../../src/middleware/error-handler.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { requestLoggerMiddleware } from '../../src/middleware/request-logger.js';
import type { AppVariables } from '../../src/lib/request-id.js';

const { captureServerErrorMock } = vi.hoisted(() => ({
  captureServerErrorMock: vi.fn(),
}));

vi.mock('../../src/lib/observability.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    captureServerError: captureServerErrorMock,
  };
});

describe('api server app', () => {
  it('returns hello payload and request id header', async () => {
    const response = await app.request('/hello');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(payload).toEqual({
      message: 'Hello from the API',
      requestId: expect.any(String),
    });
  });

  it('forwards an incoming request id', async () => {
    const response = await app.request('/hello', {
      headers: {
        'x-request-id': 'req-from-proxy',
      },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req-from-proxy');
    expect(payload).toEqual({
      message: 'Hello from the API',
      requestId: 'req-from-proxy',
    });
  });

  it('returns a json 404 response with a request id', async () => {
    const response = await app.request('/missing');
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(payload).toEqual({
      error: {
        message: 'Not Found',
        requestId: expect.any(String),
      },
    });
  });

  it('returns cors and security headers on hello responses', async () => {
    const response = await app.request('/hello');

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('captures internal errors with request metadata', async () => {
    const failingApp = new Hono<{ Variables: AppVariables }>();

    failingApp.use('*', requestIdMiddleware);
    failingApp.use('*', requestLoggerMiddleware);
    failingApp.get('/boom', () => {
      throw new Error('boom');
    });
    failingApp.onError(errorHandler);

    const response = await failingApp.request('/boom');
    const payload = (await response.json()) as {
      error: {
        message: string;
        requestId: string;
      };
    };

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: {
        message: 'Internal Server Error',
        requestId: expect.any(String),
      },
    });
    expect(captureServerErrorMock).toHaveBeenCalledWith(expect.any(Error), {
      requestId: payload.error.requestId,
      route: '/boom',
    });
  });
});
