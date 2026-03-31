import { getRequestHeaders } from '@tanstack/react-start/server';
import { and, gte, isNotNull, lt, sql } from 'drizzle-orm';
import { user as userTable } from '@workspace/web-db-schema';
import { getVerifiedAdminSession } from '@/auth/validators';
import { auth, db } from '@/init';

// --- Auth ---

/** Verify the caller is an authenticated admin. Throws redirect otherwise. */
export async function requireAdmin() {
  const headers = getRequestHeaders();
  return getVerifiedAdminSession(headers, auth);
}

// --- Timezone helpers ---

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;
export const MAU_WINDOW_DAYS = 30;

/**
 * Compute UTC timestamp for the start of "today" in the admin's local timezone.
 * offsetMinutes comes from `new Date().getTimezoneOffset()` (positive = behind UTC).
 */
export function getLocalDayStartUtc(offsetMinutes: number): Date {
  const now = new Date();
  const localNow = new Date(
    now.getTime() - offsetMinutes * MILLISECONDS_PER_MINUTE
  );
  const dateStr = localNow.toISOString().slice(0, 10);
  return new Date(
    new Date(dateStr + 'T00:00:00Z').getTime() +
      offsetMinutes * MILLISECONDS_PER_MINUTE
  );
}

/** Generate an array of day buckets (start/end in UTC) for the given range. */
export function getDayBuckets(
  days: number,
  offsetMinutes: number
): Array<{ start: Date; end: Date; label: string }> {
  const todayStart = getLocalDayStartUtc(offsetMinutes);
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(todayStart.getTime() - i * MILLISECONDS_PER_DAY);
    const end = new Date(start.getTime() + MILLISECONDS_PER_DAY);
    // Label in admin's local date.
    const localDate = new Date(
      start.getTime() - offsetMinutes * MILLISECONDS_PER_MINUTE
    );
    const label = localDate.toISOString().slice(0, 10);
    buckets.push({ start, end, label });
  }
  return buckets;
}

export { MILLISECONDS_PER_DAY };

// --- Dashboard queries ---

export async function queryDashboardMetrics(timezoneOffset: number) {
  const todayStart = getLocalDayStartUtc(timezoneOffset);
  const todayEnd = new Date(todayStart.getTime() + MILLISECONDS_PER_DAY);

  const rows = await db
    .select({
      totalUsers: sql<number>`count(*)::int`,
      verifiedUsers: sql<number>`count(*) filter (where ${userTable.emailVerified} = true)::int`,
      unverifiedUsers: sql<number>`count(*) filter (where ${userTable.emailVerified} = false)::int`,
      signupsToday: sql<number>`count(*) filter (where ${userTable.createdAt} >= ${todayStart} and ${userTable.createdAt} < ${todayEnd})::int`,
      verifiedToday: sql<number>`count(*) filter (where ${userTable.createdAt} >= ${todayStart} and ${userTable.createdAt} < ${todayEnd} and ${userTable.emailVerified} = true)::int`,
      unverifiedToday: sql<number>`count(*) filter (where ${userTable.createdAt} >= ${todayStart} and ${userTable.createdAt} < ${todayEnd} and ${userTable.emailVerified} = false)::int`,
    })
    .from(userTable);

  const metrics = rows[0];
  return metrics;
}

export async function querySignupChartData(
  days: number,
  timezoneOffset: number
) {
  const buckets = getDayBuckets(days, timezoneOffset);
  const rangeStart = buckets[0].start;
  const rangeEnd = buckets[buckets.length - 1].end;

  const rows = await db
    .select({
      createdAt: userTable.createdAt,
      emailVerified: userTable.emailVerified,
    })
    .from(userTable)
    .where(
      and(
        gte(userTable.createdAt, rangeStart),
        lt(userTable.createdAt, rangeEnd)
      )
    );

  return buckets.map((bucket) => {
    const inBucket = rows.filter(
      (r) => r.createdAt >= bucket.start && r.createdAt < bucket.end
    );
    return {
      date: bucket.label,
      verified: inBucket.filter((r) => r.emailVerified).length,
      unverified: inBucket.filter((r) => !r.emailVerified).length,
    };
  });
}

export async function queryMauChartData(days: number, timezoneOffset: number) {
  const buckets = getDayBuckets(days, timezoneOffset);
  const earliestWindowStart = new Date(
    buckets[0].start.getTime() - MAU_WINDOW_DAYS * MILLISECONDS_PER_DAY
  );
  const latestBucketEnd = buckets[buckets.length - 1].end;

  const rows = await db
    .select({ lastSignInAt: userTable.lastSignInAt })
    .from(userTable)
    .where(
      and(
        isNotNull(userTable.lastSignInAt),
        gte(userTable.lastSignInAt, earliestWindowStart),
        lt(userTable.lastSignInAt, latestBucketEnd)
      )
    );

  return buckets.map((bucket) => {
    const windowStart = new Date(
      bucket.start.getTime() - MAU_WINDOW_DAYS * MILLISECONDS_PER_DAY
    );
    const mau = rows.filter((r) => {
      const t = r.lastSignInAt;
      return !!t && t >= windowStart && t < bucket.end;
    }).length;
    return { date: bucket.label, mau };
  });
}
