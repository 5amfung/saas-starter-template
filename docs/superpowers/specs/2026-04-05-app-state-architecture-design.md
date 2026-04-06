# App State Architecture Design

**Date:** 2026-04-05
**Goal:** Standardize app-wide state ownership so shared server-backed data updates propagate predictably across routes, shells, and leaf components without ad hoc refresh logic.
**Approach:** Treat URL state, server state, route coordination, and client-only UI state as separate architecture layers with explicit ownership; use TanStack Router for navigation state, TanStack Query for shared server state, and small local/scoped client stores only where synchronous client-only sharing is truly needed.
**Scope exclusion:** This design does not replace the existing policy capability architecture, auth/middleware model, or current package boundaries. It focuses on state ownership and state propagation.

---

## 1. Context

The current codebase already uses strong primitives:

- TanStack Router for route structure and loader orchestration
- TanStack Query in parts of the app
- Better Auth client hooks for session/organization reads
- local component state for forms and ephemeral UI

The bug pattern behind `SF-15` exposed a broader architecture issue:

- a leaf mutation can update a server-backed entity,
- ancestor UI reads the same entity through a different cache or loader path,
- the system has no single canonical owner for that domain data,
- refresh behavior becomes ad hoc and feature-specific.

Concrete examples in the current repo:

- workspace settings can mutate workspace identity while the sidebar and switcher read their own copies,
- route loaders can hold entity data while hooks separately read the same entity,
- Better Auth hooks and app-owned query logic can overlap semantically,
- local form state can temporarily become the freshest copy of data in the tree.

The problem is not simply "state is too deep in the tree." The problem is duplicated ownership of the same state.

Current `main` already contains an initial corrective step:

- workspace shell rename propagation now refreshes through `useWorkspacesQuery`
- the workspace settings rename flow invalidates shared workspace list state and router-owned route data
- workspace route capability rules are already centralized through the shared policy architecture on `main`

This design starts from that improved baseline. It does not propose undoing the current fix. It proposes turning that fix into a consistent repo-wide pattern.

## 2. External Guidance From Current Production Docs

This proposal is aligned with current official guidance:

- React recommends organizing state to avoid duplication and derived-state drift rather than centralizing everything blindly.
  - Source: https://react.dev/learn/managing-state
- TanStack Query explicitly positions itself as the owner for async/server state and notes that once server state is moved there, the remaining globally shared client state is usually much smaller.
  - Source: https://tanstack.com/query/v4/docs/framework/react/guides/does-this-replace-client-state
- TanStack Router recommends external data caches such as TanStack Query when data is shared broadly or needs richer mutation/cache coordination.
  - Source: https://tanstack.com/router/latest/docs/guide/data-loading
  - Source: https://tanstack.com/router/latest/docs/guide/external-data-loading
- Zustand and Jotai are commonly used as small client-state layers, not as the first answer for server-backed entity ownership.
  - Source: https://zustand.docs.pmnd.rs/reference/hooks/use-store
  - Source: https://jotai.org/

## 3. Decision Summary

This repo should standardize on the tools already aligned with its stack:

1. TanStack Router owns navigational state.
2. TanStack Query owns shared server-backed state.
3. Route loaders coordinate preloading and route access, but do not become a second long-lived entity store.
4. React local state remains the default for local UI and form state.
5. A small client-only shared state layer may be introduced later for purely synchronous client state that is not URL state or server state.

## 4. State Ownership Model

### 4.1 URL state

URL state includes:

- active workspace id from path params
- filters
- sort order
- pagination
- selected tabs
- any state that should survive refresh or be linkable/shareable

Owner:

- TanStack Router params and search params

Rules:

- if state must survive refresh, consider URL first
- if state should be linkable/bookmarkable, prefer URL
- do not duplicate URL state in a global client store unless there is a specific bridging need

### 4.2 Server state

Server state includes:

- workspace list
- workspace detail
- membership lists
- invitations
- billing summaries
- account/session-derived server data

Owner:

- TanStack Query query cache

Rules:

- shared server-backed entities get canonical query keys
- mutations must update or invalidate those keys explicitly
- avoid maintaining a second independent cache for the same domain data

### 4.3 Route coordination state

Route loaders remain useful, but their role should narrow.

Owner:

- TanStack Router loaders and invalidation lifecycle

Rules:

- loaders should preload query data when route entry needs it
- loaders may return route-specific facts such as authorization/capabilities
- loaders should avoid returning duplicate long-lived entity data that is already query-owned unless there is a strong route-bound reason
- if a mutation changes route-owned data, router invalidation must be part of the mutation contract

### 4.4 Local component state

Local state includes:

- in-progress form values
- open/closed state for dialogs
- temporary selection inside one component tree
- local optimistic editing presentation

Owner:

- `useState`, `useReducer`, form library state

Rules:

- default to local state until sharing pressure is real
- do not promote local state into global state preemptively

### 4.5 Client-only shared state

This is the smallest and most optional layer.

Examples:

- command palette open state
- drag/drop composition state
- multi-step client workflow drafts
- unsaved cross-page composition state

Owner:

- scoped Zustand or Jotai store only when local state and URL state are not appropriate

Rules:

- do not use this layer for server-backed entity ownership
- prefer scoped stores over one giant app-global store
- add this layer only when a real synchronous client-only sharing problem appears

## 5. Proposed Repo Pattern

The repo should adopt app-owned domain query modules.

Example structure in `apps/web`:

```text
apps/web/src/workspace/
  workspace.queries.ts
  workspace.mutations.ts
  workspace.selectors.ts
  workspace.functions.ts
  workspace.server.ts
```

The exact file names can vary, but responsibilities should be stable:

- `*.queries.ts`: query keys, query options, query hooks
- `*.mutations.ts`: mutation hooks, optimistic update logic, invalidation contracts
- `*.selectors.ts`: optional projection helpers for repeated query shaping
- `*.functions.ts`: app-facing server functions and route-entry helpers
- `*.server.ts`: privileged server-only fact loading

Current `workspace`, `billing`, `account`, and `members` areas are good candidates for this pattern.

Near-term note:

- `apps/web/src/hooks/use-workspaces-query.ts` already exists on `main`
- that file should be treated as an initial bridge toward a domain-owned workspace query module
- migration should prefer evolving that behavior into `apps/web/src/workspace/` ownership rather than re-introducing parallel query shapes

## 6. Canonical Workspace Domain Model

Workspace identity data is the first domain that should be standardized.

Recommended canonical keys:

```ts
['workspace', 'list'][('workspace', 'detail', workspaceId)][
  ('workspace', 'capabilities', workspaceId)
][('workspace', 'members', workspaceId)][
  ('workspace', 'invitations', workspaceId)
][('workspace', 'billing', workspaceId)];
```

Rules:

- sidebar and switcher read `['workspace', 'list']`
- route pages needing the current workspace read `['workspace', 'detail', workspaceId]` or route-capability data
- settings rename mutation updates/invalidate `workspace list` and `workspace detail`
- delete mutation invalidates `workspace list`, current workspace detail, and route state
- role/capability checks remain aligned with the policy architecture already on `main`

## 7. Better Auth Integration Strategy

Better Auth remains the authentication/session transport layer, but it should not be the long-term app-wide source of truth for every organization-shaped UI read.

Guideline:

- use Better Auth hooks directly for narrow auth/session concerns
- wrap organization/workspace reads in app-owned query modules when that data is broadly consumed by the web shell or multiple routes

Why:

- app-owned query keys give the repo explicit mutation contracts
- testing becomes easier
- route loaders and components can share one cache vocabulary
- migration away from any one auth-client query shape becomes easier later

## 8. Loader Guidance

Current pain comes partly from loaders and hooks both owning the same entity data.

Recommended direction:

- loaders should preload query data via `ensureQueryData` or equivalent query-first integration
- loaders should return route-specific capability/access decisions
- components should prefer domain query hooks for entity reads

This keeps one cache authoritative while preserving route-level guards and redirect behavior.

Current baseline implication:

- workspace settings on `main` already performs `router.invalidate({ sync: true })` after rename
- that remains correct until route loaders are narrowed further
- future migration should reduce duplicate entity ownership first, then simplify invalidation contracts

## 9. Migration Principles

1. Move one domain at a time.
2. Do not rewrite all routes at once.
3. Start from the existing workspace shell/query fix already on `main`.
4. Preserve current package boundaries.
5. Prefer adapter layers over invasive rewrites.
6. Add regression tests for cache invalidation behavior.

## 10. Recommended Migration Order

### Phase 1: Workspace shell state

- consolidate the existing workspace list hook into a domain-owned workspace query module
- add canonical workspace detail/query contracts that build on the current list refresh behavior
- keep sidebar/switcher/header consumers on one query vocabulary
- preserve the shipped rename/delete propagation behavior while narrowing ownership

### Phase 2: Workspace detail routes

- settings
- members
- invitations
- overview identity reads

### Phase 3: Billing and account shared state

- workspace billing summaries
- account profile/session projections
- notifications and other account-scoped query modules

### Phase 4: Client-only shared state audit

- identify actual candidates for scoped Zustand/Jotai stores
- introduce only where needed

## 11. Success Criteria

The architecture is working when:

- a workspace rename updates all workspace shell consumers without ad hoc refresh code scattered around the tree
- route loaders no longer duplicate long-lived entity ownership unnecessarily
- query keys are explicit and consistent across mutations and readers
- new features have an obvious place to put each state type
- developers can answer "who owns this state?" quickly

## 12. Explicit Non-Goals

- replacing TanStack Router
- replacing Better Auth
- replacing the current policy capability model
- introducing one monolithic app-global store
- migrating every domain in one pass

## 13. Preferred Outcome

The best outcome is a state architecture that is boring, explicit, and easy to extend:

- URL state in Router
- shared server state in Query
- local state local
- route loaders coordinating, not duplicating
- client-only shared stores used sparingly

That is the pattern most consistent with both the repo’s current stack and current production guidance from the relevant tools.
