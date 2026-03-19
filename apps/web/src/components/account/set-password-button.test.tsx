// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderWithProviders } from "@workspace/test-utils"
import { SetPasswordButton } from "@/components/account/set-password-button"

const { requestPasswordResetMock, signOutMock } = vi.hoisted(() => ({
  requestPasswordResetMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock("@workspace/auth/client", () => ({
  authClient: {
    requestPasswordReset: requestPasswordResetMock,
    signOut: signOutMock,
  },
}))

const TEST_EMAIL = "user@example.com"

describe("SetPasswordButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders set password button", () => {
    renderWithProviders(<SetPasswordButton email={TEST_EMAIL} />)

    expect(
      screen.getByRole("button", { name: /set password/i })
    ).toBeInTheDocument()
  })

  it("calls requestPasswordReset and signOut on click", async () => {
    requestPasswordResetMock.mockResolvedValue({ error: null })
    signOutMock.mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderWithProviders(<SetPasswordButton email={TEST_EMAIL} />)

    await user.click(screen.getByRole("button", { name: /set password/i }))

    await waitFor(() => {
      expect(requestPasswordResetMock).toHaveBeenCalledWith({
        email: TEST_EMAIL,
        redirectTo: "/reset-password",
      })
    })

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled()
    })
  })

  it("disables button after successful click", async () => {
    requestPasswordResetMock.mockResolvedValue({ error: null })
    signOutMock.mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderWithProviders(<SetPasswordButton email={TEST_EMAIL} />)

    await user.click(screen.getByRole("button", { name: /set password/i }))

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /set password/i })
      ).toBeDisabled()
    })
  })
})
