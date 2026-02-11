# TanStack Start - Reference

## Global Middleware

Global middleware runs automatically for every request. Configure in `src/start.ts`.

### Global Request Middleware

Runs before every request (SSR, server routes, server functions):

```tsx
// src/start.ts
import { createStart, createMiddleware } from '@tanstack/react-start'

const globalLogging = createMiddleware().server(async ({ next, request }) => {
  console.log(`[${request.method}] ${request.url}`)
  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [globalLogging],
}))
```

### Global Server Function Middleware

Runs before every server function:

```tsx
// src/start.ts
import { createStart } from '@tanstack/react-start'
import { authMiddleware } from './middleware'

export const startInstance = createStart(() => ({
  functionMiddleware: [authMiddleware],
}))
```

### Execution Order

Middleware executes dependency-first: global middleware -> function-specific middleware -> handler.

## Middleware Composition

Middleware can depend on other middleware:

```tsx
const loggingMiddleware = createMiddleware().server(async ({ next }) => {
  console.log('log')
  return next()
})

const authMiddleware = createMiddleware()
  .middleware([loggingMiddleware])
  .server(async ({ next }) => {
    const user = await getUser()
    return next({ context: { user } })
  })
```

## Middleware Context Patterns

### Server-to-Server Context

Pass data between middleware on the server via `next({ context })`:

```tsx
const timingMiddleware = createMiddleware().server(async ({ next }) => {
  return next({ context: { requestStart: Date.now() } })
})

const fn = createServerFn()
  .middleware([timingMiddleware])
  .handler(async ({ context }) => {
    console.log('Started at:', context.requestStart)
  })
```

### Client-to-Server Context

Client context is NOT sent to the server by default. Use `sendContext` explicitly:

```tsx
const workspaceMiddleware = createMiddleware({ type: 'function' })
  .client(async ({ next, context }) => {
    return next({
      sendContext: { workspaceId: context.workspaceId },
    })
  })
  .server(async ({ next, context }) => {
    console.log('Workspace:', context.workspaceId)
    return next()
  })
```

Validate dynamic client-sent context on the server for security.

### Server-to-Client Context

Send data from server back to client middleware via `sendContext`:

```tsx
const serverTimer = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    return next({
      sendContext: { serverTime: new Date().toISOString() },
    })
  },
)

const clientLogger = createMiddleware({ type: 'function' })
  .middleware([serverTimer])
  .client(async ({ next }) => {
    const result = await next()
    console.log('Server time:', result.context.serverTime)
    return result
  })
```

## Server Function Middleware with Input Validation

```tsx
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'

const workspaceMiddleware = createMiddleware({ type: 'function' })
  .inputValidator(zodValidator(z.object({ workspaceId: z.string() })))
  .server(async ({ next, data }) => {
    console.log('Workspace:', data.workspaceId)
    return next()
  })
```

## Custom Client Headers

Add headers to outgoing server function requests from client middleware:

```tsx
const authMiddleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    return next({
      headers: { Authorization: `Bearer ${getToken()}` },
    })
  },
)
```

Header precedence (later overrides earlier):
1. Earlier middleware headers
2. Later middleware headers
3. Call-site headers

## Custom Fetch Implementation

Override the fetch used for server function RPC calls:

```tsx
import type { CustomFetch } from '@tanstack/react-start'

const retryMiddleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const customFetch: CustomFetch = async (url, init) => {
      let response = await fetch(url, init)
      if (!response.ok) {
        response = await fetch(url, init) // Simple retry.
      }
      return response
    }
    return next({ fetch: customFetch })
  },
)
```

Fetch precedence: call-site > later middleware > earlier middleware > `createStart` global > default `fetch`.

## Server Routes - Advanced

### Mixed App + API Route

Same file can serve both a UI component and API handlers:

```tsx
export const Route = createFileRoute('/hello')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        return Response.json({ message: `Hello, ${body.name}!` })
      },
    },
  },
  component: HelloComponent,
})
```

### Dynamic Path Params

```ts
// src/routes/users/$id.ts
export const Route = createFileRoute('/users/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => Response.json({ userId: params.id }),
    },
  },
})
```

### Wildcard Params

```ts
// src/routes/file/$.ts
export const Route = createFileRoute('/file/$')({
  server: {
    handlers: {
      GET: async ({ params }) => new Response(`File: ${params._splat}`),
    },
  },
})
```

### Escaped Matching

File named `routes/data[.]json.ts` creates route at `/data.json`.

### Pathless Layout Middleware

Pathless layout routes (`_prefix`) can add middleware to a group of server routes, same as with app routes.

## Server Request/Response Utilities

All available from `@tanstack/react-start/server`:

| Utility | Description |
|---------|-------------|
| `getRequest()` | Access the full Request object. |
| `getRequestHeader(name)` | Read a specific request header. |
| `getRequestHeaders()` | Read all request headers. |
| `setResponseHeader(name, value)` | Set a single response header. |
| `setResponseHeaders(headers)` | Set multiple response headers via Headers object. |
| `setResponseStatus(code)` | Set the HTTP status code. |

## Environment Variables - Advanced

### File Load Order

```
.env.local         # Local overrides (gitignored).
.env.production    # Production-specific.
.env.development   # Development-specific.
.env               # Default (committed).
```

### Runtime Client Variables

`VITE_` variables are replaced at build time. For runtime variables on the client, pass from server:

```tsx
const getConfig = createServerFn({ method: 'GET' }).handler(() => {
  return { apiUrl: process.env.RUNTIME_API_URL }
})

export const Route = createFileRoute('/')({
  loader: () => getConfig(),
  component: () => {
    const { apiUrl } = Route.useLoaderData()
    return <div>{apiUrl}</div>
  },
})
```

### Runtime Validation with Zod

```ts
// src/config/env.ts
import { z } from 'zod'

export const serverEnv = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
}).parse(process.env)

export const clientEnv = z.object({
  VITE_APP_NAME: z.string(),
  VITE_API_URL: z.string().url(),
}).parse(import.meta.env)
```

## Static Prerendering

Generate HTML at build time for static routes:

```ts
// vite.config.ts
tanstackStart({
  prerender: {
    enabled: true,
    crawlLinks: true,
  },
  sitemap: {
    enabled: true,
    host: 'https://myapp.com',
  },
})
```

## SEO - Additional Patterns

### Canonical URLs

```tsx
export const Route = createFileRoute('/posts/$postId')({
  head: ({ params }) => ({
    links: [{ rel: 'canonical', href: `https://myapp.com/posts/${params.postId}` }],
  }),
})
```

### Open Graph + Twitter Cards

```tsx
head: ({ loaderData }) => ({
  meta: [
    { title: loaderData.title },
    { name: 'description', content: loaderData.excerpt },
    { property: 'og:title', content: loaderData.title },
    { property: 'og:description', content: loaderData.excerpt },
    { property: 'og:image', content: loaderData.coverImage },
    { property: 'og:type', content: 'article' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: loaderData.title },
    { name: 'twitter:image', content: loaderData.coverImage },
  ],
})
```

### Dynamic robots.txt

```ts
// src/routes/robots[.]txt.ts
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async () => new Response(
        `User-agent: *\nAllow: /\nSitemap: https://myapp.com/sitemap.xml`,
        { headers: { 'Content-Type': 'text/plain' } },
      ),
    },
  },
})
```

## Vite Plugin Options

```ts
tanstackStart({
  // Router options passed to TanStack Router plugin.
  router: {
    semicolons: true,
    autoCodeSplitting: true,
  },
  // Static prerendering.
  prerender: { enabled: false },
  // Sitemap generation.
  sitemap: { enabled: false, host: '' },
  // Server build options.
  server: {
    build: {
      // Replace process.env.NODE_ENV at build time (default: true).
      staticNodeEnv: true,
    },
  },
  // Custom server function ID generation.
  serverFns: {
    generateFunctionId: ({ filename, functionName }) => {
      return customHash(`${filename}--${functionName}`)
    },
  },
})
```

## Tree-Shaking & Code Boundaries

- Server function handler code is stripped from client bundles automatically.
- Static imports of server functions in client files are safe.
- Avoid dynamic imports for server functions (`await import(...)` can cause bundler issues).
- Middleware `.server()` code is removed from client bundles.
- Middleware `.client()` code is removed from server bundles.
- `inputValidator` code is removed from client bundles.
