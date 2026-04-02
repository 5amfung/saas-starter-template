# Design: Add Standalone Hono API in `apps/api-server`

**Date:** 2026-04-01
**Status:** Approved

## Problem

The monorepo currently has frontend applications in `apps/web` and `apps/admin`, but no dedicated API workspace. That makes it harder to add server-only endpoints, middleware, and deployment concerns without coupling them to an existing UI app.

## Goal

Add a new standalone Hono server in `apps/api-server` with a single `GET /hello` endpoint for smoke testing. The new app should follow the monorepo's workspace conventions, include essential HTTP middlewares, and be runnable, type-checkable, and lintable as a first-class app.

---

## Scope

### Included

- Create a new workspace app at `apps/api-server`.
- Use Hono with the Node server adapter.
- Expose `GET /hello` that returns JSON confirming the server is up.
- Add essential middleware for:
  - request logging
  - request ID propagation
  - error handling
  - not-found handling
  - CORS
  - secure headers
  - body size limiting
- Add app-local scripts for development, build, start, lint, and typecheck.
- Register the app cleanly in the Turborepo workflow.

### Excluded

- Authentication and authorization.
- Database access.
- Shared API packages or domain modules.
- Additional routes beyond `/hello`.
- Deployment-specific infrastructure files.

---

## App Structure

```
apps/api-server/
├── package.json
├── tsconfig.json
├── eslint.config.js
└── src/
    ├── app.ts
    ├── index.ts
    ├── lib/
    │   └── env.ts
    ├── middleware/
    │   ├── error-handler.ts
    │   ├── request-id.ts
    │   └── request-logger.ts
    └── routes/
        └── hello.ts
```

### Responsibilities

| File                                               | Responsibility                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/api-server/src/app.ts`                       | Create the Hono app, register global middleware, mount routes, and attach not-found / error handling. |
| `apps/api-server/src/index.ts`                     | Start the Node HTTP server on the configured port.                                                    |
| `apps/api-server/src/routes/hello.ts`              | Define the `GET /hello` test endpoint.                                                                |
| `apps/api-server/src/lib/env.ts`                   | Parse and expose server environment values such as port and CORS origin.                              |
| `apps/api-server/src/middleware/request-id.ts`     | Ensure each request has a stable request ID attached to the context and response headers.             |
| `apps/api-server/src/middleware/request-logger.ts` | Log request/response metadata, including request ID and duration.                                     |
| `apps/api-server/src/middleware/error-handler.ts`  | Normalize thrown errors into JSON responses for API consumers.                                        |

---

## Middleware Design

The server should start with a minimal but production-shaped middleware stack:

1. **Request ID middleware**
   - Read `x-request-id` from the incoming request when present.
   - Generate a UUID when absent.
   - Store the ID on the Hono context and echo it in the response header.

2. **Request logging middleware**
   - Measure request duration.
   - Log method, path, status code, duration, and request ID.
   - Use lightweight console logging for now to avoid prematurely designing a shared logger contract.

3. **CORS middleware**
   - Allow a configurable origin, defaulting to permissive local development behavior.
   - Support common methods needed for future API expansion.

4. **Secure headers middleware**
   - Apply standard security-oriented response headers using Hono middleware.
   - Keep the defaults unless a concrete app need requires tuning.

5. **Body limit middleware**
   - Reject oversized payloads early.
   - Even though `/hello` is a `GET`, this establishes a safe default for future endpoints.

6. **JSON error handler**
   - Catch unhandled exceptions.
   - Return a stable JSON shape with an HTTP status and request ID.
   - Avoid leaking stack traces in production mode.

7. **JSON not-found handler**
   - Return a consistent 404 JSON payload for unknown routes.

### Middleware Order

The middleware order matters:

1. request ID
2. request logger
3. CORS
4. secure headers
5. body limit
6. routes
7. not-found / error handlers

This ordering ensures the request ID is available to logs and error responses, while global HTTP protections apply before route execution.

---

## Route Design

### `GET /hello`

Purpose: prove the server starts correctly and returns JSON through the full middleware stack.

Expected response:

```json
{
  "message": "Hello from the API",
  "requestId": "generated-or-forwarded-request-id"
}
```

This route intentionally stays simple. It should not depend on the database, auth, or shared business logic. Its only job is to verify that the standalone app is wired correctly.

---

## Runtime and Scripts

`apps/api-server` should be a workspace package with scripts aligned to the existing apps, adapted for a server-only runtime:

- `dev`: run the TypeScript server in watch mode.
- `build`: compile TypeScript into a distributable output directory.
- `start`: run the built server.
- `lint`: run ESLint for the app.
- `typecheck`: run `tsc --noEmit`.
- `check`: run lint plus typecheck.

The root `package.json` should also gain an API-focused development entry so the new app can be started consistently from the repo root.

---

## TypeScript and Tooling

- `apps/api-server/tsconfig.json` should extend the root TypeScript config like the other apps.
- Because this is a server-only app, the config should use Node-oriented libs and types rather than DOM-oriented ones.
- Linting should follow the repo's ESLint conventions instead of introducing a one-off toolchain.
- The implementation should avoid Vite unless a concrete requirement emerges; a plain TypeScript + Node server is enough for this app.

---

## Error Handling Contract

All API errors should return JSON. A simple stable shape is enough for the initial app:

```json
{
  "error": {
    "message": "Not Found"
  },
  "requestId": "generated-or-forwarded-request-id"
}
```

For the first version:

- 404 responses use `Not Found`.
- unexpected 500 responses use a generic message in production.
- local development may include additional error detail if helpful, but the structure remains consistent.

---

## Verification Plan

The implementation must prove all of the following:

1. `apps/api-server` is recognized as a workspace app.
2. TypeScript succeeds for the new app.
3. ESLint succeeds for the new app.
4. The server boots locally.
5. `GET /hello` returns the expected JSON response.
6. The response includes the request ID header and payload field.
7. Unknown routes return the JSON 404 contract.

Verification commands are expected to include app-local checks plus at least one end-to-end smoke request against the running server.

---

## Tradeoffs

### Why standalone instead of mounting into `apps/web`

A standalone app keeps API runtime concerns isolated from the TanStack Start app. That gives cleaner boundaries for middleware, deployment, and future scaling at the cost of managing one more process in development.

### Why custom lightweight logging instead of a shared logging package

The repo already has shared logging utilities, but this first API route does not need a cross-package logging abstraction. Starting with a small local middleware keeps the blast radius small, and the app can later switch to shared logging once real API usage shapes the requirements.

### Why route and middleware files for a single endpoint

Creating route and middleware boundaries now is slightly more code up front, but it prevents `src/index.ts` or `src/app.ts` from becoming a dumping ground as soon as the second endpoint appears.
