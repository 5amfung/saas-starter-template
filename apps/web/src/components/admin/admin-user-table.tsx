import * as React from 'react';
import {
  IconBan,
  IconBolt,
  IconChevronDown,
  IconCircleCheckFilled,
  IconDotsVertical,
  IconLayoutColumns,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { Tabs, TabsList, TabsTrigger } from '@workspace/ui/components/tabs';
import {
  ACTIONS_COLUMN_CLASS,
  ADMIN_PAGE_SIZE_OPTIONS,
  MAX_SKELETON_ROWS,
  formatDate,
} from '@workspace/components/lib';
import { useColumnSort } from '@workspace/components/hooks';
import { SortableHeader, TablePagination } from '@workspace/components/layout';
import type {
  ColumnDef,
  Table as ReactTable,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';

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
  onSearchSubmit: (search?: string) => void;
  onSearchClear: () => void;
  onFilterChange: (filter: string) => void;
  onSortingChange: (sorting: SortingState) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  isLoading?: boolean;
}

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
  onSearchSubmit,
  onSearchClear,
  onFilterChange,
  onSortingChange,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: AdminUserTableProps) {
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      id: false,
      banReason: false,
      banExpires: false,
      updatedAt: false,
    });
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const columns = React.useMemo<Array<ColumnDef<UserRow>>>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
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
            to="/admin/users/$userId"
            params={{ userId: row.original.id }}
            className="text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
        enableHiding: true,
        enableSorting: true,
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <SortableHeader column={column} label="Email" />
        ),
        cell: ({ row }) => (
          <Link
            to="/admin/users/$userId"
            params={{ userId: row.original.id }}
            className="text-primary hover:underline"
          >
            {row.original.email}
          </Link>
        ),
        enableHiding: false,
        enableSorting: true,
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
        enableSorting: false,
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) =>
          row.original.role ? (
            <Badge variant="secondary" className="gap-1">
              {row.original.role === 'admin' && <IconBolt className="size-3" />}
              {row.original.role === 'user' && <IconUser className="size-3" />}
              {row.original.role}
            </Badge>
          ) : null,
        enableHiding: true,
        enableSorting: false,
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
        enableSorting: false,
      },
      {
        accessorKey: 'banReason',
        header: 'Ban Reason',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.banReason ?? ''}
          </span>
        ),
        enableHiding: true,
        enableSorting: false,
      },
      {
        accessorKey: 'banExpires',
        header: 'Ban Expires',
        cell: ({ row }) =>
          row.original.banExpires
            ? new Date(row.original.banExpires).toLocaleDateString()
            : null,
        enableHiding: true,
        enableSorting: false,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <SortableHeader column={column} label="Created" />
        ),
        cell: ({ row }) => formatDate(row.original.createdAt),
        enableHiding: true,
        enableSorting: true,
      },
      {
        accessorKey: 'updatedAt',
        header: ({ column }) => (
          <SortableHeader column={column} label="Updated" />
        ),
        cell: ({ row }) => formatDate(row.original.updatedAt),
        enableHiding: true,
        enableSorting: true,
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
                  size="icon"
                >
                  <IconDotsVertical className="size-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                render={
                  <Link
                    to="/admin/users/$userId"
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
    []
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
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const skeletonRowCount = Math.min(pageSize, MAX_SKELETON_ROWS);

  const handleHeaderSort = useColumnSort(sorting, onSortingChange);

  return (
    <Tabs
      value={filter}
      onValueChange={onFilterChange}
      className="w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label htmlFor="admin-user-filter-selector" className="sr-only">
          User filter
        </Label>
        <Select
          value={filter}
          onValueChange={(value) => {
            if (!value) return;
            onFilterChange(value);
          }}
        >
          <SelectTrigger
            className="flex w-fit @4xl/main:hidden"
            size="sm"
            id="admin-user-filter-selector"
          >
            <SelectValue placeholder="Select filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="verified">Verified</TabsTrigger>
          <TabsTrigger value="unverified">Unverified</TabsTrigger>
          <TabsTrigger value="banned">Banned</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Input
              ref={searchInputRef}
              placeholder="Search by email..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSearchSubmit(e.currentTarget.value);
                }
                if (e.key === 'Escape' && search.length > 0) {
                  e.preventDefault();
                  onSearchClear();
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }
              }}
              className="h-8 w-40 pr-8 sm:w-56 lg:w-72"
            />
            {search.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  onSearchClear();
                  requestAnimationFrame(() => searchInputRef.current?.focus());
                }}
                className="absolute top-1/2 right-1 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <IconX className="size-3.5" />
              </Button>
            ) : null}
          </div>
          <ColumnVisibilityDropdown table={table} />
        </div>
      </div>

      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
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
                Array.from({ length: skeletonRowCount }).map((_, rowIdx) => (
                  <TableRow key={`loading-row-${rowIdx}`}>
                    {Array.from({ length: visibleColumnCount }).map(
                      (__, colIdx) => {
                        const column = table.getVisibleLeafColumns()[colIdx];
                        const isActionsColumn = column.id === 'actions';
                        return (
                          <TableCell
                            key={`loading-cell-${rowIdx}-${colIdx}`}
                            className={
                              isActionsColumn ? ACTIONS_COLUMN_CLASS : undefined
                            }
                          >
                            <Skeleton
                              className={
                                isActionsColumn
                                  ? 'ml-auto h-8 w-8 rounded-md'
                                  : 'h-4 w-24'
                              }
                            />
                          </TableCell>
                        );
                      }
                    )}
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

        <TablePagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}
          isLoading={isLoading}
          totalCount={total}
          countLabel="user"
          selectId="rows-per-page"
          responsiveBreakpoint="lg"
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </Tabs>
  );
}

// --- Internal components ---

function ColumnVisibilityDropdown({ table }: { table: ReactTable<UserRow> }) {
  const toggleableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanHide());

  if (toggleableColumns.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button {...props} variant="outline" size="sm">
            <IconLayoutColumns />
            <span className="hidden lg:inline">Customize Columns</span>
            <span className="lg:hidden">Columns</span>
            <IconChevronDown />
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="w-56">
        {toggleableColumns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            className="capitalize"
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(!!value)}
          >
            {column.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
