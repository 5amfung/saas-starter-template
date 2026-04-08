import { afterEach, describe, expect, it, vi } from 'vitest';
import { signInBaselineUser, signInSeededUser } from '@workspace/test-utils';

describe('signInSeededUser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts seeded credentials to Better Auth and returns the cookie header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          'set-cookie': 'better-auth.session_token=abc123; Path=/; HttpOnly',
        },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await signInSeededUser('http://localhost:3000', {
      email: 'owner@e2e.local',
      password: 'Password123!',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/sign-in/email',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      })
    );
    expect(result.cookie).toContain('better-auth.session_token=abc123');
  });

  it('throws a useful error when seeded sign-in fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('invalid credentials', { status: 401 }))
    );

    const run = signInSeededUser('http://localhost:3000', {
      email: 'owner@e2e.local',
      password: 'Password123!',
    });

    await expect(run).rejects.toBeInstanceOf(Error);
    await expect(run).rejects.toMatchObject({
      message: 'Seeded sign-in failed (401): invalid credentials',
    });
  });

  it('signs in a baseline seeded persona with shared fixture credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          'set-cookie':
            'better-auth.session_token=baseline123; Path=/; HttpOnly',
        },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await signInBaselineUser('http://localhost:3000', 'owner');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/sign-in/email',
      expect.objectContaining({
        body: JSON.stringify({
          email: 'owner@e2e.local',
          password: 'Password123!',
        }),
      })
    );
    expect(result.cookie).toContain('better-auth.session_token=baseline123');
  });
});
