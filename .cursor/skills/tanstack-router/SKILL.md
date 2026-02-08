---
name: tanstack-router
description: Build type-safe routing for React apps using TanStack Router v1 and TanStack Start. Covers file-based routing, search params, data loading, authenticated routes, code splitting, navigation, server functions, and Vite setup. Use when the user works with TanStack Router, TanStack Start, file-based routes, createFileRoute, or asks about type-safe routing in React.
---

# TanStack Router v1

Type-safe router for React with built-in caching, URL state management, and file-based routing.

- **Package**: `@tanstack/react-router` (v1.x)
- **Full-stack**: `@tanstack/react-start` (RC, built on TanStack Router)
- **Requires**: React 18+, TypeScript 5.3+

## Quick Start

### New Project (SPA)

```sh
npx create-tsrouter-app@latest my-app --template file-router
cd my-app && npm run dev
```

### New Project (Full-Stack with TanStack Start)

```sh
npm create @tanstack/start@latest
```

### Add to Existing Project

```sh
bun install @tanstack/react-router
bun install -D @tanstack/router-plugin
```

## Vite Setup (File-Based Routing)

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
})
```

Default config: routes in `./src/routes`, generates `./src/routeTree.gen.ts`.

## File Naming Conventions

| Convention | Purpose |
|---|---|
| `__root.tsx` | Root route (always rendered) |
| `index.tsx` | Exact match for parent path |
| `$param.tsx` | Dynamic path parameter segment |
| `_layout.tsx` | Pathless layout (prefix `_` = no URL segment) |
| `route_.child.tsx` | Suffix `_` = escape parent nesting |
| `.` separator | Flat route nesting: `posts.index.tsx` = `/posts` (exact) |
| `(group)` folder | Route group (not in URL path) |
| `-prefix` | Excluded from route tree (colocation) |
| `route.tsx` | Directory route file: `posts/route.tsx` = `/posts` |
| `.lazy.tsx` | Code-split non-critical route config |

### File-Based Routing Examples

**Directory style:**
```
src/routes/
  __root.tsx          → <Root>
  index.tsx           → / (exact)
  about.tsx           → /about
  posts.tsx           → /posts (layout)
  posts/
    index.tsx         → /posts (exact)
    $postId.tsx       → /posts/$postId
  _auth.tsx           → pathless layout
  _auth/
    dashboard.tsx     → /dashboard (wrapped by _auth layout)
```

**Flat style:**
```
src/routes/
  __root.tsx
  posts.tsx
  posts.index.tsx        → /posts (exact)
  posts.$postId.tsx      → /posts/$postId
  settings.profile.tsx   → /settings/profile
```

## Creating Routes

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <div>
      <nav>{/* links */}</nav>
      <Outlet />
    </div>
  ),
})
```

```tsx
// src/routes/posts.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts')({
  component: PostsLayout,
})

function PostsLayout() {
  return <div><Outlet /></div>
}
```

## Navigation

### Link Component

```tsx
import { Link } from '@tanstack/react-router'

// Static link.
<Link to="/about">About</Link>

// Dynamic params.
<Link to="/posts/$postId" params={{ postId: '123' }}>Post</Link>

// Search params.
<Link to="/posts" search={{ page: 1, sort: 'newest' }}>Posts</Link>

// Update search params functionally.
<Link to="." search={(prev) => ({ ...prev, page: prev.page + 1 })}>
  Next Page
</Link>

// Active styling.
<Link
  to="/about"
  activeProps={{ className: 'font-bold' }}
  activeOptions={{ exact: true }}
>
  About
</Link>

// Preloading on hover.
<Link to="/posts" preload="intent">Posts</Link>
```

### Imperative Navigation

```tsx
import { useNavigate } from '@tanstack/react-router'

function Component() {
  const navigate = useNavigate({ from: '/posts/$postId' })

  const handleClick = () => {
    navigate({ to: '/posts', search: { page: 1 } })
  }
}
```

## Search Params (Type-Safe URL State)

TanStack Router parses search params as JSON, preserving types (numbers, booleans, arrays, objects).

### Validation with Zod (Recommended)

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator, fallback } from '@tanstack/zod-adapter'
import { z } from 'zod'

const searchSchema = z.object({
  page: fallback(z.number(), 1).default(1),
  filter: fallback(z.string(), '').default(''),
  sort: fallback(z.enum(['newest', 'oldest', 'price']), 'newest').default('newest'),
})

export const Route = createFileRoute('/products')({
  validateSearch: zodValidator(searchSchema),
})
```

Use `fallback()` from `@tanstack/zod-adapter` instead of `.catch()` to retain types.

### Reading Search Params

```tsx
// In route component.
const { page, filter, sort } = Route.useSearch()

// From another file (avoids circular imports).
import { getRouteApi } from '@tanstack/react-router'
const routeApi = getRouteApi('/products')
const search = routeApi.useSearch()
```

### Search Middlewares

```tsx
import { retainSearchParams, stripSearchParams } from '@tanstack/react-router'

export const Route = createFileRoute('/products')({
  validateSearch: zodValidator(searchSchema),
  search: {
    middlewares: [
      retainSearchParams(['rootValue']),
      stripSearchParams({ sort: 'newest' }),
    ],
  },
})
```

## Data Loading

### Route Loaders

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
})

// Consume in component.
function Posts() {
  const posts = Route.useLoaderData()
  return <div>{posts.map(p => <p key={p.id}>{p.title}</p>)}</div>
}
```

### Loader with Search Param Dependencies

Use `loaderDeps` to key cache on specific search params. Only include deps you actually use.

```tsx
export const Route = createFileRoute('/posts')({
  validateSearch: z.object({ offset: z.number().catch(0) }),
  loaderDeps: ({ search: { offset } }) => ({ offset }),
  loader: ({ deps: { offset } }) => fetchPosts({ offset }),
})
```

### Loader with Path Params

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: ({ params: { postId } }) => fetchPostById(postId),
})
```

### Router Context (Dependency Injection)

```tsx
// __root.tsx
export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
})

// posts.tsx - access context in loader.
export const Route = createFileRoute('/posts')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(postsQueryOptions()),
})

// router.tsx
const router = createRouter({
  routeTree,
  context: { queryClient },
})
```

### Caching Defaults

- `staleTime`: `0` (always refetch on navigation)
- `preloadStaleTime`: `30s`
- `gcTime`: `30min`
- `router.invalidate()` forces all loaders to refetch.

## Authenticated Routes

Use `beforeLoad` to guard routes. Throw `redirect()` to send unauthenticated users to login.

```tsx
// src/routes/_authenticated.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
})
```

### With React Context

```tsx
// __root.tsx
export const Route = createRootRouteWithContext<{ auth: AuthState }>()({
  component: () => <Outlet />,
})

// App.tsx
function InnerApp() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}

// _authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
})
```

## Code Splitting

With `autoCodeSplitting: true` in Vite config, route components are automatically split.

**Manual splitting** uses `.lazy.tsx`:

```tsx
// posts.tsx (critical: loader, validateSearch)
export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
})

// posts.lazy.tsx (non-critical: component)
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/posts')({
  component: Posts,
})

function Posts() { /* ... */ }
```

## Error Handling

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  errorComponent: ({ error, reset }) => (
    <div>
      <p>{error.message}</p>
      <button onClick={() => router.invalidate()}>Retry</button>
    </div>
  ),
  pendingComponent: () => <div>Loading...</div>,
  notFoundComponent: () => <div>Not found</div>,
})
```

## TanStack Start (Full-Stack)

TanStack Start extends Router with SSR, streaming, server functions, and API routes. See [reference.md](reference.md) for server function patterns.

### Server Functions

```tsx
import { createServerFn } from '@tanstack/react-start'

export const getPosts = createServerFn({ method: 'GET' }).handler(async () => {
  return db.query.posts.findMany()
})

// Use in loader.
export const Route = createFileRoute('/posts')({
  loader: () => getPosts(),
})
```

### Server Function with Validation

```tsx
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const createPost = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ title: z.string().min(1), body: z.string() }))
  .handler(async ({ data }) => {
    return db.insert(posts).values(data).returning()
  })
```

## Additional Resources

- For detailed API patterns, server functions, and advanced examples, see [reference.md](reference.md)
- [TanStack Router Docs](https://tanstack.com/router/latest/docs)
- [TanStack Start Docs](https://tanstack.com/start/latest/docs)
