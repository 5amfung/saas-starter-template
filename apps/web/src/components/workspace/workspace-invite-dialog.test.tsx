// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { InviteRole } from "@/workspace/workspace-members.types"
import { WorkspaceInviteDialog } from "@/components/workspace/workspace-invite-dialog"

const DEFAULT_ROLES: ReadonlyArray<InviteRole> = ["member", "admin"]

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  email: "",
  role: "member" as InviteRole,
  roles: DEFAULT_ROLES,
  isPending: false,
  onEmailChange: vi.fn(),
  onRoleChange: vi.fn(),
  onSubmit: vi.fn(),
}

describe("WorkspaceInviteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders dialog with email input and role select when open", () => {
    render(<WorkspaceInviteDialog {...defaultProps} />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /send invitation/i })
    ).toBeInTheDocument()
  })

  it("calls onEmailChange when typing in email input", async () => {
    const user = userEvent.setup()
    const onEmailChange = vi.fn()

    render(
      <WorkspaceInviteDialog {...defaultProps} onEmailChange={onEmailChange} />
    )

    await user.type(screen.getByLabelText(/email/i), "test@example.com")

    expect(onEmailChange).toHaveBeenCalled()
    expect(onEmailChange).toHaveBeenLastCalledWith("test@example.com".at(-1))
  })

  it("calls onSubmit when send invitation button is clicked", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<WorkspaceInviteDialog {...defaultProps} onSubmit={onSubmit} />)

    await user.click(screen.getByRole("button", { name: /send invitation/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("disables buttons when isPending is true", () => {
    render(<WorkspaceInviteDialog {...defaultProps} isPending={true} />)

    expect(
      screen.getByRole("button", { name: /send invitation/i })
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled()
  })

  it("closes dialog when cancel is clicked", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <WorkspaceInviteDialog {...defaultProps} onOpenChange={onOpenChange} />
    )

    await user.click(screen.getByRole("button", { name: /cancel/i }))

    // AlertDialog passes additional dialog detail as second argument; verify the first arg is false.
    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange.mock.calls[0][0]).toBe(false)
  })
})
