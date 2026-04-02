import { describe, expect, it } from 'vitest';

import { app } from '../../src/app';

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
});
