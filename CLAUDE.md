# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Turborepo monorepo for a SaaS starter template. Main web app built with TanStack Start, React 19, and shadcn/ui. Shared packages for auth, database, email, and UI. File-based routing, Tailwind CSS v4, strict TypeScript.

## Tech Stack

| Layer          | Technology                                                    |
| -------------- | ------------------------------------------------------------- |
| Framework      | TanStack Start + TanStack Router v1 + TanStack Query v5       |
| UI             | React 19, shadcn/ui (base-vega style), Base UI                |
| Styling        | Tailwind CSS v4, OKLCH color system, tw-animate               |
| Icons          | Tabler Icons (`@tabler/icons-react`)                          |
| Data tables    | TanStack Table v8                                             |
| Charts         | Recharts                                                      |
| Validation     | Zod v4                                                        |
| Testing        | Vitest + Testing Library (unit/integration), Playwright (e2e) |
| Linting        | ESLint (TanStack config) + Prettier                           |
| Build          | Vite 7, Nitro (server)                                        |
| Monorepo       | Turborepo, pnpm workspaces                                    |
| Package mgr    | pnpm                                                          |
| Language       | TypeScript 5.9 (strict mode)                                  |
| Database       | Neon PostgreSQL                                               |
| ORM            | Drizzle ORM                                                   |
| Authentication | Better Auth                                                   |

## Project Structure

```
apps/
└── web/                        # Main web application (@workspace/web)
    ├── test/
    │   ├── e2e/                # Playwright E2E tests (*.spec.ts)
    │   ├── integration/        # Vitest integration tests (*.integration.test.tsx)
    │   ├── unit/               # Vitest unit tests (*.test.{ts,tsx})
    │   └── mocks/              # Shared test mocks (auth, db, router)
    └── src/
        ├── account/            # Account-domain server functions and schemas.
        ├── admin/              # Admin-domain server functions and schemas.
        ├── billing/            # Billing/subscription server functions and schemas.
        ├── components/         # Reusable React UI and feature components.
        │   └── (account/, admin/, auth/, workspace/ sub-dirs)
        ├── hooks/              # Shared custom React hooks.
        ├── lib/                # Framework-agnostic utilities and shared helpers.
        ├── middleware/          # Request middleware for auth and admin gating.
        ├── routes/             # TanStack Router file-based route modules.
        │   ├── _auth/          # Public authentication route segment files.
        │   ├── _protected/     # Protected route segment files behind auth middleware.
        │   │   ├── _account/   # Protected account pages.
        │   │   ├── admin/      # Protected admin pages and nested admin routes.
        │   │   └── ws/         # Protected workspace routes.
        │   └── api/            # API route segment files.
        ├── types/              # Project-level TypeScript type declarations.
        └── workspace/          # Workspace-domain client logic and server functions.
packages/
├── auth/                       # Better Auth server/client setup, permissions, schemas (@workspace/auth)
├── db/                         # Drizzle ORM schema and database client (@workspace/db)
├── email/                      # Email provider integration and templates (@workspace/email)
├── eslint-config/              # Shared ESLint configuration (@workspace/eslint-config)
├── test-utils/                 # Shared test utilities (@workspace/test-utils)
└── ui/                         # shadcn/ui components, hooks, and styles (@workspace/ui)
```

## Commands

| Command                      | Description                                                         |
| ---------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                   | Start dev server on port 3000                                       |
| `pnpm run build`             | Production build                                                    |
| `pnpm run preview`           | Preview production build                                            |
| `pnpm test`                  | Run unit + integration tests with Vitest                            |
| `pnpm test:e2e`              | Run E2E tests with Playwright (all browsers)                        |
| `pnpm web:test:e2e:chromium` | Run E2E tests with Chromium only (fastest)                          |
| `pnpm web:test:e2e:ui`       | Run E2E tests with Playwright UI mode (interactive)                 |
| `pnpm web:test:e2e:report`   | Show Playwright HTML test report                                    |
| `pnpm run lint`              | Lint with ESLint                                                    |
| `pnpm run lint:fix`          | Fix lint issues                                                     |
| `pnpm run typecheck`         | TypeScript type-check without emitting                              |
| `pnpm run check`             | Type-check + lint                                                   |
| `pnpm run format`            | Format code with Prettier                                           |
| `pnpm run db:generate`       | Generate Drizzle migration files                                    |
| `pnpm run db:migrate`        | Apply migrations                                                    |
| `pnpm run db:push`           | Push schema directly (dev only)                                     |
| `pnpm run db:studio`         | Open Drizzle Studio                                                 |
| `pnpm run gen-auth-schema`   | Regenerate `packages/db/src/auth.schema.ts` from Better Auth config |

To run a single unit/integration test: `pnpm --filter @workspace/web test test/unit/workspace/workspace.test.ts`
To run a single E2E test: `pnpm --filter @workspace/web test:e2e test/e2e/example.spec.ts`

## Architecture

### Workspace Model

Workspaces are implemented as **Better Auth organizations** with two additional fields on the `organization` table:

- `workspaceType`: `"personal"` | `"workspace"`
- `personalOwnerUserId`: set only for personal workspaces

Every user gets a personal workspace automatically created on sign-up (via `databaseHooks.user.create` in `packages/auth/src/auth.server.ts`). The active workspace is tracked via Better Auth's `activeOrganizationId` on the session. Workspace logic lives in `packages/auth/src/` (core) and `apps/web/src/workspace/` (UI/functions).

### Routing Architecture

File-based routing in `apps/web/src/routes/`. Key segments:

- `__root.tsx` — HTML shell, global providers
- `_auth.tsx` / `_auth/` — Pathless layout for public auth pages (`/signin`, `/signup`)
- `_protected.tsx` / `_protected/` — Pathless layout with `authMiddleware`; all children require auth
  - `_protected/ws/index.tsx` — Redirects to `/ws/$workspaceId/overview` for the active workspace
  - `_protected/ws/$workspaceId.tsx` — Loader calls `getWorkspaceById` (server fn), verifying membership and switching active workspace
  - `_protected/ws/$workspaceId/` — Per-workspace pages (overview, members, settings, projects)
  - `_protected/_account/` — Account settings pages
  - `_protected/admin/` — Admin pages (gated by `adminMiddleware`)
- `apps/web/src/routeTree.gen.ts` — **Auto-generated; never edit manually**

Route conventions:

- Layout routes use `_` prefix (e.g., `_auth.tsx`).
- Each route exports `Route` using `createFileRoute()`.

### Server Functions & File Boundaries

Data fetching and mutations use `createServerFn()` from `@tanstack/react-start`. These run on the server and are called from route loaders or client components. See `apps/web/src/workspace/workspace.functions.ts` for examples.

Split server-side code by responsibility using these file roles:

| Suffix             | Role                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `*.functions.ts`   | `createServerFn` wrappers — safe to import anywhere; only the handler runs on the server.    |
| `*.server.ts`      | Server-only helpers (DB queries, internal logic, secrets). Import only from server contexts. |
| `*.ts` (no suffix) | Client-safe shared code (types, schemas, constants, pure utilities).                         |

**Import rules:**

- Never import `*.server.ts` from client-safe files or route components.
- Only `*.functions.ts` (and other `*.server.ts` files) may import `*.server.ts`.
- Routes call server functions from `*.functions.ts`.

```ts
// ✅ Route imports server function wrapper.
import { updateUserRole } from '@/utils/users.function';

// ❌ Route importing server-only module directly.
import { updateUserRoleInDb } from '@/utils/users.server';
```

`packages/email/src/templates/` is server-only — never import from client code.

### Auth

Better Auth configured in `packages/auth/src/auth.server.ts`. Client-side auth via `authClient` from `packages/auth/src/auth-client.ts`.

Plugins active: `organization` (workspaces), `admin`, `lastLoginMethod`, `tanstackStartCookies`.

Middleware in `apps/web/src/middleware/auth.ts`:

- `authMiddleware` — Checks session + email verification, ensures active workspace, used on `_protected.tsx`
- `guestMiddleware` — Redirects authenticated users to `/ws`, used on `_auth.tsx`

Admin user IDs are whitelisted directly in `packages/auth/src/auth.server.ts` (`admin({ adminUserIds: [...] })`).

### Database

Drizzle ORM with PostgreSQL (Neon). Schema entry point: `packages/db/src/schema.ts` re-exports `auth.schema.ts` (Better Auth tables, managed by `gen-auth-schema` script) and `app.schema.ts` (application tables). Database client: `packages/db/src/index.ts`.

### Testing

Three test types, each in its own directory under `apps/web/test/` (or `packages/*/test/`):

| Type        | Directory           | Runner     | File pattern                  |
| ----------- | ------------------- | ---------- | ----------------------------- |
| Unit        | `test/unit/`        | Vitest     | `*.test.{ts,tsx}`             |
| Integration | `test/integration/` | Vitest     | `*.integration.test.{ts,tsx}` |
| E2E         | `test/e2e/`         | Playwright | `*.spec.ts`                   |

- Unit tests mirror `src/` structure (e.g., `test/unit/components/auth/signin-form.test.tsx`).
- Shared mocks live in `test/mocks/` (auth, db, router).
- Playwright config: `apps/web/playwright.config.ts`. Vitest config: `apps/web/vitest.config.ts`.

## Conventions

### General

- **Package manager**: pnpm only — never use npm, yarn, or bun.
- **Path alias**: `@/*` maps to `src/*` within each app/package.
- **Workspace imports**: `@workspace/auth`, `@workspace/db`, `@workspace/email`, `@workspace/ui` for cross-package imports.
- **Imports**: React first, then external packages, then `@workspace/*`, then `@/*` aliases.

### File Naming

- Components: `kebab-case.tsx` (e.g., `login-form.tsx`, `app-sidebar.tsx`).
- Exports: PascalCase for components (e.g., `LoginForm`, `AppSidebar`).
- Hooks: `use-kebab-case.ts` (e.g., `use-mobile.ts`).
- Routes: filenames determine URL paths (file-based routing).

### Components

- Functional components only — no class components.
- Use `cn()` from `@/lib/utils` for conditional class merging.
- Use CVA (`class-variance-authority`) for component variants.
- Use `React.ComponentProps<'element'>` for extending HTML element props.
- Icons: `@tabler/icons-react`.

### Styling

- Tailwind CSS utility classes — no CSS modules or styled-components.
- CSS custom properties (OKLCH) for theming — defined in `packages/ui/src/styles/`.
- Dark mode via `.dark` class; mobile-first responsive design.

### TypeScript

- Strict mode (`strict`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`).
- No `any` types — prefer `unknown` and narrow with type guards.
- Use Zod v4 schemas for runtime validation.

### shadcn/ui

- Style: `base-vega`; base color: `zinc`.
- Add components via `pnpx shadcn@latest add <component>`.
- Never manually edit files in `packages/ui/src/components/`.

## Code Quality

### Clean Code

**Constants over magic numbers** — Replace hard-coded values with named constants. Keep constants at the top of the file or in a dedicated constants file.

**Meaningful names** — Variables, functions, and classes should reveal purpose. Names should explain why something exists and how it is used. Avoid abbreviations unless universally understood.

**Smart comments** — Comments explain _why_, not _what_. Make code self-documenting; use comments for complex algorithms, non-obvious side effects, and API documentation. Always end comments with a period.

**Single responsibility** — Each function should do exactly one thing and be small and focused. If a function needs a comment to explain what it does, split it.

**DRY** — Extract repeated code into reusable functions. Share common logic through proper abstraction. Maintain single sources of truth.

**Encapsulation** — Hide implementation details, expose clear interfaces, and move nested conditionals into well-named functions.

### Proper Solutions Over Workarounds

Fix root causes rather than papering over symptoms.

- **Fix at the source**: Address root causes, not symptoms.
- **Use intended APIs**: Prefer library-recommended patterns (optimistic updates, proper cache invalidation) over compensating logic.
- **Single source of truth**: Avoid parallel state (refs, local copies) that can drift from real data.
- **TypeScript**: Validate or narrow types rather than casting with `as`.
- **Error handling contracts**: Find and use concrete library error types/contracts instead of shape-probing unknown error objects.

When unsure: research the recommended approach for the library, fix the architecture (queries, state flow) rather than adding compensating logic, and prefer a small correct refactor over a quick workaround.

## Do Not

- Edit `apps/web/src/routeTree.gen.ts` — it is auto-generated by the router plugin.
- Manually edit files in `packages/ui/src/components/` — use the shadcn CLI to update them.
- Use `npm`, `yarn`, or `bun` — this project uses pnpm.
- Commit `.env` files or secrets.
- Use `any` type — prefer proper typing or `unknown` with guards.
- Import `*.server.ts` modules from client-safe files or route components.
- Import from `packages/email/src/templates/` in client code.

## Command Execution Rules

- **Always run from the project root.** Never `cd` into subdirectories.
- **Be consistent.** Use the same CLI tool and invocation pattern every time. Never mix `npx`/`pnpm exec`/direct paths for the same tool.
- **Use `pnpm` for package management.** Never use `npm`, `yarn`, `bun`, or `npx`.
- **Pre-approve CLIs**: Before executing a multi-step task, identify **all** CLI tools needed (`pnpm`, `git`, `node`, `find`, `python3`, etc.) and run a benign command for each (e.g., `--version`) to trigger permission approval upfront. Avoids and minimizes interruptions mid-task.
- **Subagents follow the same rules.** Include these rules in subagent prompts.
- **Use rg (ripgrep) over grep command** for performance gain.

<!-- intent-skills:start -->

# Skill mappings - when working in these areas, load the linked skill file into context.

skills:

- task: "Adding or modifying routes (file-based routing, createFileRoute, route tree)"
  load:
  - "node_modules/.pnpm/@tanstack+router-core@\*/node_modules/@tanstack/router-core/skills/router-core/SKILL.md"
  - "apps/web/node_modules/@tanstack/router-plugin/skills/router-plugin/SKILL.md"
- task: "Writing or updating server functions (createServerFn, loaders, mutations)"
  load: "node_modules/.pnpm/@tanstack+start-client-core@\*/node_modules/@tanstack/start-client-core/skills/start-core/server-functions/SKILL.md"
- task: "Route protection, auth guards, middleware (authMiddleware, beforeLoad, redirect)"
  load:
  - "node_modules/.pnpm/@tanstack+router-core@\*/node_modules/@tanstack/router-core/skills/router-core/auth-and-guards/SKILL.md"
  - "node_modules/.pnpm/@tanstack+start-client-core@\*/node_modules/@tanstack/start-client-core/skills/start-core/middleware/SKILL.md"
- task: "Search params and data loading (route loaders, loaderDeps, staleTime, validateSearch)"
  load:
  - "node_modules/.pnpm/@tanstack+router-core@\*/node_modules/@tanstack/router-core/skills/router-core/data-loading/SKILL.md"
  - "node_modules/.pnpm/@tanstack+router-core@\*/node_modules/@tanstack/router-core/skills/router-core/search-params/SKILL.md"
- task: "SSR, head management, deployment (HeadContent, Scripts, document shell)"
  load:
  - "node_modules/.pnpm/@tanstack+start-client-core@\*/node_modules/@tanstack/start-client-core/skills/start-core/SKILL.md"
  - "node_modules/.pnpm/@tanstack+router-core@\*/node_modules/@tanstack/router-core/skills/router-core/ssr/SKILL.md"
  <!-- intent-skills:end -->
