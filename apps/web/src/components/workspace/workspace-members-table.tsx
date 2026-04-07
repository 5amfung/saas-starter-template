import * as React from 'react';
import { IconDotsVertical } from '@tabler/icons-react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@workspace/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import {
  ACTIONS_COLUMN_CLASS,
  DEFAULT_PAGE_SIZE_OPTIONS,
  MAX_SKELETON_ROWS,
  normalizeRole,
} from '@workspace/components/lib';
import { useColumnSort } from '@workspace/components/hooks';
import { SortableHeader, TablePagination } from '@workspace/components/layout';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { WorkspaceTransferOwnershipDialog } from '@/components/workspace/workspace-transfer-ownership-dialog';

export interface WorkspaceMemberRow {
  id: string;
  userId: string;
  email: string;
  role: string;
}

interface WorkspaceMembersTableProps {
  data: Array<WorkspaceMemberRow>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sorting: SortingState;
  isLoading?: boolean;
  removingMemberId?: string | null;
  transferringMemberId?: string | null;
  leavingWorkspace?: boolean;
  currentUserId: string | null;
  workspaceName?: string;
  workspaceRole: string | null;
  canLeaveWorkspace: boolean;
  canManageMembers: boolean;
  onSortingChange: (sorting: SortingState) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRemoveMember: (memberId: string) => void;
  onLeave: () => void;
  onTransferOwnership?: (memberId: string) => Promise<void>;
}

export function WorkspaceMembersTable({
  data,
  total,
  page,
  pageSize,
  totalPages,
  sorting,
  isLoading = false,
  removingMemberId = null,
  transferringMemberId = null,
  leavingWorkspace = false,
  currentUserId,
  workspaceName,
  workspaceRole,
  canLeaveWorkspace,
  canManageMembers,
  onSortingChange,
  onPageChange,
  onPageSizeChange,
  onRemoveMember,
  onLeave,
  onTransferOwnership,
}: WorkspaceMembersTableProps) {
  const [transferTarget, setTransferTarget] =
    React.useState<WorkspaceMemberRow | null>(null);

  const columns = React.useMemo<Array<ColumnDef<WorkspaceMemberRow>>>(
    () => [
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <SortableHeader column={column} label="Email Address" />
        ),
        cell: ({ row }) => row.original.email,
        enableSorting: true,
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => normalizeRole(row.original.role),
        enableSorting: false,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const { id, userId, role } = row.original;
          const isOwnerRow = role === 'owner';
          const isCurrentUserRow = userId === currentUserId;
          const canTransferOwnership =
            workspaceRole === 'owner' && !isCurrentUserRow && !isOwnerRow;
          const isMemberViewer = workspaceRole === 'member';
          const showDisabledRemove =
            !isCurrentUserRow &&
            (isOwnerRow || isMemberViewer || !canManageMembers);

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
                    disabled={leavingWorkspace || !canLeaveWorkspace}
                    className="text-destructive focus:text-destructive"
                  >
                    Leave
                  </DropdownMenuItem>
                ) : (
                  <>
                    {canTransferOwnership ? (
                      <DropdownMenuItem
                        onClick={() => setTransferTarget(row.original)}
                      >
                        Transfer ownership
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onClick={() => onRemoveMember(id)}
                      disabled={removingMemberId === id}
                      className="text-destructive focus:text-destructive"
                    >
                      Remove
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [
      canManageMembers,
      currentUserId,
      canLeaveWorkspace,
      isLoading,
      leavingWorkspace,
      onLeave,
      onRemoveMember,
      setTransferTarget,
      removingMemberId,
      workspaceRole,
    ]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel(),
  });

  const skeletonRowCount = Math.min(pageSize, MAX_SKELETON_ROWS);

  const handleHeaderSort = useColumnSort(sorting, onSortingChange);

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
                      header.id === 'actions'
                        ? ACTIONS_COLUMN_CLASS
                        : header.column.getCanSort()
                          ? 'cursor-pointer select-none'
                          : undefined
                    }
                    aria-sort={
                      header.column.getIsSorted() === 'asc'
                        ? 'ascending'
                        : header.column.getIsSorted() === 'desc'
                          ? 'descending'
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
                        cell.column.id === 'actions'
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

      <TablePagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        pageSizeOptions={DEFAULT_PAGE_SIZE_OPTIONS}
        isLoading={isLoading}
        totalCount={total}
        countLabel="member"
        selectId="members-rows-per-page"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      <WorkspaceTransferOwnershipDialog
        open={transferTarget !== null}
        workspaceName={workspaceName ?? ''}
        targetMemberEmail={transferTarget?.email ?? ''}
        isPending={transferringMemberId === transferTarget?.id}
        onOpenChange={(open) => {
          if (!open) setTransferTarget(null);
        }}
        onTransfer={async () => {
          if (!transferTarget || !onTransferOwnership) return;

          await onTransferOwnership(transferTarget.id);
          setTransferTarget(null);
        }}
      />
    </div>
  );
}
