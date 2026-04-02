# Appfolio API Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone Hono server in `apps/api-server` with essential middleware and a `GET /hello` smoke-test endpoint.

**Architecture:** Create a new workspace app that exports a composed Hono `app` from `src/app.ts` and boots a Node server from `src/index.ts`. Keep middleware concerns isolated in small files, test the app in-process with Vitest using `app.request()`, and wire root scripts only after the app behavior is proven.

**Tech Stack:** pnpm workspaces, Turborepo, TypeScript, Hono, `@hono/node-server`, Vitest, ESLint flat config.

---

## File Structure

### Create

- `apps/api-server/package.json`
- `apps/api-server/tsconfig.json`
- `apps/api-server/tsconfig.build.json`
- `apps/api-server/eslint.config.js`
- `apps/api-server/src/app.ts`
- `apps/api-server/src/index.ts`
- `apps/api-server/src/lib/env.ts`
- `apps/api-server/src/lib/request-id.ts`
- `apps/api-server/src/middleware/request-id.ts`
- `apps/api-server/src/middleware/request-logger.ts`
- `apps/api-server/src/middleware/error-handler.ts`
- `apps/api-server/src/routes/hello.ts`
- `apps/api-server/test/unit/app.test.ts`

### Modify

- `package.json`

### Responsibility Notes

- `src/app.ts` owns middleware registration order, route mounting, and JSON not-found / error behavior.
- `src/index.ts` is only the runtime bootstrap for Node.
- `src/lib/env.ts` centralizes `PORT`, `API_NAME`, and allowed CORS origin defaults.
- `src/lib/request-id.ts` keeps ID generation / normalization pure so route and middleware tests do not depend on `crypto` calls directly.
- `test/unit/app.test.ts` is the regression net for `/hello`, request ID forwarding, and 404 JSON handling.

---

### Task 1: Scaffold The Workspace And Write The First Failing App Test

**Files:**

- Create: `apps/api-server/package.json`
- Create: `apps/api-server/tsconfig.json`
- Create: `apps/api-server/tsconfig.build.json`
- Create: `apps/api-server/eslint.config.js`
- Create: `apps/api-server/test/unit/app.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the workspace package metadata and root scripts**

Create `apps/api-server/package.json`:

```json
{
  "name": "@workspace/api-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:unit": "vitest run --dir test/unit",
    "lint": "eslint",
    "lint:fix": "eslint --fix",
    "typecheck": "tsc --noEmit",
    "check": "tsc --noEmit && eslint"
  },
  "dependencies": {
    "@hono/node-server": "^1.19.11",
    "hono": "^4.12.8"
  },
  "devDependencies": {
    "@types/node": "^25.2.2",
    "@workspace/eslint-config": "workspace:*",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```

Update the root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "turbo run dev dev:stripe-webhook --filter @workspace/web --filter @workspace/admin-web --filter @workspace/api-server",
    "api:dev": "pnpm --filter @workspace/api-server dev"
  }
}
```

- [ ] **Step 2: Add server-only TypeScript and ESLint config**

Create `apps/api-server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src/**/*.ts", "test/**/*.ts", "eslint.config.js"],
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node", "vitest/globals"],
    "noEmit": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Create `apps/api-server/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "noEmit": false
  }
}
```

Create `apps/api-server/eslint.config.js`:

```js
// @ts-check

import config from '@workspace/eslint-config/base';

export default [
  {
    ignores: ['eslint.config.js', 'dist/**'],
  },
  ...config,
];
```

- [ ] **Step 3: Write the first failing test for `GET /hello`**

Create `apps/api-server/test/unit/app.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { app } from '../../src/app';

describe('appfolio api server', () => {
  it('returns hello payload and request id header', async () => {
    const response = await app.request('/hello');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(payload).toEqual({
      message: 'Hello from the API',
      requestId: expect.any(String),
    });
  });
});
```

- [ ] **Step 4: Run the test to verify RED**

Run:

```bash
pnpm --filter @workspace/api-server test:unit
```

Expected: FAIL because `apps/api-server/src/app.ts` does not exist yet.

- [ ] **Step 5: Commit the scaffolding and red test**

```bash
git add package.json apps/api-server/package.json apps/api-server/tsconfig.json apps/api-server/tsconfig.build.json apps/api-server/eslint.config.js apps/api-server/test/unit/app.test.ts
git commit -m "test(api-server): add initial hello route spec"
```

---

### Task 2: Implement The Hono App, Middleware, And Route To Turn The Test Green

**Files:**

- Create: `apps/api-server/src/app.ts`
- Create: `apps/api-server/src/lib/env.ts`
- Create: `apps/api-server/src/lib/request-id.ts`
- Create: `apps/api-server/src/middleware/request-id.ts`
- Create: `apps/api-server/src/middleware/request-logger.ts`
- Create: `apps/api-server/src/middleware/error-handler.ts`
- Create: `apps/api-server/src/routes/hello.ts`
- Modify: `apps/api-server/test/unit/app.test.ts`

- [ ] **Step 1: Expand the test to cover forwarded request IDs and JSON 404 responses**

Update `apps/api-server/test/unit/app.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { app } from '../../src/app';

describe('appfolio api server', () => {
  it('returns hello payload and request id header', async () => {
    const response = await app.request('/hello');
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(payload).toEqual({
      message: 'Hello from the API',
      requestId: expect.any(String),
    });
  });

  it('reuses a forwarded request id', async () => {
    const response = await app.request('/hello', {
      headers: {
        'x-request-id': 'req-from-client',
      },
    });
    const payload = await response.json();

    expect(response.headers.get('x-request-id')).toBe('req-from-client');
    expect(payload.requestId).toBe('req-from-client');
  });

  it('returns JSON for unknown routes', async () => {
    const response = await app.request('/missing');
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      error: {
        message: 'Not Found',
      },
      requestId: expect.any(String),
    });
  });
});
```

- [ ] **Step 2: Run the test to verify RED still reflects missing implementation**

Run:

```bash
pnpm --filter @workspace/api-server test:unit
```

Expected: FAIL because the app and middleware code is still missing.

- [ ] **Step 3: Add the smallest implementation that satisfies the tests**

Create `apps/api-server/src/lib/env.ts`:

```ts
const DEFAULT_PORT = 3002;
const DEFAULT_CORS_ORIGIN = '*';

export const env = {
  apiName: 'api-server',
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  corsOrigin: process.env.API_CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN,
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const;
```

Create `apps/api-server/src/lib/request-id.ts`:

```ts
import { randomUUID } from 'node:crypto';

export function resolveRequestId(headerValue: string | undefined): string {
  const trimmed = headerValue?.trim();

  return trimmed ? trimmed : randomUUID();
}
```

Create `apps/api-server/src/middleware/request-id.ts`:

```ts
import type { MiddlewareHandler } from 'hono';

import { resolveRequestId } from '../lib/request-id';

type RequestIdVariables = {
  requestId: string;
};

export const requestIdMiddleware: MiddlewareHandler<{
  Variables: RequestIdVariables;
}> = async (c, next) => {
  const requestId = resolveRequestId(c.req.header('x-request-id'));

  c.set('requestId', requestId);
  c.header('x-request-id', requestId);

  await next();
};
```

Create `apps/api-server/src/middleware/request-logger.ts`:

```ts
import type { MiddlewareHandler } from 'hono';

type RequestIdVariables = {
  requestId: string;
};

export const requestLoggerMiddleware: MiddlewareHandler<{
  Variables: RequestIdVariables;
}> = async (c, next) => {
  const startedAt = performance.now();

  await next();

  const durationMs = Math.round(performance.now() - startedAt);
  const requestId = c.get('requestId');

  console.info('[api-server]', {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs,
    requestId,
  });
};
```

Create `apps/api-server/src/middleware/error-handler.ts`:

```ts
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

type RequestIdVariables = {
  requestId: string;
};

export function buildErrorResponse(
  c: Context<{ Variables: RequestIdVariables }>,
  status: number,
  message: string
) {
  return c.json(
    {
      error: { message },
      requestId: c.get('requestId'),
    },
    status
  );
}

export function handleAppError(
  error: unknown,
  c: Context<{ Variables: RequestIdVariables }>
) {
  if (error instanceof HTTPException) {
    return buildErrorResponse(c, error.status, error.message);
  }

  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : 'Unexpected Error';

  console.error(error);

  return buildErrorResponse(c, 500, message);
}
```

Create `apps/api-server/src/routes/hello.ts`:

```ts
import { Hono } from 'hono';

type RequestIdVariables = {
  requestId: string;
};

export const helloRoute = new Hono<{ Variables: RequestIdVariables }>().get(
  '/hello',
  (c) => {
    return c.json({
      message: 'Hello from the API',
      requestId: c.get('requestId'),
    });
  }
);
```

Create `apps/api-server/src/app.ts`:

```ts
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { Hono } from 'hono';

import { env } from './lib/env';
import { handleAppError } from './middleware/error-handler';
import { requestIdMiddleware } from './middleware/request-id';
import { requestLoggerMiddleware } from './middleware/request-logger';
import { helloRoute } from './routes/hello';

type AppVariables = {
  requestId: string;
};

export const app = new Hono<{ Variables: AppVariables }>();

app.use('*', requestIdMiddleware);
app.use('*', requestLoggerMiddleware);
app.use(
  '*',
  cors({
    origin: env.corsOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  })
);
app.use('*', secureHeaders());
app.use('*', bodyLimit({ maxSize: 1024 * 1024 }));

app.route('/', helloRoute);

app.notFound((c) => {
  return c.json(
    {
      error: { message: 'Not Found' },
      requestId: c.get('requestId'),
    },
    404
  );
});

app.onError(handleAppError);
```

- [ ] **Step 4: Run the unit test to verify GREEN**

Run:

```bash
pnpm --filter @workspace/api-server test:unit
```

Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit the green app implementation**

```bash
git add apps/api-server/src apps/api-server/test/unit/app.test.ts
git commit -m "feat(api-server): add hello route and core middleware"
```

---

### Task 3: Add The Node Bootstrap And Workspace Verification Hooks

**Files:**

- Create: `apps/api-server/src/index.ts`
- Modify: `apps/api-server/src/app.ts`
- Modify: `apps/api-server/package.json`
- Modify: `package.json`

- [ ] **Step 1: Write a failing runtime smoke expectation**

Add this test to `apps/api-server/test/unit/app.test.ts`:

```ts
it('returns CORS and security headers on hello responses', async () => {
  const response = await app.request('/hello');

  expect(response.headers.get('access-control-allow-origin')).toBe('*');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
});
```

- [ ] **Step 2: Run the unit test to verify RED**

Run:

```bash
pnpm --filter @workspace/api-server test:unit
```

Expected: FAIL if the selected header values are not yet exposed the way the test expects.

- [ ] **Step 3: Add the Node server bootstrap and adjust middleware config as needed**

Create `apps/api-server/src/index.ts`:

```ts
import { serve } from '@hono/node-server';

import { app } from './app';
import { env } from './lib/env';

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.info(`[${env.apiName}] listening on http://localhost:${info.port}`);
  }
);
```

If the CORS test from Step 1 fails, adjust the `cors()` config in `src/app.ts` so the chosen default origin behavior is explicit and testable.

- [ ] **Step 4: Run app-local verification**

Run:

```bash
pnpm --filter @workspace/api-server test:unit
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/api-server lint
pnpm --filter @workspace/api-server build
```

Expected:

- `test:unit`: PASS
- `typecheck`: PASS with no TypeScript errors
- `lint`: PASS with no ESLint errors
- `build`: PASS and emit `dist/**`

- [ ] **Step 5: Commit the runtime wiring**

```bash
git add apps/api-server/src/index.ts apps/api-server/src/app.ts apps/api-server/package.json package.json
git commit -m "feat(api-server): add standalone server runtime"
```

---

### Task 4: Run End-To-End Smoke Verification From The Built Server

**Files:**

- No code changes expected unless verification fails

- [ ] **Step 1: Start the built server on an explicit port**

Run:

```bash
PORT=3101 pnpm --filter @workspace/api-server start
```

Expected: server log contains `listening on http://localhost:3101`.

- [ ] **Step 2: Verify `/hello` from outside the process**

In a second terminal:

```bash
curl -i http://localhost:3101/hello
```

Expected response includes:

```text
HTTP/1.1 200 OK
x-request-id: <value>
content-type: application/json
```

And body:

```json
{ "message": "Hello from the API", "requestId": "<same-value>" }
```

- [ ] **Step 3: Verify unknown routes return the JSON contract**

Run:

```bash
curl -i http://localhost:3101/missing
```

Expected response includes:

```text
HTTP/1.1 404 Not Found
content-type: application/json
```

And body:

```json
{ "error": { "message": "Not Found" }, "requestId": "<value>" }
```

- [ ] **Step 4: Run workspace-level regression checks**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS, including the new workspace app.

- [ ] **Step 5: Commit only if verification required follow-up fixes**

```bash
git add .
git commit -m "chore(api-server): finalize verification fixes"
```

---

## Self-Review

### Spec coverage

- New standalone workspace app: covered in Task 1.
- Essential middleware: covered in Task 2 and header verification in Task 3.
- `GET /hello`: covered in Tasks 1 and 2.
- Node bootstrap and root workflow integration: covered in Task 3.
- Local and workspace verification: covered in Task 4.

### Placeholder scan

- No `TODO` or `TBD` markers remain.
- All tasks include concrete files, code, and commands.

### Type consistency

- Workspace name is consistently `@workspace/api-server`.
- App path is consistently `apps/api-server`.
- The request ID variable is consistently named `requestId`.
