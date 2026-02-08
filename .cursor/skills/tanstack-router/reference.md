# TanStack Router & Start - Reference

## Navigation API

### ToOptions Interface

All navigation APIs share this core interface:

```ts
type ToOptions = {
  from?: string    // Origin route path (enables relative navigation).
  to: string       // Destination route path (absolute or relative).
  params: Record<string, string> | ((prev) => Record<string, string>)
  search: Record<string, unknown> | ((prev) => Record<string, unknown>)
  hash?: string | ((prev: string) => string)
  state?: Record<string, unknown> | ((prev) => Record<string, unknown>)
}
```

### NavigateOptions (extends ToOptions)

```ts
type NavigateOptions = ToOptions & {
  replace?: boolean           // Replace current history entry.
  resetScroll?: boolean       // Reset scroll to 0,0.
  viewTransition?: boolean    // Use document.startViewTransition().
  reloadDocument?: boolean    // Full page load instead of SPA navigation.
}
```

### LinkOptions (extends NavigateOptions)

```ts
type LinkOptions = NavigateOptions & {
  target?: string
  activeOptions?: {
    exact?: boolean          // Default: false.
    includeHash?: boolean    // Default: false.
    includeSearch?: boolean  // Default: true.
  }
  preload?: false | 'intent'
  preloadDelay?: number      // Default: 50ms.
  disabled?: boolean
}
```

### Link Active/Inactive Props

```tsx
<Link
  to="/about"
  activeProps={{ className: 'font-bold text-blue-600' }}
  inactiveProps={{ className: 'text-gray-500' }}
>
  About
</Link>
```

The `data-status` attribute is set to `"active"` on active links for CSS styling.

### Link Children Function (isActive)

```tsx
<Link to="/posts">
  {({ isActive }) => (
    <span className={isActive ? 'font-bold' : ''}>Posts</span>
  )}
</Link>
```

### useNavigate Hook

```tsx
const navigate = useNavigate({ from: '/posts/$postId' })

// After successful action.
navigate({ to: '/posts', search: { page: 1 } })

// Replace history entry.
navigate({ to: '/login', replace: true })
```

### Navigate Component (Immediate Redirect)

```tsx
function Component() {
  return <Navigate to="/dashboard" />
}
```

### useMatchRoute Hook

```tsx
const matchRoute = useMatchRoute()

// Check if route is matched.
if (matchRoute({ to: '/users' })) { /* matched */ }

// Check if route is pending (transitioning to).
if (matchRoute({ to: '/users', pending: true })) { /* pending */ }
```

## Search Params - Advanced Patterns

### Standard Schema Support (No Adapter Needed)

Libraries implementing Standard Schema (Valibot, ArkType, Effect/Schema) work directly:

```tsx
// Valibot
import * as v from 'valibot'

const searchSchema = v.object({
  page: v.optional(v.fallback(v.number(), 1), 1),
  filter: v.optional(v.fallback(v.string(), ''), ''),
})

export const Route = createFileRoute('/products')({
  validateSearch: searchSchema,
})
```

```tsx
// ArkType
import { type } from 'arktype'

const searchSchema = type({
  page: 'number = 1',
  filter: 'string = ""',
  sort: '"newest" | "oldest" | "price" = "newest"',
})

export const Route = createFileRoute('/products')({
  validateSearch: searchSchema,
})
```

### Zod Adapter Details

```tsx
import { zodValidator, fallback } from '@tanstack/zod-adapter'
import { z } from 'zod'

const searchSchema = z.object({
  page: fallback(z.number(), 1).default(1),
  filter: fallback(z.string(), '').default(''),
  sort: fallback(z.enum(['newest', 'oldest', 'price']), 'newest').default('newest'),
})

export const Route = createFileRoute('/products')({
  // zodValidator pipes correct input/output types.
  validateSearch: zodValidator(searchSchema),
})
```

Key points:
- Use `fallback()` from `@tanstack/zod-adapter` (not `.catch()`) to retain types.
- `.default()` makes the search param optional when navigating.
- Without adapter, `validateSearch: schema` works but `.default()` still requires search.

### Search Param Inheritance

Child routes inherit parent search params and types:

```tsx
// shop.products.tsx
export const Route = createFileRoute('/shop/products')({
  validateSearch: productSearchSchema,
})

// shop.products.$productId.tsx
export const Route = createFileRoute('/shop/products/$productId')({
  beforeLoad: ({ search }) => {
    // search has ProductSearch type from parent.
  },
})
```

### Search Middlewares

**retainSearchParams** - Keep specific params across navigations:

```tsx
import { retainSearchParams } from '@tanstack/react-router'

export const Route = createRootRoute({
  validateSearch: zodValidator(searchSchema),
  search: {
    middlewares: [retainSearchParams(['rootValue'])],
  },
})
```

**stripSearchParams** - Remove params when they match defaults:

```tsx
import { stripSearchParams } from '@tanstack/react-router'

const defaultValues = { sort: 'newest', page: 1 }

export const Route = createFileRoute('/products')({
  validateSearch: zodValidator(searchSchema),
  search: {
    middlewares: [stripSearchParams(defaultValues)],
  },
})
```

Middlewares can be chained:

```tsx
search: {
  middlewares: [
    retainSearchParams(['retainMe']),
    stripSearchParams({ arrayWithDefaults: defaultValues }),
  ],
},
```

## Data Loading - Advanced

### Stale-While-Revalidate Configuration

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  staleTime: 10_000,          // Fresh for 10 seconds.
  gcTime: 5 * 60 * 1000,      // Garbage collect after 5 minutes.
  shouldReload: false,         // Only reload on entry or deps change.
})
```

Disable caching entirely:

```tsx
staleTime: Infinity
```

Router-wide defaults:

```tsx
const router = createRouter({
  routeTree,
  defaultStaleTime: Infinity,
  defaultPreloadStaleTime: 0,
})
```

### loaderDeps Best Practice

Only include deps you actually use in the loader:

```tsx
// Don't do this — causes unnecessary cache invalidation.
loaderDeps: ({ search }) => search,

// Do this — only reload when used params change.
loaderDeps: ({ search }) => ({ page: search.page, limit: search.limit }),
```

### beforeLoad (Middleware-like)

Runs before loader and child routes. Use for auth, context injection, redirects:

```tsx
export const Route = createFileRoute('/posts')({
  beforeLoad: ({ context, location }) => {
    // Inject additional context.
    return { fetchPosts: () => fetch('/api/posts') }
  },
  loader: ({ context: { fetchPosts } }) => fetchPosts(),
})
```

### Abort Signal

```tsx
export const Route = createFileRoute('/posts')({
  loader: ({ abortController }) =>
    fetchPosts({ signal: abortController.signal }),
})
```

### Pending Component

Default shows after 1 second (`pendingMs`), minimum display 500ms (`pendingMinMs`):

```tsx
export const Route = createFileRoute('/posts')({
  loader: () => fetchPosts(),
  pendingComponent: () => <Spinner />,
  pendingMs: 500,
  pendingMinMs: 200,
})
```

## Authenticated Routes - Patterns

### Pathless Layout Guard

```tsx
// _authenticated.tsx
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  component: () => <Outlet />,
})

// _authenticated/dashboard.tsx → /dashboard (guarded).
// _authenticated/settings.tsx  → /settings (guarded).
```

### Error-Safe Auth Check

```tsx
import { redirect, isRedirect } from '@tanstack/react-router'

beforeLoad: async ({ location }) => {
  try {
    const user = await verifySession()
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { user }
  } catch (error) {
    if (isRedirect(error)) throw error
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
},
```

### Non-Redirect Auth (Inline Login)

```tsx
export const Route = createFileRoute('/_authenticated')({
  component: () => {
    if (!isAuthenticated()) return <LoginForm />
    return <Outlet />
  },
})
```

### Post-Login Redirect

```tsx
// After successful login.
router.history.push(search.redirect)
```

## Router Context

### Root Context with Types

```tsx
// __root.tsx
import { createRootRouteWithContext } from '@tanstack/react-router'

interface RouterContext {
  auth: AuthState
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})
```

### Providing Context

```tsx
// router.tsx
const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,      // Provided at render time.
    queryClient,
  },
})

// App.tsx
function InnerApp() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ auth }} />
}
```

## Code Splitting

### Auto Code Splitting (Recommended)

Enable in Vite config:

```ts
tanstackRouter({ target: 'react', autoCodeSplitting: true })
```

Splits automatically:
- **Critical** (not split): loader, beforeLoad, validateSearch, context, path parsing.
- **Non-critical** (split): component, errorComponent, pendingComponent, notFoundComponent.

### Manual with .lazy.tsx

```tsx
// posts.tsx — critical config.
export const Route = createFileRoute('/posts')({ loader: fetchPosts })

// posts.lazy.tsx — non-critical (component).
import { createLazyFileRoute } from '@tanstack/react-router'
export const Route = createLazyFileRoute('/posts')({ component: Posts })
```

### getRouteApi (Avoid Circular Imports)

```tsx
import { getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/posts')

function Posts() {
  const data = routeApi.useLoaderData()
  const search = routeApi.useSearch()
  const params = routeApi.useParams()
}
```

## TanStack Start - Server Functions

### createServerFn

```tsx
import { createServerFn } from '@tanstack/react-start'

// GET (default).
export const getData = createServerFn().handler(async () => {
  return { message: 'Hello from server!' }
})

// POST with validation.
export const createItem = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ name: z.string(), value: z.number() }))
  .handler(async ({ data }) => {
    return db.insert(items).values(data).returning()
  })
```

### Calling Server Functions

```tsx
// In route loader.
export const Route = createFileRoute('/items')({
  loader: () => getData(),
})

// In component with useServerFn.
import { useServerFn } from '@tanstack/react-start'

function Component() {
  const createItem = useServerFn(createItemFn)
  const handleSubmit = async () => {
    await createItem({ data: { name: 'New', value: 42 } })
  }
}
```

### Server Function Error Handling

```tsx
import { redirect, notFound } from '@tanstack/react-router'

export const getPost = createServerFn()
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const post = await db.findPost(data.id)
    if (!post) throw notFound()
    return post
  })

export const requireAuth = createServerFn().handler(async () => {
  const user = await getCurrentUser()
  if (!user) throw redirect({ to: '/login' })
  return user
})
```

### Server Request/Response Utilities

```tsx
import {
  getRequest,
  getRequestHeader,
  setResponseHeaders,
  setResponseStatus,
} from '@tanstack/react-start/server'

export const getCachedData = createServerFn({ method: 'GET' }).handler(async () => {
  const authHeader = getRequestHeader('Authorization')

  setResponseHeaders(new Headers({
    'Cache-Control': 'public, max-age=300',
  }))

  return fetchData()
})
```

### File Organization for Server Functions

```
src/utils/
├── users.functions.ts   # createServerFn wrappers (safe to import anywhere).
├── users.server.ts      # Server-only helpers (DB queries, internal logic).
└── schemas.ts           # Shared validation schemas (client-safe).
```

## TanStack Start - Vite Config

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  plugins: [
    tanstackStart(),
    react(),
  ],
})
```

## VSCode Settings for Route Tree

Recommended `.vscode/settings.json` to handle the generated `routeTree.gen.ts`:

```json
{
  "files.readonlyInclude": {
    "**/routeTree.gen.ts": true
  },
  "files.watcherExclude": {
    "**/routeTree.gen.ts": true
  },
  "search.exclude": {
    "**/routeTree.gen.ts": true
  }
}
```

## ESLint Plugin

```sh
npm install -D @tanstack/eslint-plugin-router
```

Provides rules like `create-route-property-order` to enforce consistent route option ordering.

## Integration with TanStack Query

For external data loading with TanStack Query, set `defaultPreloadStaleTime: 0`:

```tsx
const router = createRouter({
  routeTree,
  defaultPreloadStaleTime: 0,
  context: { queryClient },
})
```

This ensures every preload/load event triggers your loader, letting TanStack Query handle deduplication and caching.

```tsx
// posts.tsx
import { queryOptions } from '@tanstack/react-query'

const postsQueryOptions = queryOptions({
  queryKey: ['posts'],
  queryFn: fetchPosts,
})

export const Route = createFileRoute('/posts')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(postsQueryOptions()),
})
```

## Not Found Handling

```tsx
import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => {
    const post = await fetchPost(postId)
    if (!post) throw notFound()
    return post
  },
  notFoundComponent: () => <div>Post not found</div>,
})
```

## Scroll Restoration

```tsx
import { ScrollRestoration } from '@tanstack/react-router'

// In root route component.
function RootComponent() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  )
}
```

## Preloading

Configure globally or per-route:

```tsx
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',   // Preload on hover/touch.
  defaultPreloadDelay: 100,
})
```

Or per-link:

```tsx
<Link to="/posts" preload="intent" preloadDelay={50}>Posts</Link>
```
