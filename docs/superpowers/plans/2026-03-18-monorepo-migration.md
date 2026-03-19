# Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate single-app SaaS starter to a Turborepo monorepo with shared packages (`ui`, `db`, `email`, `auth`, `billing`, `test-utils`).

**Architecture:** Scaffold a fresh monorepo with `shadcn init --monorepo`, move the existing app into `apps/web/`, then incrementally extract packages bottom-up following the dependency graph: `ui` → `db` → `email` → `auth` → `billing` → `test-utils`. Each package uses dependency injection (factory functions) and ships raw TypeScript (no build step). TanStack Start framework primitives (`createServerFn`, `createMiddleware`, `getRequestHeaders`) stay in the app.

**Tech Stack:** pnpm, Turborepo, TanStack Start, React 19, shadcn/ui, Drizzle ORM, Better Auth, Stripe, Resend, Vitest

**Spec:** `docs/superpowers/specs/2026-03-18-monorepo-migration-design.md`

---

## Chunk 1: Scaffold & Move App

### Task 0: Scaffold Monorepo Skeleton

**Files:**

- Create (via scaffold, then move): root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.prettierrc`, `.prettierignore`, `.gitignore`
- Create (via scaffold): `apps/web/` skeleton, `packages/ui/` skeleton

- [ ] **Step 0.1: Scaffold into temp directory**

```bash
cd /private/tmp/claude && rm -rf saas-starter-template && pnpm dlx shadcn@latest init -t start -b base -p maia --monorepo -n saas-starter-template --yes
```

Expected: Directory `/private/tmp/claude/saas-starter-template/` created with monorepo structure.

- [ ] **Step 0.2: Inspect scaffold output**

List the scaffold structure to understand what was generated:

```bash
find /private/tmp/claude/saas-starter-template -not -path '*/node_modules/*' -not -path '*/.git/*' | head -100
```

Read key files: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `packages/ui/package.json`, `packages/ui/components.json`, `apps/web/components.json`, `packages/ui/src/styles/globals.css`, `packages/ui/src/lib/utils.ts`.

Record the exact content of these files — you'll need them as the target configuration.

- [ ] **Step 0.3: Clear current worktree and copy scaffold root config**

The working directory is `/Users/sfung/src/sass-starter-template/.claude/worktrees/conv-to-monorepo-claude`.

**IMPORTANT**: Do NOT delete the current `src/`, `.git/`, `.claude/`, `.serena/`, `docs/`, `CLAUDE.md`, or `drizzle/` directories. Only copy in the new root-level monorepo config files from the scaffold.

Copy from scaffold to worktree root:

- `pnpm-workspace.yaml`
- `turbo.json`

For `package.json`, `tsconfig.json`, `.gitignore`, `.prettierrc`, `.prettierignore`: merge the scaffold versions with the existing ones. The root `package.json` should have:

- `"name": "saas-starter-template"`
- `"private": true`
- Turbo scripts: `"dev"`, `"build"`, `"lint"`, `"typecheck"`, `"check"`, `"format"`, `"test"` — all delegating to `turbo run <task>`
- `devDependencies`: `turbo`, `prettier`, `prettier-plugin-tailwindcss`, `typescript` (shared)
- NO app-level dependencies (those go in `apps/web/package.json`)

The root `tsconfig.json` should be minimal (base config extended by all packages/apps).

- [ ] **Step 0.4: Create `apps/web/` directory structure**

```bash
mkdir -p apps/web
```

- [ ] **Step 0.5: Copy scaffold `packages/ui/`**

Copy the entire `packages/ui/` directory from the scaffold into the worktree:

```bash
cp -r /private/tmp/claude/saas-starter-template/packages/ui packages/ui
```

This gives us the correctly configured UI package with `package.json` (wildcard exports), `components.json`, `tsconfig.json`, `src/lib/utils.ts` (cn), `src/styles/globals.css`, and the scaffold's sample button component.

- [ ] **Step 0.6: Copy scaffold `apps/web/components.json`**

Copy the app-level shadcn config that points `shadcn add` to the UI package:

```bash
cp /private/tmp/claude/saas-starter-template/apps/web/components.json apps/web/components.json
```

- [ ] **Step 0.7: Verify pnpm install**

```bash
pnpm install
```

Expected: Install succeeds. `node_modules/` created at root with hoisted packages. Workspace links established.

- [ ] **Step 0.8: Commit scaffold**

```bash
git add -A && git commit -m "chore: scaffold monorepo skeleton with turbo and shadcn ui package"
```

---

### Task 1: Move Existing App into `apps/web/`

This is the most delicate step. The goal is to move the existing app code into `apps/web/` while keeping it functional.

**Files:**

- Move to `apps/web/`: `src/`, `vite.config.ts`, `eslint.config.js`, `vitest.config.ts`, `vitest.setup.ts`, `components.json` (keep scaffold version already there)
- Move to `apps/web/`: `.env`, `.env.example`
- Keep at root: `.husky/`, `CLAUDE.md`, `docs/`, `.claude/`, `.serena/`, `drizzle/` (temporarily — moves in Task 3)
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`

- [ ] **Step 1.1: Move app source and config into `apps/web/`**

```bash
# Move source code.
mv src apps/web/src

# Move app config files.
mv vite.config.ts apps/web/vite.config.ts
mv eslint.config.js apps/web/eslint.config.js
mv vitest.config.ts apps/web/vitest.config.ts
mv vitest.setup.ts apps/web/vitest.setup.ts

# Move env files to app.
mv .env apps/web/.env 2>/dev/null || true
mv .env.example apps/web/.env.example

# Move drizzle config and migrations to app (temporarily — moves to packages/db in Task 3).
mv drizzle.config.ts apps/web/drizzle.config.ts
mv drizzle apps/web/drizzle

# Move scripts (temporarily — patch-auth-schema moves to packages/db in Task 3).
mv scripts apps/web/scripts
```

- [ ] **Step 1.2: Create `apps/web/package.json`**

Create `apps/web/package.json` with ALL dependencies from the original root `package.json`. The `name` should be `@workspace/web`. Include all `dependencies` and `devDependencies` from the original (excluding shared ones already in root). Keep the same `scripts` as the original `package.json` (dev, build, test, lint, etc.) but adjust paths.

Read the original root `package.json` (it should still have the full dependency list from before the scaffold merge). Copy all dependencies and devDependencies to `apps/web/package.json`.

Key scripts for `apps/web/package.json`:

```json
{
  "name": "@workspace/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev --port 3000",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "lint": "eslint",
    "lint:fix": "eslint --fix",
    "typecheck": "tsc --noEmit",
    "check": "tsc --noEmit && eslint",
    "format": "prettier --write ./src",
    "dev:stripe-webhook": "stripe listen --forward-to localhost:3000/api/auth/stripe/webhook"
  }
}
```

Add `@workspace/ui` as a dependency: `"@workspace/ui": "workspace:*"`.

- [ ] **Step 1.3: Create `apps/web/tsconfig.json`**

Create `apps/web/tsconfig.json` that extends the root base config. It must include:

- `"extends": "../../tsconfig.json"` (or the scaffold's pattern)
- `"compilerOptions.paths"`: `"@/*": ["./src/*"]` and `"@workspace/ui/*": ["../../packages/ui/src/*"]`
- All the strict settings from the original `tsconfig.json`
- The `include`, `lib`, `target`, `jsx` settings from the original

Read the scaffold's `apps/web/tsconfig.json` for the correct `extends` pattern, then merge with the original strict settings.

- [ ] **Step 1.4: Update `apps/web/vite.config.ts` paths**

Read the current `apps/web/vite.config.ts`. Ensure the `viteTsConfigPaths` plugin points to the correct tsconfig:

```typescript
viteTsConfigPaths({ projects: ['./tsconfig.json'] });
```

No other changes needed — paths are relative to the config file location.

- [ ] **Step 1.5: Update `apps/web/vitest.config.ts` paths**

Read the current `apps/web/vitest.config.ts`. Ensure setup file path is correct:

```typescript
setupFiles: ['./vitest.setup.ts'];
```

- [ ] **Step 1.6: Update `apps/web/drizzle.config.ts` paths**

Read the current `apps/web/drizzle.config.ts`. Update the schema path:

```typescript
schema: './src/db/schema.ts',
out: './drizzle',
```

The `dotenv` path stays `'.env'` since `.env` is now in `apps/web/`.

- [ ] **Step 1.7: Update root `package.json`**

Ensure the root `package.json` has Turbo-delegating scripts and ONLY shared devDependencies. Keep `"prepare": "husky || echo 'Skip installing husky'"` and the `"lint-staged"` config at the root level (these are monorepo-wide concerns). Remove any app-level dependencies that were left from the merge:

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "check": "turbo run check",
    "test": "turbo run test",
    "format": "turbo run format"
  }
}
```

- [ ] **Step 1.8: Run pnpm install**

```bash
pnpm install
```

Expected: Resolves all workspace dependencies.

- [ ] **Step 1.9: Update imports in `apps/web/src/styles.css`**

The app's `src/styles.css` currently imports Tailwind. This will eventually be replaced by `@workspace/ui/globals.css`, but for now, ensure it still works from its new location.

Read `apps/web/src/styles.css` — if paths are relative, they should still work since `src/` is inside `apps/web/`.

- [ ] **Step 1.10: Verify build**

```bash
cd apps/web && pnpm run build
```

Expected: Build succeeds. Fix any path resolution errors.

- [ ] **Step 1.11: Verify tests**

```bash
cd apps/web && pnpm test
```

Expected: All 47 tests pass. Fix any path issues.

- [ ] **Step 1.12: Commit**

```bash
git add -A && git commit -m "chore: move existing app into apps/web/"
```

---

## Chunk 2: Extract UI Package

### Task 2: Extract `packages/ui`

The scaffold already created `packages/ui/` with the correct `package.json` (wildcard exports), `tsconfig.json`, `components.json`, `src/lib/utils.ts`, and `src/styles/globals.css`. We need to:

1. Replace the scaffold's sample components with our actual shadcn components
2. Move our CSS theme into the UI package's `globals.css`
3. Move the shared `use-mobile` hook
4. Rewrite imports across the app

**Files:**

- Move to `packages/ui/src/components/`: all 28 files from `apps/web/src/components/ui/`
- Move to `packages/ui/src/hooks/`: `apps/web/src/hooks/use-mobile.ts`
- Move to `packages/ui/src/styles/globals.css`: theme/CSS from `apps/web/src/styles.css`
- Modify: all files in `apps/web/` that import `@/components/ui/*` or `@/lib/utils`
- Move tests: `apps/web/src/lib/utils.test.ts` → `packages/ui/src/lib/utils.test.ts`

- [ ] **Step 2.1: Remove scaffold sample components**

The scaffold may have created a sample `button.tsx` in `packages/ui/src/components/`. Remove it:

```bash
rm -f packages/ui/src/components/button.tsx
```

- [ ] **Step 2.2: Move all shadcn components to UI package**

```bash
mv apps/web/src/components/ui/* packages/ui/src/components/
rmdir apps/web/src/components/ui
```

Components being moved (28 files): `alert-dialog.tsx`, `avatar.tsx`, `badge.tsx`, `breadcrumb.tsx`, `button.tsx`, `card.tsx`, `chart.tsx`, `checkbox.tsx`, `combobox.tsx`, `drawer.tsx`, `dropdown-menu.tsx`, `field.tsx`, `input-group.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`, `skeleton.tsx`, `sonner.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `toggle-group.tsx`, `toggle.tsx`, `tooltip.tsx`.

- [ ] **Step 2.3: Replace UI package's `utils.ts` with our `cn()` implementation**

Read `apps/web/src/lib/utils.ts` and `packages/ui/src/lib/utils.ts`. The scaffold's `utils.ts` should already have `cn()` using `clsx` + `tailwind-merge`. If the implementations differ, replace the scaffold's version with ours. Then delete the app's copy:

```bash
# Compare and replace if needed.
cp apps/web/src/lib/utils.ts packages/ui/src/lib/utils.ts
rm apps/web/src/lib/utils.ts
```

- [ ] **Step 2.4: Move `utils.test.ts` to UI package**

```bash
mv apps/web/src/lib/utils.test.ts packages/ui/src/lib/utils.test.ts
```

- [ ] **Step 2.5: Move `use-mobile` hook to UI package**

```bash
mkdir -p packages/ui/src/hooks
mv apps/web/src/hooks/use-mobile.ts packages/ui/src/hooks/use-mobile.ts
```

- [ ] **Step 2.6: Merge CSS theme into UI package's `globals.css`**

Read `apps/web/src/styles.css` (our current theme with OKLCH variables, Tailwind imports, `@theme` block).
Read `packages/ui/src/styles/globals.css` (scaffold's CSS with Tailwind imports, `@source` directives).

Merge them: the UI package's `globals.css` should have:

1. The scaffold's Tailwind imports (`@import "tailwindcss"`, `@import "tw-animate-css"`)
2. `@source` directives scanning both apps and packages:
   ```css
   @source "../../../apps/**/*.{ts,tsx}";
   @source "../../auth/src/**/*.{ts,tsx}";
   @source "../../billing/src/**/*.{ts,tsx}";
   @source "../../email/src/**/*.{ts,tsx}";
   @source "../**/*.{ts,tsx}";
   ```
3. Our OKLCH theme variables and `@theme inline` block from `src/styles.css`
4. Any custom utility classes from our `src/styles.css`

After merging, delete the app's `src/styles.css`:

```bash
rm apps/web/src/styles.css
```

- [ ] **Step 2.7: Update `__root.tsx` to import CSS from UI package**

Read `apps/web/src/routes/__root.tsx`. Find the CSS import (may be a relative path like `'../styles.css?url'` or an alias like `'@/styles.css?url'`). Replace it with:

```typescript
import appCss from '@workspace/ui/globals.css?url';
```

- [ ] **Step 2.8: Update `apps/web/tsconfig.json` paths**

Ensure `@workspace/ui/*` path mapping is present:

```json
"paths": {
  "@/*": ["./src/*"],
  "@workspace/ui/*": ["../../packages/ui/src/*"]
}
```

- [ ] **Step 2.9: Rewrite UI component imports across the app**

Search and replace across all files in `apps/web/src/`:

| Find                        | Replace                                 |
| --------------------------- | --------------------------------------- |
| `from '@/components/ui/`    | `from '@workspace/ui/components/`       |
| `from "@/components/ui/`    | `from "@workspace/ui/components/`       |
| `from '@/lib/utils'`        | `from '@workspace/ui/lib/utils'`        |
| `from "@/lib/utils"`        | `from "@workspace/ui/lib/utils"`        |
| `from '@/hooks/use-mobile'` | `from '@workspace/ui/hooks/use-mobile'` |
| `from "@/hooks/use-mobile"` | `from "@workspace/ui/hooks/use-mobile"` |

**IMPORTANT**: Also rewrite imports WITHIN the moved UI components. The shadcn components import from each other and from `@/lib/utils`. These need to become `@workspace/ui/components/*` and `@workspace/ui/lib/utils`.

Read the scaffold's UI components to see what import pattern they use internally (likely `@workspace/ui/lib/utils`). Ensure all moved components use the same pattern.

Use grep to find all affected files:

```bash
grep -r "from '@/components/ui/" apps/web/src/ --include="*.ts" --include="*.tsx" -l
grep -r "from '@/lib/utils'" apps/web/src/ --include="*.ts" --include="*.tsx" -l
grep -r "from '@/hooks/use-mobile'" apps/web/src/ --include="*.ts" --include="*.tsx" -l
```

Also rewrite within `packages/ui/src/components/`:

```bash
grep -r "from '@/components/ui/" packages/ui/src/ --include="*.ts" --include="*.tsx" -l
grep -r "from '@/lib/utils'" packages/ui/src/ --include="*.ts" --include="*.tsx" -l
```

- [ ] **Step 2.10: Update UI package dependencies**

Read `packages/ui/package.json`. Ensure it has all dependencies used by the moved components. At minimum: `clsx`, `tailwind-merge`, `class-variance-authority`, `@tabler/icons-react`, `@base-ui/react`, `sonner`, `vaul`, `recharts` (for chart component), `@dnd-kit/*` (if sidebar uses it), `tailwindcss`, `tw-animate-css`.

Check each moved component's imports to determine the exact dependency list.

- [ ] **Step 2.11: Create `packages/ui/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

Create `packages/ui/vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

Add `test` script to `packages/ui/package.json`:

```json
"scripts": {
  "test": "vitest run"
}
```

Add test devDependencies to `packages/ui/package.json`: `vitest`, `vite-tsconfig-paths`, `jsdom`, `@testing-library/jest-dom`.

- [ ] **Step 2.12: Verify build**

```bash
pnpm run build
```

Expected: Build succeeds from root (Turbo runs app build).

- [ ] **Step 2.13: Verify tests**

```bash
pnpm test
```

Expected: All tests pass (app tests + UI package tests).

- [ ] **Step 2.14: Commit**

```bash
git add -A && git commit -m "feat: extract @workspace/ui package with shadcn components, hooks, and theme"
```

---

## Chunk 3: Extract DB Package

### Task 3: Extract `packages/db`

**Files:**

- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/vitest.config.ts`
- Move to `packages/db/src/`: `apps/web/src/db/index.ts`, `apps/web/src/db/schema.ts`, `apps/web/src/db/auth.schema.ts`, `apps/web/src/db/app.schema.ts`
- Move to `packages/db/`: `apps/web/drizzle.config.ts`, `apps/web/drizzle/`
- Move to `packages/db/scripts/`: `apps/web/scripts/patch-auth-schema.ts`
- Create: `packages/db/.env.example`, `apps/web/src/init.ts`
- Modify: `packages/db/src/index.ts` (convert to factory), all files importing `@/db`

- [ ] **Step 3.1: Create `packages/db` directory structure**

```bash
mkdir -p packages/db/src packages/db/scripts
```

- [ ] **Step 3.2: Move DB source files**

```bash
mv apps/web/src/db/index.ts packages/db/src/index.ts
mv apps/web/src/db/schema.ts packages/db/src/schema.ts
mv apps/web/src/db/auth.schema.ts packages/db/src/auth.schema.ts
mv apps/web/src/db/app.schema.ts packages/db/src/app.schema.ts
rmdir apps/web/src/db
```

- [ ] **Step 3.3: Move drizzle config and migrations**

```bash
mv apps/web/drizzle.config.ts packages/db/drizzle.config.ts
mv apps/web/drizzle packages/db/drizzle
```

- [ ] **Step 3.4: Move patch script**

```bash
mv apps/web/scripts/patch-auth-schema.ts packages/db/scripts/patch-auth-schema.ts
rmdir apps/web/scripts 2>/dev/null || true
```

- [ ] **Step 3.5: Convert DB client to factory function**

Read `packages/db/src/index.ts`. Currently it creates a singleton:

```typescript
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });
```

Rewrite to a factory:

```typescript
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

Also re-export schema for convenience:

```typescript
export { schema };
export * from './schema';
```

- [ ] **Step 3.6: Create `packages/db/package.json`**

```json
{
  "name": "@workspace/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts"
  },
  "scripts": {
    "test": "vitest run",
    "db:generate": "dotenv -e .env -- drizzle-kit generate",
    "db:migrate": "dotenv -e .env -- drizzle-kit migrate",
    "db:push": "dotenv -e .env -- drizzle-kit push",
    "db:studio": "dotenv -e .env -- drizzle-kit studio",
    "gen-auth-schema": "dotenv -e .env -- pnpx @better-auth/cli generate --config ../auth/src/auth.server.ts --output ./src/auth.schema.ts --yes && node --experimental-strip-types scripts/patch-auth-schema.ts && eslint --fix ./src/auth.schema.ts && prettier --write ./src/auth.schema.ts"
  },
  "dependencies": {
    "@neondatabase/serverless": "^1.0.2",
    "drizzle-orm": "^0.45.1"
  },
  "devDependencies": {
    "dotenv-cli": "^8.0.0",
    "drizzle-kit": "^0.31.9",
    "vitest": "^4.0.18",
    "vite-tsconfig-paths": "^6.1.0",
    "typescript": "^5.9.3"
  }
}
```

Note: The `gen-auth-schema` script references `../auth/src/auth.server.ts` which won't exist until Task 5. That's fine — the script just won't be usable until then.

- [ ] **Step 3.7: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@workspace/db/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3.8: Create `packages/db/vitest.config.ts`**

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

- [ ] **Step 3.9: Create `packages/db/.env.example`**

```
DATABASE_URL=postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

- [ ] **Step 3.10: Update `packages/db/drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

Remove the `dotenv` import — env is loaded by `dotenv-cli` in the npm script.

- [ ] **Step 3.11: Update schema imports**

Read `packages/db/src/schema.ts`. It currently re-exports from `./auth.schema` and `./app.schema`. These relative imports should still work since the files moved together.

Read `packages/db/src/auth.schema.ts` and `packages/db/src/app.schema.ts`. Ensure their imports (from `drizzle-orm/*`) still resolve.

- [ ] **Step 3.12: Create `apps/web/src/init.ts`**

This is the central initialization module where the app creates package instances:

```typescript
import { createDb } from '@workspace/db';

export const db = createDb(process.env.DATABASE_URL!);
```

This file will grow as we extract more packages (email, auth, billing).

- [ ] **Step 3.13: Update `apps/web/tsconfig.json` paths**

Add the `@workspace/db` path mapping:

```json
"paths": {
  "@/*": ["./src/*"],
  "@workspace/ui/*": ["../../packages/ui/src/*"],
  "@workspace/db": ["../../packages/db/src/index.ts"],
  "@workspace/db/*": ["../../packages/db/src/*"]
}
```

- [ ] **Step 3.14: Rewrite `@/db` imports across the app**

Search and replace in `apps/web/src/`:

| Find                 | Replace                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| `from '@/db'`        | `from '@/init'` (for `db` instance) or `from '@workspace/db'` (for `createDb` type) |
| `from '@/db/schema'` | `from '@workspace/db/schema'`                                                       |
| `from "@/db"`        | see above                                                                           |
| `from "@/db/schema"` | `from "@workspace/db/schema"`                                                       |

**IMPORTANT**: Files that import `db` (the singleton instance) should now import from `@/init` instead. Files that import schema types/tables should import from `@workspace/db/schema`.

Find all affected files:

```bash
grep -r "from ['\"]@/db" apps/web/src/ --include="*.ts" --include="*.tsx" -l
```

For each file, determine whether it needs:

- `import { db } from '@/init'` (runtime usage of the db instance)
- `import { someTable } from '@workspace/db/schema'` (schema types)
- Both

- [ ] **Step 3.15: Verify build**

```bash
pnpm install && pnpm run build
```

- [ ] **Step 3.16: Verify tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 3.17: Commit**

```bash
git add -A && git commit -m "feat: extract @workspace/db package with createDb factory and drizzle config"
```

---

## Chunk 4: Extract Email Package

### Task 4: Extract `packages/email`

**Files:**

- Create: `packages/email/package.json`, `packages/email/tsconfig.json`, `packages/email/vitest.config.ts`
- Move to `packages/email/src/`: `apps/web/src/email/resend.server.ts`, `apps/web/src/email/email-request-context.server.ts`
- Move to `packages/email/src/templates/`: all 5 email templates from `apps/web/src/components/email-template/`
- Move tests: `apps/web/src/email/resend.server.test.ts`, `apps/web/src/components/email-template/email-security-notice.test.tsx`, `apps/web/src/components/email-template/email-templates.test.tsx`
- Modify: `packages/email/src/request-context.ts` (accept Headers param), all email importers

- [ ] **Step 4.1: Create `packages/email` directory structure**

```bash
mkdir -p packages/email/src/templates
```

- [ ] **Step 4.2: Move email source files**

```bash
mv apps/web/src/email/resend.server.ts packages/email/src/resend.server.ts
mv apps/web/src/email/resend.server.test.ts packages/email/src/resend.server.test.ts 2>/dev/null || true
mv apps/web/src/email/email-request-context.server.ts packages/email/src/request-context.ts
rmdir apps/web/src/email 2>/dev/null || true
```

- [ ] **Step 4.3: Move email templates**

```bash
mv apps/web/src/components/email-template/change-email-approval-email.tsx packages/email/src/templates/
mv apps/web/src/components/email-template/email-security-notice.tsx packages/email/src/templates/
mv apps/web/src/components/email-template/email-verification-email.tsx packages/email/src/templates/
mv apps/web/src/components/email-template/reset-password-email.tsx packages/email/src/templates/
mv apps/web/src/components/email-template/workspace-invitation-email.tsx packages/email/src/templates/
```

- [ ] **Step 4.4: Move email tests**

```bash
mv apps/web/src/components/email-template/email-security-notice.test.tsx packages/email/src/templates/email-security-notice.test.tsx
mv apps/web/src/components/email-template/email-templates.test.tsx packages/email/src/templates/email-templates.test.tsx
rmdir apps/web/src/components/email-template
```

- [ ] **Step 4.5: Convert `resend.server.ts` to factory**

Read `packages/email/src/resend.server.ts`. Currently it reads `process.env.RESEND_API_KEY`, `process.env.RESEND_FROM_EMAIL`, `process.env.RESEND_REPLY_TO_EMAIL` directly.

Rewrite to accept config:

```typescript
import { Resend } from 'resend';

export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  replyToEmail?: string;
  /** App name used in email subjects and templates (e.g., "My App"). */
  appName: string;
  /** Prefix subject in dev. Pass `true` or a custom prefix string. */
  devPrefix?: boolean | string;
}

export interface EmailClient {
  sendEmail(params: {
    to: string;
    subject: string;
    react: React.ReactElement;
  }): Promise<void>;
  config: EmailConfig;
}

export function createEmailClient(config: EmailConfig): EmailClient {
  const resend = new Resend(config.apiKey);

  return {
    config,
    async sendEmail({ to, subject, react }) {
      const prefixedSubject = config.devPrefix
        ? `${typeof config.devPrefix === 'string' ? config.devPrefix : '[DEV]'} ${subject}`
        : subject;

      await resend.emails.send({
        from: config.fromEmail,
        replyTo: config.replyToEmail,
        to,
        subject: prefixedSubject,
        react,
      });
    },
  };
}
```

Preserve the original behavior (dev prefix, etc.) while removing all `process.env` reads.

- [ ] **Step 4.6: Refactor `request-context.ts` to accept Headers**

Read `packages/email/src/request-context.ts`. Currently it calls `getRequestHeaders()` from `@tanstack/react-start/server`.

Rewrite to accept a `Headers` parameter:

```typescript
// Before:
import { getRequestHeaders } from '@tanstack/react-start/server';
export function buildEmailRequestContext() {
  const headers = getRequestHeaders();
  // ...
}

// After:
export interface EmailRequestContext {
  ip: string | null;
  city: string | null;
  country: string | null;
  timestamp: string;
}

export function buildEmailRequestContext(
  headers: Headers,
): EmailRequestContext {
  const ip = headers.get('x-forwarded-for') || headers.get('x-real-ip') || null;
  // ... keep the same extraction logic, just using the passed headers
}
```

Remove the `@tanstack/react-start` import entirely.

- [ ] **Step 4.7: Create `packages/email/src/index.ts`**

```typescript
export {
  createEmailClient,
  type EmailConfig,
  type EmailClient,
} from './resend.server';
export {
  buildEmailRequestContext,
  type EmailRequestContext,
} from './request-context';
```

- [ ] **Step 4.8: Create `packages/email/package.json`**

```json
{
  "name": "@workspace/email",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./templates/*": "./src/templates/*.tsx"
  },
  "scripts": {
    "test": "vitest run",
    "dev:email": "pnpx react-email dev --dir src/templates --port 3001"
  },
  "dependencies": {
    "@react-email/components": "^1.0.7",
    "resend": "^6.9.2"
  },
  "devDependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "vitest": "^4.0.18",
    "vite-tsconfig-paths": "^6.1.0",
    "typescript": "^5.9.3",
    "@react-email/preview-server": "5.2.9",
    "react-email": "^5.2.8"
  }
}
```

- [ ] **Step 4.9: Create `packages/email/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "paths": {
      "@workspace/email/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 4.10: Create `packages/email/vitest.config.ts`**

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

- [ ] **Step 4.11: Update `apps/web/src/init.ts`**

Add email client initialization:

```typescript
import { createDb } from '@workspace/db';
import { createEmailClient } from '@workspace/email';

export const db = createDb(process.env.DATABASE_URL!);

export const emailClient = createEmailClient({
  apiKey: process.env.RESEND_API_KEY!,
  fromEmail: process.env.RESEND_FROM_EMAIL!,
  replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
  appName: process.env.VITE_APP_NAME || 'App',
  devPrefix: process.env.NODE_ENV !== 'production',
});
```

- [ ] **Step 4.12: Update `apps/web/tsconfig.json` paths**

Add email path mapping:

```json
"@workspace/email": ["../../packages/email/src/index.ts"],
"@workspace/email/*": ["../../packages/email/src/*"]
```

- [ ] **Step 4.13: Rewrite email imports across the app**

| Find                                          | Replace                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `from '@/email/resend.server'`                | `from '@/init'` (for `emailClient`) or `from '@workspace/email'` (for types) |
| `from '@/email/email-request-context.server'` | `from '@workspace/email'`                                                    |
| `from '@/components/email-template/`          | `from '@workspace/email/templates/`                                          |

Find all affected files:

```bash
grep -r "from ['\"]@/email/" apps/web/src/ --include="*.ts" --include="*.tsx" -l
grep -r "from ['\"]@/components/email-template/" apps/web/src/ --include="*.ts" --include="*.tsx" -l
```

Update the email template test imports within `packages/email/src/templates/` to use relative imports instead of `@/` aliases.

- [ ] **Step 4.14: Update email template internal imports**

Read each moved template file. They may import from `@/email/resend.server` or from each other. Update to use relative imports within the package or `@workspace/email` aliases.

The `email-security-notice.tsx` is imported by other templates — ensure relative imports work.

- [ ] **Step 4.15: Remove `dev:email` script from `apps/web/package.json`**

It now lives in `packages/email/package.json`.

- [ ] **Step 4.16: Verify build**

```bash
pnpm install && pnpm run build
```

- [ ] **Step 4.17: Verify tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 4.18: Commit**

```bash
git add -A && git commit -m "feat: extract @workspace/email package with createEmailClient factory and templates"
```

---

## Chunk 5: Extract Auth Package

### Task 5: Extract `packages/auth`

This is the most complex extraction due to the factory conversion, hooks interface, and multiple file dependencies.

**Files:**

- Create: `packages/auth/package.json`, `packages/auth/tsconfig.json`, `packages/auth/vitest.config.ts`
- Move to `packages/auth/src/`: `auth.server.ts`, `auth-client.ts`, `auth-emails.server.ts`, `auth-hooks.server.ts`, `auth-workspace.server.ts`, `permissions.ts`, `schemas.ts`
- Create: `packages/auth/src/workspace-types.ts`, `packages/auth/src/validators.ts`, `packages/auth/src/index.ts`
- Move tests: `auth-emails.server.test.ts`, `auth-hooks.server.test.ts`, `auth-workspace.server.test.ts`, `schemas.test.ts`, `middleware/auth.test.ts` (for validator logic)
- Modify: `apps/web/src/middleware/auth.ts` (wrap validators), `apps/web/src/init.ts` (add `createAuth`)
- Modify: all files importing from `@/auth/*`

- [ ] **Step 5.1: Create `packages/auth` directory structure**

```bash
mkdir -p packages/auth/src
```

- [ ] **Step 5.2: Move auth source files**

```bash
mv apps/web/src/auth/auth.server.ts packages/auth/src/auth.server.ts
mv apps/web/src/auth/auth-client.ts packages/auth/src/auth-client.ts
mv apps/web/src/auth/auth-emails.server.ts packages/auth/src/auth-emails.server.ts
mv apps/web/src/auth/auth-hooks.server.ts packages/auth/src/auth-hooks.server.ts
mv apps/web/src/auth/auth-workspace.server.ts packages/auth/src/auth-workspace.server.ts
mv apps/web/src/auth/permissions.ts packages/auth/src/permissions.ts
mv apps/web/src/auth/schemas.ts packages/auth/src/schemas.ts
```

- [ ] **Step 5.3: Move auth test files**

```bash
mv apps/web/src/auth/auth-emails.server.test.ts packages/auth/src/auth-emails.server.test.ts
mv apps/web/src/auth/auth-hooks.server.test.ts packages/auth/src/auth-hooks.server.test.ts
mv apps/web/src/auth/auth-workspace.server.test.ts packages/auth/src/auth-workspace.server.test.ts
mv apps/web/src/auth/schemas.test.ts packages/auth/src/schemas.test.ts
rmdir apps/web/src/auth
```

- [ ] **Step 5.4: Create `packages/auth/src/workspace-types.ts`**

Extract workspace type constants from `apps/web/src/workspace/workspace.ts`. Read that file and extract:

Read `apps/web/src/workspace/workspace.ts` carefully — the actual signatures may differ from what you expect.

Key functions/constants to extract (copy the **exact** implementations):

- `PERSONAL_WORKSPACE_TYPE`, `STANDARD_WORKSPACE_TYPE`, `PERSONAL_WORKSPACE_NAME`
- `WORKSPACE_TYPES` array and `WorkspaceType` type
- `PersonalWorkspaceFields` type
- `isPersonalWorkspace(workspace: unknown): boolean` — **takes a full object, not just a string**. It checks `workspace.workspaceType === PERSONAL_WORKSPACE_TYPE` after a `isRecord` guard.
- `isPersonalWorkspaceOwnedByUser(workspace: unknown, userId: string): boolean`
- `buildPersonalWorkspaceSlug(userId: string): string`
- The helper `isRecord(value: unknown)` that `isPersonalWorkspace` depends on (can be inlined or kept private)

Also extract any other constants/helpers from `workspace.ts` that are imported by auth files. Search:

```bash
grep -r "from ['\"]@/workspace/workspace['\"]" packages/auth/src/ apps/web/src/auth/ --include="*.ts"
```

- [ ] **Step 5.5: Create `AuthConfig` interface and convert `auth.server.ts` to factory**

This is the biggest refactor. Read the current `packages/auth/src/auth.server.ts` thoroughly. Then rewrite:

1. Define `AuthConfig` and `AuthHooks` interfaces (per spec Section 7)
2. Replace module-level `process.env` reads with `config.*` properties
3. Replace `logger()` calls with `config.logger?.() ?? console.log()`
4. Replace billing function imports (`getPlanLimitsForPlanId`, `countOwnedWorkspaces`, etc.) with `config.hooks` callbacks
5. Replace workspace constant imports with imports from `./workspace-types`
6. Export `createAuth(config: AuthConfig)` instead of `export const auth = betterAuth({...})`
7. Export `type Auth = ReturnType<typeof createAuth>`

Key changes:

- `import { db } from '@/db'` → `config.db` (from AuthConfig)
- `import { logger } from '@/lib/logger'` → `config.logger` callback
- `import { sendEmail } from '@/email/resend.server'` → use `config.emailClient`
- `process.env.STRIPE_SECRET_KEY` → `config.stripe.secretKey`
- `process.env.BETTER_AUTH_URL` → `config.baseUrl`
- All billing imports → replaced by `config.hooks`

- [ ] **Step 5.6: Refactor `auth-emails.server.ts` to use config**

Read the current file. It imports `buildEmailRequestContext` (which now accepts Headers) and `sendEmail` (now from email client).

The auth-emails functions are called by Better Auth hooks and need access to the email client and request headers. These should be created as a closure factory:

```typescript
// packages/auth/src/auth-emails.server.ts
import { createElement } from 'react';
import type { EmailClient } from '@workspace/email';
import { buildEmailRequestContext } from '@workspace/email';
// ... import templates from @workspace/email/templates/*

export function createAuthEmails(deps: {
  emailClient: EmailClient;
  getRequestHeaders?: () => Headers;
  appName: string;
}) {
  const { emailClient, getRequestHeaders, appName } = deps;

  return {
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: { email: string };
      url: string;
    }) => {
      const headers = getRequestHeaders?.();
      const requestContext = headers
        ? buildEmailRequestContext(headers)
        : undefined;
      await emailClient.sendEmail({
        to: user.email,
        subject: 'Verify your email address',
        react: createElement(EmailVerificationEmail, {
          appName,
          verificationUrl: url,
          requestContext,
        }),
      });
    },
    // ... same pattern for sendResetPasswordEmail, sendChangeEmailConfirmation, sendInvitationEmail
  };
}
```

The `createAuth` factory internally calls `createAuthEmails(...)` with config values.

- [ ] **Step 5.7: Refactor `auth-workspace.server.ts` to use config**

Replace `resolveAppOrigin()` (which reads `process.env.BETTER_AUTH_URL`) with a function that accepts `baseUrl`:

```typescript
// Before:
const resolveAppOrigin = (): string => {
  const baseUrl = process.env.BETTER_AUTH_URL ...
};
export const buildAcceptInviteUrl = (invitationId: string): string => {
  const origin = resolveAppOrigin();
  ...
};

// After:
export const buildAcceptInviteUrl = (baseUrl: string, invitationId: string): string => {
  const origin = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${origin}/accept-invite?id=${encodeURIComponent(invitationId)}`;
};
```

Update workspace constant imports from `@/workspace/workspace` to `./workspace-types`.

- [ ] **Step 5.8: Create `packages/auth/src/validators.ts`**

**IMPORTANT**: `validateAuthSession` in the current middleware calls `ensureActiveWorkspaceForSession` from `workspace.server.ts`, which imports `auth` and calls `auth.api.listOrganizations` / `auth.api.setActiveOrganization`. Since workspace stays in the app, `validateAuthSession` **cannot move to the auth package**.

Instead, the auth package exports **simpler building blocks** that the app composes with workspace logic:

```typescript
// packages/auth/src/validators.ts
import { redirect } from '@tanstack/react-router';
import type { Auth } from './auth.server';

/** Gets a verified session or throws redirect to /signin. */
export async function getVerifiedSession(headers: Headers, auth: Auth) {
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }
  return session;
}

/** Checks if user is authenticated. If so, throws redirect to /ws. */
export async function validateGuestSession(headers: Headers, auth: Auth) {
  const session = await auth.api.getSession({ headers });
  if (session?.user.emailVerified) {
    throw redirect({ to: '/ws' });
  }
}

/** Gets an admin session or throws redirect to /signin. */
export async function validateAdminSession(headers: Headers, auth: Auth) {
  const session = await auth.api.getSession({ headers });
  if (!session || session.user.role !== 'admin') {
    throw redirect({ to: '/signin' });
  }
  return session;
}
```

The app-level `validateAuthSession` stays in `apps/web/src/middleware/auth.ts` and **composes** the package's `getVerifiedSession` with the workspace's `ensureActiveWorkspaceForSession`:

```typescript
// apps/web/src/middleware/auth.ts
import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { getVerifiedSession, validateGuestSession } from '@workspace/auth';
import { ensureActiveWorkspaceForSession } from '@/workspace/workspace.server';
import { auth } from '@/init';

export async function validateAuthSession(headers: Headers) {
  const session = await getVerifiedSession(headers, auth);
  await ensureActiveWorkspaceForSession(headers, {
    user: { id: session.user.id },
    session: session.session,
  });
  return session;
}

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  await validateAuthSession(headers);
  return await next();
});

export const guestMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  await validateGuestSession(headers, auth);
  return await next();
});
```

Note: `@tanstack/react-router` is needed for `redirect` in the auth package — this is a router primitive, not a Start primitive, so it's OK in a package.

- [ ] **Step 5.9: Create `packages/auth/src/index.ts`**

```typescript
export {
  createAuth,
  type AuthConfig,
  type AuthHooks,
  type Auth,
} from './auth.server';
export { createAuthClient } from './auth-client';
export {
  getVerifiedSession,
  validateGuestSession,
  validateAdminSession,
} from './validators';
export * from './permissions';
export * from './workspace-types';
export {
  isSignInPath,
  isDuplicateOrganizationError,
  type SessionLike,
} from './auth-hooks.server';
```

- [ ] **Step 5.10: Rewire `apps/web/src/middleware/auth.ts`**

The auth middleware is already defined in Step 5.8 above. The file stays in the app but now composes `getVerifiedSession` from the auth package with `ensureActiveWorkspaceForSession` from the workspace module. Replace the current file with the code from Step 5.8.

Key change: `import { auth } from '@/auth/auth.server'` becomes `import { auth } from '@/init'` and `import { getVerifiedSession, validateGuestSession } from '@workspace/auth'`.

Also update `apps/web/src/middleware/auth.test.ts` — the test now mocks `@workspace/auth` instead of re-testing the validation logic (which is tested in the auth package).

- [ ] **Step 5.11: Rewire `apps/web/src/middleware/admin.ts`**

Update to import from `@workspace/auth`:

```typescript
import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { validateAdminSession } from '@workspace/auth';
import { auth } from '@/init';

export const adminMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  const session = await validateAdminSession(headers, auth);
  return next({ context: { session } });
});
```

- [ ] **Step 5.12: Update `apps/web/src/init.ts`**

Add auth initialization:

```typescript
import { createDb } from '@workspace/db';
import { createEmailClient } from '@workspace/email';
import { createAuth } from '@workspace/auth/server';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { logger } from '@/lib/logger';

export const db = createDb(process.env.DATABASE_URL!);

export const emailClient = createEmailClient({
  apiKey: process.env.RESEND_API_KEY!,
  fromEmail: process.env.RESEND_FROM_EMAIL!,
  replyToEmail: process.env.RESEND_REPLY_TO_EMAIL,
  devPrefix: process.env.NODE_ENV !== 'production',
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
  logger,
  getRequestHeaders,
  // hooks will be added in Task 6 when billing is extracted.
});
```

Note: `hooks` (billing limit callbacks) can't be wired yet — billing isn't extracted. Leave them out for now and add in Task 6.

- [ ] **Step 5.13: Update workspace module imports**

Read `apps/web/src/workspace/workspace.ts`. Remove the workspace type constants that moved to `@workspace/auth/workspace-types`. Import them from the package instead:

```typescript
import {
  PERSONAL_WORKSPACE_TYPE,
  STANDARD_WORKSPACE_TYPE,
  isPersonalWorkspace,
  buildPersonalWorkspaceSlug,
  PERSONAL_WORKSPACE_NAME,
} from '@workspace/auth';
```

Re-export them from `workspace.ts` for backward compatibility within the app if needed.

- [ ] **Step 5.14: Create `packages/auth/package.json`**

```json
{
  "name": "@workspace/auth",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./server": "./src/auth.server.ts",
    "./client": "./src/auth-client.ts",
    "./validators": "./src/validators.ts",
    "./schemas": "./src/schemas.ts"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@workspace/db": "workspace:*",
    "@workspace/email": "workspace:*",
    "better-auth": "1.5.5",
    "@better-auth/core": "1.5.5",
    "@better-auth/stripe": "^1.5.4",
    "@tanstack/react-router": "^1.159.4",
    "stripe": "^20.4.1",
    "zod": "^4.3.6",
    "react": "^19.2.4"
  },
  "devDependencies": {
    "vitest": "^4.0.18",
    "vite-tsconfig-paths": "^6.1.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 5.15: Create `packages/auth/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "paths": {
      "@workspace/auth/*": ["./src/*"],
      "@workspace/db": ["../db/src/index.ts"],
      "@workspace/db/*": ["../db/src/*"],
      "@workspace/email": ["../email/src/index.ts"],
      "@workspace/email/*": ["../email/src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 5.16: Create `packages/auth/vitest.config.ts`**

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

- [ ] **Step 5.17: Update `apps/web/tsconfig.json` paths**

Add auth path mappings:

```json
"@workspace/auth": ["../../packages/auth/src/index.ts"],
"@workspace/auth/*": ["../../packages/auth/src/*"]
```

- [ ] **Step 5.18: Rewrite auth imports across the app**

| Find                                  | Replace                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `from '@/auth/auth.server'`           | `from '@/init'` (for `auth` instance) or `from '@workspace/auth/server'` (for types) |
| `from '@/auth/auth-client'`           | `from '@workspace/auth/client'`                                                      |
| `from '@/auth/permissions'`           | `from '@workspace/auth'`                                                             |
| `from '@/auth/schemas'`               | `from '@workspace/auth/schemas'`                                                     |
| `from '@/auth/auth-hooks.server'`     | `from '@workspace/auth'`                                                             |
| `from '@/auth/auth-workspace.server'` | `from '@workspace/auth'` (re-exported)                                               |
| `from '@/middleware/auth'`            | still `from '@/middleware/auth'` (stays in app)                                      |

Find all affected files:

```bash
grep -r "from ['\"]@/auth/" apps/web/src/ --include="*.ts" --include="*.tsx" -l
```

**Key files to check that are easy to miss:**

- `apps/web/src/workspace/workspace.server.ts` — imports `auth` from `@/auth/auth.server`. Change to `from '@/init'`.
- `apps/web/src/lib/email-provider.ts` — may import from `@/email/`. Update to `@workspace/email`.
- `apps/web/src/admin/admin.server.ts` — may import `auth`. Update to `from '@/init'`.
- Any file in `apps/web/src/account/` that imports auth.

- [ ] **Step 5.19: Update auth test mocks**

Read `apps/web/src/test/mocks/auth.ts`. Update mock paths from `@/auth/auth-client` to `@workspace/auth/client`.

- [ ] **Step 5.20: Fix internal imports within packages/auth**

All moved auth files may import each other via `@/auth/*` — rewrite to relative imports (`./auth-hooks.server`, `./workspace-types`, etc.) or `@workspace/auth/*`.

Also fix any imports of `@/db`, `@/email/`, `@/lib/logger`, `@/workspace/workspace` to use the correct package or config references.

- [ ] **Step 5.21: Verify build**

```bash
pnpm install && pnpm run build
```

- [ ] **Step 5.22: Verify tests**

```bash
pnpm test
```

Expected: All tests pass. Auth package tests + app tests.

- [ ] **Step 5.23: Commit**

```bash
git add -A && git commit -m "feat: extract @workspace/auth package with createAuth factory, validators, and hooks"
```

---

## Chunk 6: Extract Billing Package, Test Utils, and Cleanup

### Task 6: Extract `packages/billing`

**Files:**

- Create: `packages/billing/package.json`, `packages/billing/tsconfig.json`, `packages/billing/vitest.config.ts`
- Move to `packages/billing/src/`: `plans.ts` (pure), `billing.server.ts` (split — pure DB/Stripe functions only)
- Keep in `apps/web/src/billing/`: `billing.functions.ts`, new `billing.server.ts` (auth-coupled functions)
- Move tests: `plans.test.ts` to package; split `billing.server.test.ts` between package and app

- [ ] **Step 6.1: Create `packages/billing` directory structure**

```bash
mkdir -p packages/billing/src
```

- [ ] **Step 6.2: Move `plans.ts` and `plans.test.ts`**

```bash
cp apps/web/src/billing/plans.ts packages/billing/src/plans.ts
cp apps/web/src/billing/plans.test.ts packages/billing/src/plans.test.ts
```

Note: use `cp` not `mv` for plans.ts because the app still imports it (later we update imports). Then remove the app copies after imports are updated.

- [ ] **Step 6.3: Split `billing.server.ts`**

Read `apps/web/src/billing/billing.server.ts` fully. Split into:

**Package layer** (`packages/billing/src/billing.server.ts`) — Use a `createBillingService` factory to avoid re-creating Stripe client per call:

```typescript
import Stripe from 'stripe';
import type { Database } from '@workspace/db';

export function createBillingService(db: Database, stripeSecretKey: string) {
  const stripeClient = new Stripe(stripeSecretKey);
  return {
    resolveUserPlanIdFromDb(userId: string) {
      /* uses db */
    },
    countOwnedWorkspaces(userId: string) {
      /* uses db */
    },
    countWorkspaceMembers(workspaceId: string) {
      /* uses db */
    },
    getWorkspaceOwnerUserId(workspaceId: string) {
      /* uses db */
    },
    getInvoicesForUser(userId: string) {
      /* uses stripeClient + db */
    },
    checkWorkspaceLimit(userId: string) {
      /* uses db */
    },
    checkMemberLimit(orgId: string) {
      /* uses db */
    },
  };
}
export type BillingService = ReturnType<typeof createBillingService>;
```

Also keep `resolveSubscriptionDetails` as a standalone export (already pure, no db/stripe needed)

**App layer** (`apps/web/src/billing/billing.server.ts`) — Keep auth-coupled functions:

- `requireVerifiedSession()` — uses `getRequestHeaders()` + `auth.api.getSession`
- `getUserActivePlanId(headers, userId)` — uses `auth.api.listActiveSubscriptions`
- `getUserPlanContext(headers, userId)`
- `checkUserPlanLimit(headers, userId, feature, workspaceId?)`
- `getBillingData(headers, userId)` — uses `auth.api.listActiveSubscriptions`
- `createCheckoutForPlan(headers, planId, annual)` — uses `auth.api.upgradeSubscription`
- `createUserBillingPortal(headers)` — uses `auth.api.createBillingPortal`
- `reactivateUserSubscription(headers, userId)` — uses `auth.api.listActiveSubscriptions` + `auth.api.restoreSubscription`

The app-layer functions import pure helpers from `@workspace/billing/plans` and `@workspace/billing/server`, and import `auth` and `db` from `@/init`.

- [ ] **Step 6.4: Create `packages/billing/src/index.ts`**

```typescript
export * from './plans';
export type { PlanId, Plan, PlanLimits } from './plans';
```

- [ ] **Step 6.5: Create `packages/billing/package.json`**

```json
{
  "name": "@workspace/billing",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./plans": "./src/plans.ts",
    "./server": "./src/billing.server.ts"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@workspace/db": "workspace:*",
    "drizzle-orm": "^0.45.1",
    "stripe": "^20.4.1"
  },
  "devDependencies": {
    "vitest": "^4.0.18",
    "vite-tsconfig-paths": "^6.1.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 6.6: Create `packages/billing/tsconfig.json` and `vitest.config.ts`**

Similar to other packages. Ensure paths include `@workspace/db`.

- [ ] **Step 6.7: Split `billing.server.test.ts`**

Read `apps/web/src/billing/billing.server.test.ts`. Tests for pure functions (`resolveUserPlanIdFromDb`, `countOwnedWorkspaces`, etc.) move to `packages/billing/src/billing.server.test.ts`. Tests for auth-coupled functions stay in `apps/web/src/billing/billing.server.test.ts`.

- [ ] **Step 6.8: Wire billing hooks into auth init**

Update `apps/web/src/init.ts` to create the billing service and pass billing hooks to `createAuth`:

```typescript
import { createBillingService } from '@workspace/billing/server';

export const billingService = createBillingService(
  db,
  process.env.STRIPE_SECRET_KEY!,
);

export const auth = createAuth({
  // ... existing config
  hooks: {
    beforeCreateOrganization: (userId) =>
      billingService.checkWorkspaceLimit(userId),
    beforeCreateInvitation: (orgId) => billingService.checkMemberLimit(orgId),
  },
});
```

Note: `billingService` is created before `auth` because it only needs `db` (no auth dependency). `auth` is created second with billing hooks passed in. No circular dependency.

- [ ] **Step 6.9: Rewrite billing imports across the app**

| Find                                                     | Replace                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `from '@/billing/plans'`                                 | `from '@workspace/billing/plans'`                                       |
| `from '@/billing/billing.server'` (for pure fns)         | `from '@workspace/billing/server'`                                      |
| `from '@/billing/billing.server'` (for auth-coupled fns) | `from '@/billing/billing.server'` (stays, but rewrite internal imports) |

Update the app-layer `billing.server.ts` to import pure helpers from the package:

```typescript
import {
  resolveUserPlanId,
  getPlanById,
  getFreePlan,
  getPlanLimitsForPlanId,
  getUpgradePlan,
} from '@workspace/billing/plans';
import {
  resolveSubscriptionDetails,
  countOwnedWorkspaces,
  countWorkspaceMembers,
  getWorkspaceOwnerUserId,
} from '@workspace/billing/server';
import { auth, db } from '@/init';
```

Remove the old `apps/web/src/billing/plans.ts` and `apps/web/src/billing/plans.test.ts` (now in package).

- [ ] **Step 6.10: Update `apps/web/tsconfig.json` paths**

```json
"@workspace/billing": ["../../packages/billing/src/index.ts"],
"@workspace/billing/*": ["../../packages/billing/src/*"]
```

- [ ] **Step 6.11: Verify build**

```bash
pnpm install && pnpm run build
```

- [ ] **Step 6.12: Verify tests**

```bash
pnpm test
```

- [ ] **Step 6.13: Commit**

```bash
git add -A && git commit -m "feat: extract @workspace/billing package with plan definitions and pure DB/Stripe helpers"
```

---

### Task 7: Create `packages/test-utils`

**Files:**

- Create: `packages/test-utils/package.json`, `packages/test-utils/tsconfig.json`
- Move: `apps/web/src/test/factories.ts` → `packages/test-utils/src/factories.ts`
- Move: `apps/web/src/test/render.tsx` → `packages/test-utils/src/render.tsx`
- Create: `packages/test-utils/src/index.ts`

- [ ] **Step 7.1: Create `packages/test-utils`**

```bash
mkdir -p packages/test-utils/src
```

- [ ] **Step 7.2: Move shared test utilities**

```bash
cp apps/web/src/test/factories.ts packages/test-utils/src/factories.ts
cp apps/web/src/test/render.tsx packages/test-utils/src/render.tsx
```

- [ ] **Step 7.3: Create `packages/test-utils/src/index.ts`**

```typescript
export * from './factories';
export * from './render';
```

- [ ] **Step 7.4: Create `packages/test-utils/package.json`**

```json
{
  "name": "@workspace/test-utils",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.9.1",
    "@tanstack/react-query": "^5.90.21",
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 7.5: Update factory/render imports**

Update `packages/test-utils/src/factories.ts` to import types from `@workspace/db/schema` and `@workspace/auth` instead of `@/db/schema` and `@/auth/*`.

Update `packages/test-utils/src/render.tsx` to use generic imports that work across packages.

- [ ] **Step 7.6: Update test files to import from `@workspace/test-utils`**

Search for imports of `@/test/factories` and `@/test/render` across all packages and the app. Replace with `@workspace/test-utils`.

```bash
grep -r "from ['\"]@/test/" apps/web/src/ packages/ --include="*.ts" --include="*.tsx" -l
```

Add `@workspace/test-utils` as a devDependency to each package and app that uses it.

- [ ] **Step 7.7: Remove duplicated files from app**

After confirming all imports are updated, remove the app copies:

```bash
rm apps/web/src/test/factories.ts
rm apps/web/src/test/render.tsx
```

Keep `apps/web/src/test/mocks/` in the app — those are app-specific mocks.

- [ ] **Step 7.8: Verify tests**

```bash
pnpm install && pnpm test
```

- [ ] **Step 7.9: Commit**

```bash
git add -A && git commit -m "feat: extract @workspace/test-utils package with shared factories and render helpers"
```

---

### Task 8: Final Cleanup

- [ ] **Step 8.1: Remove empty directories**

```bash
find apps/web/src -type d -empty -delete
```

- [ ] **Step 8.2: Grep for stale imports**

```bash
# Check for stale @/ imports that should now point to packages.
grep -r "from ['\"]@/db['\"/]" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "from ['\"]@/auth/" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "from ['\"]@/email/" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "from ['\"]@/components/ui/" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "from ['\"]@/components/email-template/" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "from ['\"]@/lib/utils['\"]" apps/web/src/ --include="*.ts" --include="*.tsx"
```

Each of these should return 0 results. Fix any remaining stale imports.

- [ ] **Step 8.3: Verify typecheck**

```bash
pnpm run typecheck
```

Expected: No type errors across all packages and app.

- [ ] **Step 8.4: Verify lint**

```bash
pnpm run lint
```

Fix any lint issues.

- [ ] **Step 8.5: Verify full test suite**

```bash
pnpm test
```

Expected: All tests pass across all packages and app.

- [ ] **Step 8.6: Verify build**

```bash
pnpm run build
```

Expected: Production build succeeds.

- [ ] **Step 8.7: Verify dev server (manual)**

```bash
cd apps/web && pnpm run dev
```

Verify the app loads at `http://localhost:3000` and basic navigation works. This is a manual verification step — check that the home page, sign-in, and a protected route render correctly.

- [ ] **Step 8.8: Update `.gitignore`**

Ensure `.gitignore` includes:

- `apps/web/.env`
- `packages/db/.env`
- `node_modules/` at all levels

- [ ] **Step 8.9: Final commit**

```bash
git add -A && git commit -m "chore: final cleanup after monorepo migration"
```
