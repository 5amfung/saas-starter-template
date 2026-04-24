// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { SortingState } from '@tanstack/react-table';
import { useColumnSort } from '@/hooks';

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
