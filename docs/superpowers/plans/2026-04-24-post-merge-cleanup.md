# Post-Merge Cleanup Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove stale two-app cleanup leftovers after merging admin into web and inlining the old components package.

**Architecture:** Keep domain package boundaries intact. Remove only configuration, docs, and tests that encode the retired separate-admin-app runtime model.

**Tech Stack:** TypeScript, Better Auth, TanStack Start, Vitest, pnpm.

---

## Task 1: Root Dev Script Cleanup

- [x] **Step 1: Remove duplicate `dev:web` root script**

The branch already contains commit `d6d78ee refactor(web): remove unused dev:web script from package.json`.

- [x] **Step 2: Update README command docs**

Remove the stale `pnpm run dev:web` row from the app-specific commands table because root `pnpm run dev` is now the single web-app dev entry.

## Task 2: Remove Retired Auth Cookie Prefix Option

- [x] **Step 1: Remove `cookiePrefix` from auth server config**

Delete the `AuthConfig.cookiePrefix` option and the conditional `advanced.cookiePrefix` wiring from `packages/auth/src/auth.server.ts`.

- [x] **Step 2: Update auth package tests**

Delete tests that assert `cookiePrefix` override behavior and simplify the local Better Auth config test type.

- [x] **Step 3: Update web init test**

Remove the assertion that `getAuth()` does not pass `cookiePrefix`; the type no longer permits that option.

## Task 3: Verification

- [x] **Step 1: Search for retired live references**

Run:

```bash
rg -n "cookiePrefix|dev:web|@workspace/components" README.md package.json apps packages
```

Expected: no live runtime or command-doc references remain. Historical docs under `docs/superpowers` are allowed to mention retired concepts.

- [x] **Step 2: Run targeted tests**

Run:

```bash
pnpm --filter @workspace/auth test test/unit/auth.server.test.ts
pnpm --filter @workspace/web test test/unit/init/init.test.ts
```

Expected: both pass.

- [x] **Step 3: Run static checks**

Run:

```bash
pnpm --filter @workspace/auth typecheck
pnpm --filter @workspace/web typecheck
pnpm run lint
```

Expected: all pass.
