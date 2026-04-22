# SF-27 Design: Workspace Switcher Trigger Details

## Summary

Update the web app workspace switcher trigger to show:

- the active workspace name on the first line
- the active workspace plan name on the second line
- a right-side status icon:
  - `users` when the workspace has more than one member
  - `lock` when the workspace is not shared (`memberCount <= 1`)

The dropdown content remains unchanged. Workspace rows inside the dropdown will continue to show only the existing role/name presentation.

## Goals

- Match the Linear request for the sidebar trigger visual treatment.
- Keep the change tightly scoped to the active workspace trigger.
- Preserve the current dropdown behavior and layout.
- Avoid introducing duplicate sources of truth for plan or sharing state.

## Non-Goals

- Redesigning workspace rows inside the dropdown
- Adding plan or sharing metadata to every workspace item in the dropdown
- Persisting plan or member-count display state into organization metadata
- Refactoring unrelated sidebar, billing, or workspace navigation behavior

## Existing Context

### UI ownership

- `apps/web/src/components/app-sidebar.tsx` resolves the active workspace and passes a minimal `workspaces` array into `WorkspaceSwitcher`.
- `apps/web/src/components/workspace-switcher.tsx` renders both the sidebar trigger and the dropdown menu.

### Data ownership

- Accessible workspaces currently come from `authClient.organization.list()` via `useWorkspaceListQuery()`.
- Active workspace detail is already overlaid into the list by `mergeCurrentWorkspaceIntoList()`.
- Workspace plan resolution already exists in billing/server code.
- Workspace member counts already exist in auth/billing server helpers.

The current sidebar model only passes `id`, `name`, and `logo` to `WorkspaceSwitcher`, so the trigger cannot currently render plan or shared/private state.

## Proposed Approach

### 1. Add an active-workspace shell detail query

Introduce a small web-facing server helper for a single workspace id that returns:

- `planName: string`
- `memberCount: number`

This helper should resolve:

- plan name from the existing billing/auth subscription helpers
- member count from the existing workspace/auth member-count helpers

The helper should be scoped to the active workspace only. It should not fetch or enrich the entire workspace list.

### 2. Keep dropdown workspace items unchanged

`AppSidebar` should continue to build the existing minimal workspace list for dropdown rows. No new per-row plan or sharing metadata is needed for the dropdown.

### 3. Extend the trigger props for `WorkspaceSwitcher`

Add a small trigger-specific detail payload to `WorkspaceSwitcher`, separate from the dropdown items:

```ts
triggerDetail?: {
  planName: string;
  memberCount: number;
}
```

This keeps the component API explicit:

- `workspaces` remains the dropdown list model
- `triggerDetail` drives only the trigger’s subtitle and right-side icon

### 4. Render the trigger as a two-line summary

In the trigger area:

- first line: active workspace name
- second line: plan name in muted styling
- right side: `IconUsers` when `memberCount > 1`, otherwise `IconLock`

The dropdown contents, switching behavior, and create-workspace flow stay exactly as they are.

## Why This Approach

### Recommended option

Enrich only the active workspace detail path and keep the dropdown model unchanged.

### Why it fits this codebase

- It matches the approved scope: trigger only.
- It minimizes blast radius in `AppSidebar` and `WorkspaceSwitcher`.
- It respects current ownership boundaries:
  - auth/workspace code owns membership access
  - billing/auth helpers own plan resolution
  - the component only renders prepared data
- It avoids paying for broader list enrichment that the UI will not render.

## Alternatives Considered

### Enrich every workspace in the list

Rejected because the dropdown does not need plan or sharing metadata. This would increase query and mapping complexity without user-visible benefit for this ticket.

### Derive from organization metadata

Rejected because plan and member count already have authoritative sources elsewhere. Copying them into metadata would create drift risk and extra synchronization work.

### Fetch multiple client-side sources directly inside `WorkspaceSwitcher`

Rejected because `WorkspaceSwitcher` is currently a mostly presentational shell component. Moving billing and membership data loading into the component would blur boundaries and complicate testing.

## Data Flow

1. `AppSidebar` resolves the active workspace id as it does today.
2. `AppSidebar` requests active-workspace trigger details for that id.
3. `AppSidebar` passes:
   - the existing `workspaces` list for the dropdown
   - the existing `activeWorkspaceId`
   - the new trigger detail payload
4. `WorkspaceSwitcher` renders:
   - the existing dropdown rows from `workspaces`
   - the new subtitle and sharing icon in the trigger only

## Error Handling

- If trigger details are still loading, the trigger should keep rendering the active workspace name and omit the subtitle/icon until data is ready.
- If the detail query fails, the trigger should gracefully fall back to the current single-line name rendering instead of breaking the sidebar.
- Workspace switching and workspace creation behavior should remain unaffected by trigger-detail failures.

## Testing Plan

### Unit tests

Update:

- `apps/web/test/unit/components/workspace-switcher.test.tsx`
- `apps/web/test/unit/components/app-sidebar.test.tsx`

Cover:

- trigger renders plan subtitle when provided
- trigger renders `users` icon when `memberCount > 1`
- trigger renders `lock` icon when `memberCount <= 1`
- dropdown rows remain unchanged
- missing trigger detail falls back to current rendering safely

### Integration / route behavior

No new route behavior is expected. Existing workspace switching behavior should continue to work unchanged.

### E2E

Add a focused assertion to the existing workspace switcher coverage that the trigger shows the subtitle/icon for a known workspace state, without asserting any new dropdown row content.

## Risks

### Extra query for active workspace details

This adds one more active-workspace data dependency in the sidebar. The scope is still acceptable because it is limited to a single workspace and directly serves the approved trigger UI.

### Visual crowding in the trigger

The trigger currently has a simple one-line layout. The updated two-line layout needs to keep truncation and alignment clean in the sidebar’s existing width constraints.

## Definition of Done

SF-27 is complete when:

- the workspace switcher trigger shows the active workspace plan name under the workspace name
- the trigger shows `users` for shared workspaces and `lock` for non-shared workspaces
- dropdown rows remain visually and behaviorally unchanged
- unit coverage is updated for trigger rendering and fallback behavior
- targeted E2E coverage confirms the trigger presentation
