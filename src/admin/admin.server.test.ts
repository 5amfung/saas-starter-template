import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDayBuckets, getLocalDayStartUtc } from './admin.server';

// Mock modules that import server-only dependencies.
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn(),
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  gte: vi.fn(),
  isNotNull: vi.fn(),
  lt: vi.fn(),
  sql: vi.fn(),
}));
vi.mock('@/auth/auth.server', () => ({
  auth: { api: {} },
}));
vi.mock('@/db', () => ({
  db: {},
}));
vi.mock('@/db/schema', () => ({
  user: {},
}));

describe('getLocalDayStartUtc', () => {
  beforeEach(() => {
    // Freeze time: 2026-03-12 15:30:00 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T15:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns start of day in UTC when offset is 0', () => {
    const result = getLocalDayStartUtc(0);
    expect(result.toISOString()).toBe('2026-03-12T00:00:00.000Z');
  });

  it('handles negative offset (ahead of UTC, e.g., UTC+5:30)', () => {
    // offset = -330 means 5.5 hours ahead. Local time = 21:00 on Mar 12.
    // Local day start in UTC = Mar 12 00:00 local = Mar 11 18:30 UTC.
    const result = getLocalDayStartUtc(-330);
    expect(result.toISOString()).toBe('2026-03-11T18:30:00.000Z');
  });

  it('handles positive offset (behind UTC, e.g., UTC-8)', () => {
    // offset = 480 means 8 hours behind. Local time = 07:30 on Mar 12.
    // Local day start in UTC = Mar 12 00:00 local = Mar 12 08:00 UTC.
    const result = getLocalDayStartUtc(480);
    expect(result.toISOString()).toBe('2026-03-12T08:00:00.000Z');
  });
});

describe('getDayBuckets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T15:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates correct number of buckets', () => {
    const buckets = getDayBuckets(7, 0);
    expect(buckets).toHaveLength(7);
  });

  it('buckets span exactly 24 hours each', () => {
    const buckets = getDayBuckets(3, 0);
    for (const bucket of buckets) {
      const diff = bucket.end.getTime() - bucket.start.getTime();
      expect(diff).toBe(24 * 60 * 60 * 1000);
    }
  });

  it('last bucket starts at today', () => {
    const buckets = getDayBuckets(3, 0);
    const last = buckets[buckets.length - 1];
    expect(last.label).toBe('2026-03-12');
  });

  it('labels are consecutive dates', () => {
    const buckets = getDayBuckets(3, 0);
    expect(buckets.map((b) => b.label)).toEqual([
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
    ]);
  });

  it('adjusts labels for timezone offset', () => {
    // UTC-8: local time is 07:30 on Mar 12. Still Mar 12 locally.
    const buckets = getDayBuckets(1, 480);
    expect(buckets[0].label).toBe('2026-03-12');
  });
});
