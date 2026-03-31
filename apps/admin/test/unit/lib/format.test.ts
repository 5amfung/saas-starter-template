import { formatDate, normalizeRole, toBase64Url } from '@/lib/format';

describe('formatDate', () => {
  it('formats a Date object to en-US short format', () => {
    const result = formatDate(new Date('2026-01-15T00:00:00'));
    expect(result).toBe('Jan 15, 2026');
  });

  it('formats a date string to en-US short format', () => {
    const result = formatDate('2026-06-01');
    expect(result).toContain('2026');
    expect(result).toContain('Jun');
  });
});

describe('normalizeRole', () => {
  it('returns dash for empty string', () => {
    expect(normalizeRole('')).toBe('-');
  });

  it('trims and joins comma-separated roles', () => {
    expect(normalizeRole(' admin , member ')).toBe('admin, member');
  });

  it('handles a single role without commas', () => {
    expect(normalizeRole('owner')).toBe('owner');
  });

  it('filters out empty segments', () => {
    expect(normalizeRole('admin,,member')).toBe('admin, member');
  });
});

describe('toBase64Url', () => {
  it('encodes a simple string', () => {
    const result = toBase64Url('hello');
    expect(result).not.toMatch(/[+/=]/);
  });

  it('encodes unicode characters', () => {
    const result = toBase64Url('héllo wörld');
    expect(result).not.toMatch(/[+/=]/);
  });
});
