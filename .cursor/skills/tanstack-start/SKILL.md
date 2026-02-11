---
name: tanstack-start
description: Build full-stack React apps with TanStack Start (RC). Covers SSR, server functions, middleware, server routes, API endpoints, environment variables, SEO, and Vite configuration. Use when working with createServerFn, createMiddleware, server routes, SSR head management, or any TanStack Start server-side feature. For routing, search params, and data loading, see the tanstack-router skill instead.
---

# TanStack Start

Full-stack React framework built on TanStack Router. Adds SSR, streaming, server functions, middleware, server routes, and universal deployment via Vite + Nitro.

- **Package**: `@tanstack/react-start` (RC)
- **Requires**: TanStack Router v1, Vite, React 18+
- **Server**: Nitro (configurable)

## Vite Setup

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tanstackStart({
      router: { semicolons: true },
    }),
    // React plugin must come AFTER Start plugin.
    viteReact(),
  ],
})
```

## SSR & Document Head

SSR is enabled by default. Use `head()` on routes for meta tags, `HeadContent` in root for rendering, and `Scripts` for hydration.

### Root Route Shell

```tsx
// src/routes/__root.tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

### Dynamic Head with Loader Data

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: ({ params }) => fetchPost(params.postId),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData.title },
      { name: 'description', content: loaderData.excerpt },
      { property: 'og:title', content: loaderData.title },
      { property: 'og:image', content: loaderData.coverImage },
    ],
  }),
})
```

### Selective SSR

Disable SSR for routes that do not need indexing:

```tsx
export const Route = createFileRoute('/dashboard')({
  ssr: false,
  component: DashboardPage,
})
```

## Server Functions

Type-safe RPCs that run only on the server but can be called from anywhere.

```tsx
import { createServerFn } from '@tanstack/react-start'

// GET (default method).
export const getPosts = createServerFn().handler(async () => {
  return db.query.posts.findMany()
})

// POST with Zod validation.
export const createPost = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ title: z.string().min(1), body: z.string() }))
  .handler(async ({ data }) => {
    return db.insert(posts).values(data).returning()
  })
```

### Calling Server Functions

```tsx
// In route loader.
export const Route = createFileRoute('/posts')({
  loader: () => getPosts(),
})

// In component with useServerFn.
import { useServerFn } from '@tanstack/react-start'

function CreateButton() {
  const create = useServerFn(createPost)
  return <button onClick={() => create({ data: { title: 'New', body: '...' } })}>Create</button>
}
```

### Error Handling & Redirects

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
  getRequestHeaders,
  setResponseHeaders,
  setResponseStatus,
} from '@tanstack/react-start/server'

export const getCachedData = createServerFn({ method: 'GET' }).handler(async () => {
  const authHeader = getRequestHeader('Authorization')
  setResponseHeaders(new Headers({ 'Cache-Control': 'public, max-age=300' }))
  return fetchData()
})
```

### File Organization

```
src/utils/
├── users.functions.ts   # createServerFn wrappers (safe to import anywhere).
├── users.server.ts      # Server-only helpers (DB queries, internal logic).
└── schemas.ts           # Shared validation schemas (client-safe).
```

Static imports of server functions are safe in client files — the build replaces implementations with RPC stubs.

## Middleware

Two types: **request middleware** (all server requests) and **server function middleware** (server functions only, supports `.client()` and `.inputValidator()`).

### Request Middleware

```tsx
import { createMiddleware } from '@tanstack/react-start'

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session) throw redirect({ to: '/login' })
  return await next()
})
```

### Attaching Middleware to Routes

```tsx
export const Route = createFileRoute('/_protected')({
  server: {
    middleware: [authMiddleware],
  },
  component: () => <Outlet />,
})
```

### Server Function Middleware

```tsx
const loggingMiddleware = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    console.log('Before RPC')
    const result = await next()
    console.log('After RPC')
    return result
  })
  .server(async ({ next }) => {
    const start = Date.now()
    const result = await next()
    console.log(`Handler took ${Date.now() - start}ms`)
    return result
  })

// Attach to a server function.
const fn = createServerFn()
  .middleware([loggingMiddleware])
  .handler(async () => ({ ok: true }))
```

### Context Passing

Pass data between middleware via `next({ context })`:

```tsx
const authMiddleware = createMiddleware().server(async ({ next }) => {
  const user = await getUser()
  return next({ context: { user } })
})

const fn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    console.log(context.user)
  })
```

For detailed middleware patterns (global middleware, client context, custom fetch, composition), see [reference.md](reference.md).

## Server Routes (API Endpoints)

Define API endpoints alongside app routes using `server.handlers`:

```ts
// src/routes/api/hello.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return Response.json({ message: 'Hello!' })
      },
      POST: async ({ request }) => {
        const body = await request.json()
        return Response.json({ received: body })
      },
    },
  },
})
```

### Wildcard/Splat Routes

```ts
// src/routes/api/auth/$.ts — handles /api/auth/*
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => auth.handler(request),
      POST: async ({ request }) => auth.handler(request),
    },
  },
})
```

### Handler Context

Each handler receives `{ request, params, context }`. Return a `Response` object.

### Per-Handler Middleware

```tsx
export const Route = createFileRoute('/api/data')({
  server: {
    middleware: [authMiddleware],
    handlers: ({ createHandlers }) =>
      createHandlers({
        GET: async ({ request }) => Response.json({ data: [] }),
        POST: {
          middleware: [validationMiddleware],
          handler: async ({ request }) => {
            const body = await request.json()
            return Response.json({ created: body })
          },
        },
      }),
  },
})
```

## Environment Variables

| Context | Access | Prefix required |
|---------|--------|-----------------|
| Server functions / API routes | `process.env.VAR_NAME` | None |
| Client components | `import.meta.env.VITE_VAR` | `VITE_` |

`.env` files are loaded automatically. Never expose secrets via `VITE_` prefix.

### Type Safety

```ts
// src/env.d.ts
interface ImportMetaEnv {
  readonly VITE_APP_NAME: string
  readonly VITE_API_URL: string
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL: string
      readonly JWT_SECRET: string
    }
  }
}
export {}
```

## SEO

### Structured Data (JSON-LD)

```tsx
export const Route = createFileRoute('/posts/$postId')({
  head: ({ loaderData }) => ({
    scripts: [{
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: loaderData.title,
      }),
    }],
  }),
})
```

### Dynamic Sitemap via Server Route

```ts
// src/routes/sitemap[.]xml.ts
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const posts = await fetchAllPosts()
        const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          ${posts.map((p) => `<url><loc>https://example.com/posts/${p.id}</loc></url>`).join('')}
        </urlset>`
        return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
      },
    },
  },
})
```

## Additional Resources

- For detailed middleware patterns, global middleware, and advanced server route configuration, see [reference.md](reference.md).
- [TanStack Start Docs](https://tanstack.com/start/latest/docs)
