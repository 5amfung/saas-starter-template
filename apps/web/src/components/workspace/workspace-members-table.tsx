import * as React from 'react';
import { IconDotsVertical } from '@tabler/icons-react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
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
  OPERATIONS,
  buildWorkflowAttributes,
  startWorkflowSpan,
} from '@workspace/logging/client';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { SortableHeader, TablePagination } from '@/components/layout';
import { useColumnSort } from '@/hooks';
import {
  ACTIONS_COLUMN_CLASS,
  DEFAULT_PAGE_SIZE_OPTIONS,
  MAX_SKELETON_ROWS,
  normalizeRole,
} from '@/lib';
import { WorkspaceTransferOwnershipDialog } from '@/components/workspace/workspace-transfer-ownership-dialog';
import { TypedConfirmDialog } from '@/components/shared/typed-confirm-dialog';

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
  onRemoveMember: (memberId: string) => void | Promise<void>;
  onLeave: () => void | Promise<void>;
  onTransferOwnership?: (memberId: string) => Promise<void>;
}

type PendingAction =
  | {
      type: 'remove';
      memberId: string;
      userId: string;
      email: string;
    }
  | {
      type: 'leave';
    }
  | null;

const WORKFLOW_ROUTE = 'workspace-members-table';

function buildWorkspaceMembershipSpanAttributes(
  operation: (typeof OPERATIONS)[keyof typeof OPERATIONS],
  result: 'attempt' | 'success' | 'failure',
  currentUserId: string | null,
  targetUserId?: string
) {
  return buildWorkflowAttributes(operation, {
    route: WORKFLOW_ROUTE,
    userId: currentUserId ?? undefined,
    targetUserId,
    result,
  });
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value
  );
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
  const [pendingAction, setPendingAction] = React.useState<PendingAction>(null);
  const [isSubmittingAction, setIsSubmittingAction] = React.useState(false);
  const isSubmittingActionRef = React.useRef(false);

  const resetSubmissionState = React.useCallback(() => {
    isSubmittingActionRef.current = false;
    setIsSubmittingAction(false);
  }, []);

  const closePendingAction = React.useCallback(() => {
    resetSubmissionState();
    setPendingAction(null);
  }, [resetSubmissionState]);

  const beginSubmission = React.useCallback(() => {
    isSubmittingActionRef.current = true;
    setIsSubmittingAction(true);
  }, []);

  const handleConfirmRemove = React.useCallback(() => {
    if (
      !pendingAction ||
      pendingAction.type !== 'remove' ||
      isSubmittingActionRef.current
    ) {
      return;
    }

    try {
      beginSubmission();
      const result = startWorkflowSpan(
        {
          op: OPERATIONS.WORKSPACE_MEMBER_REMOVE,
          name: 'Remove workspace member',
          attributes: buildWorkspaceMembershipSpanAttributes(
            OPERATIONS.WORKSPACE_MEMBER_REMOVE,
            'attempt',
            currentUserId,
            pendingAction.userId
          ),
        },
        () => onRemoveMember(pendingAction.memberId)
      );

      if (isPromiseLike(result)) {
        return Promise.resolve(result).then(
          () => {
            closePendingAction();
          },
          () => {
            // Keep the dialog open so the user can retry without retyping.
            resetSubmissionState();
          }
        );
      }

      closePendingAction();
    } catch {
      // Keep the dialog open on synchronous failure as well.
      resetSubmissionState();
    }
  }, [
    beginSubmission,
    closePendingAction,
    currentUserId,
    onRemoveMember,
    pendingAction,
    resetSubmissionState,
  ]);

  const handleConfirmLeave = React.useCallback(() => {
    if (
      !pendingAction ||
      pendingAction.type !== 'leave' ||
      isSubmittingActionRef.current
    ) {
      return;
    }

    try {
      beginSubmission();
      const result = startWorkflowSpan(
        {
          op: OPERATIONS.WORKSPACE_MEMBER_LEAVE,
          name: 'Leave workspace',
          attributes: buildWorkspaceMembershipSpanAttributes(
            OPERATIONS.WORKSPACE_MEMBER_LEAVE,
            'attempt',
            currentUserId
          ),
        },
        () => onLeave()
      );

      if (isPromiseLike(result)) {
        return Promise.resolve(result).then(
          () => {
            closePendingAction();
          },
          () => {
            // Keep the dialog open so the user can retry without retyping.
            resetSubmissionState();
          }
        );
      }

      closePendingAction();
    } catch {
      // Keep the dialog open on synchronous failure as well.
      resetSubmissionState();
    }
  }, [
    beginSubmission,
    closePendingAction,
    currentUserId,
    onLeave,
    pendingAction,
    resetSubmissionState,
  ]);

  const columns = React.useMemo<Array<ColumnDef<WorkspaceMemberRow>>>(
    () => [
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <SortableHeader column={column} label="Email Address" />
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span>{row.original.email}</span>
            {row.original.userId === currentUserId ? (
              <Badge variant="secondary">Current user</Badge>
            ) : null}
          </div>
        ),
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
          const { id, userId, role, email } = row.original;
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
                    aria-label={`Row actions for ${email}`}
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
                    onClick={() =>
                      setPendingAction({
                        type: 'leave',
                      })
                    }
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
                      onClick={() =>
                        setPendingAction({
                          type: 'remove',
                          memberId: id,
                          userId,
                          email,
                        })
                      }
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
  const confirmDialogOpen = pendingAction !== null;
  const confirmDialogPending =
    isSubmittingAction ||
    (pendingAction?.type === 'remove'
      ? removingMemberId === pendingAction.memberId
      : pendingAction?.type === 'leave'
        ? leavingWorkspace
        : false);

  return (
    <>
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
      </div>

      <TypedConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closePendingAction();
          }
        }}
        title={
          pendingAction?.type === 'remove' ? 'Remove member' : 'Leave workspace'
        }
        description={
          pendingAction?.type === 'remove'
            ? `This will remove ${pendingAction.email} from the workspace. The user will lose access immediately.`
            : 'This will remove your access to this workspace immediately.'
        }
        confirmLabel={
          pendingAction?.type === 'remove' ? 'Confirm remove' : 'Confirm leave'
        }
        confirmationText={pendingAction?.type === 'remove' ? 'REMOVE' : 'LEAVE'}
        isPending={confirmDialogPending}
        onConfirm={
          pendingAction?.type === 'remove'
            ? handleConfirmRemove
            : handleConfirmLeave
        }
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

          await startWorkflowSpan(
            {
              op: OPERATIONS.WORKSPACE_TRANSFER_OWNERSHIP,
              name: 'Transfer workspace ownership',
              attributes: buildWorkspaceMembershipSpanAttributes(
                OPERATIONS.WORKSPACE_TRANSFER_OWNERSHIP,
                'attempt',
                currentUserId,
                transferTarget.userId
              ),
            },
            () => onTransferOwnership(transferTarget.id)
          );
          setTransferTarget(null);
        }}
      />
    </>
  );
}
