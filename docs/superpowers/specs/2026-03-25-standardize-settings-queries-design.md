# Standardize Data Fetching Patterns in Workspace Settings

**Date**: 2026-03-25
**Scope**: `settings.tsx` and related files under the workspace route tree

## Problem

`apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx` uses five different data fetching patterns: router loader data, two Better Auth reactive hooks, a manual `useEffect`+`useState` for role, and an inline `useQuery` for billing. The manual `useEffect` pattern is duplicated in `app-sidebar.tsx` and inconsistent with `use-members-table.ts`, which already fetches the same role via `useQuery`. The billing query is duplicated between `settings.tsx` and `billing-page.tsx` with no shared key.

## Decision

**Option B — Balanced**: Promote role to the parent route loader, extract shared hooks for billing and role, remove manual `useEffect` patterns. Better Auth reactive hooks stay where they serve localized reactive needs.

## Design

### 1. Parent Route Loader — Add Role

Extend the `$workspaceId.tsx` loader to fetch both workspace membership and the member's role in parallel.

**Server function**: Add `getWorkspaceWithRole` to `workspace.functions.ts`. Internally uses `Promise.all` to call `ensureWorkspaceMembership` and a new server-side role lookup in parallel.

**Loader return shape changes from**:

```ts
Organization;
```

**to**:

```ts
{ workspace: Organization, role: string | null }
```

**Add `staleTime`** (e.g., 30 seconds) to the parent route config so navigating between child pages does not re-fetch on every transition.

**All child routes** that call `useLoaderData()` on the parent must destructure the new shape. The TypeScript compiler will catch any missed call sites.

### 2. Extract `useBillingDataQuery` Hook

Create `apps/web/src/billing/use-billing-data-query.ts`:

- Exports `BILLING_DATA_QUERY_KEY(workspaceId)` — shared query key factory.
- Exports `useBillingDataQuery(workspaceId, enabled)` — wraps `getWorkspaceBillingData` in `useQuery`.

Replaces the inline `useQuery` in both `settings.tsx` and `billing-page.tsx`. Invalidation calls in `billing-page.tsx` switch to the exported key factory.

### 3. Extract `useActiveMemberRoleQuery` Hook

Create `apps/web/src/hooks/use-active-member-role-query.ts`:

- Exports `ACTIVE_MEMBER_ROLE_QUERY_KEY(workspaceId)` — shared query key factory.
- Exports `useActiveMemberRoleQuery(workspaceId)` — wraps `authClient.organization.getActiveMemberRole()` in `useQuery` with `enabled: !!workspaceId`.

This hook serves components **outside** the `$workspaceId` route tree (e.g., `app-sidebar.tsx`) that cannot access `useLoaderData()`.

Also replaces the inline `useQuery` in `use-members-table.ts` for a single source of truth on the query key.

### 4. Cleanup in `settings.tsx`

| Data                | Before                                     | After                                       |
| ------------------- | ------------------------------------------ | ------------------------------------------- |
| Workspace           | `useLoaderData()` returns Organization     | `useLoaderData()` — destructure `workspace` |
| Role                | Manual `useEffect` + `useState` (15 lines) | `useLoaderData()` — destructure `role`      |
| Active organization | `authClient.useActiveOrganization()`       | Stays — used in mutation stale-check        |
| Billing             | Inline `useQuery`                          | `useBillingDataQuery(workspaceId, isOwner)` |
| Organization list   | `authClient.useListOrganizations()`        | Stays — localized "last workspace" check    |

**Removed from settings.tsx**:

- `useState` + `useEffect` block for `activeRole`.
- `hasOwnerRole` helper — replaced by `role === 'owner'` or `role?.includes('owner')` inline.
- Inline billing `useQuery` — replaced by hook import.

**Result**: 3 data patterns (loader, `useQuery` hook, Better Auth reactive hook) instead of 5. ~20 lines removed.

## Files Changed

| File                                                          | Change                                                                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/web/src/routes/_protected/ws/$workspaceId.tsx`          | Extend loader to fetch role in parallel; add `staleTime`; return `{ workspace, role }`                    |
| `apps/web/src/workspace/workspace.functions.ts`               | Add `getWorkspaceWithRole` server function                                                                |
| `apps/web/src/workspace/workspace.server.ts`                  | Add server-side role lookup helper if needed                                                              |
| `apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx` | Remove `useEffect`/`useState` for role; use loader role; use `useBillingDataQuery`; remove `hasOwnerRole` |
| `apps/web/src/hooks/use-active-member-role-query.ts`          | **New** — shared `useQuery` hook + query key for role                                                     |
| `apps/web/src/billing/use-billing-data-query.ts`              | **New** — shared `useQuery` hook + query key for billing                                                  |
| `apps/web/src/components/app-sidebar.tsx`                     | Replace `useEffect`+`useState` with `useActiveMemberRoleQuery`                                            |
| `apps/web/src/workspace/use-members-table.ts`                 | Replace inline role `useQuery` with `useActiveMemberRoleQuery`                                            |
| `apps/web/src/components/billing/billing-page.tsx`            | Replace inline billing `useQuery` + key with `useBillingDataQuery`                                        |

## Verification Targets

Child routes under `$workspaceId` that may call `useLoaderData()` and need to destructure the new shape:

- `settings.tsx`
- `overview.tsx`
- `members.tsx`
- `billing.tsx`
- `projects.tsx`
- Any other files using `workspaceRouteApi.useLoaderData()` or `Route.useLoaderData()`

The TypeScript compiler will flag all missed sites via the changed return type.

## Testing

Run from project root:

1. `pnpm run typecheck` — catches all loader shape mismatches.
2. `pnpm run lint` — ensures code quality.
3. `pnpm test` — verifies no behavioral regressions.
