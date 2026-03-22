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

// Static class maps keyed by breakpoint to avoid dynamic Tailwind class interpolation,
// which would cause classes to be pruned in production builds.
const BREAKPOINT_CLASSES = {
  md: {
    hiddenUntilBp: 'hidden md:flex',
    countContainer: '',
    outerContainer: '',
    navContainer: '',
  },
  lg: {
    hiddenUntilBp: 'hidden lg:flex',
    countContainer: 'hidden flex-1 lg:flex',
    outerContainer: 'w-full lg:w-fit',
    navContainer: 'ml-auto lg:ml-0',
  },
} as const;

interface TablePaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: ReadonlyArray<string>;
  isLoading: boolean;
  totalCount: number;
  countLabel: string;
  selectId: string;
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
  const classes = BREAKPOINT_CLASSES[responsiveBreakpoint];

  return (
    <div className="flex items-center justify-between gap-4 px-1">
      <div
        className={`text-sm text-muted-foreground ${classes.countContainer}`}
      >
        {isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          `${totalCount} ${countLabel}${totalCount === 1 ? '' : 's'}`
        )}
      </div>
      <div className={`flex items-center gap-6 ${classes.outerContainer}`}>
        <div className={`${classes.hiddenUntilBp} items-center gap-2`}>
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
        <div className={`flex items-center gap-2 ${classes.navContainer}`}>
          <Button
            variant="outline"
            size="icon"
            className={classes.hiddenUntilBp}
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
            className={classes.hiddenUntilBp}
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
