---
name: tanstack-query
description: Guide to TanStack Query v5 (React) for server state management. Covers setup, queries, mutations, query keys, invalidation, infinite queries, optimistic updates, suspense, prefetching, SSR, and testing. Use when the user asks about data fetching, caching, useQuery, useMutation, React Query, TanStack Query, or server state in React.
---

# TanStack Query v5 (React)

## Installation

```bash
bun install @tanstack/react-query
bun install -D @tanstack/react-query-devtools  # optional
bun install -D @tanstack/eslint-plugin-query   # optional
```

## Setup

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## Important Defaults

- Queries are considered stale immediately (`staleTime: 0`).
- Stale queries refetch on: window focus, network reconnect, component mount.
- Inactive queries are garbage collected after `gcTime` (default 5 minutes).
- Failed queries retry 3 times with exponential backoff.
- Query results are structurally shared to detect data changes without deep comparison.

## Queries

All hooks accept a **single object argument** (no positional arguments).

```tsx
import { useQuery } from "@tanstack/react-query";

const { data, isPending, isError, error, isFetching } = useQuery({
  queryKey: ["todos"],
  queryFn: fetchTodos,
});
```

### Status fields

| Field | Meaning |
|-------|---------|
| `isPending` | No cached data yet, query is fetching. |
| `isError` | Query encountered an error. |
| `isSuccess` | Query has data. |
| `isFetching` | Query is fetching (including background refetches). |
| `isLoading` | Shorthand for `isPending && isFetching` (true on first fetch only). |

### Typed query function

```tsx
const { data } = useQuery({
  queryKey: ["todo", id],
  queryFn: async (): Promise<Todo> => {
    const res = await fetch(`/api/todos/${id}`);
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  },
});
```

## Query Keys

Query keys must be arrays. They are serialized deterministically (object key order does not matter).

```tsx
// String key.
useQuery({ queryKey: ["todos"] })

// Key with variables.
useQuery({ queryKey: ["todo", id] })

// Key with filters.
useQuery({ queryKey: ["todos", { status, page }] })
```

### Invalidation matching

Keys match hierarchically. Invalidating `["todos"]` also invalidates `["todos", 1]` and `["todos", { status: "done" }]`.

## queryOptions Helper

Use `queryOptions()` to create reusable, type-safe query configurations. Share across `useQuery`, `prefetchQuery`, `ensureQueryData`, etc.

```tsx
import { queryOptions } from "@tanstack/react-query";

function todoQueryOptions(id: number) {
  return queryOptions({
    queryKey: ["todo", id],
    queryFn: () => fetchTodo(id),
    staleTime: 5 * 60 * 1000,
  });
}

// Usage in component.
const { data } = useQuery(todoQueryOptions(id));

// Usage in loader / prefetch.
await queryClient.prefetchQuery(todoQueryOptions(id));
```

## Mutations

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: (newTodo: NewTodo) => axios.post("/api/todos", newTodo),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["todos"] });
  },
  onError: (error) => {
    console.error("Failed:", error);
  },
  onSettled: () => {
    // Runs on both success and error.
  },
});

mutation.mutate({ title: "New Todo" });
```

### Mutation callbacks

Callbacks are available on both `useMutation` options AND `mutate()` call:

```tsx
mutation.mutate(data, {
  onSuccess: (response) => { /* per-call handler */ },
  onError: (error) => { /* per-call handler */ },
});
```

## Query Invalidation

```tsx
const queryClient = useQueryClient();

// Invalidate all queries starting with "todos".
queryClient.invalidateQueries({ queryKey: ["todos"] });

// Invalidate exact key.
queryClient.invalidateQueries({ queryKey: ["todos"], exact: true });

// Invalidate with predicate.
queryClient.invalidateQueries({
  predicate: (query) => query.queryKey[0] === "todos",
});
```

## Direct Cache Updates

Update cache directly from mutation response to avoid a refetch:

```tsx
const mutation = useMutation({
  mutationFn: updateTodo,
  onSuccess: (updatedTodo) => {
    // Update the list cache.
    queryClient.setQueryData(["todos"], (old: Todo[]) =>
      old.map((t) => (t.id === updatedTodo.id ? updatedTodo : t))
    );
    // Update the detail cache.
    queryClient.setQueryData(["todo", updatedTodo.id], updatedTodo);
  },
});
```

## Optimistic Updates

Preferred approach: update UI via `useMutation` variables (no cache rollback needed).

```tsx
const { mutate, variables, isPending, isError } = useMutation({
  mutationFn: updateTodo,
  onSettled: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
});

// In JSX, overlay optimistic data.
<ul>
  {todos.map((todo) => (
    <li key={todo.id} style={{
      opacity: todo.id === variables?.id && isPending ? 0.5 : 1,
    }}>
      {todo.id === variables?.id && isPending ? variables.title : todo.title}
    </li>
  ))}
</ul>
```

### Cache-level optimistic updates (complex cases)

```tsx
useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ["todos"] });
    const previous = queryClient.getQueryData(["todos"]);
    queryClient.setQueryData(["todos"], (old: Todo[]) =>
      old.map((t) => (t.id === newTodo.id ? { ...t, ...newTodo } : t))
    );
    return { previous };
  },
  onError: (_err, _newTodo, context) => {
    queryClient.setQueryData(["todos"], context?.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["todos"] });
  },
});
```

## Infinite Queries

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";

const {
  data, fetchNextPage, hasNextPage, isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ["projects"],
  queryFn: ({ pageParam }) => fetchProjects(pageParam),
  initialPageParam: 0,
  getNextPageParam: (lastPage, allPages) => lastPage.nextCursor ?? undefined,
});

// Access all items.
const allItems = data?.pages.flatMap((page) => page.items) ?? [];
```

## Dependent Queries

```tsx
const { data: user } = useQuery({
  queryKey: ["user", email],
  queryFn: () => getUser(email),
});

const { data: projects } = useQuery({
  queryKey: ["projects", user?.id],
  queryFn: () => getProjects(user!.id),
  enabled: !!user?.id, // Only runs when user is available.
});
```

## Parallel Queries

```tsx
import { useQueries } from "@tanstack/react-query";

const results = useQueries({
  queries: userIds.map((id) => ({
    queryKey: ["user", id],
    queryFn: () => fetchUser(id),
  })),
});
```

## Suspense

Use dedicated suspense hooks. `data` is guaranteed to be defined.

```tsx
import { useSuspenseQuery } from "@tanstack/react-query";

function TodoList() {
  const { data } = useSuspenseQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
  });
  // data is Todo[], never undefined.
  return <ul>{data.map(/* ... */)}</ul>;
}

// Wrap with Suspense + ErrorBoundary.
<ErrorBoundary fallback={<Error />}>
  <Suspense fallback={<Loading />}>
    <TodoList />
  </Suspense>
</ErrorBoundary>
```

Also available: `useSuspenseInfiniteQuery`, `useSuspenseQueries`.

## Prefetching

```tsx
// In a component (e.g., on hover).
const queryClient = useQueryClient();
const prefetch = () =>
  queryClient.prefetchQuery({
    queryKey: ["todo", id],
    queryFn: () => fetchTodo(id),
  });

// In a router loader.
export async function loader({ params }) {
  await queryClient.ensureQueryData(todoQueryOptions(params.id));
  return null;
}

// Hook-based prefetch.
import { usePrefetchQuery } from "@tanstack/react-query";
usePrefetchQuery({ queryKey: ["todos"], queryFn: fetchTodos });
```

## Polling / Auto Refetch

```tsx
useQuery({
  queryKey: ["status"],
  queryFn: fetchStatus,
  refetchInterval: 5000, // Refetch every 5 seconds.
  refetchIntervalInBackground: true, // Continue when tab is not focused.
});
```

## Paginated Queries

Use `placeholderData` with `keepPreviousData` to avoid loading flashes between pages:

```tsx
import { useQuery, keepPreviousData } from "@tanstack/react-query";

const { data, isPlaceholderData } = useQuery({
  queryKey: ["todos", page],
  queryFn: () => fetchTodos(page),
  placeholderData: keepPreviousData,
});
```

## Disabling Queries

```tsx
useQuery({
  queryKey: ["todos", filter],
  queryFn: () => fetchTodos(filter),
  enabled: filter !== "", // Disabled when filter is empty.
});
```

## Testing

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

test("fetches todos", async () => {
  const { result } = renderHook(() => useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
  }), { wrapper: createTestWrapper() });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(3);
});
```

## Common Mistakes

- **DO NOT** use positional arguments: `useQuery(key, fn)` does not work in v5.
- **DO NOT** use `onSuccess`/`onError`/`onSettled` on `useQuery`. These callbacks were removed from queries in v5. Use `useEffect` or handle in the component.
- **DO NOT** use `cacheTime`. Renamed to `gcTime` in v5.
- **DO NOT** use `isInitialLoading`. Renamed to `isLoading` in v5.
- **DO NOT** use `status: 'loading'`. Renamed to `status: 'pending'` in v5.
- **DO NOT** use `keepPreviousData: true` option. Use `placeholderData: keepPreviousData` (import `keepPreviousData` from the package).
- **DO NOT** use `useQuery` with `suspense: true`. Use `useSuspenseQuery` instead.
- **DO NOT** forget `initialPageParam` in `useInfiniteQuery` (required in v5).

## Additional Resources

- For detailed API reference and advanced patterns, see [reference.md](reference.md).
