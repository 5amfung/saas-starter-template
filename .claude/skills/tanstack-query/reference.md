# TanStack Query v5 Reference

## QueryClient Methods

### Reading Cache

```tsx
// Get cached data (returns undefined if not in cache).
const data = queryClient.getQueryData<Todo[]>(["todos"]);

// Get full query state (data, status, error, timestamps).
const state = queryClient.getQueryState(["todos"]);
```

### Writing Cache

```tsx
// Set data directly.
queryClient.setQueryData(["todos"], newTodos);

// Update with callback (receives old data).
queryClient.setQueryData(["todos"], (old: Todo[] | undefined) =>
  old ? [...old, newTodo] : [newTodo]
);
```

### Fetching

```tsx
// Prefetch (does not throw on error).
await queryClient.prefetchQuery({
  queryKey: ["todos"],
  queryFn: fetchTodos,
});

// Ensure data exists (returns data, throws on error).
const data = await queryClient.ensureQueryData({
  queryKey: ["todos"],
  queryFn: fetchTodos,
});

// Fetch (always fetches, returns data, throws on error).
const data = await queryClient.fetchQuery({
  queryKey: ["todos"],
  queryFn: fetchTodos,
});
```

### Invalidation and Removal

```tsx
// Mark queries as stale, triggering refetch for active ones.
queryClient.invalidateQueries({ queryKey: ["todos"] });

// Remove queries from cache entirely.
queryClient.removeQueries({ queryKey: ["todos"] });

// Cancel in-flight queries.
await queryClient.cancelQueries({ queryKey: ["todos"] });

// Reset queries to initial state.
queryClient.resetQueries({ queryKey: ["todos"] });
```

## useQuery Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `queryKey` | `readonly unknown[]` | required | Unique key for the query. |
| `queryFn` | `(context) => Promise<TData>` | required | Function that fetches data. |
| `enabled` | `boolean` | `true` | Disable query when false. |
| `staleTime` | `number` | `0` | Time (ms) data stays fresh. |
| `gcTime` | `number` | `300000` | Time (ms) unused data stays in cache. |
| `retry` | `boolean \| number \| function` | `3` | Retry count or strategy. |
| `retryDelay` | `number \| function` | exp backoff | Delay between retries. |
| `refetchInterval` | `number \| false` | `false` | Polling interval (ms). |
| `refetchOnWindowFocus` | `boolean` | `true` | Refetch on window focus. |
| `refetchOnReconnect` | `boolean` | `true` | Refetch on network reconnect. |
| `refetchOnMount` | `boolean` | `true` | Refetch on mount if stale. |
| `placeholderData` | `TData \| (prev) => TData` | — | Shown while pending. |
| `initialData` | `TData \| () => TData` | — | Seed cache (treated as fresh). |
| `initialDataUpdatedAt` | `number` | — | Timestamp for initialData. |
| `select` | `(data) => TSelected` | — | Transform/select data. |
| `notifyOnChangeProps` | `string[]` | all | Control re-renders. |
| `throwOnError` | `boolean \| function` | `false` | Throw to error boundary. |
| `meta` | `Record<string, unknown>` | — | Metadata accessible in callbacks. |

## useQuery Return Values

| Field | Type | Description |
|-------|------|-------------|
| `data` | `TData \| undefined` | Resolved data. |
| `error` | `TError \| null` | Error object if failed. |
| `status` | `"pending" \| "error" \| "success"` | Current status. |
| `fetchStatus` | `"fetching" \| "paused" \| "idle"` | Fetch status. |
| `isPending` | `boolean` | No data yet. |
| `isError` | `boolean` | Error state. |
| `isSuccess` | `boolean` | Has data. |
| `isFetching` | `boolean` | Fetching (initial or background). |
| `isLoading` | `boolean` | First fetch (`isPending && isFetching`). |
| `isRefetching` | `boolean` | Background refetch. |
| `isPlaceholderData` | `boolean` | Showing placeholder data. |
| `dataUpdatedAt` | `number` | Timestamp of last successful fetch. |
| `refetch` | `() => Promise` | Manually trigger refetch. |

## useMutation Options

| Option | Type | Description |
|--------|------|-------------|
| `mutationFn` | `(variables) => Promise` | Required mutation function. |
| `mutationKey` | `readonly unknown[]` | Optional key for deduplication. |
| `onMutate` | `(variables) => Promise<context>` | Before mutation. Return rollback context. |
| `onSuccess` | `(data, variables, context) => void` | On success. |
| `onError` | `(error, variables, context) => void` | On error. |
| `onSettled` | `(data, error, variables, context) => void` | On completion. |
| `retry` | `boolean \| number` | `0` | Retry count. |
| `gcTime` | `number` | `300000` | Cache time for mutation state. |
| `meta` | `Record<string, unknown>` | — | |

## useMutation Return Values

| Field | Type | Description |
|-------|------|-------------|
| `mutate` | `(variables, options?) => void` | Fire mutation. |
| `mutateAsync` | `(variables, options?) => Promise` | Fire mutation (returns Promise). |
| `data` | `TData \| undefined` | Response data. |
| `error` | `TError \| null` | Error if failed. |
| `variables` | `TVariables \| undefined` | Variables passed to mutate. |
| `status` | `"idle" \| "pending" \| "error" \| "success"` | Mutation status. |
| `isPending` | `boolean` | Mutation in flight. |
| `isIdle` | `boolean` | Not yet triggered. |
| `isError` | `boolean` | Mutation failed. |
| `isSuccess` | `boolean` | Mutation succeeded. |
| `reset` | `() => void` | Reset mutation state. |

## Infinite Query Options

Additional options beyond `useQuery`:

| Option | Type | Description |
|--------|------|-------------|
| `initialPageParam` | `TPageParam` | Required. Starting page param. |
| `getNextPageParam` | `(lastPage, allPages) => TPageParam \| undefined` | Return next page param or undefined to stop. |
| `getPreviousPageParam` | `(firstPage, allPages) => TPageParam \| undefined` | For bi-directional scrolling. |
| `maxPages` | `number` | Limit stored pages (old pages dropped). |

### Infinite Query Return Values

```tsx
const {
  data,              // { pages: TData[], pageParams: TPageParam[] }
  fetchNextPage,     // () => Promise
  fetchPreviousPage, // () => Promise
  hasNextPage,       // boolean (getNextPageParam returned non-undefined)
  hasPreviousPage,   // boolean
  isFetchingNextPage,
  isFetchingPreviousPage,
} = useInfiniteQuery(/* ... */);
```

## Query Key Factory Pattern

Organize query keys for large applications:

```tsx
const todoKeys = {
  all: ["todos"] as const,
  lists: () => [...todoKeys.all, "list"] as const,
  list: (filters: TodoFilters) => [...todoKeys.lists(), filters] as const,
  details: () => [...todoKeys.all, "detail"] as const,
  detail: (id: number) => [...todoKeys.details(), id] as const,
};

// Usage.
useQuery({ queryKey: todoKeys.detail(id), queryFn: () => fetchTodo(id) });

// Invalidation.
queryClient.invalidateQueries({ queryKey: todoKeys.lists() }); // All lists.
queryClient.invalidateQueries({ queryKey: todoKeys.all });      // Everything.
```

## SSR with Next.js App Router

```tsx
// app/providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000 },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Hydration pattern

```tsx
// app/todos/page.tsx (Server Component)
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

export default async function TodosPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TodoList />
    </HydrationBoundary>
  );
}
```

## Query Filters

Filters used in `invalidateQueries`, `cancelQueries`, `removeQueries`, etc.

```tsx
type QueryFilters = {
  queryKey?: QueryKey;     // Match by key prefix.
  exact?: boolean;         // Match key exactly.
  type?: "active" | "inactive" | "all"; // Default "all".
  stale?: boolean;         // Match stale/fresh queries.
  fetchStatus?: FetchStatus;
  predicate?: (query: Query) => boolean; // Custom matcher.
};
```

## Error Boundaries with Query

```tsx
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

function App() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary onReset={reset} fallbackRender={({ resetErrorBoundary }) => (
          <div>
            <p>Something went wrong</p>
            <button onClick={resetErrorBoundary}>Try again</button>
          </div>
        )}>
          <Suspense fallback={<Loading />}>
            <TodoList />
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
```

## Cancel Query on Unmount

Pass `AbortSignal` from the query context:

```tsx
useQuery({
  queryKey: ["todos"],
  queryFn: async ({ signal }) => {
    const res = await fetch("/api/todos", { signal });
    return res.json();
  },
});
```

## Select / Transform Data

```tsx
const { data: todoTitles } = useQuery({
  queryKey: ["todos"],
  queryFn: fetchTodos,
  select: (data) => data.map((t) => t.title), // Only re-renders when titles change.
});
```

## Dependent Mutations (Chaining)

```tsx
const mutation = useMutation({ mutationFn: createTodo });

mutation.mutateAsync(newTodo).then((created) => {
  // Chain a second action after mutation succeeds.
  return assignTodo(created.id, userId);
});
```

## useMutationState

Access mutation state globally (useful for showing pending mutations in other components):

```tsx
import { useMutationState } from "@tanstack/react-query";

const pendingTodos = useMutationState({
  filters: { mutationKey: ["addTodo"], status: "pending" },
  select: (mutation) => mutation.state.variables as NewTodo,
});
```

## ESLint Plugin

```bash
npm i -D @tanstack/eslint-plugin-query
```

Key rules:
- `@tanstack/query/exhaustive-deps` - Ensure queryKey includes all queryFn dependencies.
- `@tanstack/query/stable-query-client` - Prevent unstable QueryClient references.
- `@tanstack/query/no-rest-destructuring` - Prevent rest destructuring of query results (breaks reactivity).
- `@tanstack/query/no-unstable-deps` - Prevent unstable values in query options.

## v5 Migration Quick Reference

| v4 | v5 |
|----|-----|
| `useQuery(key, fn, options)` | `useQuery({ queryKey, queryFn, ...options })` |
| `cacheTime` | `gcTime` |
| `isInitialLoading` | `isLoading` |
| `status: 'loading'` | `status: 'pending'` |
| `isLoading` (old meaning) | `isPending` |
| `keepPreviousData: true` | `placeholderData: keepPreviousData` |
| `useQuery({ suspense: true })` | `useSuspenseQuery()` |
| `onSuccess/onError on useQuery` | Removed. Use effects or component logic. |
| `useInfiniteQuery` (no initialPageParam) | `initialPageParam` is required. |
| `data.pages` structure same | `data.pages` + `data.pageParams` |
| `getLogger()` / `setLogger()` | Removed. |
| `import from 'react-query'` | `import from '@tanstack/react-query'` |
