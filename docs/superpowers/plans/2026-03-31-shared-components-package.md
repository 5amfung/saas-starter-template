# Extract Shared Components into @workspace/components — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract ~40 duplicated components, hooks, and utilities shared between `apps/admin` and `apps/web` into a new `@workspace/components` package so both apps import from one source of truth.

**Architecture:** Create `packages/components` with domain-organized subdirectories (`lib/`, `hooks/`, `icons/`, `form/`, `layout/`, `auth/`, `account/`), each with a barrel `index.ts` as its public API. Each domain is extracted as a self-contained step in dependency order; both apps remain fully functional after every step.

**Tech Stack:** TypeScript 5.9 (strict), React 19, TanStack Router v1, TanStack Query v5, TanStack Form v1, TanStack Start v1, `@workspace/ui` (shadcn/ui primitives), `@workspace/auth` (Better Auth), Zod v4, pnpm workspaces, Turborepo.

---

## Implementation Notes

### Internal imports within the package

Components currently use the `@/` path alias (e.g., `@/lib/form-utils`, `@/components/auth/form-error`). Inside `packages/components`, there is no `@/` alias — use **relative imports** instead:

- Same-domain: `./form-error`
- Cross-domain: `../form/form-error`, `../lib/form-utils`, `../hooks/use-session-query`

### Import rule: `form-error.tsx` lives in `form/`, not `auth/`

`form/form-error-display.tsx` imports `FormError`. If `FormError` stayed in `auth/`, that would create a circular dependency (`form/ → auth/ → form/`). `FormError` is a generic component (not auth-specific), so it is placed in the `form/` domain.

### Per-step verification gate

After **every** task, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

All three must pass before committing.

### Finding import sites

Each task includes `rg` commands to find all import sites. Always run them — the list of files that import a given path may not be exhaustive.

---

## File Map

### Created (new files)

```
packages/components/package.json
packages/components/tsconfig.json
packages/components/eslint.config.ts
packages/components/src/lib/index.ts
packages/components/src/lib/email-provider.ts
packages/components/src/lib/format.ts
packages/components/src/lib/form-utils.ts
packages/components/src/lib/get-initials.ts
packages/components/src/lib/logger.ts              ← factory functions, not a direct export
packages/components/src/lib/table-constants.ts
packages/components/src/lib/test-email-links.ts
packages/components/src/hooks/index.ts
packages/components/src/hooks/use-column-sort.ts
packages/components/src/hooks/use-linked-accounts-query.ts
packages/components/src/hooks/use-session-query.ts
packages/components/src/hooks/use-sessions-query.ts
packages/components/src/icons/index.ts
packages/components/src/icons/google-icon.tsx
packages/components/src/form/index.ts
packages/components/src/form/form-error.tsx         ← moved from auth/
packages/components/src/form/form-error-display.tsx
packages/components/src/form/form-submit-button.tsx
packages/components/src/form/validated-field.tsx
packages/components/src/layout/index.ts
packages/components/src/layout/dynamic-breadcrumb.tsx
packages/components/src/layout/nav-admin.tsx
packages/components/src/layout/nav-secondary.tsx
packages/components/src/layout/nav-user.tsx
packages/components/src/layout/not-found.tsx
packages/components/src/layout/site-header.tsx
packages/components/src/layout/sortable-header.tsx
packages/components/src/layout/table-pagination.tsx
packages/components/src/layout/theme-provider.tsx
packages/components/src/auth/index.ts
packages/components/src/auth/auth-layout.tsx
packages/components/src/auth/check-email-card.tsx
packages/components/src/auth/forgot-password-form.tsx
packages/components/src/auth/google-sign-in-button.tsx
packages/components/src/auth/reset-password-form.tsx
packages/components/src/auth/signin-form.tsx        ← parameterized
packages/components/src/auth/signup-form.tsx        ← parameterized
packages/components/src/account/index.ts
packages/components/src/account/schemas.ts
packages/components/src/account/account-profile-form.tsx
packages/components/src/account/active-sessions-list.tsx
packages/components/src/account/change-email-dialog.tsx
packages/components/src/account/change-password-dialog.tsx
packages/components/src/account/linked-accounts-card.tsx
packages/components/src/account/set-password-dialog.tsx
```

### Modified (existing files)

```
apps/admin/package.json                     ← add @workspace/components dep
apps/web/package.json                       ← add @workspace/components dep
apps/admin/tsconfig.json                    ← add @workspace/components/* path
apps/web/tsconfig.json                      ← add @workspace/components/* path
apps/admin/src/lib/logger.ts                ← becomes thin wrapper (replaces old file)
apps/web/src/lib/logger.ts                  ← becomes thin wrapper (new file, replaces old)
apps/*/src/components/auth/signin-form.tsx  ← update call site with new props
apps/*/src/components/auth/signup-form.tsx  ← update call site with new props
```

### Deleted (per-domain, during their respective tasks)

```
apps/admin/src/lib/utils.ts                 ← Task 2: consumers switch to @workspace/ui/lib/utils
apps/*/src/lib/{format,form-utils,email-provider,get-initials,table-constants,test-email-links}.ts
apps/*/src/hooks/{use-column-sort,use-linked-accounts-query,use-session-query,use-sessions-query}.ts
apps/*/src/components/icons/google-icon.tsx
apps/*/src/components/form/{form-error,form-error-display,form-submit-button,validated-field}.tsx
apps/*/src/components/{dynamic-breadcrumb,nav-admin,nav-secondary,nav-user,not-found,site-header,sortable-header,table-pagination,theme-provider}.tsx
apps/*/src/components/auth/{auth-layout,check-email-card,forgot-password-form,google-sign-in-button,reset-password-form,signin-form,signup-form}.tsx
apps/*/src/account/schemas.ts
apps/*/src/components/account/{account-profile-form,active-sessions-list,change-email-dialog,change-password-dialog,linked-accounts-card,set-password-dialog}.tsx
```

---

## Task 1: Scaffold `packages/components`

**Files:**

- Create: `packages/components/package.json`
- Create: `packages/components/tsconfig.json`
- Create: `packages/components/eslint.config.ts`
- Modify: `apps/admin/package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/admin/tsconfig.json`
- Modify: `apps/web/tsconfig.json`

- [ ] **Step 1: Create `packages/components/package.json`**

```json
{
  "name": "@workspace/components",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "eslint",
    "lint:fix": "eslint --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tabler/icons-react": "^3.36.1",
    "@tanstack/react-form": "^1.28.0",
    "@tanstack/react-query": "^5.91.2",
    "@tanstack/react-router": "^1.159.4",
    "@tanstack/react-start": "^1.159.4",
    "@tanstack/react-table": "^8.21.3",
    "@workspace/auth": "workspace:*",
    "@workspace/ui": "workspace:*",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "sonner": "^2.0.7",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/react": "^19.2.10",
    "@types/react-dom": "^19.2.3",
    "@workspace/eslint-config": "workspace:*",
    "typescript": "^5.9.3"
  },
  "exports": {
    "./account": "./src/account/index.ts",
    "./auth": "./src/auth/index.ts",
    "./form": "./src/form/index.ts",
    "./hooks": "./src/hooks/index.ts",
    "./icons": "./src/icons/index.ts",
    "./layout": "./src/layout/index.ts",
    "./lib": "./src/lib/index.ts"
  }
}
```

- [ ] **Step 2: Create `packages/components/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true,
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@workspace/ui/*": ["../../packages/ui/src/*"],
      "@workspace/auth": ["../../packages/auth/src/index.ts"],
      "@workspace/auth/*": ["../../packages/auth/src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `packages/components/eslint.config.ts`**

```ts
import config from '@workspace/eslint-config';
export default config;
```

- [ ] **Step 4: Add `@workspace/components` to both apps' `package.json`**

In `apps/admin/package.json`, add to `dependencies`:

```json
"@workspace/components": "workspace:*"
```

In `apps/web/package.json`, add to `dependencies`:

```json
"@workspace/components": "workspace:*"
```

- [ ] **Step 5: Add tsconfig path entries to both apps**

In `apps/admin/tsconfig.json`, add to `compilerOptions.paths`:

```json
"@workspace/components/*": ["../../packages/components/src/*/index.ts"]
```

In `apps/web/tsconfig.json`, add to `compilerOptions.paths`:

```json
"@workspace/components/*": ["../../packages/components/src/*/index.ts"]
```

- [ ] **Step 6: Install and verify**

```bash
pnpm install
pnpm typecheck
```

Expected: typecheck passes with no new errors.

- [ ] **Step 7: Commit**

```bash
git add packages/components/ apps/admin/package.json apps/web/package.json apps/admin/tsconfig.json apps/web/tsconfig.json pnpm-lock.yaml
git commit -m "chore: scaffold @workspace/components package"
```

---

## Task 2: Extract `lib/`

Six files move verbatim (`format.ts`, `form-utils.ts`, `email-provider.ts`, `get-initials.ts`, `table-constants.ts`, `test-email-links.ts`). `logger.ts` becomes two factory functions so each app can tag logs with its own service name. `apps/admin/src/lib/utils.ts` is deleted — its consumers switch to `@workspace/ui/lib/utils`.

**Files:**

- Create: `packages/components/src/lib/` (all files + `index.ts`)
- Replace: `apps/admin/src/lib/logger.ts` and `apps/web/src/lib/logger.ts` (thin wrappers)
- Delete: `apps/admin/src/lib/utils.ts` and the 6 pure-util files from both apps

- [ ] **Step 1: Create the `lib/` directory with the 6 verbatim files**

Copy each file unchanged from `apps/admin/src/lib/` to `packages/components/src/lib/`:

```bash
mkdir -p packages/components/src/lib
cp apps/admin/src/lib/email-provider.ts packages/components/src/lib/email-provider.ts
cp apps/admin/src/lib/form-utils.ts      packages/components/src/lib/form-utils.ts
cp apps/web/src/lib/format.ts            packages/components/src/lib/format.ts
cp apps/web/src/lib/get-initials.ts      packages/components/src/lib/get-initials.ts
cp apps/admin/src/lib/table-constants.ts packages/components/src/lib/table-constants.ts
cp apps/admin/src/lib/test-email-links.ts packages/components/src/lib/test-email-links.ts
```

(Use the `apps/web` version of `format.ts` and `get-initials.ts` — they use the `→` Unicode arrow in comments, which is the canonical style.)

- [ ] **Step 2: Create `packages/components/src/lib/logger.ts`**

The shared package exports factory functions. Each app instantiates its own logger with its service name. The `any` type is replaced with `unknown` to satisfy strict mode.

```ts
import { createIsomorphicFn, createMiddleware } from '@tanstack/react-start';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Creates an isomorphic logger tagged with the given service name.
 * Server: emits structured JSON in production, human-readable in dev.
 * Client: always emits to console.
 */
export function createLogger(service: string) {
  return createIsomorphicFn()
    .server((level: LogLevel, message: string, data?: unknown) => {
      const timestamp = new Date().toISOString();
      if (process.env.NODE_ENV === 'production') {
        console[level](
          JSON.stringify({
            timestamp,
            level,
            message,
            data,
            service,
            environment: process.env.NODE_ENV,
          })
        );
      } else {
        console[level](
          `[${timestamp}] [${level.toUpperCase()}]`,
          message,
          data ?? ''
        );
      }
    })
    .client((level: LogLevel, message: string, data?: unknown) => {
      console[level](`[${level.toUpperCase()}]`, message, data ?? '');
    });
}

/**
 * Creates a server-side request logger middleware using the provided log function.
 * Logs method, URL, status, and duration for every request.
 */
export function createRequestLogger(
  log: (level: LogLevel, message: string, data?: unknown) => void
) {
  return createMiddleware().server(async ({ request, next }) => {
    const startTime = Date.now();
    try {
      const result = await next();
      const duration = Date.now() - startTime;
      log(
        'info',
        `${request.method} ${request.url} - ${result.response.status} (${duration}ms)`
      );
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      log(
        'error',
        `${request.method} ${request.url} - Error (${duration}ms):`,
        error
      );
      throw error;
    }
  });
}
```

- [ ] **Step 3: Create `packages/components/src/lib/index.ts`**

```ts
export * from './email-provider';
export * from './form-utils';
export * from './format';
export * from './get-initials';
export * from './logger';
export * from './table-constants';
export * from './test-email-links';
```

- [ ] **Step 4: Replace `apps/admin/src/lib/logger.ts` with a thin wrapper**

The file stays so existing consumers (`@/lib/logger`) need no import changes.

```ts
import { createLogger, createRequestLogger } from '@workspace/components/lib';

export const logger = createLogger('admin');
export const requestLogger = createRequestLogger(logger);
```

- [ ] **Step 5: Replace `apps/web/src/lib/logger.ts` with a thin wrapper**

Check whether the file exists first:

```bash
ls apps/web/src/lib/logger.ts
```

Create or replace it:

```ts
import { createLogger, createRequestLogger } from '@workspace/components/lib';

export const logger = createLogger('web');
export const requestLogger = createRequestLogger(logger);
```

- [ ] **Step 6: Delete `apps/admin/src/lib/utils.ts` and update its consumers**

Find all files that import from it:

```bash
rg "'@/lib/utils'" apps/admin/src --type ts --type tsx -l
rg '"@/lib/utils"' apps/admin/src -l
```

For each file found, replace the import:

```ts
// Before
import { cn } from '@/lib/utils';
// After
import { cn } from '@workspace/ui/lib/utils';
```

Then delete the file:

```bash
rm apps/admin/src/lib/utils.ts
```

- [ ] **Step 7: Update all imports of the 6 pure util files in both apps**

Find all import sites:

```bash
rg "'@/lib/(format|form-utils|email-provider|get-initials|table-constants|test-email-links)'" apps/admin/src apps/web/src -l
```

For each file found, update the import to use `@workspace/components/lib`. Examples:

```ts
// Before
import { formatDate } from '@/lib/format';
import { toFieldErrorItem } from '@/lib/form-utils';
import { getInitials } from '@/lib/get-initials';
import { ADMIN_PAGE_SIZE_OPTIONS } from '@/lib/table-constants';
// After
import {
  formatDate,
  toFieldErrorItem,
  getInitials,
  ADMIN_PAGE_SIZE_OPTIONS,
} from '@workspace/components/lib';
```

Multiple named imports from the same domain can be merged into a single import statement.

- [ ] **Step 8: Delete the original lib files from both apps**

```bash
rm apps/admin/src/lib/format.ts
rm apps/admin/src/lib/form-utils.ts
rm apps/admin/src/lib/email-provider.ts
rm apps/admin/src/lib/get-initials.ts
rm apps/admin/src/lib/table-constants.ts
rm apps/admin/src/lib/test-email-links.ts
rm apps/web/src/lib/format.ts
rm apps/web/src/lib/form-utils.ts
rm apps/web/src/lib/email-provider.ts
rm apps/web/src/lib/get-initials.ts
rm apps/web/src/lib/table-constants.ts
rm apps/web/src/lib/test-email-links.ts
```

(Web may not have all of these — check with `ls apps/web/src/lib/` first.)

- [ ] **Step 9: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: extract lib/ utilities into @workspace/components"
```

---

## Task 3: Extract `hooks/`

Four hooks are identical between both apps (only a one-character comment difference in `use-column-sort.ts`). All depend on `@workspace/auth` and `@tanstack/react-query`.

**Files:**

- Create: `packages/components/src/hooks/` (4 hooks + `index.ts`)
- Delete: hooks from both apps

- [ ] **Step 1: Create the hooks files**

```bash
mkdir -p packages/components/src/hooks
```

**`packages/components/src/hooks/use-column-sort.ts`** (use web version — has `→` in comment):

```ts
import { useCallback } from 'react';
import type { SortingState } from '@tanstack/react-table';

/**
 * Hook that returns a memoized sort cycling callback.
 * Cycles: none → asc → desc → none.
 * Always produces single-column sort; any prior sort state is replaced.
 */
export function useColumnSort(
  sorting: SortingState,
  onSortingChange: (sorting: SortingState) => void
) {
  return useCallback(
    (columnId: string) => {
      const current = sorting.find((item) => item.id === columnId);
      if (!current) {
        onSortingChange([{ id: columnId, desc: false }]);
        return;
      }
      if (!current.desc) {
        onSortingChange([{ id: columnId, desc: true }]);
        return;
      }
      onSortingChange([]);
    },
    [sorting, onSortingChange]
  );
}
```

**`packages/components/src/hooks/use-session-query.ts`** (copy verbatim from either app — identical):

```ts
import { useQuery } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';

export const SESSION_QUERY_KEY = ['session', 'current'] as const;

export function useSessionQuery() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.getSession();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
  });
}
```

**`packages/components/src/hooks/use-linked-accounts-query.ts`** (copy verbatim):

```ts
import { useQuery } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';

export const LINKED_ACCOUNTS_QUERY_KEY = [
  'account',
  'linked-accounts',
] as const;

export function useLinkedAccountsQuery() {
  return useQuery({
    queryKey: LINKED_ACCOUNTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
```

**`packages/components/src/hooks/use-sessions-query.ts`** (copy verbatim):

```ts
import { useQuery } from '@tanstack/react-query';
import { authClient } from '@workspace/auth/client';

export const SESSIONS_QUERY_KEY = ['session', 'active-list'] as const;

export function useSessionsQuery() {
  return useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
```

- [ ] **Step 2: Create `packages/components/src/hooks/index.ts`**

```ts
export * from './use-column-sort';
export * from './use-linked-accounts-query';
export * from './use-session-query';
export * from './use-sessions-query';
```

- [ ] **Step 3: Find and update all hook import sites in both apps**

```bash
rg "'@/hooks/use-(column-sort|session-query|sessions-query|linked-accounts-query)'" apps/admin/src apps/web/src -l
```

For each file found, update imports to `@workspace/components/hooks`. Example:

```ts
// Before
import { useSessionQuery, SESSION_QUERY_KEY } from '@/hooks/use-session-query';
import { useColumnSort } from '@/hooks/use-column-sort';
// After
import {
  useSessionQuery,
  SESSION_QUERY_KEY,
  useColumnSort,
} from '@workspace/components/hooks';
```

- [ ] **Step 4: Delete the original hook files from both apps**

```bash
rm apps/admin/src/hooks/use-column-sort.ts
rm apps/admin/src/hooks/use-linked-accounts-query.ts
rm apps/admin/src/hooks/use-session-query.ts
rm apps/admin/src/hooks/use-sessions-query.ts
rm apps/web/src/hooks/use-column-sort.ts
rm apps/web/src/hooks/use-linked-accounts-query.ts
rm apps/web/src/hooks/use-session-query.ts
rm apps/web/src/hooks/use-sessions-query.ts
```

- [ ] **Step 5: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: extract hooks/ into @workspace/components"
```

---

## Task 4: Extract `icons/`

One file: `google-icon.tsx`. No dependencies.

**Files:**

- Create: `packages/components/src/icons/google-icon.tsx` and `index.ts`
- Delete: from both apps

- [ ] **Step 1: Create `packages/components/src/icons/google-icon.tsx`**

```bash
mkdir -p packages/components/src/icons
cp apps/admin/src/components/icons/google-icon.tsx packages/components/src/icons/google-icon.tsx
```

- [ ] **Step 2: Create `packages/components/src/icons/index.ts`**

```ts
export * from './google-icon';
```

- [ ] **Step 3: Find and update all import sites**

```bash
rg "'@/components/icons/google-icon'" apps/admin/src apps/web/src -l
```

Update each import:

```ts
// Before
import { GoogleIcon } from '@/components/icons/google-icon';
// After
import { GoogleIcon } from '@workspace/components/icons';
```

- [ ] **Step 4: Delete original files**

```bash
rm apps/admin/src/components/icons/google-icon.tsx
rm apps/web/src/components/icons/google-icon.tsx
```

Check if the `icons/` directories are now empty and remove them if so:

```bash
rmdir apps/admin/src/components/icons 2>/dev/null || true
rmdir apps/web/src/components/icons 2>/dev/null || true
```

- [ ] **Step 5: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: extract icons/ into @workspace/components"
```

---

## Task 5: Extract `form/`

Four files. `form-error.tsx` is moved here (from `auth/`) to avoid a circular dependency — it is a generic component, not auth-specific. `form-error-display.tsx` imports `FormError` via relative path. `validated-field.tsx` imports `toFieldErrorItem` from `../lib/form-utils`.

**Files:**

- Create: `packages/components/src/form/` (4 files + `index.ts`)
- Delete: from both apps

- [ ] **Step 1: Create `packages/components/src/form/form-error.tsx`**

Copy verbatim from `apps/admin/src/components/auth/form-error.tsx`. It has no `@/` imports — only `@workspace/ui/lib/utils`:

```tsx
'use client';
import { cn } from '@workspace/ui/lib/utils';

export function FormError({
  className,
  errors,
  ...props
}: React.ComponentProps<'div'> & {
  errors?: Array<string>;
}) {
  if (!errors?.length) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn('text-sm font-normal text-destructive', className)}
      {...props}
    >
      {errors.join(', ')}
    </div>
  );
}
```

- [ ] **Step 2: Create `packages/components/src/form/form-error-display.tsx`**

The `@/components/auth/form-error` import becomes a relative import to the same domain:

```tsx
import type { ReactFormExtendedApi } from '@tanstack/react-form';
import { FormError } from './form-error';

type AnyReactFormApi = ReactFormExtendedApi<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

interface FormErrorDisplayProps {
  form: AnyReactFormApi;
}

export function FormErrorDisplay({ form }: FormErrorDisplayProps) {
  return (
    <form.Subscribe
      selector={(state) => state.errors}
      children={(errors) => (
        <FormError
          errors={errors
            .flatMap((e) => (typeof e === 'string' ? [e] : []))
            .filter(Boolean)}
        />
      )}
    />
  );
}
```

- [ ] **Step 3: Create `packages/components/src/form/form-submit-button.tsx`**

No `@/` imports — copy verbatim (only uses `@workspace/ui` and `@tanstack/react-form`):

```tsx
import { IconLoader2 } from '@tabler/icons-react';
import { Button } from '@workspace/ui/components/button';
import type { ReactFormExtendedApi } from '@tanstack/react-form';

type AnyReactFormApi = ReactFormExtendedApi<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

interface FormSubmitButtonProps {
  form: AnyReactFormApi;
  label: string;
  disabled?: boolean;
}

export function FormSubmitButton({
  form,
  label,
  disabled,
}: FormSubmitButtonProps) {
  return (
    <form.Subscribe
      selector={(state) => [state.isSubmitting]}
      children={([isSubmitting]) => (
        <Button type="submit" disabled={disabled || isSubmitting}>
          {isSubmitting && (
            <span data-testid="submit-loader">
              <IconLoader2 className="animate-spin" />
            </span>
          )}
          {label}
        </Button>
      )}
    />
  );
}
```

- [ ] **Step 4: Create `packages/components/src/form/validated-field.tsx`**

`@/lib/form-utils` becomes `../lib/form-utils`:

```tsx
import type { AnyFieldApi } from '@tanstack/react-form';
import { Field, FieldError, FieldLabel } from '@workspace/ui/components/field';
import { toFieldErrorItem } from '../lib/form-utils';

interface ValidatedFieldProps {
  field: AnyFieldApi;
  label?: string;
  children: React.ReactNode;
}

export function ValidatedField({
  field,
  label,
  children,
}: ValidatedFieldProps) {
  const isInvalid = field.state.meta.isBlurred && !field.state.meta.isValid;
  return (
    <Field data-invalid={isInvalid}>
      {label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}
      {children}
      {isInvalid && (
        <FieldError errors={field.state.meta.errors.map(toFieldErrorItem)} />
      )}
    </Field>
  );
}
```

- [ ] **Step 5: Create `packages/components/src/form/index.ts`**

```ts
export * from './form-error';
export * from './form-error-display';
export * from './form-submit-button';
export * from './validated-field';
```

- [ ] **Step 6: Find and update all import sites in both apps**

```bash
rg "'@/components/(auth/form-error|form/form-error-display|form/form-submit-button|form/validated-field)'" apps/admin/src apps/web/src -l
```

Update each import to `@workspace/components/form`. Example:

```ts
// Before
import { FormError } from '@/components/auth/form-error';
import { FormErrorDisplay } from '@/components/form/form-error-display';
import { FormSubmitButton } from '@/components/form/form-submit-button';
import { ValidatedField } from '@/components/form/validated-field';
// After
import {
  FormError,
  FormErrorDisplay,
  FormSubmitButton,
  ValidatedField,
} from '@workspace/components/form';
```

- [ ] **Step 7: Delete original files from both apps**

```bash
rm apps/admin/src/components/auth/form-error.tsx
rm apps/web/src/components/auth/form-error.tsx
rm apps/admin/src/components/form/form-error-display.tsx
rm apps/admin/src/components/form/form-submit-button.tsx
rm apps/admin/src/components/form/validated-field.tsx
rm apps/web/src/components/form/form-error-display.tsx
rm apps/web/src/components/form/form-submit-button.tsx
rm apps/web/src/components/form/validated-field.tsx
```

Check if `form/` directories are empty and remove them:

```bash
rmdir apps/admin/src/components/form 2>/dev/null || true
rmdir apps/web/src/components/form 2>/dev/null || true
```

- [ ] **Step 8: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: extract form/ primitives into @workspace/components"
```

---

## Task 6: Extract `layout/`

Nine components from the flat `components/` directory of each app. Two internal dependencies to fix: `nav-secondary.tsx` imports `useTheme` from `@/components/theme-provider` → `./theme-provider`; `site-header.tsx` imports `DynamicBreadcrumb` from `@/components/dynamic-breadcrumb` → `./dynamic-breadcrumb`.

**Files:**

- Create: `packages/components/src/layout/` (9 files + `index.ts`)
- Delete: from both apps

- [ ] **Step 1: Create layout files with internal imports fixed**

```bash
mkdir -p packages/components/src/layout
```

Copy these files verbatim (no `@/` imports — all external deps only):

```bash
cp apps/admin/src/components/dynamic-breadcrumb.tsx packages/components/src/layout/dynamic-breadcrumb.tsx
cp apps/admin/src/components/nav-admin.tsx          packages/components/src/layout/nav-admin.tsx
cp apps/admin/src/components/not-found.tsx          packages/components/src/layout/not-found.tsx
cp apps/admin/src/components/sortable-header.tsx    packages/components/src/layout/sortable-header.tsx
cp apps/admin/src/components/table-pagination.tsx   packages/components/src/layout/table-pagination.tsx
cp apps/admin/src/components/theme-provider.tsx     packages/components/src/layout/theme-provider.tsx
```

- [ ] **Step 2: Create `packages/components/src/layout/nav-user.tsx`**

The only `@/` import is `@/lib/logger` → `../lib/logger`. But wait — `logger` is now a factory-created value in each app's `lib/logger.ts`. The shared `nav-user.tsx` must not reference an app-specific logger. Instead, make the logout error handler accept a `logger` prop or use `console.error` as a fallback.

**Check the web version of `nav-user.tsx` first:**

```bash
diff apps/admin/src/components/nav-user.tsx apps/web/src/components/nav-user.tsx
```

If the only difference is `@/lib/logger`, replace the import with a `console.error` fallback (navigation errors are non-critical):

```tsx
'use client';

import {
  IconDotsVertical,
  IconLogout,
  IconUserCircle,
} from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@workspace/ui/components/sidebar';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { authClient } from '@workspace/auth/client';

export function NavUserSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="aria-expanded:bg-muted">
          <Skeleton className="size-8 rounded-lg" />
          <div className="grid flex-1 gap-1 text-left">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const navigate = useNavigate();
  const { isMobile } = useSidebar();

  async function handleLogout() {
    try {
      await authClient.signOut();
      navigate({ to: '/' });
    } catch (error) {
      console.error('Logout failed', error);
      toast.error('Logout failed. Please try again.');
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar className="size-8 rounded-lg grayscale">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg">CN</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-foreground/70">
                {user.email}
              </span>
            </div>
            <IconDotsVertical className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate({ to: '/account' })}>
                <IconUserCircle />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

- [ ] **Step 3: Create `packages/components/src/layout/nav-secondary.tsx`**

Fix `@/components/theme-provider` → `./theme-provider`:

```tsx
'use client';

import * as React from 'react';
import { IconBrightness, IconExternalLink } from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@workspace/ui/components/sidebar';
import { useTheme } from './theme-provider';

export function NavSecondary({
  items,
  ...props
}: {
  items: Array<{
    title: string;
    url: string;
    icon: React.ReactNode;
    newTab?: boolean;
  }>;
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { setTheme } = useTheme();
  const { isMobile } = useSidebar();

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton />}>
                <IconBrightness />
                <span>Theme</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                render={
                  <a
                    href={item.url}
                    target={item.newTab ? '_blank' : undefined}
                    rel={item.newTab ? 'noreferrer noopener' : undefined}
                  />
                }
              >
                {item.icon}
                <span>{item.title}</span>
                {item.newTab ? <IconExternalLink className="size-4" /> : null}
                {item.newTab ? (
                  <span className="sr-only">(opens in a new tab)</span>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

- [ ] **Step 4: Create `packages/components/src/layout/site-header.tsx`**

Fix `@/components/dynamic-breadcrumb` → `./dynamic-breadcrumb`:

```tsx
import { Separator } from '@workspace/ui/components/separator';
import { SidebarTrigger } from '@workspace/ui/components/sidebar';
import { DynamicBreadcrumb } from './dynamic-breadcrumb';

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <DynamicBreadcrumb />
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Create `packages/components/src/layout/index.ts`**

```ts
export * from './dynamic-breadcrumb';
export * from './nav-admin';
export * from './nav-secondary';
export * from './nav-user';
export * from './not-found';
export * from './site-header';
export * from './sortable-header';
export * from './table-pagination';
export * from './theme-provider';
```

- [ ] **Step 6: Find and update all import sites in both apps**

```bash
rg "'@/components/(dynamic-breadcrumb|nav-admin|nav-secondary|nav-user|not-found|site-header|sortable-header|table-pagination|theme-provider)'" apps/admin/src apps/web/src -l
```

Update each import to `@workspace/components/layout`. Example (in `app-sidebar.tsx` and route files):

```ts
// Before
import { NavAdmin } from '@/components/nav-admin';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser, NavUserSkeleton } from '@/components/nav-user';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
// After
import {
  NavAdmin,
  NavSecondary,
  NavUser,
  NavUserSkeleton,
  ThemeProvider,
  useTheme,
} from '@workspace/components/layout';
```

- [ ] **Step 7: Delete original files from both apps**

```bash
rm apps/admin/src/components/dynamic-breadcrumb.tsx
rm apps/admin/src/components/nav-admin.tsx
rm apps/admin/src/components/nav-secondary.tsx
rm apps/admin/src/components/nav-user.tsx
rm apps/admin/src/components/not-found.tsx
rm apps/admin/src/components/site-header.tsx
rm apps/admin/src/components/sortable-header.tsx
rm apps/admin/src/components/table-pagination.tsx
rm apps/admin/src/components/theme-provider.tsx
rm apps/web/src/components/dynamic-breadcrumb.tsx
rm apps/web/src/components/nav-admin.tsx
rm apps/web/src/components/nav-secondary.tsx
rm apps/web/src/components/nav-user.tsx
rm apps/web/src/components/not-found.tsx
rm apps/web/src/components/site-header.tsx
rm apps/web/src/components/sortable-header.tsx
rm apps/web/src/components/table-pagination.tsx
rm apps/web/src/components/theme-provider.tsx
```

- [ ] **Step 8: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: extract layout/ components into @workspace/components"
```

---

## Task 7: Extract `auth/`

Eight components. `signin-form.tsx` and `signup-form.tsx` are parameterized with `defaultCallbackUrl`. `google-sign-in-button.tsx` also has a hardcoded default — its default `/dashboard` vs `/ws` is handled via its existing `callbackURL` prop which callers always provide explicitly, so no change needed. `auth-layout.tsx` may differ between apps — check before copying.

**Files:**

- Create: `packages/components/src/auth/` (8 files + `index.ts`)
- Delete: from both apps

- [ ] **Step 1: Check if `auth-layout.tsx` differs between apps**

```bash
diff apps/admin/src/components/auth/auth-layout.tsx apps/web/src/components/auth/auth-layout.tsx
```

If the only diff is import order, copy the admin version verbatim. If there are content differences (brand name, icon), add a `logo` prop:

```tsx
// If different — parameterized version:
import { IconShieldLock } from '@tabler/icons-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  logo?: React.ReactNode;
}

const DEFAULT_LOGO = (
  <a href="/" className="flex items-center gap-2 self-center font-medium">
    <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
      <IconShieldLock className="size-4" />
    </div>
    Admin Portal
  </a>
);

export function AuthLayout({ children, logo = DEFAULT_LOGO }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        {logo}
        <div className="flex flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
```

If the apps have different logos, each app's auth layout route (`_auth.tsx`) passes its own `logo` prop to `<AuthLayout>`.

- [ ] **Step 2: Copy verbatim auth components (no `@/` imports)**

```bash
mkdir -p packages/components/src/auth
cp apps/admin/src/components/auth/check-email-card.tsx packages/components/src/auth/check-email-card.tsx
```

`check-email-card.tsx`, `forgot-password-form.tsx`, and `reset-password-form.tsx` have `@/components/form/` imports that now resolve to `../form/`. Copy them with updated imports:

**`packages/components/src/auth/forgot-password-form.tsx`** — replace `@/components/form/*` with `../form/*`:

```tsx
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
} from '@workspace/ui/components/field';
import { Input } from '@workspace/ui/components/input';
import { forgotPasswordSchema } from '@workspace/auth/schemas';
import { authClient } from '@workspace/auth/client';
import { FormErrorDisplay } from '../form/form-error-display';
import { FormSubmitButton } from '../form/form-submit-button';
import { ValidatedField } from '../form/validated-field';

export function ForgotPasswordForm() {
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm({
    defaultValues: { email: '' },
    validators: {
      onBlur: forgotPasswordSchema,
      onSubmit: forgotPasswordSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: '/reset-password',
      });
      if (error) {
        const message = error.message ?? 'Something went wrong.';
        formApi.setErrorMap({
          ...formApi.state.errorMap,
          onSubmit: { form: message, fields: {} },
        });
        return;
      }
      setIsSuccess(true);
    },
  });

  if (isSuccess) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            If an account exists for that email, we&apos;ve sent a link to reset
            your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldDescription className="text-center">
            <Link to="/signin" className="underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </FieldDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Forgot password</CardTitle>
        <CardDescription>
          Enter your email to receive a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field
              name="email"
              children={(field) => (
                <ValidatedField field={field} label="Email">
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    placeholder="m@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={
                      field.state.meta.isBlurred && !field.state.meta.isValid
                    }
                    required
                  />
                </ValidatedField>
              )}
            />
            <FormErrorDisplay form={form} />
            <Field>
              <FormSubmitButton form={form} label="Send reset link" />
              <FieldDescription className="text-center">
                <Link
                  to="/signin"
                  className="underline-offset-4 hover:underline"
                >
                  Back to sign in
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
```

**`packages/components/src/auth/reset-password-form.tsx`** — same pattern, replace `@/components/form/*` with `../form/*`. Copy the file from `apps/admin/src/components/auth/reset-password-form.tsx` and change the three form import lines:

```ts
// Before
import { FormErrorDisplay } from '@/components/form/form-error-display';
import { FormSubmitButton } from '@/components/form/form-submit-button';
import { ValidatedField } from '@/components/form/validated-field';
// After
import { FormErrorDisplay } from '../form/form-error-display';
import { FormSubmitButton } from '../form/form-submit-button';
import { ValidatedField } from '../form/validated-field';
```

**`packages/components/src/auth/google-sign-in-button.tsx`** — replace `@/components/icons/google-icon` with `../icons/google-icon`:

```tsx
import { useState } from 'react';
import { IconLoader } from '@tabler/icons-react';
import { Button } from '@workspace/ui/components/button';
import { authClient } from '@workspace/auth/client';
import { GoogleIcon } from '../icons/google-icon';

export function GoogleSignInButton({ callbackURL }: { callbackURL: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL,
      errorCallbackURL: '/signin',
    });
    if (signInError) {
      setError(signInError.message ?? 'Something went wrong.');
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        type="button"
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? (
          <IconLoader className="animate-spin" />
        ) : (
          <GoogleIcon className="size-4" />
        )}
        Sign in with Google
      </Button>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

Note: `callbackURL` is now required (no default) — callers always provide it. This removes the admin-specific `/dashboard` default from the shared component.

- [ ] **Step 3: Create `packages/components/src/auth/signin-form.tsx`**

Merges both app versions. Adds `defaultCallbackUrl`, `title`, and `description` props. Handles `?error=admin_only` internally. Internal imports use relative paths.

```tsx
import { useForm } from '@tanstack/react-form';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { authClient } from '@workspace/auth/client';
import { loginSchema } from '@workspace/auth/schemas';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@workspace/ui/components/field';
import { Input } from '@workspace/ui/components/input';
import { FormError } from '../form/form-error';
import { FormErrorDisplay } from '../form/form-error-display';
import { FormSubmitButton } from '../form/form-submit-button';
import { ValidatedField } from '../form/validated-field';
import { GoogleSignInButton } from './google-sign-in-button';

const ADMIN_ONLY_ERROR_MESSAGE =
  'Admin access required. Please contact your administrator.';

interface SigninFormProps {
  /** URL to redirect to after successful sign-in when no ?redirect param is present. */
  defaultCallbackUrl?: string;
  /** Card title text. */
  title?: string;
  /** Card description text. */
  description?: string;
  /** OAuth error code passed from the URL (e.g. 'admin_only'). */
  oauthError?: string;
  /** Redirect URL passed from the route search params. */
  redirect?: string;
}

export function SigninForm({
  defaultCallbackUrl = '/ws',
  title = 'Welcome back',
  description = 'Sign in with your Google account',
  oauthError,
  redirect,
}: SigninFormProps) {
  const navigate = useNavigate();
  const callbackURL = redirect ?? defaultCallbackUrl;

  // Reads ?error=admin_only from URL search params — handled as a known error code.
  const searchParams = useSearch({ strict: false });
  const adminOnlyError = searchParams.error === 'admin_only';

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onBlur: loginSchema, onSubmit: loginSchema },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
        callbackURL,
      });
      if (error) {
        if (error.status === 403) {
          navigate({ to: '/verify', search: { email: value.email, redirect } });
          return;
        }
        const message =
          error.status === 401
            ? 'Invalid email or password. If you signed up with Google, use "Sign in with Google" or reset your password.'
            : (error.message ?? 'Something went wrong.');
        formApi.setErrorMap({
          ...formApi.state.errorMap,
          onSubmit: { form: message, fields: {} },
        });
      }
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <GoogleSignInButton callbackURL={callbackURL} />
              {oauthError && (
                <FormError
                  errors={[
                    oauthError === 'admin_only'
                      ? 'Access denied. This portal is restricted to administrators.'
                      : 'Google sign-in was cancelled or failed. Please try again.',
                  ]}
                />
              )}
              {adminOnlyError && (
                <FormError errors={[ADMIN_ONLY_ERROR_MESSAGE]} />
              )}
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <form.Field
                name="email"
                children={(field) => (
                  <ValidatedField field={field} label="Email">
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      placeholder="m@example.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={
                        field.state.meta.isBlurred && !field.state.meta.isValid
                      }
                      required
                    />
                  </ValidatedField>
                )}
              />
              <form.Field
                name="password"
                children={(field) => (
                  <ValidatedField field={field}>
                    <div className="flex items-center">
                      <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                      <Link
                        to="/forgot-password"
                        className="ml-auto text-sm underline-offset-4 hover:underline"
                      >
                        Forgot your password?
                      </Link>
                    </div>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={
                        field.state.meta.isBlurred && !field.state.meta.isValid
                      }
                      required
                    />
                  </ValidatedField>
                )}
              />
              <FormErrorDisplay form={form} />
              <Field>
                <FormSubmitButton form={form} label="Sign in" />
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{' '}
                  <Link to="/signup" search={{ redirect }}>
                    Sign up
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{' '}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </>
  );
}
```

- [ ] **Step 4: Create `packages/components/src/auth/signup-form.tsx`**

Admin version has `DEFAULT_CALLBACK_URL = '/dashboard'`; web has `/ws`. Add `defaultCallbackUrl` prop. Replace `@/components/` imports with relative paths.

```tsx
import { useForm } from '@tanstack/react-form';
import { Link, useNavigate } from '@tanstack/react-router';
import { authClient } from '@workspace/auth/client';
import { signupSchema } from '@workspace/auth/schemas';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldSeparator,
} from '@workspace/ui/components/field';
import { Input } from '@workspace/ui/components/input';
import { FormErrorDisplay } from '../form/form-error-display';
import { FormSubmitButton } from '../form/form-submit-button';
import { ValidatedField } from '../form/validated-field';
import { GoogleSignInButton } from './google-sign-in-button';

interface SignupFormProps {
  /** URL to redirect to after successful signup when no ?redirect param is present. */
  defaultCallbackUrl?: string;
  redirect?: string;
}

export function SignupForm({
  defaultCallbackUrl = '/ws',
  redirect,
}: SignupFormProps) {
  const navigate = useNavigate();
  const callbackURL = redirect ?? defaultCallbackUrl;

  const form = useForm({
    defaultValues: { email: '', password: '', confirmPassword: '' },
    validators: { onBlur: signupSchema, onSubmit: signupSchema },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.signUp.email({
        email: value.email,
        password: value.password,
        name: value.email.split('@')[0] ?? '',
        callbackURL,
      });
      if (error) {
        const message =
          error.status === 422
            ? 'An account with this email already exists. Try signing in with Google or reset your password.'
            : (error.message ?? 'Something went wrong.');
        formApi.setErrorMap({
          ...formApi.state.errorMap,
          onSubmit: { form: message, fields: {} },
        });
        return;
      }
      navigate({ to: '/verify', search: { email: value.email, redirect } });
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <FieldGroup>
              <GoogleSignInButton callbackURL={callbackURL} />
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <form.Field
                name="email"
                children={(field) => (
                  <ValidatedField field={field} label="Email">
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      placeholder="m@example.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={
                        field.state.meta.isBlurred && !field.state.meta.isValid
                      }
                      required
                    />
                  </ValidatedField>
                )}
              />
              <Field>
                <Field className="grid grid-cols-2 gap-4">
                  <form.Field
                    name="password"
                    children={(field) => (
                      <ValidatedField field={field} label="Password">
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={
                            field.state.meta.isBlurred &&
                            !field.state.meta.isValid
                          }
                          required
                        />
                      </ValidatedField>
                    )}
                  />
                  <form.Field
                    name="confirmPassword"
                    validators={{
                      onChangeListenTo: ['password'],
                      onChange: ({ value, fieldApi }) => {
                        if (value !== fieldApi.form.getFieldValue('password')) {
                          return 'Passwords do not match.';
                        }
                        return undefined;
                      },
                    }}
                    children={(field) => (
                      <ValidatedField field={field} label="Confirm Password">
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={
                            field.state.meta.isBlurred &&
                            !field.state.meta.isValid
                          }
                          required
                        />
                      </ValidatedField>
                    )}
                  />
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <FormErrorDisplay form={form} />
              <Field>
                <FormSubmitButton form={form} label="Create Account" />
                <FieldDescription className="text-center">
                  Already have an account?{' '}
                  <Link to="/signin" search={{ redirect }}>
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{' '}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </>
  );
}
```

- [ ] **Step 5: Create `packages/components/src/auth/index.ts`**

```ts
export * from './auth-layout';
export * from './check-email-card';
export * from './forgot-password-form';
export * from './google-sign-in-button';
export * from './reset-password-form';
export * from './signin-form';
export * from './signup-form';
```

- [ ] **Step 6: Update `SigninForm` call site in `apps/admin`**

Find the admin auth route that renders `<SigninForm>`:

```bash
rg "SigninForm" apps/admin/src -l
```

Add the new props:

```tsx
// Before
<SigninForm oauthError={oauthError} redirect={redirect} />
// After
<SigninForm
  defaultCallbackUrl="/dashboard"
  title="Admin Portal"
  description="Sign in to access the admin dashboard"
  oauthError={oauthError}
  redirect={redirect}
/>
```

- [ ] **Step 7: Update `SignupForm` call site in `apps/admin`**

```bash
rg "SignupForm" apps/admin/src -l
```

Add the `defaultCallbackUrl` prop:

```tsx
// Before
<SignupForm redirect={redirect} />
// After
<SignupForm defaultCallbackUrl="/dashboard" redirect={redirect} />
```

- [ ] **Step 8: Find and update all auth import sites in both apps**

```bash
rg "'@/components/auth/(auth-layout|check-email-card|forgot-password-form|google-sign-in-button|reset-password-form|signin-form|signup-form)'" apps/admin/src apps/web/src -l
```

Update each import to `@workspace/components/auth`. Example:

```ts
// Before
import { SigninForm } from '@/components/auth/signin-form';
import { AuthLayout } from '@/components/auth/auth-layout';
// After
import { SigninForm, AuthLayout } from '@workspace/components/auth';
```

- [ ] **Step 9: Delete original auth files from both apps**

```bash
rm apps/admin/src/components/auth/auth-layout.tsx
rm apps/admin/src/components/auth/check-email-card.tsx
rm apps/admin/src/components/auth/forgot-password-form.tsx
rm apps/admin/src/components/auth/google-sign-in-button.tsx
rm apps/admin/src/components/auth/reset-password-form.tsx
rm apps/admin/src/components/auth/signin-form.tsx
rm apps/admin/src/components/auth/signup-form.tsx
rm apps/web/src/components/auth/auth-layout.tsx
rm apps/web/src/components/auth/check-email-card.tsx
rm apps/web/src/components/auth/forgot-password-form.tsx
rm apps/web/src/components/auth/google-sign-in-button.tsx
rm apps/web/src/components/auth/reset-password-form.tsx
rm apps/web/src/components/auth/signin-form.tsx
rm apps/web/src/components/auth/signup-form.tsx
```

- [ ] **Step 10: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: extract auth/ components into @workspace/components"
```

---

## Task 8: Extract `account/`

Seven items: `schemas.ts` plus 6 components. Internal imports use `../hooks/`, `../lib/`, `../form/`. `accountProfileSchema` is imported by route files using `@/account/schemas` — those routes update to `@workspace/components/account`.

**Files:**

- Create: `packages/components/src/account/` (7 files + `index.ts`)
- Delete: `apps/*/src/account/schemas.ts` and all 6 account components from both apps

- [ ] **Step 1: Create `packages/components/src/account/schemas.ts`**

Copy verbatim from `apps/admin/src/account/schemas.ts` (identical in both apps):

```ts
import * as z from 'zod';

export const accountProfileSchema = z.object({
  name: z.string().trim().min(1, { message: 'Name is required.' }),
});

export const changeEmailSchema = z.object({
  newEmail: z.email({ error: 'Please enter a valid email address.' }),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { error: 'Current password is required.' }),
    newPassword: z
      .string()
      .min(8, { error: 'Password must be at least 8 characters.' }),
    confirmPassword: z
      .string()
      .min(1, { error: 'Please confirm your password.' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
```

- [ ] **Step 2: Create `packages/components/src/account/account-profile-form.tsx`**

Replace `@/account/schemas` → `./schemas`, `@/hooks/use-session-query` → `../hooks/use-session-query`, `@/lib/form-utils` → `../lib/form-utils`, `@/lib/get-initials` → `../lib/get-initials`. Copy the rest verbatim:

```tsx
import { IconLoader2 } from '@tabler/icons-react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authClient } from '@workspace/auth/client';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@workspace/ui/components/field';
import { Input } from '@workspace/ui/components/input';
import { toFieldErrorItem } from '../lib/form-utils';
import { getInitials } from '../lib/get-initials';
import { SESSION_QUERY_KEY } from '../hooks/use-session-query';
import { accountProfileSchema } from './schemas';

const CARD_FOOTER_CLASS = 'flex justify-end gap-2 pt-6';

interface AccountProfileFormProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

export function AccountProfileForm({ user }: AccountProfileFormProps) {
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: { name: user.name },
    validators: {
      onBlur: accountProfileSchema,
      onSubmit: accountProfileSchema,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({ name: value.name });
      form.reset(value);
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      const { error } = await authClient.updateUser({ name: payload.name });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      // Optimistic update.
      queryClient.setQueryData(
        SESSION_QUERY_KEY,
        (prev: { user: { name: string } } | null | undefined) =>
          prev
            ? { ...prev, user: { ...prev.user, name: variables.name } }
            : prev
      );
      toast.success('Profile updated.');
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update profile.');
    },
  });

  const initials = getInitials(user.name, user.email);
  const avatarSrc = user.image ?? undefined;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your profile information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-center gap-4">
            <Avatar className="size-20">
              <AvatarImage
                src={avatarSrc}
                alt={user.name}
                className="object-cover"
              />
              <AvatarFallback className="text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="text-sm font-medium">Profile Photo</p>
              <p className="text-xs text-muted-foreground">
                Displayed from your sign-in provider. Read-only.
              </p>
            </div>
          </div>
          <FieldGroup className="gap-6">
            <form.Field
              name="name"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isBlurred && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Full Name</FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {isInvalid && (
                      <FieldError
                        errors={field.state.meta.errors.map(toFieldErrorItem)}
                      />
                    )}
                  </Field>
                );
              }}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className={CARD_FOOTER_CLASS}>
          <form.Subscribe
            selector={(state) => [
              state.isDirty,
              state.isSubmitting,
              state.canSubmit,
            ]}
            children={([isDirty, isSubmitting, canSubmit]) => (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                  disabled={!isDirty || isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isDirty || !canSubmit || isSubmitting}
                >
                  {isSubmitting && (
                    <IconLoader2 className="size-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </>
            )}
          />
        </CardFooter>
      </Card>
    </form>
  );
}
```

- [ ] **Step 3: Create the remaining 5 account components**

For each of these files, read both app versions, diff them, fix `@/` imports to use relative paths, and save to `packages/components/src/account/`:

```bash
diff apps/admin/src/components/account/active-sessions-list.tsx apps/web/src/components/account/active-sessions-list.tsx
diff apps/admin/src/components/account/change-email-dialog.tsx apps/web/src/components/account/change-email-dialog.tsx
diff apps/admin/src/components/account/change-password-dialog.tsx apps/web/src/components/account/change-password-dialog.tsx
diff apps/admin/src/components/account/linked-accounts-card.tsx apps/web/src/components/account/linked-accounts-card.tsx
diff apps/admin/src/components/account/set-password-dialog.tsx apps/web/src/components/account/set-password-dialog.tsx
```

For each file, copy the admin version (or web if it differs only in import order) and apply these import replacements:

```ts
// @/ imports → relative paths
'@/account/schemas'              → './schemas'
'@/hooks/use-session-query'      → '../hooks/use-session-query'
'@/hooks/use-sessions-query'     → '../hooks/use-sessions-query'
'@/hooks/use-linked-accounts-query' → '../hooks/use-linked-accounts-query'
'@/lib/form-utils'               → '../lib/form-utils'
'@/lib/format'                   → '../lib/format'
'@/lib/get-initials'             → '../lib/get-initials'
'@/components/form/validated-field'    → '../form/validated-field'
'@/components/form/form-error-display' → '../form/form-error-display'
'@/components/form/form-submit-button' → '../form/form-submit-button'
```

- [ ] **Step 4: Create `packages/components/src/account/index.ts`**

```ts
export * from './schemas';
export * from './account-profile-form';
export * from './active-sessions-list';
export * from './change-email-dialog';
export * from './change-password-dialog';
export * from './linked-accounts-card';
export * from './set-password-dialog';
```

- [ ] **Step 5: Find and update all account import sites in both apps**

```bash
rg "'@/account/schemas'" apps/admin/src apps/web/src -l
rg "'@/components/account/(account-profile-form|active-sessions-list|change-email-dialog|change-password-dialog|linked-accounts-card|set-password-dialog)'" apps/admin/src apps/web/src -l
```

Update each import to `@workspace/components/account`. Examples:

```ts
// Before
import { accountProfileSchema } from '@/account/schemas';
import { AccountProfileForm } from '@/components/account/account-profile-form';
// After
import {
  accountProfileSchema,
  AccountProfileForm,
} from '@workspace/components/account';
```

- [ ] **Step 6: Delete original files from both apps**

```bash
rm apps/admin/src/account/schemas.ts
rm apps/web/src/account/schemas.ts
rm apps/admin/src/components/account/account-profile-form.tsx
rm apps/admin/src/components/account/active-sessions-list.tsx
rm apps/admin/src/components/account/change-email-dialog.tsx
rm apps/admin/src/components/account/change-password-dialog.tsx
rm apps/admin/src/components/account/linked-accounts-card.tsx
rm apps/admin/src/components/account/set-password-dialog.tsx
rm apps/web/src/components/account/account-profile-form.tsx
rm apps/web/src/components/account/active-sessions-list.tsx
rm apps/web/src/components/account/change-email-dialog.tsx
rm apps/web/src/components/account/change-password-dialog.tsx
rm apps/web/src/components/account/linked-accounts-card.tsx
rm apps/web/src/components/account/set-password-dialog.tsx
```

Check if directories are now empty:

```bash
rmdir apps/admin/src/components/account 2>/dev/null || true
rmdir apps/web/src/components/account 2>/dev/null || true
rmdir apps/admin/src/account 2>/dev/null || true
rmdir apps/web/src/account 2>/dev/null || true
```

- [ ] **Step 7: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: extract account/ components into @workspace/components"
```

---

## Task 9: Final E2E Smoke Test

All domains extracted. Run the full E2E suite across both apps to confirm end-to-end user flows work correctly.

- [ ] **Step 1: Run E2E tests**

```bash
pnpm web:test:e2e:chromium
```

Expected: all existing E2E tests pass. If any fail, check for missing import updates or broken component props before marking this task complete.

- [ ] **Step 2: Commit if any fixes were needed**

If Step 1 required fixes, commit them:

```bash
git add -A
git commit -m "fix: address E2E failures after @workspace/components extraction"
```

---

## Self-Review Notes

- **Spec coverage:** All 8 extraction domains from the spec are covered (Tasks 1–8). The spec's `form-error.tsx` placement is corrected here — it lives in `form/` not `auth/` to avoid circular imports.
- **`nav-secondary.tsx` and `site-header.tsx`:** Not explicitly listed in the spec's layout table but are clearly shared (appear in both apps) and are included here.
- **`logger.ts` factory:** The spec said "copy logger.ts" but the file has a hardcoded `service: 'admin'`. The factory approach resolves this without breaking any call sites.
- **`google-sign-in-button.tsx` `callbackURL`:** Made required (not optional with a default) since callers always supply it and the default was app-specific.
- **Type consistency:** `SESSION_QUERY_KEY`, `LINKED_ACCOUNTS_QUERY_KEY`, `SESSIONS_QUERY_KEY` are all exported from `@workspace/components/hooks` — any existing `import { SESSION_QUERY_KEY }` will resolve correctly.
