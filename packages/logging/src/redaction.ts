const AUTH_SENSITIVE_KEYS = new Set([
  'password',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
]);

export function redactAuthMetadata(
  input: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => !AUTH_SENSITIVE_KEYS.has(key))
      .map(([key, value]) => [
        key,
        key === 'email' ? '[REDACTED_EMAIL]' : value,
      ])
  );
}
