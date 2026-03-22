import React from 'react';
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
