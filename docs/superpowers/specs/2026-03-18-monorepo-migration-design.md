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
│           ├── components/
│           │   ├── account/
│           │   ├── admin/
│           │   ├── auth/
│           │   └── workspace/
│           ├── hooks/                # App-specific hooks
│           ├── lib/                  # App-specific utils
│           ├── middleware/
│           │   └── admin.ts          # Admin middleware (imports @workspace/auth)
│           ├── routes/               # All routes stay in app
│           ├── test/                 # App-level test mocks
│           └── types/
│
└── packages/
    ├── ui/
    │   ├── package.json
    │   ├── components.json
    │   ├── tsconfig.json
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
    │       ├── email-request-context.server.ts
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
    │       ├── index.ts              # Public API: auth client, types, re-exports
    │       ├── auth.server.ts        # betterAuth() config (accepts db, email config)
    │       ├── auth-client.ts        # createAuthClient()
    │       ├── auth-emails.server.ts # Email hook wiring
    │       ├── auth.permissions.ts   # Permission definitions
    │       ├── middleware.ts          # validateAuthSession, validateGuestSession
    │       └── schemas/              # Auth-related Zod schemas
    │
    ├── billing/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── index.ts              # Public API: plan helpers, types
    │       ├── plans.ts              # Plan definitions, limits, pure helpers
    │       ├── billing.server.ts     # Stripe helpers, DB queries
    │       └── billing.functions.ts  # createServerFn wrappers
    │
    └── test-utils/
        ├── package.json
        └── src/
            ├── index.ts
            └── factories.ts          # createMockUser, createMockSession, etc.
```

---

## 3. Package Dependency Graph

```
@workspace/ui          (no internal deps)
@workspace/db          (no internal deps)
@workspace/email       (no internal deps)
@workspace/auth     →  @workspace/db, @workspace/email
@workspace/billing  →  @workspace/db, @workspace/auth
@workspace/test-utils → @workspace/db, @workspace/auth (devDependencies)
apps/web            →  all packages
```

No circular dependencies. Extraction order follows this graph bottom-up.

---

## 4. Package Export Contracts

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
    "./middleware": "./src/middleware.ts",
    "./schemas/*": "./src/schemas/*.ts"
  }
}
```

### `@workspace/billing`

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./plans": "./src/plans.ts",
    "./server": "./src/billing.server.ts",
    "./functions": "./src/billing.functions.ts"
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

## 5. Import Rewrite Map

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
| `@/auth/auth.permissions`              | `@workspace/auth` (re-exported)                |
| `@/middleware/auth`                    | `@workspace/auth/middleware`                   |
| `@/billing/plans`                      | `@workspace/billing/plans`                     |
| `@/billing/billing.server`             | `@workspace/billing/server`                    |
| `@/billing/billing.functions`          | `@workspace/billing/functions`                 |

The `@/*` alias continues to work within `apps/web/` for app-local imports.

---

## 6. Environment Variable Strategy

### Principle

Packages never read `process.env` directly at runtime. They accept configuration via factory functions (dependency injection). Each workspace owns its own `.env` for CLI tooling needs.

### Runtime (App → Package)

```typescript
// apps/web initializes packages with config from its .env
import { createDb } from '@workspace/db';
import { createEmailClient } from '@workspace/email';

const db = createDb(process.env.DATABASE_URL!);
const emailClient = createEmailClient({
  apiKey: process.env.RESEND_API_KEY!,
  fromEmail: process.env.RESEND_FROM_EMAIL!,
  replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
});
```

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
```

`packages/db/.env` contains only `DATABASE_URL`. Gitignored. Documented in `packages/db/.env.example`.

`apps/web/.env` contains all app env vars. Gitignored. Documented in `apps/web/.env.example`.

### CI

Environment variables injected by CI platform. No `.env` files needed.

---

## 7. Dependency Injection Patterns

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
```

### Auth

```typescript
// packages/auth/src/auth.server.ts
export function createAuth(config: { db: Database; email: EmailClient; ... }) {
  return betterAuth({ ... });
}
```

### Billing

```typescript
// packages/billing/src/billing.server.ts
export function createBillingService(config: { db: Database; auth: Auth; stripeSecretKey: string }) { ... }
```

The app wires everything together in a central initialization module.

---

## 8. CSS & Tailwind Strategy

`globals.css` moves to `packages/ui/src/styles/globals.css` and includes `@source` directives to scan across package boundaries:

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@source "../../../apps/**/*.{ts,tsx}";
@source "../../auth/src/**/*.{ts,tsx}";
@source "../../billing/src/**/*.{ts,tsx}";
@source "../**/*.{ts,tsx}";

/* OKLCH theme variables, @theme block, etc. */
```

The app imports this CSS in `__root.tsx`:

```typescript
import appCss from '@workspace/ui/globals.css?url';
```

---

## 9. Test Strategy

### Ownership

Each package owns its tests. Tests that validate package logic move with the package.

| Package              | Tests                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| `@workspace/ui`      | UI component tests, shared hook tests                                  |
| `@workspace/db`      | Schema/table definition tests                                          |
| `@workspace/email`   | Email template tests, sendEmail tests                                  |
| `@workspace/auth`    | Auth middleware tests, auth helper tests, permission tests             |
| `@workspace/billing` | Plan helper tests, billing server tests                                |
| `apps/web`           | Route tests, workspace/account/admin domain tests, app component tests |

### Shared Test Utilities

`@workspace/test-utils` provides shared factories (`createMockUser`, `createMockSession`, etc.) used by multiple packages and the app.

### Configuration

Each package with tests has its own `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

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

## 10. Migration Steps (Incremental)

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
8. Move UI component tests to `packages/ui/`
9. **Verify**: `pnpm test`, `pnpm run build`

### Step 3: Extract `packages/db`

1. Create `packages/db` with `package.json`, `tsconfig.json`, `vitest.config.ts`
2. Move `src/db/*` → `packages/db/src/`
3. Convert DB client to factory: `createDb(connectionString)`
4. Move `drizzle.config.ts` and `drizzle/` to `packages/db/`
5. Move `scripts/patch-auth-schema.ts` to `packages/db/scripts/`
6. Set up `packages/db/.env.example` with `DATABASE_URL`
7. Move db commands and `gen-auth-schema` to `packages/db/package.json` with `dotenv-cli`
8. Rewrite `@/db` → `@workspace/db`
9. Move db-related tests
10. **Verify**: `pnpm test`, `pnpm run build`

### Step 4: Extract `packages/email`

1. Create `packages/email` with `package.json`, `tsconfig.json`, `vitest.config.ts`
2. Move `src/email/*` → `packages/email/src/`
3. Move `src/components/email-template/*` → `packages/email/src/templates/`
4. Convert to factory: `createEmailClient(config)`
5. Rewrite email imports
6. Move email-related tests
7. **Verify**: `pnpm test`, `pnpm run build`

### Step 5: Extract `packages/auth`

1. Create `packages/auth` with `package.json`, `tsconfig.json`, `vitest.config.ts`
2. Add `@workspace/db` and `@workspace/email` as dependencies
3. Move `src/auth/*` → `packages/auth/src/`
4. Move `src/middleware/auth.ts` → `packages/auth/src/middleware.ts`
5. Convert to factory: `createAuth(config)` accepting db + email + env config
6. `src/middleware/admin.ts` stays in app, imports from `@workspace/auth`
7. Rewrite auth imports
8. Move auth/middleware tests
9. **Verify**: `pnpm test`, `pnpm run build`

### Step 6: Extract `packages/billing`

1. Create `packages/billing` with `package.json`, `tsconfig.json`, `vitest.config.ts`
2. Add `@workspace/db` and `@workspace/auth` as dependencies
3. Move `src/billing/*` → `packages/billing/src/`
4. Convert to factory: `createBillingService(config)`
5. Rewrite billing imports
6. Move billing tests
7. **Verify**: `pnpm test`, `pnpm run build`

### Step 7: Create `packages/test-utils` (if needed)

1. Extract shared test factories from `apps/web/src/test/`
2. Publish as `@workspace/test-utils`
3. Update package and app test files to import from `@workspace/test-utils`
4. **Verify**: `pnpm test`

### Step 8: Final Cleanup

1. Remove empty directories from `apps/web/src/`
2. Grep for stale `@/` imports referencing moved modules
3. Run full suite: `pnpm run check`, `pnpm test`, `pnpm run build`
4. Verify `pnpm run dev` works end-to-end

---

## 11. What Doesn't Change

- **Routing**: All routes stay in `apps/web/src/routes/`, file-based routing unchanged
- **`routeTree.gen.ts`**: Auto-generated, never edited
- **Workspace domain**: `src/workspace/` stays in `apps/web/`
- **Account domain**: `src/account/` stays in `apps/web/`
- **Admin domain**: `src/admin/` stays in `apps/web/`
- **App-specific components**: `src/components/account/`, `admin/`, `auth/`, `workspace/` stay in app
- **`@/*` alias**: Works within `apps/web/` for app-local imports
- **Server function pattern**: `*.functions.ts` / `*.server.ts` / `*.ts` convention unchanged
- **Runtime behavior**: The app behaves identically after migration

---

## 12. Risks & Mitigations

| Risk                                          | Mitigation                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Broken imports after mass rewrite             | Incremental steps with `pnpm run build` + `pnpm test` after each                            |
| Tailwind classes not detected across packages | `@source` directives in `globals.css` explicitly scan all packages and apps                 |
| Circular dependencies between packages        | Dependency graph is acyclic by design; auth depends on db+email, billing depends on db+auth |
| `gen-auth-schema` breaks with new paths       | Update CLI flags and patch script paths in Step 3                                           |
| Test mocks break with new import paths        | Update `vi.mock()` paths when moving each package                                           |
| shadcn CLI `add` breaks                       | Two `components.json` files configured to target `packages/ui`                              |
| Environment variables not found               | Factory functions for runtime; `dotenv-cli` for CLI tools; CI injects env directly          |
