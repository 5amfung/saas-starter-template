# Codebase Refactoring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce code duplication, improve type safety, fix data bugs, and consolidate test infrastructure across the monorepo.

**Architecture:** Bottom-up extraction — build shared primitives first (constants, utilities, components), then update consumers, then fix surgical issues. Each layer is independently verifiable via typecheck + test + lint.

**Tech Stack:** TanStack Start, TanStack Router v1, TanStack Query v5, TanStack Table v8, TanStack Form, React 19, shadcn/ui, Vitest, pnpm

**Spec:** `docs/superpowers/specs/2026-03-22-codebase-refactoring-design.md`

---

## Chunk 1: Shared Table Utilities (Layer 1)

### Task 1: Create shared table constants

**Files:**

- Create: `apps/web/src/lib/table-constants.ts`

- [ ] **Step 1: Create the constants file**

```ts
// apps/web/src/lib/table-constants.ts

/** CSS class applied to the actions column in data tables. */
export const ACTIONS_COLUMN_CLASS = 'text-right w-14';

/** Page size options for workspace tables (members, invitations). */
export const DEFAULT_PAGE_SIZE_OPTIONS = ['10', '25', '50'];

/** Page size options for the admin users table. */
export const ADMIN_PAGE_SIZE_OPTIONS = ['10', '50', '100'];

/** Maximum number of skeleton rows shown while loading. */
export const MAX_SKELETON_ROWS = 10;
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS — no consumers yet, just exports

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/table-constants.ts
git commit -m "refactor: extract shared table constants to lib/table-constants"
```

---

### Task 2: Create shared formatting utilities

**Files:**

- Create: `apps/web/src/lib/format.ts`
- Create: `apps/web/test/unit/lib/format.test.ts`

- [ ] **Step 1: Write tests for formatDate, normalizeRole, toBase64Url**

```ts
// apps/web/test/unit/lib/format.test.ts

import { formatDate, normalizeRole, toBase64Url } from '@/lib/format';

describe('formatDate', () => {
  it('formats a Date object to en-US short format', () => {
    // Use a fixed date to avoid timezone issues.
    const result = formatDate(new Date('2026-01-15T00:00:00'));
    expect(result).toBe('Jan 15, 2026');
  });

  it('formats a date string to en-US short format', () => {
    const result = formatDate('2026-06-01');
    expect(result).toContain('2026');
    expect(result).toContain('Jun');
  });
});

describe('normalizeRole', () => {
  it('returns dash for empty string', () => {
    expect(normalizeRole('')).toBe('-');
  });

  it('trims and joins comma-separated roles', () => {
    expect(normalizeRole(' admin , member ')).toBe('admin, member');
  });

  it('handles a single role without commas', () => {
    expect(normalizeRole('owner')).toBe('owner');
  });

  it('filters out empty segments', () => {
    expect(normalizeRole('admin,,member')).toBe('admin, member');
  });
});

describe('toBase64Url', () => {
  it('encodes a simple string', () => {
    const result = toBase64Url('hello');
    // Base64url should not contain +, /, or trailing =.
    expect(result).not.toMatch(/[+/=]/);
  });

  it('encodes unicode characters', () => {
    const result = toBase64Url('héllo wörld');
    expect(result).not.toMatch(/[+/=]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/web test test/unit/lib/format.test.ts`
Expected: FAIL — module `@/lib/format` does not exist yet

- [ ] **Step 3: Create the format utilities**

```ts
// apps/web/src/lib/format.ts

/**
 * Format a date to en-US short format (e.g., "Jan 15, 2026").
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Normalize a comma-separated role string by trimming each segment.
 * Returns '-' for empty input.
 */
export function normalizeRole(role: string): string {
  if (!role) return '-';
  return role
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Encode a string to base64url format (browser-only).
 */
export function toBase64Url(input: string): string {
  const base64 = window.btoa(unescape(encodeURIComponent(input)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/web test test/unit/lib/format.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/format.ts apps/web/test/unit/lib/format.test.ts
git commit -m "refactor: extract formatDate, normalizeRole, toBase64Url to lib/format"
```

---

### Task 3: Create SortableHeader component

**Files:**

- Create: `apps/web/src/components/sortable-header.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/sortable-header.tsx
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
} from '@tabler/icons-react';

interface SortableHeaderProps {
  column: { getIsSorted: () => false | 'asc' | 'desc' };
  label: string;
}

export function SortableHeader({ column, label }: SortableHeaderProps) {
  const sorted = column.getIsSorted();
  return (
    <div className="flex items-center gap-1">
      {label}
      {sorted === 'asc' ? (
        <IconArrowUp className="size-3.5" />
      ) : sorted === 'desc' ? (
        <IconArrowDown className="size-3.5" />
      ) : (
        <IconArrowsSort className="size-3.5 text-muted-foreground/50" />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sortable-header.tsx
git commit -m "refactor: extract SortableHeader to shared component"
```

---

### Task 4: Create useColumnSort hook

**Files:**

- Create: `apps/web/src/hooks/use-column-sort.ts`
- Create: `apps/web/test/unit/hooks/use-column-sort.test.ts`

- [ ] **Step 1: Write test for useColumnSort**

```ts
// apps/web/test/unit/hooks/use-column-sort.test.ts
import { renderHook, act } from '@testing-library/react';
import { useColumnSort } from '@/hooks/use-column-sort';
import type { SortingState } from '@tanstack/react-table';

describe('useColumnSort', () => {
  it('sets ascending sort when column is unsorted', () => {
    const onSortingChange = vi.fn();
    const sorting: SortingState = [];
    const { result } = renderHook(() =>
      useColumnSort(sorting, onSortingChange)
    );

    act(() => result.current('name'));

    expect(onSortingChange).toHaveBeenCalledWith([{ id: 'name', desc: false }]);
  });

  it('sets descending sort when column is ascending', () => {
    const onSortingChange = vi.fn();
    const sorting: SortingState = [{ id: 'name', desc: false }];
    const { result } = renderHook(() =>
      useColumnSort(sorting, onSortingChange)
    );

    act(() => result.current('name'));

    expect(onSortingChange).toHaveBeenCalledWith([{ id: 'name', desc: true }]);
  });

  it('clears sort when column is descending', () => {
    const onSortingChange = vi.fn();
    const sorting: SortingState = [{ id: 'name', desc: true }];
    const { result } = renderHook(() =>
      useColumnSort(sorting, onSortingChange)
    );

    act(() => result.current('name'));

    expect(onSortingChange).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/web test test/unit/hooks/use-column-sort.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Create the hook**

```ts
// apps/web/src/hooks/use-column-sort.ts
import React from 'react';
import type { SortingState } from '@tanstack/react-table';

/**
 * Hook that returns a memoized sort cycling callback.
 * Cycles: none → asc → desc → none.
 */
export function useColumnSort(
  sorting: SortingState,
  onSortingChange: (sorting: SortingState) => void
) {
  return React.useCallback(
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/web test test/unit/hooks/use-column-sort.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-column-sort.ts apps/web/test/unit/hooks/use-column-sort.test.ts
git commit -m "refactor: extract useColumnSort hook from table components"
```

---

### Task 5: Create TablePagination component

**Files:**

- Create: `apps/web/src/components/table-pagination.tsx`

- [ ] **Step 1: Create the component**

This component must handle two responsive breakpoints: `md:` for workspace tables and `lg:` for admin tables. The `responsiveBreakpoint` prop controls this.

```tsx
// apps/web/src/components/table-pagination.tsx
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from '@tabler/icons-react';
import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { Skeleton } from '@workspace/ui/components/skeleton';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: ReadonlyArray<string>;
  isLoading: boolean;
  /** Total number of items for the count display. */
  totalCount: number;
  /** Label for the count (e.g., "member", "invitation", "user"). */
  countLabel: string;
  /** ID prefix for the rows-per-page select (for a11y). */
  selectId: string;
  /** Breakpoint at which rows-per-page and first/last buttons are shown. Default 'md'. */
  responsiveBreakpoint?: 'md' | 'lg';
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TablePagination({
  page,
  totalPages,
  pageSize,
  pageSizeOptions,
  isLoading,
  totalCount,
  countLabel,
  selectId,
  responsiveBreakpoint = 'md',
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPagesSafe = Math.max(1, totalPages);
  const bp = responsiveBreakpoint;

  // Build responsive classes based on breakpoint.
  const hiddenUntilBp = `hidden ${bp}:flex`;

  return (
    <div className="flex items-center justify-between gap-4 px-1">
      <div
        className={`text-sm text-muted-foreground ${bp === 'lg' ? 'hidden flex-1 lg:flex' : ''}`}
      >
        {isLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          `${totalCount} ${countLabel}${totalCount === 1 ? '' : 's'}`
        )}
      </div>
      <div
        className={`flex items-center gap-6 ${bp === 'lg' ? 'w-full lg:w-fit' : ''}`}
      >
        <div className={`${hiddenUntilBp} items-center gap-2`}>
          <Label htmlFor={selectId} className="text-sm font-medium">
            Rows per page
          </Label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              if (!value) return;
              onPageSizeChange(Number(value));
            }}
            disabled={isLoading}
          >
            <SelectTrigger id={selectId} size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm font-medium">
          {`Page ${page} of ${totalPagesSafe}`}
        </div>
        <div
          className={`flex items-center gap-2 ${bp === 'lg' ? 'ml-auto lg:ml-0' : ''}`}
        >
          <Button
            variant="outline"
            size="icon"
            className={hiddenUntilBp}
            onClick={() => onPageChange(1)}
            disabled={isLoading || page <= 1}
          >
            <span className="sr-only">Go to first page</span>
            <IconChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page - 1)}
            disabled={isLoading || page <= 1}
          >
            <span className="sr-only">Go to previous page</span>
            <IconChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page + 1)}
            disabled={isLoading || page >= totalPagesSafe}
          >
            <span className="sr-only">Go to next page</span>
            <IconChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={hiddenUntilBp}
            onClick={() => onPageChange(totalPagesSafe)}
            disabled={isLoading || page >= totalPagesSafe}
          >
            <span className="sr-only">Go to last page</span>
            <IconChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/table-pagination.tsx
git commit -m "refactor: extract TablePagination to shared component"
```

---

### Task 6: Wire shared modules into workspace-members-table

**Files:**

- Modify: `apps/web/src/components/workspace/workspace-members-table.tsx`

- [ ] **Step 1: Replace inline constants, SortableHeader, normalizeRole, handleHeaderSort, and pagination block**

In `workspace-members-table.tsx`:

1. Add imports at top:

   ```ts
   import {
     ACTIONS_COLUMN_CLASS,
     DEFAULT_PAGE_SIZE_OPTIONS,
     MAX_SKELETON_ROWS,
   } from '@/lib/table-constants';
   import { normalizeRole } from '@/lib/format';
   import { SortableHeader } from '@/components/sortable-header';
   import { TablePagination } from '@/components/table-pagination';
   import { useColumnSort } from '@/hooks/use-column-sort';
   ```

2. Remove lines 69-71 (inline `PAGE_SIZE_OPTIONS`, `MAX_SKELETON_ROWS`, `ACTIONS_COLUMN_CLASS`)

3. Replace the `handleHeaderSort` `useCallback` (lines 189-203) with:

   ```ts
   const handleHeaderSort = useColumnSort(sorting, onSortingChange);
   ```

4. Replace the pagination JSX block (lines 288-371) with:

   ```tsx
   <TablePagination
     page={page}
     totalPages={totalPagesSafe}
     pageSize={pageSize}
     pageSizeOptions={DEFAULT_PAGE_SIZE_OPTIONS}
     isLoading={isLoading}
     totalCount={total}
     countLabel="member"
     selectId="members-rows-per-page"
     onPageChange={onPageChange}
     onPageSizeChange={onPageSizeChange}
   />
   ```

5. Delete the inline `SortableHeader` function (lines 375-395)

6. Delete the inline `normalizeRole` function (lines 397-404)

7. Remove unused imports that were only needed by the deleted code (e.g., `IconArrowUp`, `IconArrowDown`, `IconArrowsSort`, pagination UI components if no longer used elsewhere)

- [ ] **Step 2: Run typecheck + lint**

Run: `pnpm run typecheck && pnpm run lint`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @workspace/web test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/workspace/workspace-members-table.tsx
git commit -m "refactor: use shared table utilities in workspace-members-table"
```

---

### Task 7: Wire shared modules into workspace-invitations-table

**Files:**

- Modify: `apps/web/src/components/workspace/workspace-invitations-table.tsx`

- [ ] **Step 1: Same pattern as Task 6**

1. Add imports for `ACTIONS_COLUMN_CLASS`, `DEFAULT_PAGE_SIZE_OPTIONS`, `MAX_SKELETON_ROWS`, `normalizeRole`, `formatDate`, `SortableHeader`, `TablePagination`, `useColumnSort`
2. Remove inline constants (lines 71-73)
3. Replace `handleHeaderSort` callback with `useColumnSort(sorting, onSortingChange)`
4. Replace pagination block (lines 283-366) with `<TablePagination>` using `countLabel="invitation"` and `selectId="invitations-rows-per-page"`
5. Delete inline `SortableHeader` (lines 370-389), `normalizeRole` (lines 392-399), `formatDate` (lines 401-407)
6. Remove unused imports

- [ ] **Step 2: Run typecheck + lint**

Run: `pnpm run typecheck && pnpm run lint`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @workspace/web test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/workspace/workspace-invitations-table.tsx
git commit -m "refactor: use shared table utilities in workspace-invitations-table"
```

---

### Task 8: Wire shared modules into admin-user-table

**Files:**

- Modify: `apps/web/src/components/admin/admin-user-table.tsx`

- [ ] **Step 1: Same pattern as Task 6, with admin-specific differences**

1. Add imports for `ACTIONS_COLUMN_CLASS`, `ADMIN_PAGE_SIZE_OPTIONS`, `MAX_SKELETON_ROWS`, `formatDate`, `SortableHeader`, `TablePagination`, `useColumnSort`
2. Remove inline constants (lines 93-95)
3. Replace `handleHeaderSort` callback with `useColumnSort(sorting, onSortingChange)`
4. Replace pagination block (lines 491-573) with `<TablePagination>` using:
   - `pageSizeOptions={ADMIN_PAGE_SIZE_OPTIONS}`
   - `responsiveBreakpoint="lg"`
   - `countLabel="user"`
   - `selectId="rows-per-page"`
5. Delete inline `SortableHeader` (lines 581-601), `formatDate` (lines 638-644)
6. Keep `ColumnVisibilityDropdown` — it is NOT duplicated, it stays in this file
7. Remove unused imports

- [ ] **Step 2: Run typecheck + lint**

Run: `pnpm run typecheck && pnpm run lint`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @workspace/web test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/admin/admin-user-table.tsx
git commit -m "refactor: use shared table utilities in admin-user-table"
```

---

### Task 9: Layer 1 verification

- [ ] **Step 1: Full verification pass**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: All PASS

---

## Chunk 2: Shared Chart Utilities + Form Consolidation (Layers 2-3)

### Task 10: Create shared chart utilities

**Files:**

- Create: `apps/web/src/components/admin/chart-utils.tsx`
- Modify: `apps/web/src/components/admin/admin-mau-chart.tsx`
- Modify: `apps/web/src/components/admin/admin-signup-chart.tsx`

- [ ] **Step 1: Create chart-utils.tsx**

```tsx
// apps/web/src/components/admin/chart-utils.tsx
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@workspace/ui/components/toggle-group';

interface TimeRangeToggleProps {
  value: string;
  onChange: (v: string) => void;
}

export function TimeRangeToggle({ value, onChange }: TimeRangeToggleProps) {
  return (
    <>
      <ToggleGroup
        multiple={false}
        value={value ? [value] : []}
        onValueChange={(v) => onChange(v[0] ?? '7d')}
        variant="outline"
        className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
      >
        <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
        <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
        <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
      </ToggleGroup>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v);
        }}
      >
        <SelectTrigger
          className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
          size="sm"
          aria-label="Select time range"
        >
          <SelectValue placeholder="Last 7 days" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="90d" className="rounded-lg">
            Last 3 months
          </SelectItem>
          <SelectItem value="30d" className="rounded-lg">
            Last 30 days
          </SelectItem>
          <SelectItem value="7d" className="rounded-lg">
            Last 7 days
          </SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

export function formatDateTick(value: string) {
  const date = new Date(value + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateLabel(value: React.ReactNode) {
  const date = new Date(String(value) + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
```

- [ ] **Step 2: Update admin-mau-chart.tsx**

1. Add: `import { TimeRangeToggle, formatDateTick, formatDateLabel } from '@/components/admin/chart-utils';`
2. Delete the inline `TimeRangeToggle` (lines 132-179), `formatDateTick` (lines 181-184), `formatDateLabel` (lines 186-193)
3. Remove unused imports (`Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `ToggleGroup`, `ToggleGroupItem` — if not used elsewhere in the file)

- [ ] **Step 3: Update admin-signup-chart.tsx**

Same pattern as Step 2: add import, delete inline copies (lines 153-214), remove unused imports.

- [ ] **Step 4: Run typecheck + lint + tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/admin/chart-utils.tsx apps/web/src/components/admin/admin-mau-chart.tsx apps/web/src/components/admin/admin-signup-chart.tsx
git commit -m "refactor: extract TimeRangeToggle and date formatters to chart-utils"
```

---

### Task 11: Create ValidatedField component

**Files:**

- Create: `apps/web/src/components/form/validated-field.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/form/validated-field.tsx
import type { AnyFieldApi } from '@tanstack/react-form';
import { Field, FieldError, FieldLabel } from '@workspace/ui/components/field';
import { toFieldErrorItem } from '@/lib/utils';

interface ValidatedFieldProps {
  field: AnyFieldApi;
  label?: string;
  children: React.ReactNode;
}

/**
 * Thin wrapper around shadcn Field that handles the isInvalid derivation
 * and FieldError rendering. Each form still uses form.Field directly for
 * subscriptions, validators, and generics.
 */
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

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/form/validated-field.tsx
git commit -m "refactor: create ValidatedField wrapper for form field validation display"
```

---

### Task 12: Create FormSubmitButton component

**Files:**

- Create: `apps/web/src/components/form/form-submit-button.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/form/form-submit-button.tsx
import type { FormApi } from '@tanstack/react-form';
import { IconLoader2 } from '@tabler/icons-react';
import { Button } from '@workspace/ui/components/button';

interface FormSubmitButtonProps {
  form: FormApi<any, any>;
  label: string;
  disabled?: boolean;
}

/**
 * Submit button that subscribes to form.isSubmitting and shows a spinner.
 */
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
          {isSubmitting && <IconLoader2 className="animate-spin" />}
          {label}
        </Button>
      )}
    />
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/form/form-submit-button.tsx
git commit -m "refactor: create FormSubmitButton wrapper for form submission"
```

---

### Task 13: Create FormErrorDisplay component

**Files:**

- Create: `apps/web/src/components/form/form-error-display.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/form/form-error-display.tsx
import type { FormApi } from '@tanstack/react-form';
import { FormError } from '@workspace/ui/components/field';

interface FormErrorDisplayProps {
  form: FormApi<any, any>;
}

/**
 * Subscribes to form-level errors and renders FormError.
 */
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

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/form/form-error-display.tsx
git commit -m "refactor: create FormErrorDisplay wrapper for form-level errors"
```

---

### Task 14: Wire form components into auth forms + fix icon consistency

**Files:**

- Modify: `apps/web/src/components/auth/signin-form.tsx`
- Modify: `apps/web/src/components/auth/signup-form.tsx`
- Modify: `apps/web/src/components/auth/forgot-password-form.tsx`
- Modify: `apps/web/src/components/auth/reset-password-form.tsx`

- [ ] **Step 1: Update each auth form**

For each form:

1. Add imports:

   ```ts
   import { ValidatedField } from '@/components/form/validated-field';
   import { FormSubmitButton } from '@/components/form/form-submit-button';
   import { FormErrorDisplay } from '@/components/form/form-error-display';
   ```

2. Replace each `form.Field` render prop body:
   - Remove the `isInvalid` derivation, `data-invalid`, and `FieldError` rendering
   - Wrap field content with `<ValidatedField field={field} label="...">...</ValidatedField>`
   - Note: the password field in `signin-form.tsx` has a custom label with a "Forgot password?" link — use `ValidatedField` without the `label` prop and include the custom label JSX as a child

3. Replace `form.Subscribe` for errors with `<FormErrorDisplay form={form} />`

4. Replace `form.Subscribe` for submit button with `<FormSubmitButton form={form} label="Sign in" />` (adjust label per form: "Sign up", "Send reset link", "Reset password")

5. Replace `IconLoader` import with `IconLoader2` (if still importing `IconLoader` for other uses). If the only use of `IconLoader` was in the submit button, remove the import entirely since `FormSubmitButton` handles it internally.

6. Remove unused imports: `toFieldErrorItem`, `FieldError`, `FormError` (if no longer used directly), `IconLoader`

- [ ] **Step 2: Run typecheck + lint + tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/auth/signin-form.tsx apps/web/src/components/auth/signup-form.tsx apps/web/src/components/auth/forgot-password-form.tsx apps/web/src/components/auth/reset-password-form.tsx
git commit -m "refactor: use shared form components in auth forms, standardize IconLoader2"
```

---

### Task 15: Layers 2-3 verification

- [ ] **Step 1: Full verification pass**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: All PASS

---

## Chunk 3: Test Infrastructure Cleanup (Layer 4)

### Task 16: Create shared createServerFn mock

**Files:**

- Create: `apps/web/test/mocks/server-fn.ts`
- Modify: `apps/web/test/unit/admin/admin.functions.test.ts`
- Modify: `apps/web/test/unit/billing/billing.functions.test.ts`
- Modify: `apps/web/test/unit/workspace/workspace.functions.test.ts`
- Modify: `apps/web/test/unit/account/notification-preferences.functions.test.ts`

- [ ] **Step 1: Create the shared mock**

````ts
// apps/web/test/mocks/server-fn.ts

/**
 * Creates a mock module for `@tanstack/react-start` that simulates
 * the `createServerFn()` builder pattern used in server functions.
 *
 * Usage:
 * ```ts
 * import { createServerFnMock } from '../../mocks/server-fn';
 * vi.mock('@tanstack/react-start', () => createServerFnMock());
 * ```
 */
export function createServerFnMock() {
  return {
    createServerFn: () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      let handler: Function;
      const builder = {
        inputValidator: () => builder,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        handler: (fn: Function) => {
          handler = fn;
          const callable = (...args: Array<unknown>) => handler(...args);
          callable.inputValidator = () => builder;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
          callable.handler = (fn2: Function) => {
            handler = fn2;
            return callable;
          };
          return callable;
        },
      };
      const callable = (...args: Array<unknown>) => handler(...args);
      callable.inputValidator = () => builder;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      callable.handler = (fn: Function) => {
        handler = fn;
        return callable;
      };
      return callable;
    },
  };
}
````

- [ ] **Step 2: Update each of the 4 test files**

In each file, replace the ~30-line inline `vi.mock('@tanstack/react-start', ...)` block with:

```ts
import { createServerFnMock } from '../../mocks/server-fn';

vi.mock('@tanstack/react-start', () => createServerFnMock());
```

Files: `admin.functions.test.ts`, `billing.functions.test.ts`, `workspace.functions.test.ts`, `notification-preferences.functions.test.ts`

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @workspace/web test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/mocks/server-fn.ts apps/web/test/unit/admin/admin.functions.test.ts apps/web/test/unit/billing/billing.functions.test.ts apps/web/test/unit/workspace/workspace.functions.test.ts apps/web/test/unit/account/notification-preferences.functions.test.ts
git commit -m "refactor: extract createServerFn mock to shared test utility"
```

---

### Task 17: Create shared middleware mock

**Files:**

- Create: `apps/web/test/mocks/middleware.ts`
- Modify: `apps/web/test/unit/middleware/auth.test.ts`
- Modify: `apps/web/test/unit/middleware/admin.test.ts`

- [ ] **Step 1: Create the shared mock**

````ts
// apps/web/test/mocks/middleware.ts

/**
 * Creates a mock for `@tanstack/react-start` that captures middleware
 * server functions for testing.
 *
 * Usage:
 * ```ts
 * const { capturedServerFns, createMiddlewareMock } = createMiddlewareMockFactory();
 * vi.mock('@tanstack/react-start', () => createMiddlewareMock());
 * ```
 */
export function createMiddlewareMockFactory() {
  const capturedServerFns: Record<
    string,
    (opts: { next: () => Promise<unknown> }) => Promise<unknown>
  > = {};

  function createMiddlewareMock() {
    return {
      createMiddleware: () => ({
        server: (
          fn: (opts: { next: () => Promise<unknown> }) => Promise<unknown>
        ) => {
          const index = Object.keys(capturedServerFns).length;
          const key = `middleware_${index}`;
          capturedServerFns[key] = fn;
          return { _key: key };
        },
      }),
    };
  }

  return { capturedServerFns, createMiddlewareMock };
}
````

- [ ] **Step 2: Update both middleware test files**

In each file, replace the `vi.hoisted` block that creates `capturedServerFns` and the `vi.mock('@tanstack/react-start', ...)` block with:

```ts
import { createMiddlewareMockFactory } from '../../mocks/middleware';

const { capturedServerFns, createMiddlewareMock } = vi.hoisted(() =>
  createMiddlewareMockFactory()
);

vi.mock('@tanstack/react-start', () => createMiddlewareMock());
```

Note: The `capturedServerFns` must still be in `vi.hoisted` scope because middleware test files reference it in `beforeEach`/test bodies.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @workspace/web test test/unit/middleware`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/mocks/middleware.ts apps/web/test/unit/middleware/auth.test.ts apps/web/test/unit/middleware/admin.test.ts
git commit -m "refactor: extract createMiddleware mock to shared test utility"
```

---

### Task 18: Add Link mock to router.ts and create GoogleSignInButton mock

**Files:**

- Modify: `apps/web/test/mocks/router.ts`
- Create: `apps/web/test/mocks/google-sign-in-button.ts`
- Modify: 11 test files that use inline Link mock
- Modify: 4 auth test files that use inline GoogleSignInButton mock

- [ ] **Step 1: Update router.ts to add Link mock**

```ts
// apps/web/test/mocks/router.ts

/**
 * Creates hoisted router mock functions.
 */
export function createRouterMocks() {
  return {
    navigate: vi.fn(),
    redirect: vi.fn((opts: unknown) => {
      throw opts;
    }),
  };
}

/**
 * Creates a mock Link component for `@tanstack/react-router`.
 */
export function createRouterLinkMock() {
  return ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  );
}
```

- [ ] **Step 2: Create GoogleSignInButton mock**

````ts
// apps/web/test/mocks/google-sign-in-button.ts

/**
 * Creates a mock module for `@/components/auth/google-sign-in-button`.
 *
 * Usage:
 * ```ts
 * import { createGoogleSignInButtonMock } from '../../mocks/google-sign-in-button';
 * vi.mock('@/components/auth/google-sign-in-button', () => createGoogleSignInButtonMock());
 * ```
 */
export function createGoogleSignInButtonMock() {
  return {
    GoogleSignInButton: () => <button>Sign in with Google</button>,
  };
}
````

- [ ] **Step 3: Update test files that use inline Link mock**

In each of the 11 files, replace the inline `Link` mock inside `vi.mock('@tanstack/react-router', ...)` with an import from the shared mock. The exact pattern varies per file, but generally:

```ts
import { createRouterLinkMock } from '../../mocks/router';

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
  Link: createRouterLinkMock(),
}));
```

- [ ] **Step 4: Update 4 auth test files that use inline GoogleSignInButton mock**

Replace:

```ts
vi.mock('@/components/auth/google-sign-in-button', () => ({
  GoogleSignInButton: () => <button>Sign in with Google</button>,
}));
```

With:

```ts
import { createGoogleSignInButtonMock } from '../../mocks/google-sign-in-button';
vi.mock('@/components/auth/google-sign-in-button', () =>
  createGoogleSignInButtonMock()
);
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @workspace/web test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/test/mocks/router.ts apps/web/test/mocks/google-sign-in-button.ts apps/web/test/unit/ apps/web/test/integration/
git commit -m "refactor: extract Link and GoogleSignInButton mocks to shared test utilities"
```

---

### Task 19: Delete duplicate test file and remove redundant vitest imports

**Files:**

- Delete: `apps/web/test/unit/workspace/workspace-members.types.test.ts`
- Modify: all test files with redundant `import { ... } from 'vitest'`

- [ ] **Step 1: Delete the duplicate test file**

```bash
rm apps/web/test/unit/workspace/workspace-members.types.test.ts
```

- [ ] **Step 2: Remove redundant vitest imports**

Since `globals: true` is set in `vitest.config.ts`, remove explicit `import { describe, expect, it, vi, beforeEach } from 'vitest'` from all test files that have them. Search with:

```bash
grep -rl "from 'vitest'" apps/web/test/
```

Remove the import line from each matching file.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @workspace/web test`
Expected: PASS — all tests should still work via globals

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/test/
git commit -m "refactor: delete duplicate test file, remove redundant vitest imports"
```

---

### Task 20: Layer 4 verification

- [ ] **Step 1: Full verification pass**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: All PASS

---

## Chunk 4: Surgical Fixes (Layer 5)

### Task 21: Fix plans.ts feature/limit mismatch

**Files:**

- Modify: `packages/auth/src/plans.ts`

- [ ] **Step 1: Update feature strings to derive from limit constants**

In the `PLANS` array, replace hardcoded feature strings with template literals:

For the Starter plan (around line 86):

```ts
features: [
  `${STARTER_LIMITS.maxWorkspaces} workspaces`,
  `${STARTER_LIMITS.maxMembersPerWorkspace} members per workspace`,
],
```

For the Pro plan (around lines 99-100):

```ts
features: [
  `${PRO_LIMITS.maxWorkspaces} workspaces`,
  `${PRO_LIMITS.maxMembersPerWorkspace} members per workspace`,
  'Email customer support',
],
```

Note: The Free plan's features (`'1 personal workspace'`, `'1 member'`) are correct and don't need template literals since they use different wording.

Also fix the missing plural in Starter: `'10 member'` → derived string automatically produces `'5 members per workspace'`.

- [ ] **Step 2: Run typecheck + tests**

Run: `pnpm run typecheck && pnpm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/plans.ts
git commit -m "fix: derive plan feature strings from limit constants

Starter plan said '10 member' but limit was 5. Pro plan said '100 members'
but limit was 25. Feature strings now use template literals from the
limit constants to prevent future drift."
```

---

### Task 22: Fix type safety issues

**Files:**

- Modify: `apps/web/src/routes/_protected/admin/user/index.tsx`
- Modify: `apps/web/src/components/account/linked-accounts-card.tsx`
- Modify: `apps/web/src/components/account/active-sessions-list.tsx`
- Modify: `apps/web/src/admin/admin.server.ts`

- [ ] **Step 1: Fix FilterTab cast in admin/user/index.tsx**

Find the `useState` for `filter` (around line 75-80) and type it:

```ts
const [filter, setFilter] = useState<FilterTab>('all');
```

Then remove the `filter as FilterTab` cast (around line 102).

- [ ] **Step 2: Fix Provider type in linked-accounts-card.tsx**

Change the `Provider` interface `id` field from `string` to the SDK's provider union:

```ts
type SocialProvider = Parameters<typeof authClient.linkSocial>[0]['provider'];

interface Provider {
  id: SocialProvider;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}
```

Then remove the `as` cast in `handleConnect`:

```ts
async function handleConnect(providerId: SocialProvider) {
  setConnectingId(providerId);
  const { error } = await authClient.linkSocial({
    provider: providerId,
    callbackURL: '/account',
    errorCallbackURL: '/account?link_error=1',
  });
```

- [ ] **Step 3: Fix SessionItem type in active-sessions-list.tsx**

Derive `SessionItem` from the SDK return type instead of manually defining it with `unknown`. The exact approach depends on what `authClient.listSessions()` returns — inspect the type and use `Awaited<ReturnType<...>>` or similar to extract the session element type. Then remove the `as Array<SessionItem>` cast.

- [ ] **Step 4: Fix lastSignInAt non-null assertion in admin.server.ts**

Replace:

```ts
const mau = rows.filter(
  (r) => r.lastSignInAt! >= windowStart && r.lastSignInAt! < bucket.end
).length;
```

With:

```ts
const mau = rows.filter((r) => {
  const t = r.lastSignInAt;
  return !!t && t >= windowStart && t < bucket.end;
}).length;
```

- [ ] **Step 5: Run typecheck + lint + tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/_protected/admin/user/index.tsx apps/web/src/components/account/linked-accounts-card.tsx apps/web/src/components/account/active-sessions-list.tsx apps/web/src/admin/admin.server.ts
git commit -m "fix: eliminate type casts with proper typing

- Type useState<FilterTab> instead of casting
- Narrow Provider.id to SDK's social provider union
- Derive SessionItem from SDK return type
- Replace non-null assertion with truthiness guard"
```

---

### Task 23: Remove dead code

**Files:**

- Modify: `apps/web/src/components/account/change-email-dialog.tsx`
- Modify: `packages/auth/src/permissions.ts`

- [ ] **Step 1: Remove toBase64Url from change-email-dialog.tsx**

The `toBase64Url` function was moved to `apps/web/src/lib/format.ts` in Task 2. Update `change-email-dialog.tsx`:

1. Remove the inline `toBase64Url` function definition (lines 33-40)
2. Add import: `import { toBase64Url } from '@/lib/format';`

- [ ] **Step 2: Remove CUSTOM_PERMISSION_STATEMENTS from permissions.ts**

Delete the `CUSTOM_PERMISSION_STATEMENTS` export and its JSDoc comment (lines 60-68). Keep `ORGANIZATION_DEFAULT_ROLES` and `OrganizationDefaultRole` — they serve as documentation scaffolding even if not actively used.

- [ ] **Step 3: Run typecheck + lint + tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/account/change-email-dialog.tsx packages/auth/src/permissions.ts
git commit -m "refactor: remove dead code (Buffer branch, empty CUSTOM_PERMISSION_STATEMENTS)"
```

---

### Task 24: Package cleanup — auth.server.ts subscription handlers

**Files:**

- Modify: `packages/auth/src/auth.server.ts`

- [ ] **Step 1: Extract buildSubscriptionLogPayload helper**

Add a helper function near the top of the file (or just before the stripe config):

```ts
function buildSubscriptionLogPayload(subscription: {
  id: string;
  plan: string;
  referenceId: string;
  status: string;
  stripeSubscriptionId?: string;
  periodStart?: Date;
  periodEnd?: Date;
  billingInterval?: string;
  cancelAt?: Date;
  canceledAt?: Date;
  cancelAtPeriodEnd?: boolean;
  endedAt?: Date;
}) {
  return {
    subscriptionId: subscription.id,
    plan: subscription.plan,
    referenceId: subscription.referenceId,
    status: subscription.status,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    periodStart: subscription.periodStart,
    periodEnd: subscription.periodEnd,
    billingInterval: subscription.billingInterval,
    cancelAt: subscription.cancelAt,
    canceledAt: subscription.canceledAt,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    endedAt: subscription.endedAt,
  };
}
```

- [ ] **Step 2: Simplify each subscription handler**

Replace each handler's inline log payload with the helper. For example:

```ts
onSubscriptionComplete: async ({ subscription, plan }) => {
  log('info', 'subscription complete', {
    ...buildSubscriptionLogPayload(subscription),
    planName: plan.name,
  });
},
```

For `onSubscriptionCancel`, add the event-specific fields:

```ts
onSubscriptionCancel: async ({ subscription, cancellationDetails }) => {
  log('info', 'subscription canceled', {
    ...buildSubscriptionLogPayload(subscription),
    reason: cancellationDetails?.reason,
    feedback: cancellationDetails?.feedback,
  });
},
```

- [ ] **Step 3: Remove all Promise.resolve() no-ops**

Remove `await Promise.resolve()` from:

- `onSubscriptionComplete`
- `onSubscriptionCreated`
- `onSubscriptionUpdate`
- `onSubscriptionCancel`
- `onSubscriptionDeleted`
- `beforeUpdateOrganization`
- `beforeDeleteOrganization`

Remove `return Promise.resolve()` from:

- `onCustomerCreate`

For `onCustomerCreate`, simply remove the `return Promise.resolve()` line (the function is `async` so it already returns a Promise).

- [ ] **Step 4: Run typecheck + lint + tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/auth.server.ts
git commit -m "refactor: extract subscription log payload helper, remove Promise.resolve() no-ops"
```

---

### Task 25: Package cleanup — deduplicate isRecord, consolidate auth-emails, patch-auth-schema

**Files:**

- Modify: `packages/auth/src/workspace-types.ts`
- Modify: `packages/auth/src/auth-workspace.server.ts`
- Modify: `apps/web/src/workspace/workspace.server.ts`
- Modify: `packages/auth/src/auth-emails.server.ts`
- Modify: `packages/db/scripts/patch-auth-schema.ts`

- [ ] **Step 1: Deduplicate isRecord**

In `packages/auth/src/workspace-types.ts`, export `isRecord`:

```ts
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
```

In `packages/auth/src/auth-workspace.server.ts`, remove the local `isRecord` definition and import it:

```ts
import { isRecord } from './workspace-types';
```

In `apps/web/src/workspace/workspace.server.ts`, remove the local `isRecord` definition and import it:

```ts
import { isRecord } from '@workspace/auth/workspace-types';
```

(Verify the import path — `@workspace/auth` may or may not re-export from `workspace-types`. Check `packages/auth/src/index.ts` or the package.json `exports` map.)

- [ ] **Step 2: Consolidate auth-emails.server.ts**

In `createAuthEmails`, add a closure:

```ts
const getRequestContext = () => buildEmailRequestContext(getRequestHeaders?.());
```

Then replace the 3 occurrences of `const requestContext = buildEmailRequestContext(getRequestHeaders?.());` with `const requestContext = getRequestContext();`.

- [ ] **Step 3: Consolidate patch-auth-schema.ts**

Replace `findMatchingBrace` and `findMatchingBracket` with:

```ts
function findMatchingDelimiter(
  str: string,
  startPos: number,
  openChar: string,
  closeChar: string
): number {
  let depth = 0;
  for (let i = startPos; i < str.length; i += 1) {
    if (str[i] === openChar) depth += 1;
    if (str[i] === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}
```

Update call sites:

- `findMatchingBrace(...)` → `findMatchingDelimiter(..., '{', '}')`
- `findMatchingBracket(...)` → `findMatchingDelimiter(..., '[', ']')`

- [ ] **Step 4: Run typecheck + lint + tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/workspace-types.ts packages/auth/src/auth-workspace.server.ts apps/web/src/workspace/workspace.server.ts packages/auth/src/auth-emails.server.ts packages/db/scripts/patch-auth-schema.ts
git commit -m "refactor: deduplicate isRecord, consolidate email context, unify delimiter matching"
```

---

### Task 26: Email template DRY — create EmailShell

**Files:**

- Create: `packages/email/src/templates/email-shell.tsx`
- Modify: `packages/email/src/templates/email-verification-email.tsx`
- Modify: `packages/email/src/templates/reset-password-email.tsx`
- Modify: `packages/email/src/templates/change-email-approval-email.tsx`
- Modify: `packages/email/src/templates/workspace-invitation-email.tsx`

- [ ] **Step 1: Create EmailShell component**

```tsx
// packages/email/src/templates/email-shell.tsx
/**
 * Server-only: used when rendering emails; do not import from client code.
 */
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from '@react-email/components';
import { EmailSecurityNotice } from './email-security-notice';
import type { EmailRequestContext } from '../request-context';

interface EmailShellProps {
  preview: string;
  appName: string;
  children: React.ReactNode;
  /** When provided, renders the EmailSecurityNotice block. */
  requestContext?: EmailRequestContext;
}

export function EmailShell({
  preview,
  appName,
  children,
  requestContext,
}: EmailShellProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-zinc-100 p-8 px-4 font-sans">
          <Container className="mx-auto max-w-[480px] overflow-hidden rounded-[10px] bg-white shadow-sm">
            <Section className="px-6 py-8">
              {children}
              {requestContext && (
                <EmailSecurityNotice requestContext={requestContext} />
              )}
            </Section>
            <Section className="border-t border-zinc-200 p-6">
              <Text className="text-xs text-zinc-400">{appName}</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

- [ ] **Step 2: Update each email template**

For each template, replace the outer shell JSX (`Html` → `Tailwind` → `Body` → `Container` → `Section` → `EmailSecurityNotice` → footer) with `<EmailShell>`, keeping only the unique content inside.

Example for `email-verification-email.tsx`:

```tsx
import { Button, Heading, Link, Section, Text } from '@react-email/components';
import { EmailShell } from './email-shell';
import type { EmailRequestContext } from '../request-context';

export function EmailVerificationEmail({
  appName,
  verificationUrl,
  requestContext,
}: EmailVerificationEmailProps) {
  return (
    <EmailShell
      preview="Verify your email address"
      appName={appName}
      requestContext={requestContext}
    >
      <Heading as="h1" className="mb-4 text-xl font-semibold text-zinc-900">
        Verify your email address
      </Heading>
      <Text className="mb-6 text-[15px] leading-6 text-zinc-700">
        Click the button below to verify your email address and complete setup.
      </Text>
      <Section className="mb-6">
        <Button
          href={verificationUrl}
          className="inline-block rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white no-underline"
        >
          Verify email
        </Button>
      </Section>
      <Text className="mb-2 text-sm leading-5 text-zinc-500">
        Or copy and paste this link into your browser:
      </Text>
      <Link
        href={verificationUrl}
        className="mb-6 block text-sm break-all text-blue-500"
      >
        {verificationUrl}
      </Link>
      <Text className="mb-6 text-sm leading-5 text-zinc-500">
        After you click the link, you can sign in with this email address.
      </Text>
      <Text className="text-sm leading-5 text-zinc-500">
        This link expires in 10 minutes.
      </Text>
    </EmailShell>
  );
}
```

Apply the same pattern to `reset-password-email.tsx`, `change-email-approval-email.tsx`, and `workspace-invitation-email.tsx`.

For `workspace-invitation-email.tsx`: do NOT pass `requestContext` — it correctly omits the security notice.

Remove unused imports from each template (`Html`, `Head`, `Preview`, `Tailwind`, `Body`, `Container`, `pixelBasedPreset`, `EmailSecurityNotice`).

- [ ] **Step 3: Run typecheck + lint + tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/email/src/templates/
git commit -m "refactor: extract EmailShell component, reduce template duplication"
```

---

### Task 27: Layer 5 verification

- [ ] **Step 1: Full verification pass**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: All PASS

---

## Chunk 5: Query Key Standardization + Final Verification (Layer 6)

### Task 28: Rename query key values

**Files:**

- Modify: `apps/web/src/hooks/use-session-query.ts`
- Modify: `apps/web/src/hooks/use-sessions-query.ts`
- Modify: `apps/web/src/hooks/use-linked-accounts-query.ts`
- Modify: `apps/web/src/components/account/active-sessions-list.tsx`

- [ ] **Step 1: Update use-session-query.ts**

```ts
export const SESSION_QUERY_KEY = ['session', 'current'] as const;
```

- [ ] **Step 2: Update use-sessions-query.ts**

```ts
export const SESSIONS_QUERY_KEY = ['session', 'active-list'] as const;
```

- [ ] **Step 3: Update use-linked-accounts-query.ts**

```ts
export const LINKED_ACCOUNTS_QUERY_KEY = [
  'account',
  'linked-accounts',
] as const;
```

- [ ] **Step 4: Update active-sessions-list.tsx**

Find the inline `queryKey: ['last-login-method']` and change to:

```ts
queryKey: ['account', 'last-login-method'],
```

- [ ] **Step 5: Update tests that reference old query key values**

Search for `current_session`, `user_active_sessions`, `linked_accounts`, and `last-login-method` in test files and update any assertions or mock setups that depend on the old values.

- [ ] **Step 6: Run typecheck + lint + tests**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/hooks/use-session-query.ts apps/web/src/hooks/use-sessions-query.ts apps/web/src/hooks/use-linked-accounts-query.ts apps/web/src/components/account/active-sessions-list.tsx
git commit -m "refactor: standardize query keys to hierarchical domain/resource format

Rename non-hierarchical keys to ['domain', 'resource']:
- current_session → session/current
- user_active_sessions → session/active-list
- linked_accounts → account/linked-accounts
- last-login-method → account/last-login-method"
```

---

### Task 29: Final verification

- [ ] **Step 1: Full build verification**

Run: `pnpm run build`
Expected: Production build succeeds

- [ ] **Step 2: Full test suite**

Run: `pnpm run typecheck && pnpm run lint && pnpm test`
Expected: All PASS

- [ ] **Step 3: Review changes**

Run: `git log --oneline main..HEAD`
Verify all commits are present and correctly scoped.
