// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { SortingState } from "@tanstack/react-table"
import { createMockInvitationRow } from "@/test/factories"
import { WorkspaceInvitationsTable } from "@/components/workspace/workspace-invitations-table"

const defaultProps = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  sorting: [] as SortingState,
  isLoading: false,
  onSortingChange: vi.fn(),
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
  onRemoveInvitation: vi.fn(),
  onResendInvitation: vi.fn(),
}

describe("WorkspaceInvitationsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders invitation rows with emails", () => {
    const invitations = [
      createMockInvitationRow({ id: "inv-1", email: "alice@example.com" }),
      createMockInvitationRow({ id: "inv-2", email: "bob@example.com" }),
    ]

    render(
      <WorkspaceInvitationsTable
        {...defaultProps}
        data={invitations}
        total={2}
      />
    )

    expect(screen.getByText("alice@example.com")).toBeInTheDocument()
    expect(screen.getByText("bob@example.com")).toBeInTheDocument()
  })

  it("shows empty state when no invitations", () => {
    render(<WorkspaceInvitationsTable {...defaultProps} data={[]} total={0} />)

    expect(
      screen.getByText("No pending invitations found.")
    ).toBeInTheDocument()
  })

  it("shows invitation count", () => {
    const invitations = [
      createMockInvitationRow({ id: "inv-1", email: "alice@example.com" }),
      createMockInvitationRow({ id: "inv-2", email: "bob@example.com" }),
    ]

    render(
      <WorkspaceInvitationsTable
        {...defaultProps}
        data={invitations}
        total={2}
      />
    )

    expect(screen.getByText("2 invitations")).toBeInTheDocument()
  })

  it("shows singular invitation count for one invitation", () => {
    const invitations = [
      createMockInvitationRow({ id: "inv-1", email: "alice@example.com" }),
    ]

    render(
      <WorkspaceInvitationsTable
        {...defaultProps}
        data={invitations}
        total={1}
      />
    )

    expect(screen.getByText("1 invitation")).toBeInTheDocument()
  })

  it("calls onRemoveInvitation when remove action is clicked", async () => {
    const user = userEvent.setup()
    const onRemoveInvitation = vi.fn()
    const invitations = [
      createMockInvitationRow({ id: "inv-1", email: "alice@example.com" }),
    ]

    render(
      <WorkspaceInvitationsTable
        {...defaultProps}
        data={invitations}
        total={1}
        onRemoveInvitation={onRemoveInvitation}
      />
    )

    const triggerButton = screen.getByRole("button", { name: /row actions/i })
    await user.click(triggerButton)

    const removeItem = await screen.findByRole("menuitem", {
      name: /remove invitation/i,
    })
    await user.click(removeItem)

    expect(onRemoveInvitation).toHaveBeenCalledWith("inv-1")
  })

  it("calls onResendInvitation with id, email, and role when resend action is clicked", async () => {
    const user = userEvent.setup()
    const onResendInvitation = vi.fn()
    const invitations = [
      createMockInvitationRow({
        id: "inv-1",
        email: "alice@example.com",
        role: "member",
      }),
    ]

    render(
      <WorkspaceInvitationsTable
        {...defaultProps}
        data={invitations}
        total={1}
        onResendInvitation={onResendInvitation}
      />
    )

    const triggerButton = screen.getByRole("button", { name: /row actions/i })
    await user.click(triggerButton)

    const resendItem = await screen.findByRole("menuitem", {
      name: /resend invitation/i,
    })
    await user.click(resendItem)

    expect(onResendInvitation).toHaveBeenCalledWith({
      id: "inv-1",
      email: "alice@example.com",
      role: "member",
    })
  })

  it("shows skeleton loaders when loading", () => {
    render(
      <WorkspaceInvitationsTable
        {...defaultProps}
        data={[]}
        total={0}
        isLoading={true}
        pageSize={5}
      />
    )

    // Skeleton elements are rendered — the empty state text should not appear.
    expect(
      screen.queryByText("No pending invitations found.")
    ).not.toBeInTheDocument()
  })
})
