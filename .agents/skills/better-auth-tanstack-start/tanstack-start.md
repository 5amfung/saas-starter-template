## TanStack Start integration

### Mount the Better Auth handler (server route)

Create a splat server route so Better Auth can handle its endpoints:

- File: `src/routes/api/auth/$.ts`
- Route: `/api/auth/$`
- Forward `GET` and `POST` to `auth.handler(request)`

```ts
import { createFileRoute } from "@tanstack/react-router"
import { auth } from "@/auth/auth.server"

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return await auth.handler(request)
      },
      POST: async ({ request }: { request: Request }) => {
        return await auth.handler(request)
      },
    },
  },
})
```

### Server-side session helper (server function)

Use request headers to retrieve the session server-side:

```ts
import { createServerFn } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { auth } from "@/auth/auth.server"

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders()
  return await auth.api.getSession({ headers })
})
```

### Route protection (middleware)

In TanStack Start request middleware:

```ts
import { redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"
import { auth } from "@/auth/auth.server"

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session) throw redirect({ to: "/signin" })
  return await next()
})
```

Attach it to a protected layout route:

```ts
export const Route = createFileRoute("/_protected")({
  server: {
    middleware: [authMiddleware],
  },
  component: () => <Outlet />,
})
```

### Cookie handling

If you’re using TanStack Start, include `tanstackStartCookies()` as the **last** Better Auth plugin so cookie setting works automatically when calling auth APIs that set cookies (sign-in, sign-up, etc.).
