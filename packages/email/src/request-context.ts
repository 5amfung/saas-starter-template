/**
 * Context about the HTTP request that triggered the email, used for the
 * "Didn't request this?" security notice in verification and reset emails.
 */
export interface EmailRequestContext {
  requestedAtUtc: string
  ip?: string
  city?: string
  country?: string
}

const CITY_HEADERS = ["x-vercel-ip-city", "cf-ipcity", "x-geo-city"] as const

const COUNTRY_HEADERS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "x-geo-country",
] as const

function getHeader(
  headers: Headers,
  names: ReadonlyArray<string>
): string | null {
  for (const name of names) {
    const value = headers.get(name)
    if (value && value.trim() !== "") return value.trim()
  }
  return null
}

function extractClientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip")
  if (cf?.trim()) return cf.trim()

  const realIp = headers.get("x-real-ip")
  if (realIp?.trim()) return realIp.trim()

  const forwarded = headers.get("x-forwarded-for")
  if (forwarded && forwarded.trim()) {
    const first = forwarded.split(",")[0]
    if (first && first.trim()) return first.trim()
  }

  return null
}

function formatUtcTimestamp(date: Date): string {
  const day = date.getUTCDate()
  const month = date.toLocaleString("en-GB", {
    month: "long",
    timeZone: "UTC",
  })
  const year = date.getUTCFullYear()
  const hours = date.getUTCHours().toString().padStart(2, "0")
  const minutes = date.getUTCMinutes().toString().padStart(2, "0")
  return `${day} ${month} ${year}, ${hours}:${minutes} UTC`
}

/** Build email request context from optional request headers. */
export function buildEmailRequestContext(
  headers?: Headers
): EmailRequestContext {
  if (!headers) {
    return { requestedAtUtc: formatUtcTimestamp(new Date()) }
  }

  const ip = extractClientIp(headers)
  const city = getHeader(headers, CITY_HEADERS)
  const country = getHeader(headers, COUNTRY_HEADERS)
  const requestedAtUtc = formatUtcTimestamp(new Date())

  return {
    requestedAtUtc,
    ip: ip ?? undefined,
    city: city ?? undefined,
    country: country ?? undefined,
  }
}
