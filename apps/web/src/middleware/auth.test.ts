// src/middleware/auth.test.ts
import { createMockSessionResponse } from "@workspace/test-utils"
import { validateAuthSession, validateGuestSession } from "@/middleware/auth"

const { mockGetSession, mockEnsureActiveWorkspace } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockEnsureActiveWorkspace: vi.fn(),
}))

vi.mock("@/init", () => ({
  auth: { api: { getSession: mockGetSession } },
}))

vi.mock("@/workspace/workspace.server", () => ({
  ensureActiveWorkspaceForSession: mockEnsureActiveWorkspace,
}))

describe("validateAuthSession", () => {
  const headers = new Headers({ cookie: "test" })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("throws redirect to /signin when no session exists", async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(validateAuthSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: "/signin" }),
      })
    )
  })

  it("throws redirect to /signin when emailVerified is false", async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: false })
    )
    await expect(validateAuthSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: "/signin" }),
      })
    )
  })

  it("calls ensureActiveWorkspaceForSession for verified sessions", async () => {
    const session = createMockSessionResponse()
    mockGetSession.mockResolvedValue(session)
    mockEnsureActiveWorkspace.mockResolvedValue(undefined)

    await validateAuthSession(headers)

    expect(mockEnsureActiveWorkspace).toHaveBeenCalledWith(headers, {
      user: { id: session.user.id },
      session: session.session,
    })
  })

  it("handles malformed session object (missing user)", async () => {
    mockGetSession.mockResolvedValue({ session: null, user: null })
    await expect(validateAuthSession(headers)).rejects.toThrow()
  })

  it("handles getSession throwing an error", async () => {
    mockGetSession.mockRejectedValue(new Error("Auth service unavailable"))
    await expect(validateAuthSession(headers)).rejects.toThrow(
      "Auth service unavailable"
    )
  })

  it("propagates errors from ensureActiveWorkspaceForSession", async () => {
    const session = createMockSessionResponse()
    mockGetSession.mockResolvedValue(session)
    mockEnsureActiveWorkspace.mockRejectedValue(new Error("workspace error"))

    await expect(validateAuthSession(headers)).rejects.toThrow(
      "workspace error"
    )
  })
})

describe("validateGuestSession", () => {
  const headers = new Headers({ cookie: "test" })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns without throwing when no session exists", async () => {
    mockGetSession.mockResolvedValue(null)
    await expect(validateGuestSession(headers)).resolves.toBeUndefined()
  })

  it("returns without throwing when emailVerified is false", async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: false })
    )
    await expect(validateGuestSession(headers)).resolves.toBeUndefined()
  })

  it("handles getSession throwing an error", async () => {
    mockGetSession.mockRejectedValue(new Error("Auth service unavailable"))
    await expect(validateGuestSession(headers)).rejects.toThrow(
      "Auth service unavailable"
    )
  })

  it("throws redirect to /ws when session has emailVerified true", async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: true })
    )
    await expect(validateGuestSession(headers)).rejects.toEqual(
      expect.objectContaining({
        options: expect.objectContaining({ to: "/ws" }),
      })
    )
  })
})
