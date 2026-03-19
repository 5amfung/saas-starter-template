// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/render"
import { ActiveSessionsList } from "@/components/account/active-sessions-list"

const {
  mockUseSessionQuery,
  mockUseSessionsQuery,
  mockRevokeSession,
  mockGetLastUsedLoginMethod,
} = vi.hoisted(() => ({
  mockUseSessionQuery: vi.fn(),
  mockUseSessionsQuery: vi.fn(),
  mockRevokeSession: vi.fn(),
  mockGetLastUsedLoginMethod: vi.fn(),
}))

vi.mock("@/hooks/use-session-query", () => ({
  useSessionQuery: mockUseSessionQuery,
  SESSION_QUERY_KEY: ["current_session"],
}))

vi.mock("@/hooks/use-sessions-query", () => ({
  useSessionsQuery: mockUseSessionsQuery,
  SESSIONS_QUERY_KEY: ["user_active_sessions"],
}))

vi.mock("@workspace/auth/client", () => ({
  authClient: {
    revokeSession: mockRevokeSession,
    getLastUsedLoginMethod: mockGetLastUsedLoginMethod,
  },
}))

const CURRENT_SESSION_TOKEN = "current-token-abc"

const CURRENT_SESSION_RESPONSE = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    lastSignInAt: null,
  },
  session: {
    id: "session-current",
    token: CURRENT_SESSION_TOKEN,
    userId: "user-1",
    ipAddress: "192.168.1.1",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    updatedAt: new Date("2026-03-13T10:00:00Z"),
    expiresAt: new Date("2027-01-01"),
  },
}

const OTHER_SESSION = {
  id: "session-other",
  token: "other-token-xyz",
  userId: "user-1",
  ipAddress: "10.0.0.1",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Mobile/15E148",
  updatedAt: new Date("2026-03-12T08:00:00Z"),
}

function setupDefaultMocks() {
  mockUseSessionQuery.mockReturnValue({
    data: CURRENT_SESSION_RESPONSE,
    isPending: false,
    error: null,
  })
  mockUseSessionsQuery.mockReturnValue({
    data: [CURRENT_SESSION_RESPONSE.session, OTHER_SESSION],
    isPending: false,
    error: null,
    refetch: vi.fn(),
  })
  // getLastUsedLoginMethod is called via useQuery internally; resolve to null for simplicity.
  mockGetLastUsedLoginMethod.mockResolvedValue(null)
}

describe("ActiveSessionsList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders session list with "This device" badge for the current session', async () => {
    renderWithProviders(<ActiveSessionsList />)

    await waitFor(() => {
      expect(screen.getByText("This device")).toBeInTheDocument()
    })

    // Both sessions should be rendered.
    const sessionItems = screen.getAllByText(/Last active:/i)
    expect(sessionItems).toHaveLength(2)
  })

  it("shows revoke button only for non-current sessions", async () => {
    renderWithProviders(<ActiveSessionsList />)

    await waitFor(() => {
      expect(screen.getByText("This device")).toBeInTheDocument()
    })

    // Only one Revoke button should exist (for the other session, not the current one).
    const revokeButtons = screen.getAllByRole("button", { name: /revoke/i })
    expect(revokeButtons).toHaveLength(1)
  })

  it("opens confirmation dialog when revoke is clicked", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ActiveSessionsList />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /revoke/i })
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /revoke/i }))

    await waitFor(() => {
      expect(screen.getByText("Revoke session?")).toBeInTheDocument()
      expect(
        screen.getByText("This will sign that device out of your account.")
      ).toBeInTheDocument()
    })
  })
})
