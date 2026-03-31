import * as React from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@workspace/ui/components/button';
import { authClient } from '@workspace/auth/client';
import type { SortingState } from '@tanstack/react-table';
import { AdminUserTable } from '@/components/admin/admin-user-table';

export const Route = createFileRoute('/_protected/users/')({
  component: AdminUserListPage,
});

const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 450;

type FilterTab = 'all' | 'verified' | 'unverified' | 'banned';

/** Map UI filter tabs to Better Auth listUsers filter params. */
function getFilterParams(filter: FilterTab) {
  switch (filter) {
    case 'verified':
      return {
        filterField: 'emailVerified' as const,
        filterValue: 'true',
        filterOperator: 'eq' as const,
      };
    case 'unverified':
      return {
        filterField: 'emailVerified' as const,
        filterValue: 'false',
        filterOperator: 'eq' as const,
      };
    case 'banned':
      return {
        filterField: 'banned' as const,
        filterValue: 'true',
        filterOperator: 'eq' as const,
      };
    default:
      return {};
  }
}

function AdminUserListPage() {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [filter, setFilter] = React.useState<FilterTab>('all');
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const handleSearchSubmit = React.useCallback(
    (value?: string) => {
      const nextSearch = value ?? search;
      setSearch(nextSearch);
      setDebouncedSearch(nextSearch);
      setPage(1);
    },
    [search]
  );

  const handleSearchClear = React.useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  }, []);

  // Debounce search input.
  React.useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when filters change.
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter, pageSize]);

  const sortBy = sorting[0]?.id;
  const sortDirection = sorting[0]?.desc
    ? ('desc' as const)
    : sorting[0]
      ? ('asc' as const)
      : undefined;

  const usersQuery = useQuery({
    queryKey: [
      'admin',
      'users',
      page,
      pageSize,
      debouncedSearch,
      filter,
      sortBy,
      sortDirection,
    ],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const filterParams = getFilterParams(filter);
      const { data, error } = await authClient.admin.listUsers({
        query: {
          limit: pageSize,
          offset: (page - 1) * pageSize,
          ...(debouncedSearch
            ? {
                searchValue: debouncedSearch,
                searchOperator: 'contains' as const,
              }
            : {}),
          ...filterParams,
          ...(sortBy ? { sortBy, sortDirection: sortDirection ?? 'asc' } : {}),
        },
      });

      if (error) throw new Error(error.message);

      return {
        users: data.users,
        total: data.total,
        page,
        pageSize,
        totalPages: Math.ceil(data.total / pageSize),
      };
    },
  });

  if (usersQuery.isError && !usersQuery.data) {
    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <p className="text-sm text-destructive">Failed to load users.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => usersQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = usersQuery.data?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <AdminUserTable
        data={users}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        search={search}
        filter={filter}
        sorting={sorting}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearchSubmit}
        onSearchClear={handleSearchClear}
        onFilterChange={(value) => setFilter(value as FilterTab)}
        onSortingChange={setSorting}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isLoading={usersQuery.isPending && !usersQuery.data}
      />
    </div>
  );
}
