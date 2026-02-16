import * as React from 'react';
import { Link } from '@tanstack/react-router';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type {
  ColumnDef,
  Table as ReactTable,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconBan,
  IconCircleCheckFilled,
  IconDotsVertical,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface AdminUserTableProps {
  data: Array<UserRow>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
  filter: string;
  sorting: SortingState;
  onSearchChange: (search: string) => void;
  onFilterChange: (filter: string) => void;
  onSortingChange: (sorting: SortingState) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = ['10', '50', '100'];

export function AdminUserTable({
  data,
  total,
  page,
  pageSize,
  totalPages,
  search,
  filter,
  sorting,
  onSearchChange,
  onFilterChange,
  onSortingChange,
  onPageChange,
  onPageSizeChange,
}: AdminUserTableProps) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      id: false,
      banReason: false,
      banExpires: false,
      updatedAt: false,
    });

  const columns = React.useMemo<Array<ColumnDef<UserRow>>>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs">
            {row.original.id}
          </span>
        ),
        enableHiding: true,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column} label="Name" />,
        cell: ({ row }) => (
          <Link
            to="/admin/user/$userId"
            params={{ userId: row.original.id }}
            className="text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
        enableHiding: true,
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <SortableHeader column={column} label="Email" />
        ),
        cell: ({ row }) => (
          <Link
            to="/admin/user/$userId"
            params={{ userId: row.original.id }}
            className="text-primary hover:underline"
          >
            {row.original.email}
          </Link>
        ),
        enableHiding: false,
      },
      {
        accessorKey: 'emailVerified',
        header: 'Email Verified',
        cell: ({ row }) =>
          row.original.emailVerified ? (
            <Badge variant="outline" className="gap-1">
              <IconCircleCheckFilled className="size-3 text-emerald-500" />
              Verified
            </Badge>
          ) : null,
        enableHiding: true,
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) =>
          row.original.role ? (
            <Badge variant="secondary">{row.original.role}</Badge>
          ) : null,
        enableHiding: true,
      },
      {
        accessorKey: 'banned',
        header: 'Banned',
        cell: ({ row }) =>
          row.original.banned ? (
            <Badge variant="destructive" className="gap-1">
              <IconBan className="size-3" />
              Banned
            </Badge>
          ) : null,
        enableHiding: true,
      },
      {
        accessorKey: 'banReason',
        header: 'Ban Reason',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.banReason ?? ''}
          </span>
        ),
        enableHiding: true,
      },
      {
        accessorKey: 'banExpires',
        header: 'Ban Expires',
        cell: ({ row }) =>
          row.original.banExpires
            ? new Date(row.original.banExpires).toLocaleDateString()
            : null,
        enableHiding: true,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <SortableHeader column={column} label="Created" />
        ),
        cell: ({ row }) => formatDate(row.original.createdAt),
        enableHiding: true,
      },
      {
        accessorKey: 'updatedAt',
        header: ({ column }) => (
          <SortableHeader column={column} label="Updated" />
        ),
        cell: ({ row }) => formatDate(row.original.updatedAt),
        enableHiding: true,
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-xs">
                  <IconDotsVertical className="size-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                render={
                  <Link
                    to="/admin/user/$userId"
                    params={{ userId: row.original.id }}
                  />
                }
              >
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
  });

  // Map internal sorting state to parent handler.
  const handleHeaderSort = React.useCallback(
    (columnId: string) => {
      const current = sorting.find((s) => s.id === columnId);
      let next: SortingState;
      if (!current) {
        next = [{ id: columnId, desc: false }];
      } else if (!current.desc) {
        next = [{ id: columnId, desc: true }];
      } else {
        // Clear sort.
        next = [];
      }
      onSortingChange(next);
    },
    [sorting, onSortingChange],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs. */}
      <Tabs value={filter} onValueChange={onFilterChange}>
        <TabsList variant="line">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="verified">Verified</TabsTrigger>
          <TabsTrigger value="unverified">Unverified</TabsTrigger>
          <TabsTrigger value="banned">Banned</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search + column visibility. */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by email…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
        />
        <ColumnVisibilityDropdown table={table} />
      </div>

      {/* Table. */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
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
                      header.column.getCanSort()
                        ? 'cursor-pointer select-none'
                        : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {search || filter !== 'all'
                    ? 'No results. Clear filters.'
                    : 'No users found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground text-sm">
          {total} user{total !== 1 ? 's' : ''} total
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="w-18" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminUserTableSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-9 w-64" />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-16" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: 6 }).map((__, colIdx) => (
                  <TableCell key={colIdx}>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// --- Internal components ---

function SortableHeader({
  column,
  label,
}: {
  column: { getIsSorted: () => false | 'asc' | 'desc' };
  label: string;
}) {
  const sorted = column.getIsSorted();
  return (
    <div className="flex items-center gap-1">
      {label}
      {sorted === 'asc' ? (
        <IconArrowUp className="size-3.5" />
      ) : sorted === 'desc' ? (
        <IconArrowDown className="size-3.5" />
      ) : (
        <IconArrowsSort className="text-muted-foreground/50 size-3.5" />
      )}
    </div>
  );
}

function ColumnVisibilityDropdown({ table }: { table: ReactTable<UserRow> }) {
  const toggleableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanHide());

  if (toggleableColumns.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            Columns
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {toggleableColumns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onClick={() => column.toggleVisibility()}
          >
            {column.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
