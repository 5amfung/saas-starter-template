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
