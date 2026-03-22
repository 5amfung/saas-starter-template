/**
 * Format a date to en-US short format (e.g., "Jan 15, 2026").
 * Date-only strings (e.g., "2026-06-01") are parsed as local time to avoid UTC offset shifting the day.
 */
export function formatDate(date: Date | string): string {
  // Append local time suffix to date-only strings to avoid UTC offset shifting the day.
  const parsed =
    typeof date === 'string'
      ? new Date(date.includes('T') ? date : `${date}T00:00:00`)
      : date;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Normalize a comma-separated role string by trimming each segment.
 * Returns '-' for empty input.
 */
export function normalizeRole(role: string): string {
  if (!role) return '-';
  return role
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Encode a string to base64url format.
 */
export function toBase64Url(input: string): string {
  const base64 = btoa(
    encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  );
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
