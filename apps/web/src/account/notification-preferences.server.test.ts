import { beforeEach, describe, expect, it, vi } from "vitest"
import { mockDbChain, mockDbInsertChain } from "@/test/mocks/db"
import {
  getNotificationPreferencesForUser,
  upsertNotificationPreferencesForUser,
} from "@/account/notification-preferences.server"

const { dbSelectMock, dbInsertMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbInsertMock: vi.fn(),
}))

vi.mock("@/init", () => ({
  db: { select: dbSelectMock, insert: dbInsertMock },
}))

vi.mock("@workspace/db/schema", () => ({
  notificationPreferences: {
    userId: "userId",
    marketingEmails: "marketingEmails",
  },
}))

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    eq: vi.fn((a, b) => ({ field: a, value: b })),
  }
})

// Mock server-only dependencies that notification-preferences.server.ts imports.
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: vi.fn(),
}))
vi.mock("@tanstack/react-router", () => ({
  redirect: vi.fn(),
}))
vi.mock("@/auth/auth.server", () => ({
  auth: { api: {} },
}))

describe("getNotificationPreferencesForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns defaults when no row exists", async () => {
    mockDbChain(dbSelectMock, [])

    const result = await getNotificationPreferencesForUser("user-1")
    expect(result).toEqual({
      emailUpdates: true,
      marketingEmails: false,
    })
  })

  it("returns stored preferences when row exists", async () => {
    mockDbChain(dbSelectMock, [{ marketingEmails: true }])

    const result = await getNotificationPreferencesForUser("user-1")
    expect(result).toEqual({
      emailUpdates: true,
      marketingEmails: true,
    })
  })
})

describe("upsertNotificationPreferencesForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns current preferences when patch has no boolean marketingEmails", async () => {
    mockDbChain(dbSelectMock, [{ marketingEmails: false }])

    const result = await upsertNotificationPreferencesForUser("user-1", {})
    expect(result).toEqual({
      emailUpdates: true,
      marketingEmails: false,
    })
    expect(dbInsertMock).not.toHaveBeenCalled()
  })

  it("upserts when marketingEmails is a boolean", async () => {
    mockDbInsertChain(dbInsertMock)
    // After upsert, it re-fetches.
    mockDbChain(dbSelectMock, [{ marketingEmails: true }])

    const result = await upsertNotificationPreferencesForUser("user-1", {
      marketingEmails: true,
    })
    expect(dbInsertMock).toHaveBeenCalled()
    expect(result.marketingEmails).toBe(true)
  })
})
