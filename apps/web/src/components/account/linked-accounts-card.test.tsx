// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@/test/render"

const { linkSocialMock, unlinkAccountMock } = vi.hoisted(() => ({
  linkSocialMock: vi.fn(),
  unlinkAccountMock: vi.fn(),
}))

vi.mock("@/auth/auth-client", () => ({
  authClient: {
    linkSocial: linkSocialMock,
    unlinkAccount: unlinkAccountMock,
  },
}))

vi.mock("@/hooks/use-linked-accounts-query", () => ({
  useLinkedAccountsQuery: () => ({
    // Include a credential account so Google is not the only auth method,
    // which keeps the Disconnect button enabled.
    data: [
      { providerId: "credential", accountId: "credential-123" },
      { providerId: "google", accountId: "google-123" },
    ],
    isPending: false,
  }),
  LINKED_ACCOUNTS_QUERY_KEY: ["linked_accounts"],
}))

describe("LinkedAccountsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders Google provider with disconnect button when linked", async () => {
    const { LinkedAccountsCard } =
      await import("@/components/account/linked-accounts-card")

    renderWithProviders(<LinkedAccountsCard />)

    await waitFor(() => {
      expect(screen.getByText("Google")).toBeInTheDocument()
    })

    expect(
      screen.getByRole("button", { name: "Disconnect" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Connect" })
    ).not.toBeInTheDocument()
  })

  it("opens disconnect confirmation dialog when disconnect button is clicked", async () => {
    const user = userEvent.setup()
    const { LinkedAccountsCard } =
      await import("@/components/account/linked-accounts-card")

    renderWithProviders(<LinkedAccountsCard />)

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Disconnect" })
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: "Disconnect" }))

    await waitFor(() => {
      expect(screen.getByText("Disconnect account?")).toBeInTheDocument()
      expect(
        screen.getByText(
          "You will no longer be able to sign in with this account."
        )
      ).toBeInTheDocument()
    })
  })
})

describe("LinkedAccountsCard — unlinked provider", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("shows connect button when provider is not linked", async () => {
    vi.doMock("@/auth/auth-client", () => ({
      authClient: {
        linkSocial: vi.fn(),
        unlinkAccount: vi.fn(),
      },
    }))

    vi.doMock("@/hooks/use-linked-accounts-query", () => ({
      useLinkedAccountsQuery: () => ({
        data: [],
        isPending: false,
      }),
      LINKED_ACCOUNTS_QUERY_KEY: ["linked_accounts"],
    }))

    const { LinkedAccountsCard } =
      await import("@/components/account/linked-accounts-card")

    renderWithProviders(<LinkedAccountsCard />)

    await waitFor(() => {
      expect(screen.getByText("Google")).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Disconnect" })
    ).not.toBeInTheDocument()
  })
})
