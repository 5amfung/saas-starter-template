# Monorepo Migration Design

**Date**: 2026-03-18
**Status**: Draft
**Scope**: Migrate single-app SaaS starter template to a Turborepo monorepo with shared packages.

---

## 1. Overview

Convert the existing single-app SaaS starter template into a pnpm + Turborepo monorepo named `saas-starter-template`. The app's shadcn UI components, database layer, email system, authentication, and billing become shared packages. The existing app moves to `apps/web/`.

### Goals

- Shared packages (`ui`, `db`, `email`, `auth`, `billing`) usable by future apps
- Clean package boundaries with dependency injection (no `process.env` in packages)
- Each package owns its own tests
- Zero failing tests after migration
- Incremental extraction — verifiable at each step

### Non-Goals

- Adding new features or apps
- Refactoring domain logic (workspace, account, admin)
- Changing the runtime behavior of the app

---

## 2. Target Monorepo Structure

```
saas-starter-template/
├── package.json                      # Root: turbo scripts, shared devDeps
├── pnpm-workspace.yaml               # apps/* + packages/*
├── turbo.json                        # Task orchestration
├── tsconfig.json                     # Base tsconfig (extended by all)
├── .prettierrc / .prettierignore
├── .gitignore
├── .husky/
│
├── apps/
│   └── web/
│       ├── package.json
│       ├── .env                      # App env vars (gitignored)
│       ├── .env.example
│       ├── components.json           # shadcn config → targets @workspace/ui
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── eslint.config.js
│       ├── vitest.config.ts
│       ├── vitest.setup.ts
│       └── src/
│           ├── account/              # Account domain (stays in app)
│           ├── admin/                # Admin domain (stays in app)
│           ├── workspace/            # Workspace domain (stays in app)
│           ├── billing/              # App-level billing wiring (createServerFn wrappers + auth-coupled billing fns)
│           ├── components/
│           │   ├── account/
│           │   ├── admin/
│           │   ├── auth/
│           │   └── workspace/
│           ├── hooks/                # App-specific hooks
│           ├── lib/                  # App-specific utils (logger stays here)
│           ├── middleware/           # All TanStack Start middleware wrappers
│           │   ├── auth.ts           # createMiddleware wrapping @workspace/auth validators
│           │   └── admin.ts          # Admin-specific middleware
│           ├── routes/               # All routes stay in app
│           ├── test/                 # App-level test mocks
│           └── types/
│
└── packages/
    ├── ui/
    │   ├── package.json
    │   ├── components.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts          # environment: 'jsdom' for component tests
    │   └── src/
    │       ├── components/           # All shadcn/ui primitives
    │       ├── hooks/                # Shared UI hooks (use-mobile, etc.)
    │       ├── lib/
    │       │   └── utils.ts          # cn() utility
    │       └── styles/
    │           └── globals.css       # Tailwind + theme + @source directives
    │
    ├── db/
    │   ├── package.json              # Includes db:generate, db:migrate, db:push, db:studio, gen-auth-schema
    │   ├── .env                      # Just DATABASE_URL (gitignored, for drizzle-kit CLI)
    │   ├── .env.example
    │   ├── drizzle.config.ts
    │   ├── drizzle/                  # Migration files
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   ├── scripts/
    │   │   └── patch-auth-schema.ts
    │   └── src/
    │       ├── index.ts              # createDb(connectionString) factory
    │       ├── schema.ts             # Re-exports auth.schema + app.schema
    │       ├── auth.schema.ts        # Better Auth managed tables
    │       └── app.schema.ts         # App tables (notificationPreferences)
    │
    ├── email/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── index.ts              # Public API: createEmailClient, types
    │       ├── resend.server.ts      # Resend client factory (accepts config)
    │       ├── request-context.ts    # buildEmailRequestContext(headers) — pure fn, accepts headers
    │       └── templates/
    │           ├── email-verification-email.tsx
    │           ├── reset-password-email.tsx
    │           ├── change-email-approval-email.tsx
    │           ├── workspace-invitation-email.tsx
    │           └── email-security-notice.tsx
    │
    ├── auth/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── index.ts              # Public API: types, permissions, re-exports
    │       ├── auth.server.ts        # createAuth(config) factory
    │       ├── auth-client.ts        # createAuthClient()
    │       ├── auth-emails.server.ts # Email hook wiring (uses config.getRequestHeaders)
    │       ├── auth-hooks.server.ts  # isSignInPath, isDuplicateOrganizationError, SessionLike
    │       ├── auth-workspace.server.ts # validateWorkspaceFields, buildAcceptInviteUrl (uses config.baseUrl)
    │       ├── permissions.ts        # Permission definitions
    │       ├── workspace-types.ts    # PERSONAL_WORKSPACE_TYPE, isPersonalWorkspace, buildPersonalWorkspaceSlug
    │       ├── validators.ts         # validateAuthSession, validateGuestSession (pure fns)
    │       └── schemas.ts            # Auth-related Zod schemas
    │
    ├── billing/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── index.ts              # Public API: plan helpers, types
    │       ├── plans.ts              # Plan definitions, limits, pure helpers
    │       └── billing.server.ts     # Pure DB/Stripe helpers (no auth.api, no createServerFn)
    │
    └── test-utils/
        ├── package.json
        └── src/
            ├── index.ts
            ├── factories.ts          # createMockUser, createMockSession, etc.
            └── render.tsx            # renderWithProviders, createHookWrapper
```

---

## 3. Package Dependency Graph

```
@workspace/ui          (no internal deps)
@workspace/db          (no internal deps)
@workspace/email       (no internal deps)
@workspace/auth     →  @workspace/db, @workspace/email
@workspace/billing  →  @workspace/db
@workspace/test-utils → @workspace/db, @workspace/auth (devDependencies)
apps/web            →  all packages
```

No circular dependencies. Extraction order follows this graph bottom-up.

### Breaking the Auth ↔ Billing Cycle

In the current codebase, `auth.server.ts` imports billing functions (`getPlanLimitsForPlanId`, `countOwnedWorkspaces`, `countWorkspaceMembers`, `resolveUserPlanIdFromDb`) for organization hooks, and `billing.server.ts` imports auth for subscription APIs. This creates a bidirectional dependency.

**Solution**: The `createAuth` factory accepts hook callbacks via its config. The app wires billing functions into auth hooks at initialization time. This way `@workspace/auth` has no dependency on `@workspace/billing`, and `@workspace/billing` has no dependency on `@workspace/auth`.

```typescript
// packages/auth/src/auth.server.ts
export interface AuthHooks {
  /** Called before creating an organization to check workspace limits. */
  beforeCreateOrganization?: (userId: string) => Promise<void>;
  /** Called before creating an invitation to check member limits. */
  beforeCreateInvitation?: (orgId: string) => Promise<void>;
}

export function createAuth(config: AuthConfig & { hooks?: AuthHooks }) {
  return betterAuth({
    // ... core config
    plugins: [
      organization({
        // Use hooks from config instead of importing billing directly.
        async beforeCreateOrganization(ctx) {
          await config.hooks?.beforeCreateOrganization?.(ctx.userId);
        },
        async beforeCreateInvitation(ctx) {
          await config.hooks?.beforeCreateInvitation?.(ctx.orgId);
        },
      }),
    ],
  });
}

// apps/web/src/init.ts — app wires billing into auth hooks
import { createAuth } from '@workspace/auth/server';
import {
  checkWorkspaceLimit,
  checkMemberLimit,
} from '@workspace/billing/server';

const auth = createAuth({
  db,
  email,
  hooks: {
    beforeCreateOrganization: (userId) => checkWorkspaceLimit(userId),
    beforeCreateInvitation: (orgId) => checkMemberLimit(orgId),
  },
});
```

### Workspace Constants

`auth.server.ts` also imports workspace constants (`PERSONAL_WORKSPACE_TYPE`, `isPersonalWorkspace`, `buildPersonalWorkspaceSlug`). These are pure values/functions with no dependencies. They move to `@workspace/auth` since they define the workspace type system that auth's organization hooks enforce. The app's `src/workspace/` imports them from `@workspace/auth` instead.

---

## 4. Framework Boundary Rule

**TanStack Start primitives stay in the app.** Packages must not import from `@tanstack/react-start`.

| Primitive              | Where it stays                      | Package exports instead                                   |
| ---------------------- | ----------------------------------- | --------------------------------------------------------- |
| `createServerFn()`     | `apps/web/src/**/*.functions.ts`    | Pure async functions that accept args                     |
| `createMiddleware()`   | `apps/web/src/middleware/`          | Validator functions: `validateAuthSession(headers, auth)` |
| `getRequestHeaders()`  | `apps/web/` (caller passes headers) | Functions that accept `Headers` parameter                 |
| `createIsomorphicFn()` | `apps/web/src/lib/logger.ts`        | N/A — logger stays in app                                 |

**Example — auth middleware**:

```typescript
// packages/auth/src/validators.ts — pure function, no framework import
export async function validateAuthSession(
  headers: Headers,
  auth: ReturnType<typeof createAuth>,
): Promise<{ session: Session; user: User }> {
  const session = await auth.api.getSession({ headers });
  if (!session) throw redirect({ to: '/signin' });
  // ... validation logic
  return session;
}

// apps/web/src/middleware/auth.ts — TanStack Start wrapper
import { createMiddleware } from '@tanstack/react-start';
import { validateAuthSession } from '@workspace/auth';
import { auth } from '@/init';

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const session = await validateAuthSession(headers, auth);
  return next({ context: { session } });
});
```

**Example — billing server functions**:

```typescript
// packages/billing/src/billing.server.ts — pure function
export async function getInvoices(
  db: Database,
  stripeSecretKey: string,
  userId: string,
) {
  // ... Stripe API call, returns invoices
}

// apps/web/src/billing/billing.functions.ts — TanStack Start wrapper
import { createServerFn } from '@tanstack/react-start';
import { getInvoices } from '@workspace/billing/server';
import { db } from '@/init';

export const getInvoicesFn = createServerFn().handler(async () => {
  const session = await requireSession();
  return getInvoices(db, process.env.STRIPE_SECRET_KEY!, session.user.id);
});
```

**Example — email request context**:

```typescript
// packages/email/src/request-context.ts — pure function, accepts headers
export function buildEmailRequestContext(
  headers: Headers,
): EmailRequestContext {
  const ip = headers.get('x-forwarded-for') || headers.get('x-real-ip');
  // ... extract city, country, timestamp
  return { ip, city, country, timestamp };
}

// apps/web/ — caller passes headers from getRequestHeaders()
import { buildEmailRequestContext } from '@workspace/email';
const ctx = buildEmailRequestContext(getRequestHeaders());
```

---

## 5. Package Export Contracts

All packages ship raw TypeScript source (no build step). The app's Vite bundler compiles them.

### `@workspace/ui`

```json
{
  "exports": {
    "./globals.css": "./src/styles/globals.css",
    "./lib/*": "./src/lib/*.ts",
    "./components/*": "./src/components/*.tsx",
    "./hooks/*": "./src/hooks/*.ts"
  }
}
```

### `@workspace/db`

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts"
  }
}
```

### `@workspace/email`

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./templates/*": "./src/templates/*.tsx"
  }
}
```

### `@workspace/auth`

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./server": "./src/auth.server.ts",
    "./client": "./src/auth-client.ts",
    "./validators": "./src/validators.ts",
    "./schemas": "./src/schemas.ts"
  }
}
```

### `@workspace/billing`

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./plans": "./src/plans.ts",
    "./server": "./src/billing.server.ts"
  }
}
```

### `@workspace/test-utils`

```json
{
  "exports": {
    ".": "./src/index.ts"
  }
}
```

---

## 6. Import Rewrite Map

| Before (single app)                    | After (monorepo)                               |
| -------------------------------------- | ---------------------------------------------- |
| `@/lib/utils` (cn)                     | `@workspace/ui/lib/utils`                      |
| `@/components/ui/button`               | `@workspace/ui/components/button`              |
| `@/components/ui/*`                    | `@workspace/ui/components/*`                   |
| `@/hooks/use-mobile`                   | `@workspace/ui/hooks/use-mobile`               |
| `@/db`                                 | `@workspace/db`                                |
| `@/db/schema`                          | `@workspace/db/schema`                         |
| `@/email/resend.server`                | `@workspace/email`                             |
| `@/email/email-request-context.server` | `@workspace/email` (re-exported)               |
| `@/components/email-template/*`        | `@workspace/email/templates/*`                 |
| `@/auth/auth.server`                   | `@workspace/auth/server`                       |
| `@/auth/auth-client`                   | `@workspace/auth/client`                       |
| `@/auth/auth-emails.server`            | `@workspace/auth` (internal, not app-imported) |
| `@/auth/permissions`                   | `@workspace/auth` (re-exported from index)     |
| `@/middleware/auth`                    | `@/middleware/auth` (stays in app, rewired)    |
| `@/billing/plans`                      | `@workspace/billing/plans`                     |
| `@/billing/billing.server`             | `@workspace/billing/server`                    |
| `@/billing/billing.functions`          | `@/billing/billing.functions` (stays in app)   |

The `@/*` alias continues to work within `apps/web/` for app-local imports.

---

## 7. Environment Variable Strategy

### Principle

Packages never read `process.env` directly at runtime. They accept configuration via factory functions (dependency injection). Each workspace owns its own `.env` for CLI tooling needs.

### Runtime (App → Package)

The app initializes all packages in a central module (e.g., `apps/web/src/init.ts`):

```typescript
// apps/web/src/init.ts
import { createDb } from '@workspace/db';
import { createEmailClient } from '@workspace/email';
import { createAuth } from '@workspace/auth/server';
import {
  checkWorkspaceLimit,
  checkMemberLimit,
} from '@workspace/billing/server';

export const db = createDb(process.env.DATABASE_URL!);

export const emailClient = createEmailClient({
  apiKey: process.env.RESEND_API_KEY!,
  fromEmail: process.env.RESEND_FROM_EMAIL!,
  replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
});

export const auth = createAuth({
  db,
  emailClient,
  baseUrl: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    proMonthlyPriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
    proAnnualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
  },
  hooks: {
    beforeCreateOrganization: (userId) => checkWorkspaceLimit(db, userId),
    beforeCreateInvitation: (orgId) => checkMemberLimit(db, orgId),
  },
});
```

### AuthConfig Interface

```typescript
// packages/auth/src/auth.server.ts
export interface AuthConfig {
  db: Database;
  emailClient: EmailClient;
  baseUrl: string;
  secret: string;
  google: {
    clientId: string;
    clientSecret: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
    proMonthlyPriceId: string;
    proAnnualPriceId: string;
  };
  adminUserIds?: string[];
  trustedOrigins?: string[];
  hooks?: AuthHooks;
  /** Logger callback — auth package uses this instead of importing app logger. */
  logger?: (
    level: string,
    message: string,
    meta?: Record<string, unknown>,
  ) => void;
  /** Returns request headers in the current server context. Used by auth-emails
   *  to build email request context (IP, location) for security notices. */
  getRequestHeaders?: () => Headers;
}
```

**Why `logger` is a callback**: `auth.server.ts` uses `logger()` in 10+ Stripe subscription hooks. The app's logger uses `createIsomorphicFn` (TanStack Start primitive), so it can't be imported by the package. The app passes its logger at init time; if not provided, the package falls back to `console.log`.

**Why `getRequestHeaders` is a callback**: `auth-emails.server.ts` calls `buildEmailRequestContext()` to include IP/location in security emails. This function needs request headers, but Better Auth hooks trigger internally without explicit header access. The app passes its `getRequestHeaders` function (from `@tanstack/react-start/server`) at init time. The `buildEmailRequestContext` function in `@workspace/email` accepts `Headers` as a param; the auth package's email hooks call `config.getRequestHeaders()` to obtain them.

**Why `baseUrl` covers `auth-workspace.server.ts`**: `buildAcceptInviteUrl()` currently calls `resolveAppOrigin()` which reads `process.env.BETTER_AUTH_URL`. After migration, it uses `config.baseUrl` instead — no `process.env` access.

````

### CLI Tooling (Package-local `.env`)

```json
// packages/db/package.json
{
  "scripts": {
    "db:generate": "dotenv -e .env -- drizzle-kit generate",
    "db:migrate": "dotenv -e .env -- drizzle-kit migrate",
    "db:push": "dotenv -e .env -- drizzle-kit push",
    "db:studio": "dotenv -e .env -- drizzle-kit studio",
    "gen-auth-schema": "dotenv -e .env -- pnpx @better-auth/cli generate --config ../auth/src/auth.server.ts --output ./src/auth.schema.ts --yes && node --experimental-strip-types scripts/patch-auth-schema.ts && eslint --fix ./src/auth.schema.ts && prettier --write ./src/auth.schema.ts"
  }
}
````

`packages/db/.env` contains only `DATABASE_URL`. Gitignored. Documented in `packages/db/.env.example`.

`apps/web/.env` contains all app env vars. Gitignored. Documented in `apps/web/.env.example`.

### CI

Environment variables injected by CI platform. No `.env` files needed.

### New devDependency

`dotenv-cli` must be added as a devDependency for `packages/db` (or root).

---

## 8. Dependency Injection Patterns

### Database

```typescript
// packages/db/src/index.ts
export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}
export type Database = ReturnType<typeof createDb>;
```

### Email

```typescript
// packages/email/src/index.ts
export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  replyToEmail?: string;
}
export function createEmailClient(config: EmailConfig) { ... }
export type EmailClient = ReturnType<typeof createEmailClient>;
```

### Auth

```typescript
// packages/auth/src/auth.server.ts
export function createAuth(config: AuthConfig) {
  return betterAuth({
    database: drizzleAdapter(config.db, { provider: 'pg' }),
    // ... plugins, social providers, hooks all from config
  });
}
export type Auth = ReturnType<typeof createAuth>;
```

### Billing

The billing domain splits into two layers:

**`@workspace/billing` (package)** — Pure functions that need only `db` and/or `stripeSecretKey`. No auth dependency.

```typescript
// packages/billing/src/plans.ts — Pure, no dependencies.
export function getPlanById(id: PlanId): Plan { ... }
export function getPlanLimitsForPlanId(id: PlanId): PlanLimits { ... }
export function resolveUserPlanId(subscriptions: { plan: string; status: string }[]): PlanId { ... }

// packages/billing/src/billing.server.ts — Needs db + stripe, but NOT auth.api.
export function resolveUserPlanIdFromDb(db: Database, userId: string): Promise<PlanId> { ... }
export function countOwnedWorkspaces(db: Database, userId: string): Promise<number> { ... }
export function countWorkspaceMembers(db: Database, workspaceId: string): Promise<number> { ... }
export function getWorkspaceOwnerUserId(db: Database, workspaceId: string): Promise<string | null> { ... }
export function getInvoicesForUser(db: Database, stripeSecretKey: string, userId: string) { ... }
export function resolveSubscriptionDetails(subscriptions: ..., planId: PlanId) { ... }
export function checkWorkspaceLimit(db: Database, userId: string): Promise<void> { ... }
export function checkMemberLimit(db: Database, orgId: string): Promise<void> { ... }
```

**`apps/web/src/billing/` (app)** — Functions that call `auth.api.*` (subscription APIs). These stay in the app because they couple auth + billing.

```typescript
// apps/web/src/billing/billing.server.ts — Needs auth.api + billing helpers.
export function getUserActivePlanId(headers: Headers, userId: string): Promise<PlanId> {
  const subscriptions = await auth.api.listActiveSubscriptions({ headers, query: { referenceId: userId } });
  return resolveUserPlanId(Array.from(subscriptions));
}
export function getBillingData(headers: Headers, userId: string) { ... }
export function createCheckoutForPlan(headers: Headers, planId: PlanId, annual: boolean) { ... }
export function createUserBillingPortal(headers: Headers) { ... }
export function reactivateUserSubscription(headers: Headers, userId: string) { ... }
export function requireVerifiedSession() { ... } // Uses getRequestHeaders() + auth.api.getSession

// apps/web/src/billing/billing.functions.ts — createServerFn wrappers.
export const getInvoicesFn = createServerFn().handler(async () => { ... });
export const createCheckoutSessionFn = createServerFn().handler(async () => { ... });
```

This keeps the dependency graph clean: `@workspace/billing` depends only on `@workspace/db`.

The app wires everything together in `apps/web/src/init.ts`.

---

## 9. CSS & Tailwind Strategy

`globals.css` moves to `packages/ui/src/styles/globals.css` and includes `@source` directives to scan across all packages and apps for Tailwind class usage:

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@source "../../../apps/**/*.{ts,tsx}";
@source "../../auth/src/**/*.{ts,tsx}";
@source "../../billing/src/**/*.{ts,tsx}";
@source "../../email/src/**/*.{ts,tsx}";
@source "../**/*.{ts,tsx}";

/* OKLCH theme variables, @theme block, etc. */
```

The app imports this CSS in `__root.tsx`:

```typescript
import appCss from '@workspace/ui/globals.css?url';
```

---

## 10. Test Strategy

### Ownership

Each package owns its tests. Tests that validate package logic move with the package.

| Package              | Tests                                                                  | Environment |
| -------------------- | ---------------------------------------------------------------------- | ----------- |
| `@workspace/ui`      | UI component tests, shared hook tests                                  | `jsdom`     |
| `@workspace/db`      | Schema/table definition tests                                          | `node`      |
| `@workspace/email`   | Email template tests, sendEmail tests                                  | `node`      |
| `@workspace/auth`    | Auth validator tests, auth helper tests, permission tests              | `node`      |
| `@workspace/billing` | Plan helper tests, billing server tests                                | `node`      |
| `apps/web`           | Route tests, workspace/account/admin domain tests, app component tests | `jsdom`     |

### Shared Test Utilities

`@workspace/test-utils` provides:

- `factories.ts` — shared factories (`createMockUser`, `createMockSession`, etc.)
- `render.tsx` — `renderWithProviders`, `createHookWrapper` (depends on `@tanstack/react-query`, `@testing-library/react`)

### Configuration

Each package with tests has its own `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node', // or 'jsdom' for @workspace/ui
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

Packages with `jsdom` environment need `vitest.setup.ts` importing `@testing-library/jest-dom/vitest`.

Turborepo orchestrates test runs:

```json
// turbo.json
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "cache": false
    }
  }
}
```

Root convenience: `pnpm test` runs all package tests via Turbo.

### Mock Rewrites

App-level mocks update import paths:

| Before                          | After                               |
| ------------------------------- | ----------------------------------- |
| `vi.mock('@/auth/auth-client')` | `vi.mock('@workspace/auth/client')` |
| `vi.mock('@/db')`               | `vi.mock('@workspace/db')`          |

---

## 11. Migration Steps (Incremental)

Each step is independently verifiable.

### Step 0: Scaffold & Baseline

1. Scaffold monorepo: `pnpm dlx shadcn@latest init -t start -b base -p maia --monorepo -n saas-starter-template` into a temp directory
2. Move scaffold output into the worktree root (without creating a nested directory)
3. Set up `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, root `tsconfig.json`
4. **Verify**: `pnpm install` succeeds

### Step 1: Move Existing App into `apps/web/`

1. Move `src/`, app-level config files into `apps/web/`
2. Update `apps/web/package.json` with all current dependencies
3. Keep `@/*` alias working (update `tsconfig.json` paths)
4. Move `.husky` to root; move `.env`, `.env.example` to `apps/web/`
5. **Verify**: `pnpm run build`, `pnpm test` pass

### Step 2: Extract `packages/ui`

1. Scaffold already created `packages/ui` with base structure
2. Move `src/components/ui/*.tsx` → `packages/ui/src/components/`
3. Move `cn()` utility → `packages/ui/src/lib/utils.ts`
4. Move `use-mobile` hook → `packages/ui/src/hooks/`
5. Move CSS/theme → `packages/ui/src/styles/globals.css` with `@source` directives
6. Rewrite `@/components/ui/*` → `@workspace/ui/components/*`
7. Rewrite `@/lib/utils` (cn) → `@workspace/ui/lib/utils`
8. Move UI component tests to `packages/ui/` with `jsdom` vitest config
9. **Verify**: `pnpm test`, `pnpm run build`

### Step 3: Extract `packages/db`

1. Create `packages/db` with `package.json`, `tsconfig.json`, `vitest.config.ts`
2. Move `src/db/*` → `packages/db/src/`
3. Convert DB client to factory: `createDb(connectionString)`
4. Move `drizzle.config.ts` and `drizzle/` to `packages/db/`
5. Move `scripts/patch-auth-schema.ts` to `packages/db/scripts/`
6. Set up `packages/db/.env.example` with `DATABASE_URL`
7. Add `dotenv-cli` devDependency; move db commands and `gen-auth-schema` to `packages/db/package.json`
8. Rewrite `@/db` → `@workspace/db`
9. Create `apps/web/src/init.ts` with `createDb()` call; update all DB usages to import from init
10. Move db-related tests
11. **Verify**: `pnpm test`, `pnpm run build`

### Step 4: Extract `packages/email`

1. Create `packages/email` with `package.json`, `tsconfig.json`, `vitest.config.ts`
2. Move `src/email/*` → `packages/email/src/`
3. Move `src/components/email-template/*` → `packages/email/src/templates/`
4. Convert to factory: `createEmailClient(config)`
5. Refactor `email-request-context.server.ts` → `request-context.ts`: accept `Headers` param instead of calling `getRequestHeaders()`
6. Add `createEmailClient()` to `apps/web/src/init.ts`
7. Move `dev:email` script to `packages/email/package.json` with updated `--dir` path
8. Rewrite email imports
9. Move email-related tests
10. **Verify**: `pnpm test`, `pnpm run build`

### Step 5: Extract `packages/auth`

1. Create `packages/auth` with `package.json`, `tsconfig.json`, `vitest.config.ts`
2. Add `@workspace/db` and `@workspace/email` as dependencies
3. Move `src/auth/*` → `packages/auth/src/`, including:
   - `auth.server.ts` → convert to `createAuth(config: AuthConfig)` factory
   - `auth-client.ts` → `createAuthClient()`
   - `auth-emails.server.ts` → use `config.getRequestHeaders()` for email request context
   - `auth-hooks.server.ts` → helper functions (`isSignInPath`, `isDuplicateOrganizationError`, etc.)
   - `auth-workspace.server.ts` → use `config.baseUrl` instead of `process.env.BETTER_AUTH_URL`
   - `permissions.ts`, `schemas.ts`
4. Move workspace type constants (`PERSONAL_WORKSPACE_TYPE`, `isPersonalWorkspace`, `buildPersonalWorkspaceSlug`) into `packages/auth/src/workspace-types.ts`
5. Add `logger` callback to `AuthConfig` — replace all `logger()` calls in Stripe hooks with `config.logger?.()` (fallback to `console.log`)
6. Add `getRequestHeaders` callback to `AuthConfig` — auth-emails uses it to build email request context
7. Extract auth hook callbacks (billing limit checks) into `AuthHooks` interface — app wires them at init
8. Create `packages/auth/src/validators.ts` with `validateAuthSession(headers, auth)` and `validateGuestSession(headers, auth)` as pure functions (no `createMiddleware`)
9. Keep `apps/web/src/middleware/auth.ts` — wraps validators with `createMiddleware`
10. Keep `apps/web/src/middleware/admin.ts` — imports from `@workspace/auth`
11. Update `apps/web/src/init.ts` with `createAuth()` call (passing logger, getRequestHeaders, hooks)
12. Update `src/workspace/` to import workspace constants from `@workspace/auth`
13. Rewrite auth imports
14. Move auth validator tests, permission tests, auth-hooks tests to `packages/auth/`
15. **Verify**: `pnpm test`, `pnpm run build`

### Step 6: Extract `packages/billing`

1. Create `packages/billing` with `package.json`, `tsconfig.json`, `vitest.config.ts`
2. Add `@workspace/db` as dependency (no auth dependency — cycle broken by hooks)
3. Move `src/billing/plans.ts` → `packages/billing/src/plans.ts` (pure, no changes needed)
4. Split `src/billing/billing.server.ts` into two layers:
   - **Package** (`packages/billing/src/billing.server.ts`): Pure DB/Stripe functions — `resolveUserPlanIdFromDb`, `countOwnedWorkspaces`, `countWorkspaceMembers`, `getWorkspaceOwnerUserId`, `getInvoicesForUser`, `resolveSubscriptionDetails`, `checkWorkspaceLimit`, `checkMemberLimit`. Refactor to accept `db` and `stripeSecretKey` as params.
   - **App** (`apps/web/src/billing/billing.server.ts`): Auth-coupled functions — `getUserActivePlanId`, `getBillingData`, `createCheckoutForPlan`, `createUserBillingPortal`, `reactivateUserSubscription`, `requireVerifiedSession`. These call `auth.api.*` and stay in the app.
5. Keep `apps/web/src/billing/billing.functions.ts` (uses `createServerFn`)
6. Move `dev:stripe-webhook` script to `apps/web/package.json`
7. Rewrite billing imports — app-level billing imports from both `@workspace/billing` and `@/billing`
8. Move plan helper tests and pure billing server tests to `packages/billing/`; auth-coupled billing tests stay in app
9. **Verify**: `pnpm test`, `pnpm run build`

### Step 7: Create `packages/test-utils`

1. Extract shared test factories from `apps/web/src/test/factories.ts`
2. Extract `render.tsx` (renderWithProviders, createHookWrapper)
3. Publish as `@workspace/test-utils`
4. Update package and app test files to import from `@workspace/test-utils`
5. **Verify**: `pnpm test`

### Step 8: Final Cleanup

1. Remove empty directories from `apps/web/src/`
2. Grep for stale `@/` imports referencing moved modules
3. Run full suite: `pnpm run check`, `pnpm test`, `pnpm run build`
4. Verify `pnpm run dev` works end-to-end

---

## 12. What Doesn't Change

- **Routing**: All routes stay in `apps/web/src/routes/`, file-based routing unchanged
- **`routeTree.gen.ts`**: Auto-generated, never edited
- **Workspace domain**: `src/workspace/` stays in `apps/web/` (workspace constants move to `@workspace/auth`)
- **Account domain**: `src/account/` stays in `apps/web/`
- **Admin domain**: `src/admin/` stays in `apps/web/`
- **App-specific components**: `src/components/account/`, `admin/`, `auth/`, `workspace/` stay in app
- **`@/*` alias**: Works within `apps/web/` for app-local imports
- **Server function pattern**: `*.functions.ts` files stay in app; packages export pure logic
- **Logger**: `src/lib/logger.ts` stays in app (uses `createIsomorphicFn` from TanStack Start)
- **Runtime behavior**: The app behaves identically after migration

---

## 13. Risks & Mitigations

| Risk                                              | Mitigation                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Broken imports after mass rewrite                 | Incremental steps with `pnpm run build` + `pnpm test` after each                                          |
| Tailwind classes not detected across packages     | `@source` directives in `globals.css` explicitly scan all packages and apps                               |
| Auth ↔ billing circular dependency                | Auth accepts hook callbacks via factory config; billing has no auth dependency                            |
| TanStack Start primitives in packages             | Framework boundary rule: packages export pure functions, app wraps with framework primitives              |
| `gen-auth-schema` breaks with new paths           | Update CLI flags and patch script paths in Step 3; `dotenv-cli` for env loading                           |
| Test mocks break with new import paths            | Update `vi.mock()` paths when moving each package                                                         |
| shadcn CLI `add` breaks                           | Two `components.json` files configured to target `packages/ui`                                            |
| Environment variables not found                   | Factory functions for runtime; `dotenv-cli` + package-local `.env` for CLI tools; CI injects env directly |
| `auth-client.ts` depends on `auth.server.ts` type | Both stay in `@workspace/auth` — type-only import works within same package                               |
