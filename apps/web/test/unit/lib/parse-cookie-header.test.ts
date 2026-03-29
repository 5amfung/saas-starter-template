import {
  parseCookieHeader,
  toCookieHeader,
} from '../../e2e/lib/parse-cookie-header';

describe('parseCookieHeader', () => {
  it('preserves Expires attributes while splitting multiple cookies', () => {
    const parsed = parseCookieHeader(
      [
        'session=abc123; Path=/; HttpOnly; Expires=Thu, 01 Jan 2026 00:00:00 GMT',
        'csrf=xyz789; Path=/; SameSite=Lax',
      ].join(', ')
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      name: 'session',
      value: 'abc123',
      domain: 'localhost',
    });
    expect(parsed[1]).toMatchObject({
      name: 'csrf',
      value: 'xyz789',
      domain: 'localhost',
    });
  });
});

describe('toCookieHeader', () => {
  it('converts raw Set-Cookie headers into a valid Cookie header', () => {
    const cookieHeader = toCookieHeader(
      [
        'session=abc123; Path=/; HttpOnly; Expires=Thu, 01 Jan 2026 00:00:00 GMT',
        'csrf=xyz789; Path=/; SameSite=Lax',
      ].join(', ')
    );

    expect(cookieHeader).toBe('session=abc123; csrf=xyz789');
  });
});
