type ParsedCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax';
};

function splitSetCookieHeader(raw: string): Array<string> {
  const setCookies: Array<string> = [];
  let current = '';

  for (const segment of raw.split(', ')) {
    const beforeSemicolon = segment.split(';')[0];
    if (current === '' || beforeSemicolon.includes('=')) {
      if (current) setCookies.push(current);
      current = segment;
    } else {
      current += `, ${segment}`;
    }
  }

  if (current) setCookies.push(current);

  return setCookies;
}

export function parseCookieHeader(
  raw: string,
  domain = 'localhost'
): Array<ParsedCookie> {
  return splitSetCookieHeader(raw).map((entry) => {
    const [nameValue] = entry.trim().split(';');
    const idx = nameValue.indexOf('=');
    return {
      name: nameValue.slice(0, idx).trim(),
      value: nameValue.slice(idx + 1).trim(),
      domain,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
    };
  });
}

export function toCookieHeader(raw: string): string {
  return splitSetCookieHeader(raw)
    .map((entry) => entry.trim().split(';')[0]?.trim() ?? '')
    .filter(Boolean)
    .join('; ');
}
