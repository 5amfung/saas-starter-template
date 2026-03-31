import {
  getDayBuckets,
  getLocalDayStartUtc,
  queryDashboardMetrics,
  queryMauChartData,
  querySignupChartData,
} from '@/admin/admin.server';

const { dbSelectMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
}));

// Mock modules that import server-only dependencies.
vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn(),
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    and: vi.fn(),
    gte: vi.fn(),
    isNotNull: vi.fn(),
    lt: vi.fn(),
    sql: vi.fn(),
  };
});
vi.mock('@/init', () => ({
  auth: { api: {} },
  db: { select: dbSelectMock },
}));
vi.mock('@/auth/admin-auth.schema', () => ({
  user: {
    createdAt: 'createdAt',
    emailVerified: 'emailVerified',
    lastSignInAt: 'lastSignInAt',
  },
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
    const result = getLocalDayStartUtc(-330);
    expect(result.toISOString()).toBe('2026-03-11T18:30:00.000Z');
  });

  it('handles positive offset (behind UTC, e.g., UTC-8)', () => {
    const result = getLocalDayStartUtc(480);
    expect(result.toISOString()).toBe('2026-03-12T08:00:00.000Z');
  });

  it('handles UTC+14 (offset = -840, date crosses to next UTC day)', () => {
    const result = getLocalDayStartUtc(-840);
    expect(result.toISOString()).toBe('2026-03-12T10:00:00.000Z');
  });

  it('handles UTC-12 (offset = 720, date stays on same UTC day)', () => {
    const result = getLocalDayStartUtc(720);
    expect(result.toISOString()).toBe('2026-03-12T12:00:00.000Z');
  });

  it('handles UTC+5:45 Nepal (offset = -345, sub-hour offset produces non-zero UTC minutes)', () => {
    const result = getLocalDayStartUtc(-345);
    expect(result.toISOString()).toBe('2026-03-11T18:15:00.000Z');
    expect(result.getUTCMinutes()).toBe(15);
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
    const buckets = getDayBuckets(1, 480);
    expect(buckets[0].label).toBe('2026-03-12');
  });

  describe('year boundary', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-12-31T08:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('last bucket label is the local date at year boundary (UTC-8)', () => {
      const buckets = getDayBuckets(7, 480);
      const last = buckets[buckets.length - 1];
      expect(last.label).toBe('2025-12-31');
    });

    it('all 7 buckets span exactly 24 hours despite crossing year boundary', () => {
      const buckets = getDayBuckets(7, 480);
      expect(buckets).toHaveLength(7);
      for (const bucket of buckets) {
        const diff = bucket.end.getTime() - bucket.start.getTime();
        expect(diff).toBe(24 * 60 * 60 * 1000);
      }
    });
  });

  describe('month boundary', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-01T08:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('generates correct labels spanning a month boundary', () => {
      const buckets = getDayBuckets(3, 0);
      expect(buckets.map((b) => b.label)).toEqual([
        '2026-02-27',
        '2026-02-28',
        '2026-03-01',
      ]);
    });

    it('no bucket is skipped at the month boundary', () => {
      const buckets = getDayBuckets(3, 0);
      expect(buckets).toHaveLength(3);
    });
  });
});

describe('queryDashboardMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns metrics from DB query result', async () => {
    const mockRow = {
      totalUsers: 100,
      verifiedUsers: 80,
      unverifiedUsers: 20,
      signupsToday: 5,
      verifiedToday: 3,
      unverifiedToday: 2,
    };
    const fromMock = vi.fn().mockResolvedValue([mockRow]);
    dbSelectMock.mockReturnValue({ from: fromMock });

    const result = await queryDashboardMetrics(0);
    expect(result).toEqual(mockRow);
  });
});

describe('querySignupChartData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns chart data with verified/unverified counts per day', async () => {
    const today = new Date('2026-03-13T10:00:00Z');
    const mockRows = [
      { createdAt: today, emailVerified: true },
      { createdAt: today, emailVerified: false },
    ];
    const whereMock = vi.fn().mockResolvedValue(mockRows);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    dbSelectMock.mockReturnValue({ from: fromMock });

    const result = await querySignupChartData(7, 0);
    expect(result).toHaveLength(7);
    const todayBucket = result[result.length - 1];
    expect(todayBucket.verified).toBe(1);
    expect(todayBucket.unverified).toBe(1);
  });

  it('returns empty counts for days with no signups', async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    dbSelectMock.mockReturnValue({ from: fromMock });

    const result = await querySignupChartData(7, 0);
    expect(result).toHaveLength(7);
    result.forEach((bucket) => {
      expect(bucket.verified).toBe(0);
      expect(bucket.unverified).toBe(0);
    });
  });
});

describe('queryMauChartData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts MAU using 30-day sliding window', async () => {
    const recentSignIn = new Date('2026-03-12T10:00:00Z');
    const mockRows = [{ lastSignInAt: recentSignIn }];
    const whereMock = vi.fn().mockResolvedValue(mockRows);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    dbSelectMock.mockReturnValue({ from: fromMock });

    const result = await queryMauChartData(7, 0);
    expect(result).toHaveLength(7);
    const todayBucket = result[result.length - 1];
    expect(todayBucket.mau).toBeGreaterThanOrEqual(1);
  });

  it('returns zero MAU for days with no activity', async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    dbSelectMock.mockReturnValue({ from: fromMock });

    const result = await queryMauChartData(7, 0);
    result.forEach((bucket) => {
      expect(bucket.mau).toBe(0);
    });
  });

  describe('30-day window boundary', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-12T15:30:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('counts a user whose lastSignInAt is exactly 30 days ago (window start is inclusive)', async () => {
      const lastSignInAt = new Date('2026-02-10T15:30:00Z');
      const mockRows = [{ lastSignInAt }];
      const whereMock = vi.fn().mockResolvedValue(mockRows);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      dbSelectMock.mockReturnValue({ from: fromMock });

      const result = await queryMauChartData(1, 0);
      expect(result[0].mau).toBe(1);
    });

    it('does not count a user whose lastSignInAt falls before windowStart', async () => {
      const lastSignInAt = new Date('2026-02-09T15:30:00Z');
      const mockRows = [{ lastSignInAt }];
      const whereMock = vi.fn().mockResolvedValue(mockRows);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      dbSelectMock.mockReturnValue({ from: fromMock });

      const result = await queryMauChartData(1, 0);
      expect(result[0].mau).toBe(0);
    });

    it('does not count a user whose lastSignInAt is one millisecond before windowStart', async () => {
      const lastSignInAt = new Date('2026-02-09T23:59:59.999Z');
      const mockRows = [{ lastSignInAt }];
      const whereMock = vi.fn().mockResolvedValue(mockRows);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      dbSelectMock.mockReturnValue({ from: fromMock });

      const result = await queryMauChartData(1, 0);
      expect(result[0].mau).toBe(0);
    });

    it('counts a user whose lastSignInAt is exactly at windowStart (inclusive boundary)', async () => {
      const lastSignInAt = new Date('2026-02-10T00:00:00Z');
      const mockRows = [{ lastSignInAt }];
      const whereMock = vi.fn().mockResolvedValue(mockRows);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      dbSelectMock.mockReturnValue({ from: fromMock });

      const result = await queryMauChartData(1, 0);
      expect(result[0].mau).toBe(1);
    });
  });
});
