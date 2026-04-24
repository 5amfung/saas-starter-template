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
import { useColumnSort } from '@workspace/components/hooks';
import { SortableHeader, TablePagination } from '@workspace/components/layout';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  ACTIONS_COLUMN_CLASS,
  DEFAULT_PAGE_SIZE_OPTIONS,
  MAX_SKELETON_ROWS,
  formatDate,
  normalizeRole,
} from '@/lib';

export interface WorkspaceInvitationRow {
  id: string;
  email: string;
  role: string;
  invitedAt: string | Date;
}

interface WorkspaceInvitationsTableProps {
  data: Array<WorkspaceInvitationRow>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sorting: SortingState;
  isLoading?: boolean;
  canManageInvitations: boolean;
  removingInvitationId?: string | null;
  resendingInvitationId?: string | null;
  onSortingChange: (sorting: SortingState) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRemoveInvitation: (invitationId: string) => void;
  onResendInvitation: (invitation: {
    id: string;
    email: string;
    role: string;
  }) => void;
}

export function WorkspaceInvitationsTable({
  data,
  total,
  page,
  pageSize,
  totalPages,
  sorting,
  isLoading = false,
  canManageInvitations,
  removingInvitationId = null,
  resendingInvitationId = null,
  onSortingChange,
  onPageChange,
  onPageSizeChange,
  onRemoveInvitation,
  onResendInvitation,
}: WorkspaceInvitationsTableProps) {
  const columns = React.useMemo<Array<ColumnDef<WorkspaceInvitationRow>>>(
    () => [
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <SortableHeader column={column} label="Email" />
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
        accessorKey: 'invitedAt',
        header: ({ column }) => (
          <SortableHeader column={column} label="Invited Date" />
        ),
        cell: ({ row }) => formatDate(row.original.invitedAt),
        enableSorting: true,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          if (!canManageInvitations) return null;

          const { id, email, role } = row.original;
          const isRowPending =
            removingInvitationId === id || resendingInvitationId === id;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(props) => (
                  <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground data-[state=open]:bg-muted"
                    disabled={isLoading || isRowPending}
                    aria-label="Row actions"
                  >
                    <IconDotsVertical className="size-4" />
                  </Button>
                )}
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onResendInvitation({ id, email, role })}
                  disabled={resendingInvitationId === id}
                >
                  Resend invitation
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onRemoveInvitation(id)}
                  disabled={removingInvitationId === id}
                  className="text-destructive focus:text-destructive"
                >
                  Remove invitation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [
      canManageInvitations,
      isLoading,
      onRemoveInvitation,
      onResendInvitation,
      removingInvitationId,
      resendingInvitationId,
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
                <TableRow key={`invites-loading-${rowIndex}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-56" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
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
                  No pending invitations found.
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
        countLabel="invitation"
        selectId="invitations-rows-per-page"
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
