# App Bootstrap Lazy Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `apps/admin` and `apps/web` bootstrap so importing server-adjacent modules does not initialize env-dependent services at module load time, while preserving singleton-like runtime behavior and adding durable guardrails against regressions.

**Architecture:** Replace eager `auth` / `db` / `emailClient` exports in each app-local `init.ts` with cached lazy getters. Migrate all app consumers so service access happens only inside executed code paths, then lock the behavior in with app-local import-safety regression tests plus a shared ESLint rule that forbids top-level calls to app service getters.

**Tech Stack:** TanStack Start, Better Auth, Drizzle ORM, Vitest, ESLint 9 flat config, TypeScript, pnpm

---

## File Structure

### App bootstrap lifecycle

- Modify: `apps/admin/src/init.ts`
  - Replace eager singleton exports with cached `getDb()`, `getEmailClient()`, and `getAuth()` accessors.
- Modify: `apps/web/src/init.ts`
  - Mirror the admin lazy-service pattern locally without app-to-app sharing.

### Admin consumer migration

- Modify: `apps/admin/src/admin/workspaces.server.ts`
  - Resolve `auth` and `db` inside executed helpers instead of at import time.
- Modify: `apps/admin/src/middleware/auth.ts`
  - Read `auth` lazily inside middleware helpers.
- Modify: `apps/admin/src/routes/api/auth/$.ts`
  - Call `getAuth()` inside request handlers.
- Modify: `apps/admin/src/routes/health.ts`
  - Call `getDb()` inside the health check execution path.
- Modify: `apps/admin/src/routes/api/test/emails.ts`
  - Call `getEmailClient()` only when the test route executes.
- Modify: `apps/admin/src/policy/admin-app-capabilities.server.ts`
  - Replace eager auth access with lazy getter access.

### Web consumer migration

- Modify: `apps/web/src/workspace/workspace.server.ts`
  - Resolve `auth` lazily inside workspace helpers.
- Modify: `apps/web/src/workspace/workspace.functions.ts`
  - Resolve `auth` lazily inside server function handlers.
- Modify: `apps/web/src/workspace/workspace-members.functions.ts`
  - Resolve `auth` lazily inside member mutation handlers.
- Modify: `apps/web/src/workspace/workspace-settings.functions.ts`
  - Resolve `auth` lazily inside workspace settings handlers.
- Modify: `apps/web/src/billing/billing.functions.ts`
  - Resolve `auth` lazily inside billing server functions.
- Modify: `apps/web/src/billing/billing.server.ts`
  - Resolve `auth` / `db` lazily inside executed helpers.
- Modify: `apps/web/src/account/notification-preferences.server.ts`
  - Resolve `auth` / `db` lazily inside executed helpers.
- Modify: `apps/web/src/middleware/auth.ts`
  - Resolve `auth` lazily in auth/guest validation.
- Modify: `apps/web/src/routes/api/auth/$.ts`
  - Call `getAuth()` inside route handlers.
- Modify: `apps/web/src/routes/health.ts`
  - Call `getDb()` inside the health check execution path.
- Modify: `apps/web/src/routes/api/test/emails.ts`
  - Call `getEmailClient()` only when the route executes.
- Modify: `apps/web/src/routes/index.tsx`
  - Resolve `auth` lazily inside the server redirect function.
- Modify: `apps/web/src/policy/workspace-capabilities.functions.ts`
  - Resolve `auth` lazily inside handlers.

### Regression tests

- Modify: `apps/admin/test/unit/admin/workspaces.queries.test.ts`
  - Add an import-safety test covering the original repro path.
- Modify: `apps/web/test/unit/workspace/workspace.queries.test.ts`
  - Add an import-safety test for the web workspace import path.
- Create: `apps/admin/test/unit/init/init.test.ts`
  - Verify `getDb()`, `getEmailClient()`, and `getAuth()` memoize instances.
- Create: `apps/web/test/unit/init/init.test.ts`
  - Verify the mirrored web getters memoize instances.

### Static guardrail

- Create: `packages/eslint-config/rules/no-top-level-app-service-getters.js`
  - Custom ESLint rule rejecting top-level calls to `getAuth()`, `getDb()`, and `getEmailClient()`.
- Modify: `packages/eslint-config/base.js`
  - Register the local plugin and export the custom rule.
- Modify: `packages/eslint-config/react.js`
  - Apply the rule to React apps by default.
- Modify: `apps/admin/eslint.config.js`
  - Add any app-specific exclusions only if the shared rule needs them.
- Modify: `apps/web/eslint.config.js`
  - Mirror admin lint wiring only if additional app-level configuration is needed.

## Task 1: Refactor admin bootstrap to lazy, cached getters

**Files:**

- Modify: `apps/admin/src/init.ts`
- Modify: `apps/admin/src/admin/workspaces.server.ts`
- Modify: `apps/admin/src/middleware/auth.ts`
- Modify: `apps/admin/src/routes/api/auth/$.ts`
- Modify: `apps/admin/src/routes/health.ts`
- Modify: `apps/admin/src/routes/api/test/emails.ts`
- Modify: `apps/admin/src/policy/admin-app-capabilities.server.ts`
- Test: `apps/admin/test/unit/init/init.test.ts`
- Test: `apps/admin/test/unit/admin/workspaces.queries.test.ts`

- [x] **Step 1: Write the failing admin getter memoization and import-safety tests**

```ts
// apps/admin/test/unit/init/init.test.ts
import { getAuth, getDb, getEmailClient } from '@/init';

describe('admin init getters', () => {
  it('memoizes db, email client, and auth instances', () => {
    expect(getDb()).toBe(getDb());
    expect(getEmailClient()).toBe(getEmailClient());
    expect(getAuth()).toBe(getAuth());
  });
});
```

```ts
// apps/admin/test/unit/admin/workspaces.queries.test.ts
describe('admin workspace import safety', () => {
  it('imports the query module without constructing app services', async () => {
    const previousApiKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    await expect(import('@/admin/workspaces.queries')).resolves.toBeDefined();

    process.env.RESEND_API_KEY = previousApiKey;
  });
});
```

- [x] **Step 2: Run the admin tests to verify they fail against the eager bootstrap**

Run: `pnpm --filter @workspace/admin-web exec vitest run test/unit/init/init.test.ts test/unit/admin/workspaces.queries.test.ts`
Expected: FAIL because `apps/admin/src/init.ts` does not export lazy getters yet, and the import-safety test still trips eager Resend initialization.

- [x] **Step 3: Replace eager admin exports with cached getters**

```ts
// apps/admin/src/init.ts
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createAuth } from '@workspace/auth/server';
import { createDb } from '@workspace/db';
import * as schema from '@workspace/db-schema';
import { createEmailClient, createMockEmailClient } from '@workspace/email';
import { logger } from '@/lib/logger';

let dbSingleton: ReturnType<typeof createDb> | undefined;
let emailClientSingleton:
  | ReturnType<typeof createEmailClient>
  | ReturnType<typeof createMockEmailClient>
  | undefined;
let authSingleton: ReturnType<typeof createAuth> | undefined;

export function getDb() {
  if (!dbSingleton) {
    dbSingleton = createDb(process.env.DATABASE_URL!, schema);
  }

  return dbSingleton;
}

export function getEmailClient() {
  if (!emailClientSingleton) {
    emailClientSingleton =
      process.env.E2E_MOCK_EMAIL === 'true'
        ? createMockEmailClient({
            appName: process.env.VITE_APP_NAME || 'App',
          })
        : createEmailClient({
            apiKey: process.env.RESEND_API_KEY!,
            fromEmail: process.env.RESEND_FROM_EMAIL!,
            replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
            appName: process.env.VITE_APP_NAME || 'App',
            devPrefix: process.env.NODE_ENV !== 'production',
          });
  }

  return emailClientSingleton;
}

export function getAuth() {
  if (!authSingleton) {
    authSingleton = createAuth({
      db: getDb(),
      emailClient: getEmailClient(),
      baseUrl: process.env.BETTER_AUTH_URL!,
      secret: process.env.BETTER_AUTH_SECRET!,
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY!,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      },
      logger,
      getRequestHeaders,
    });
  }

  return authSingleton;
}
```

- [x] **Step 4: Migrate admin consumers so getters are called only inside executed code paths**

```ts
// apps/admin/src/admin/workspaces.server.ts
import { getAuth, getDb } from '@/init';

export async function requireAdmin() {
  const headers = getRequestHeaders();
  return getVerifiedAdminSession(headers, getAuth());
}

export async function listWorkspacesWithPlan(params: WorkspaceListParams) {
  return listAdminWorkspaces({ db: getDb(), params });
}
```

```ts
// apps/admin/src/routes/api/auth/$.ts
GET: async ({ request }) => {
  return await getAuth().handler(request);
},
POST: async ({ request }) => {
  return await getAuth().handler(request);
},
```

```ts
// apps/admin/src/routes/health.ts
async function checkDatabase() {
  await getDb().execute(sql`SELECT 1`);
}
```

```ts
// apps/admin/src/routes/api/test/emails.ts
function getMockClient(): MockEmailClient | null {
  const emailClient = getEmailClient();
  if (
    process.env.E2E_MOCK_EMAIL !== 'true' ||
    !isMockEmailClient(emailClient)
  ) {
    return null;
  }

  return emailClient;
}
```

- [x] **Step 5: Run the admin tests to verify the lazy bootstrap works**

Run: `pnpm --filter @workspace/admin-web exec vitest run test/unit/init/init.test.ts test/unit/admin/workspaces.queries.test.ts test/unit/admin/workspaces.server.test.ts test/unit/middleware/auth.test.ts`
Expected: PASS with the import-safety test succeeding even when `RESEND_API_KEY` is absent.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/init.ts apps/admin/src/admin/workspaces.server.ts apps/admin/src/middleware/auth.ts apps/admin/src/routes/api/auth/$.ts apps/admin/src/routes/health.ts apps/admin/src/routes/api/test/emails.ts apps/admin/src/policy/admin-app-capabilities.server.ts apps/admin/test/unit/init/init.test.ts apps/admin/test/unit/admin/workspaces.queries.test.ts
git commit -m "refactor(admin): lazily initialize app services"
```

## Task 2: Mirror the lazy bootstrap pattern in web

**Files:**

- Modify: `apps/web/src/init.ts`
- Modify: `apps/web/src/workspace/workspace.server.ts`
- Modify: `apps/web/src/workspace/workspace.functions.ts`
- Modify: `apps/web/src/workspace/workspace-members.functions.ts`
- Modify: `apps/web/src/workspace/workspace-settings.functions.ts`
- Modify: `apps/web/src/billing/billing.functions.ts`
- Modify: `apps/web/src/billing/billing.server.ts`
- Modify: `apps/web/src/account/notification-preferences.server.ts`
- Modify: `apps/web/src/middleware/auth.ts`
- Modify: `apps/web/src/routes/api/auth/$.ts`
- Modify: `apps/web/src/routes/health.ts`
- Modify: `apps/web/src/routes/api/test/emails.ts`
- Modify: `apps/web/src/routes/index.tsx`
- Modify: `apps/web/src/policy/workspace-capabilities.functions.ts`
- Test: `apps/web/test/unit/init/init.test.ts`
- Test: `apps/web/test/unit/workspace/workspace.queries.test.ts`

- [x] **Step 1: Write the failing web getter memoization and import-safety tests**

```ts
// apps/web/test/unit/init/init.test.ts
import { getAuth, getDb, getEmailClient } from '@/init';

describe('web init getters', () => {
  it('memoizes db, email client, and auth instances', () => {
    expect(getDb()).toBe(getDb());
    expect(getEmailClient()).toBe(getEmailClient());
    expect(getAuth()).toBe(getAuth());
  });
});
```

```ts
// apps/web/test/unit/workspace/workspace.queries.test.ts
describe('workspace import safety', () => {
  it('imports the workspace query module without constructing app services', async () => {
    const previousApiKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    await expect(
      import('@/workspace/workspace.functions')
    ).resolves.toBeDefined();

    process.env.RESEND_API_KEY = previousApiKey;
  });
});
```

- [x] **Step 2: Run the web tests to verify they fail against the eager bootstrap**

Run: `pnpm --filter @workspace/web exec vitest run test/unit/init/init.test.ts test/unit/workspace/workspace.queries.test.ts`
Expected: FAIL because `apps/web/src/init.ts` still exports eager singletons and the import-safety test still pulls in service initialization.

- [x] **Step 3: Replace eager web exports with the same cached getter shape**

```ts
// apps/web/src/init.ts
let dbSingleton: ReturnType<typeof createDb> | undefined;
let emailClientSingleton:
  | ReturnType<typeof createEmailClient>
  | ReturnType<typeof createMockEmailClient>
  | undefined;
let authSingleton: ReturnType<typeof createAuth> | undefined;

export function getDb() {
  if (!dbSingleton) {
    dbSingleton = createDb(process.env.DATABASE_URL!, schema);
  }

  return dbSingleton;
}

export function getEmailClient() {
  if (!emailClientSingleton) {
    emailClientSingleton =
      process.env.E2E_MOCK_EMAIL === 'true'
        ? createMockEmailClient({
            appName: process.env.VITE_APP_NAME || 'App',
          })
        : createEmailClient({
            apiKey: process.env.RESEND_API_KEY!,
            fromEmail: process.env.RESEND_FROM_EMAIL!,
            replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
            appName: process.env.VITE_APP_NAME || 'App',
            devPrefix: process.env.NODE_ENV !== 'production',
          });
  }

  return emailClientSingleton;
}

export function getAuth() {
  if (!authSingleton) {
    authSingleton = createAuth({
      db: getDb(),
      emailClient: getEmailClient(),
      baseUrl: process.env.BETTER_AUTH_URL!,
      secret: process.env.BETTER_AUTH_SECRET!,
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY!,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      },
      logger,
      getRequestHeaders,
    });
  }

  return authSingleton;
}
```

- [x] **Step 4: Migrate web consumers so service getters are resolved only during execution**

```ts
// apps/web/src/workspace/workspace.server.ts
import { getAuth } from '@/init';

export async function listUserWorkspaces(headers: Headers) {
  return getAuth().api.listOrganizations({ headers });
}
```

```ts
// apps/web/src/workspace/workspace.functions.ts
const requireVerifiedSession = async (headers: Headers) => {
  const session = await getAuth().api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }

  return session as VerifiedSession;
};
```

```ts
// apps/web/src/routes/index.tsx
const redirectByAuthStatus = createServerFn().handler(async () => {
  const headers = getRequestHeaders();
  const session = await getAuth().api.getSession({ headers });
  return session ? '/ws' : '/signin';
});
```

- [x] **Step 5: Run the web tests to verify the lazy bootstrap works**

Run: `pnpm --filter @workspace/web exec vitest run test/unit/init/init.test.ts test/unit/workspace/workspace.queries.test.ts test/unit/workspace/workspace.functions.test.ts test/unit/workspace/workspace.server.test.ts test/unit/middleware/auth.test.ts test/unit/billing/billing.functions.test.ts test/unit/account/notification-preferences.server.test.ts`
Expected: PASS with the import-safety test succeeding even when `RESEND_API_KEY` is absent.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/init.ts apps/web/src/workspace/workspace.server.ts apps/web/src/workspace/workspace.functions.ts apps/web/src/workspace/workspace-members.functions.ts apps/web/src/workspace/workspace-settings.functions.ts apps/web/src/billing/billing.functions.ts apps/web/src/billing/billing.server.ts apps/web/src/account/notification-preferences.server.ts apps/web/src/middleware/auth.ts apps/web/src/routes/api/auth/$.ts apps/web/src/routes/health.ts apps/web/src/routes/api/test/emails.ts apps/web/src/routes/index.tsx apps/web/src/policy/workspace-capabilities.functions.ts apps/web/test/unit/init/init.test.ts apps/web/test/unit/workspace/workspace.queries.test.ts
git commit -m "refactor(web): lazily initialize app services"
```

## Task 3: Add the shared ESLint guardrail against top-level getter calls

**Files:**

- Create: `packages/eslint-config/rules/no-top-level-app-service-getters.js`
- Modify: `packages/eslint-config/base.js`
- Modify: `packages/eslint-config/react.js`
- Test: `apps/admin/eslint.config.js`
- Test: `apps/web/eslint.config.js`

- [x] **Step 1: Write the failing lint fixtures mentally and wire the rule in config first**

```js
// packages/eslint-config/rules/no-top-level-app-service-getters.js
const SERVICE_GETTERS = new Set(['getAuth', 'getDb', 'getEmailClient']);

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow top-level calls to app service getters that recreate import-time side effects.',
    },
    schema: [],
    messages: {
      noTopLevelGetter:
        'Do not call app service getters at module top level. Call them inside executed functions only.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        if (!SERVICE_GETTERS.has(node.callee.name)) return;
        if (context.sourceCode.getScope(node).type !== 'module') return;

        context.report({ node, messageId: 'noTopLevelGetter' });
      },
    };
  },
};
```

- [x] **Step 2: Register the rule in the shared ESLint config**

```js
// packages/eslint-config/base.js
import { tanstackConfig } from '@tanstack/eslint-config';
import noTopLevelAppServiceGetters from './rules/no-top-level-app-service-getters.js';

const localPlugin = {
  rules: {
    'no-top-level-app-service-getters': noTopLevelAppServiceGetters,
  },
};

export default [
  ...tanstackConfig,
  {
    plugins: {
      '@workspace': localPlugin,
    },
  },
];
```

```js
// packages/eslint-config/react.js
export default [
  ...baseConfig,
  ...pluginRouter.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@workspace/no-top-level-app-service-getters': 'error',
    },
  },
];
```

- [x] **Step 3: Run targeted lint checks to verify the rule passes on the migrated apps**

Run: `pnpm --filter @workspace/admin-web exec eslint src && pnpm --filter @workspace/web exec eslint src`
Expected: PASS with no top-level `getAuth()`, `getDb()`, or `getEmailClient()` calls remaining in app source.

- [x] **Step 4: Add one intentional local violation temporarily to verify the rule fires, then remove it**

```ts
// temporary scratch change in an app module
const auth = getAuth();
```

Run: `pnpm --filter @workspace/admin-web exec eslint src/middleware/auth.ts`
Expected: FAIL with `@workspace/no-top-level-app-service-getters`.

Remove the scratch line after proving the rule fires.

- [ ] **Step 5: Commit**

```bash
git add packages/eslint-config/base.js packages/eslint-config/react.js packages/eslint-config/rules/no-top-level-app-service-getters.js
git commit -m "feat(eslint): forbid top-level app service getters"
```

## Task 4: Run cross-app verification and boundary checks

**Files:**

- Modify: `docs/superpowers/plans/2026-04-05-app-bootstrap-lazy-services.md`
  - Check off completed steps and record any deviations if execution revealed them.

- [x] **Step 1: Run the combined targeted unit suites**

Run: `pnpm --filter @workspace/admin-web exec vitest run test/unit/init/init.test.ts test/unit/admin/workspaces.queries.test.ts test/unit/admin/workspaces.server.test.ts test/unit/middleware/auth.test.ts`
Expected: PASS

Run: `pnpm --filter @workspace/web exec vitest run test/unit/init/init.test.ts test/unit/workspace/workspace.queries.test.ts test/unit/workspace/workspace.functions.test.ts test/unit/workspace/workspace.server.test.ts test/unit/middleware/auth.test.ts test/unit/billing/billing.functions.test.ts test/unit/account/notification-preferences.server.test.ts`
Expected: PASS

- [x] **Step 2: Run cross-repo structural verification**

Run: `pnpm run check:boundaries`
Expected: PASS

Run: `pnpm run typecheck`
Expected: PASS

- [x] **Step 3: Run lint for both apps through repo-native entrypoints**

Run: `pnpm --filter @workspace/admin-web check`
Expected: PASS

Run: `pnpm --filter @workspace/web check`
Expected: PASS

- [ ] **Step 4: Commit the final integrated change**

```bash
git add apps/admin apps/web packages/eslint-config docs/superpowers/plans/2026-04-05-app-bootstrap-lazy-services.md
git commit -m "refactor: avoid import-time app service initialization"
```

## Self-Review

- Spec coverage: The plan covers the agreed lazy getter pattern in both apps, import-safety regression tests in both apps, singleton behavior tests, and the shared ESLint guardrail.
- Placeholder scan: Replaced generic “add tests” language with concrete file paths, commands, and sample code.
- Type consistency: The plan uses one consistent API shape across both apps: `getDb()`, `getEmailClient()`, and `getAuth()`.
