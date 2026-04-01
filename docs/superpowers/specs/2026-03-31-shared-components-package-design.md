# Design: Extract Shared Components into `@workspace/components`

**Date:** 2026-03-31
**Status:** Approved

## Problem

`apps/admin` and `apps/web` share ~40 identical or near-identical components, hooks, and utility files that have been copy-pasted between the two apps. Any change to shared logic must be applied twice, and the copies will inevitably drift apart over time.

## Goal

Extract all genuinely shared components, hooks, and utilities into a single new package `@workspace/components`, so both apps import from one source of truth. Routes stay per-app.

---

## Extraction Scope

### Included in `@workspace/components`

| Domain     | Files                                                                                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/`     | `format.ts`, `form-utils.ts`, `email-provider.ts`, `get-initials.ts`, `logger.ts`, `table-constants.ts`, `test-email-links.ts`                                                                        |
| `hooks/`   | `use-column-sort.ts`, `use-linked-accounts-query.ts`, `use-session-query.ts`, `use-sessions-query.ts`                                                                                                 |
| `icons/`   | `google-icon.tsx`                                                                                                                                                                                     |
| `form/`    | `validated-field.tsx`, `form-error-display.tsx`, `form-submit-button.tsx`                                                                                                                             |
| `layout/`  | `dynamic-breadcrumb.tsx`, `nav-admin.tsx`, `nav-user.tsx`, `not-found.tsx`, `sortable-header.tsx`, `table-pagination.tsx`, `theme-provider.tsx`                                                       |
| `auth/`    | `auth-layout.tsx`, `check-email-card.tsx`, `form-error.tsx`, `forgot-password-form.tsx`, `google-sign-in-button.tsx`, `reset-password-form.tsx`, `signin-form.tsx` (parameterized), `signup-form.tsx` |
| `account/` | `schemas.ts`, `account-profile-form.tsx`, `active-sessions-list.tsx`, `change-email-dialog.tsx`, `change-password-dialog.tsx`, `linked-accounts-card.tsx`, `set-password-dialog.tsx`                  |

### Stays Per-App

| File(s)                           | Reason                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `app-sidebar.tsx`                 | Fundamentally different — admin has 2 nav items; web has workspace switcher and multiple nav sections                  |
| `middleware/auth.ts`              | Different auth logic — admin validates admin role only; web adds workspace session check                               |
| `admin/admin.server.ts`           | Different redirect targets after auth failure                                                                          |
| `auth/validators.ts` (admin only) | Admin-specific validators; web uses `@workspace/auth` directly                                                         |
| `admin/` components (all)         | Dashboard cards, charts, user table, user form, delete dialog — only relevant to admin app; no other consumer foreseen |
| `routes/` (all)                   | File-based routing is app-specific by design                                                                           |

---

## Package Structure

```
packages/components/
├── package.json              # name: @workspace/components
├── tsconfig.json             # extends workspace root tsconfig
└── src/
    ├── account/
    │   ├── schemas.ts
    │   ├── account-profile-form.tsx
    │   ├── active-sessions-list.tsx
    │   ├── change-email-dialog.tsx
    │   ├── change-password-dialog.tsx
    │   ├── linked-accounts-card.tsx
    │   └── set-password-dialog.tsx
    ├── auth/
    │   ├── auth-layout.tsx
    │   ├── check-email-card.tsx
    │   ├── form-error.tsx
    │   ├── forgot-password-form.tsx
    │   ├── google-sign-in-button.tsx
    │   ├── reset-password-form.tsx
    │   ├── signin-form.tsx
    │   └── signup-form.tsx
    ├── form/
    │   ├── form-error-display.tsx
    │   ├── form-submit-button.tsx
    │   └── validated-field.tsx
    ├── hooks/
    │   ├── use-column-sort.ts
    │   ├── use-linked-accounts-query.ts
    │   ├── use-session-query.ts
    │   └── use-sessions-query.ts
    ├── icons/
    │   └── google-icon.tsx
    ├── layout/
    │   ├── dynamic-breadcrumb.tsx
    │   ├── nav-admin.tsx
    │   ├── nav-user.tsx
    │   ├── not-found.tsx
    │   ├── sortable-header.tsx
    │   ├── table-pagination.tsx
    │   └── theme-provider.tsx
    └── lib/
        ├── email-provider.ts
        ├── form-utils.ts
        ├── format.ts
        ├── get-initials.ts
        ├── logger.ts
        ├── table-constants.ts
        └── test-email-links.ts
```

### Import Pattern

Each domain is a separate entry point via `package.json` `exports`. Consumers import by domain to avoid pulling in unnecessary dependencies:

```ts
import { formatDate } from '@workspace/components/lib';
import { useColumnSort } from '@workspace/components/hooks';
import { SigninForm } from '@workspace/components/auth';
import { AccountProfileForm } from '@workspace/components/account';
import { ValidatedField } from '@workspace/components/form';
import { ThemeProvider } from '@workspace/components/layout';
```

### Package Dependencies

| Dependency               | Kind   | Reason                                   |
| ------------------------ | ------ | ---------------------------------------- |
| `@workspace/ui`          | direct | shadcn primitives used by all components |
| `@workspace/auth`        | direct | Auth client, schemas, validators         |
| `react`, `react-dom`     | peer   | Component rendering                      |
| `@tanstack/react-query`  | peer   | Used by hooks                            |
| `@tanstack/react-router` | peer   | Used by nav and breadcrumb components    |
| `@tanstack/react-form`   | peer   | Used by form components                  |
| `@tabler/icons-react`    | direct | Icons used throughout                    |
| `zod`                    | direct | Used in account schemas                  |

---

## Migration Order

Extraction proceeds domain by domain, lowest dependency first. Each step is a self-contained PR that leaves both apps fully functional.

| Step | Domain                                                                                           | Key dependencies                                                |
| ---- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1    | **Package scaffold** — `package.json`, `tsconfig.json`, register in pnpm workspace and Turborepo | none                                                            |
| 2    | **`lib/`** — 7 utility files                                                                     | none                                                            |
| 3    | **`hooks/`** — 4 hooks                                                                           | `lib/`, `@workspace/auth`                                       |
| 4    | **`icons/`** — `google-icon.tsx`                                                                 | none                                                            |
| 5    | **`form/`** — 3 primitives                                                                       | `@workspace/ui`                                                 |
| 6    | **`layout/`** — breadcrumb, nav, not-found, sortable-header, pagination, theme-provider          | `@workspace/ui`, `@workspace/auth`, `form/`, `icons/`           |
| 7    | **`auth/`** — 8 components                                                                       | `@workspace/ui`, `@workspace/auth`, `form/`, `hooks/`, `icons/` |
| 8    | **`account/`** — schemas + 6 components                                                          | `@workspace/ui`, `@workspace/auth`, `form/`, `hooks/`           |

For each step: add files to `@workspace/components`, update imports in both apps, delete local copies, run the verification gate.

---

## Special Cases

### `signin-form.tsx`

The two app versions differ in two ways:

1. Admin defaults `callbackURL` to `/dashboard`; web defaults to `/ws`.
2. Admin renders a specific error message when `?error=admin_only` is in the URL.

**Resolution:** Add one optional prop. The `admin_only` error is handled internally — the component reads the `error` search param and maps it to a message like any other error code. No `adminOnlyMode` flag is needed.

```ts
interface SigninFormProps {
  defaultCallbackUrl?: string; // admin passes '/dashboard', web passes '/ws'
}
```

### `lib/utils.ts` (admin only)

Admin has a local `lib/utils.ts` that exports only `cn()`. Web already imports `cn` from `@workspace/ui/lib/utils`. During Step 2, admin's `lib/utils.ts` is deleted and all its import sites are updated to `@workspace/ui/lib/utils`. No new file is added.

---

## Testing & Verification

### Per-step gate (Steps 2–8)

Each PR must pass all three before merge:

```
pnpm typecheck   # strict TypeScript across all packages and apps
pnpm lint        # ESLint across workspace
pnpm test        # Vitest unit + integration tests
```

### End-to-end (Step 8 only)

```
pnpm test:e2e    # Playwright smoke test across both apps after all domains extracted
```

### No new tests required

This migration is a pure refactor — no behavior changes. Existing tests update only their import paths (e.g., `@/components/auth/signin-form` → `@workspace/components/auth`). The existing test suite is the regression net.

### Circular import guard

`@workspace/components` imports from `@workspace/auth` and `@workspace/ui`. Neither package may import from `@workspace/components`. Turborepo's dependency graph enforces this at build time — a circular import fails the build immediately.

### Path alias note

Components currently use `@/lib/...`, `@/hooks/...`, `@/components/...`. The `@/` alias belongs to each app and does not exist inside `@workspace/components`. All internal cross-domain imports within the package use relative paths.
