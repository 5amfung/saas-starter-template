import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconDotsVertical,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export interface WorkspaceMemberRow {
  id: string
  userId: string
  email: string
  role: string
}

interface WorkspaceMembersTableProps {
  data: Array<WorkspaceMemberRow>
  total: number
  page: number
  pageSize: number
  totalPages: number
  sorting: SortingState
  isLoading?: boolean
  removingMemberId?: string | null
  leavingWorkspace?: boolean
  currentUserId: string | null
  currentUserRole: string | null
  onSortingChange: (sorting: SortingState) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onRemoveMember: (memberId: string) => void
  onLeave: () => void
}

const PAGE_SIZE_OPTIONS = ["10", "25", "50"]
const MAX_SKELETON_ROWS = 10
const ACTIONS_COLUMN_CLASS = "text-right w-14"

export function WorkspaceMembersTable({
  data,
  total,
  page,
  pageSize,
  totalPages,
  sorting,
  isLoading = false,
  removingMemberId = null,
  leavingWorkspace = false,
  currentUserId,
  currentUserRole,
  onSortingChange,
  onPageChange,
  onPageSizeChange,
  onRemoveMember,
  onLeave,
}: WorkspaceMembersTableProps) {
  const columns = React.useMemo<Array<ColumnDef<WorkspaceMemberRow>>>(
    () => [
      {
        accessorKey: "email",
        header: ({ column }) => (
          <SortableHeader column={column} label="Email Address" />
        ),
        cell: ({ row }) => row.original.email,
        enableSorting: true,
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => normalizeRole(row.original.role),
        enableSorting: false,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const { id, userId, role } = row.original
          const isOwnerRow = role === "owner"
          const isCurrentUserRow = userId === currentUserId
          const showDisabledRemove =
            isOwnerRow || (currentUserRole === "member" && !isCurrentUserRow)

          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground data-[state=open]:bg-muted"
                    disabled={isLoading}
                    aria-label="Row actions"
                  >
                    <IconDotsVertical className="size-4" />
                  </Button>
                )}
              />
              <DropdownMenuContent align="end">
                {showDisabledRemove ? (
                  <DropdownMenuItem
                    disabled
                    className="text-destructive/50 focus:text-destructive/50"
                  >
                    Remove
                  </DropdownMenuItem>
                ) : isCurrentUserRow ? (
                  <DropdownMenuItem
                    onClick={() => onLeave()}
                    disabled={leavingWorkspace}
                    className="text-destructive focus:text-destructive"
                  >
                    Leave
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onRemoveMember(id)}
                    disabled={removingMemberId === id}
                    className="text-destructive focus:text-destructive"
                  >
                    Remove
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [
      currentUserId,
      currentUserRole,
      isLoading,
      leavingWorkspace,
      onLeave,
      onRemoveMember,
      removingMemberId,
    ]
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel(),
  })

  const totalPagesSafe = Math.max(totalPages, 1)
  const skeletonRowCount = Math.min(pageSize, MAX_SKELETON_ROWS)

  const handleHeaderSort = React.useCallback(
    (columnId: string) => {
      const current = sorting.find((item) => item.id === columnId)
      if (!current) {
        onSortingChange([{ id: columnId, desc: false }])
        return
      }
      if (!current.desc) {
        onSortingChange([{ id: columnId, desc: true }])
        return
      }
      onSortingChange([])
    },
    [onSortingChange, sorting]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    onClick={
                      header.column.getCanSort()
                        ? () => handleHeaderSort(header.id)
                        : undefined
                    }
                    className={
                      header.id === "actions"
                        ? ACTIONS_COLUMN_CLASS
                        : header.column.getCanSort()
                          ? "cursor-pointer select-none"
                          : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
                <TableRow key={`members-loading-${rowIndex}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-56" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className={ACTIONS_COLUMN_CLASS}>
                    <Skeleton className="ml-auto h-8 w-8 rounded-md" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={
                        cell.column.id === "actions"
                          ? ACTIONS_COLUMN_CLASS
                          : undefined
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-20 text-center"
                >
                  No team members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4 px-1">
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            `${total} member${total === 1 ? "" : "s"}`
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-2 md:flex">
            <Label
              htmlFor="members-rows-per-page"
              className="text-sm font-medium"
            >
              Rows per page
            </Label>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                if (!value) return
                onPageSizeChange(Number(value))
              }}
              disabled={isLoading}
            >
              <SelectTrigger
                id="members-rows-per-page"
                size="sm"
                className="w-20"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm font-medium">{`Page ${page} of ${totalPagesSafe}`}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="hidden md:flex"
              onClick={() => onPageChange(1)}
              disabled={isLoading || page <= 1}
            >
              <span className="sr-only">Go to first page</span>
              <IconChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(page - 1)}
              disabled={isLoading || page <= 1}
            >
              <span className="sr-only">Go to previous page</span>
              <IconChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(page + 1)}
              disabled={isLoading || page >= totalPagesSafe}
            >
              <span className="sr-only">Go to next page</span>
              <IconChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden md:flex"
              onClick={() => onPageChange(totalPagesSafe)}
              disabled={isLoading || page >= totalPagesSafe}
            >
              <span className="sr-only">Go to last page</span>
              <IconChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SortableHeader({
  column,
  label,
}: {
  column: { getIsSorted: () => false | "asc" | "desc" }
  label: string
}) {
  const sorted = column.getIsSorted()
  return (
    <div className="flex items-center gap-1">
      {label}
      {sorted === "asc" ? (
        <IconArrowUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <IconArrowDown className="size-3.5" />
      ) : (
        <IconArrowsSort className="size-3.5 text-muted-foreground/50" />
      )}
    </div>
  )
}

function normalizeRole(role: string): string {
  if (!role) return "-"
  return role
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ")
}
