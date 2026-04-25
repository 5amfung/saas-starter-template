import { describe, expect, it, vi } from 'vitest';
import { buildEmailRequestContext } from '@/email/request-context';

describe('buildEmailRequestContext', () => {
  it('returns only requestedAtUtc when no headers are provided', () => {
    const result = buildEmailRequestContext();
    expect(result).toHaveProperty('requestedAtUtc');
    expect(result.ip).toBeUndefined();
    expect(result.city).toBeUndefined();
    expect(result.country).toBeUndefined();
  });

  it('returns only requestedAtUtc when headers are empty', () => {
    const headers = new Headers();
    const result = buildEmailRequestContext(headers);
    expect(result).toHaveProperty('requestedAtUtc');
    expect(result.ip).toBeUndefined();
    expect(result.city).toBeUndefined();
    expect(result.country).toBeUndefined();
  });

  it('formats requestedAtUtc in "D Month YYYY, HH:MM UTC" format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T14:30:00Z'));

    const result = buildEmailRequestContext();
    expect(result.requestedAtUtc).toBe('15 March 2026, 14:30 UTC');

    vi.useRealTimers();
  });

  describe('IP extraction priority', () => {
    it('prefers cf-connecting-ip over other headers', () => {
      const headers = new Headers({
        'cf-connecting-ip': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
        'x-forwarded-for': '3.3.3.3, 4.4.4.4',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.ip).toBe('1.1.1.1');
    });

    it('falls back to x-real-ip when cf-connecting-ip is absent', () => {
      const headers = new Headers({
        'x-real-ip': '2.2.2.2',
        'x-forwarded-for': '3.3.3.3, 4.4.4.4',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.ip).toBe('2.2.2.2');
    });

    it('falls back to first entry of x-forwarded-for', () => {
      const headers = new Headers({
        'x-forwarded-for': '3.3.3.3, 4.4.4.4',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.ip).toBe('3.3.3.3');
    });

    it('trims whitespace from IP values', () => {
      const headers = new Headers({
        'cf-connecting-ip': '  1.1.1.1  ',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.ip).toBe('1.1.1.1');
    });

    it('ignores whitespace-only IP headers', () => {
      const headers = new Headers({
        'cf-connecting-ip': '   ',
        'x-real-ip': '2.2.2.2',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.ip).toBe('2.2.2.2');
    });
  });

  describe('city header priority', () => {
    it('prefers x-vercel-ip-city over cf-ipcity and x-geo-city', () => {
      const headers = new Headers({
        'x-vercel-ip-city': 'San Francisco',
        'cf-ipcity': 'London',
        'x-geo-city': 'Tokyo',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.city).toBe('San Francisco');
    });

    it('falls back to cf-ipcity when x-vercel-ip-city is absent', () => {
      const headers = new Headers({
        'cf-ipcity': 'London',
        'x-geo-city': 'Tokyo',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.city).toBe('London');
    });

    it('falls back to x-geo-city as last resort', () => {
      const headers = new Headers({
        'x-geo-city': 'Tokyo',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.city).toBe('Tokyo');
    });

    it('ignores whitespace-only city headers', () => {
      const headers = new Headers({
        'x-vercel-ip-city': '  ',
        'cf-ipcity': 'London',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.city).toBe('London');
    });
  });

  describe('country header priority', () => {
    it('prefers x-vercel-ip-country over cf-ipcountry and x-geo-country', () => {
      const headers = new Headers({
        'x-vercel-ip-country': 'US',
        'cf-ipcountry': 'GB',
        'x-geo-country': 'JP',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.country).toBe('US');
    });

    it('falls back to cf-ipcountry when x-vercel-ip-country is absent', () => {
      const headers = new Headers({
        'cf-ipcountry': 'GB',
        'x-geo-country': 'JP',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.country).toBe('GB');
    });

    it('falls back to x-geo-country as last resort', () => {
      const headers = new Headers({
        'x-geo-country': 'JP',
      });
      const result = buildEmailRequestContext(headers);
      expect(result.country).toBe('JP');
    });
  });

  it('extracts all fields from complete headers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const headers = new Headers({
      'cf-connecting-ip': '1.2.3.4',
      'x-vercel-ip-city': 'Berlin',
      'x-vercel-ip-country': 'DE',
    });
    const result = buildEmailRequestContext(headers);
    expect(result).toEqual({
      requestedAtUtc: '1 January 2026, 00:00 UTC',
      ip: '1.2.3.4',
      city: 'Berlin',
      country: 'DE',
    });

    vi.useRealTimers();
  });
});
