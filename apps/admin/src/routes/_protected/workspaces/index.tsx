import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@workspace/ui/components/button';
import type { SortingState } from '@tanstack/react-table';
import { AdminWorkspaceTable } from '@/components/admin/admin-workspace-table';
import { useAdminWorkspaceListQuery } from '@/admin/workspaces.queries';

export const Route = createFileRoute('/_protected/workspaces/')({
  component: AdminWorkspaceListPage,
});

const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 450;

type FilterTab = 'all' | 'self-serve' | 'enterprise';

function AdminWorkspaceListPage() {
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

  const workspacesQuery = useAdminWorkspaceListQuery({
    page,
    pageSize,
    search: debouncedSearch,
    filter,
    sortBy,
    sortDirection,
  });

  if (workspacesQuery.isError && !workspacesQuery.data) {
    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <p className="text-sm text-destructive">Failed to load workspaces.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => workspacesQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const workspaces = workspacesQuery.data?.workspaces ?? [];
  const total = workspacesQuery.data?.total ?? 0;
  const totalPages = workspacesQuery.data?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <AdminWorkspaceTable
        data={workspaces}
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
        isLoading={workspacesQuery.isPending && !workspacesQuery.data}
      />
    </div>
  );
}
