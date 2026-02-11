'use client';
import { cn } from '@/lib/utils';

export function FormError({
  className,
  errors,
  ...props
}: React.ComponentProps<'div'> & {
  errors?: Array<string>;
}) {
  if (!errors?.length) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn('text-destructive text-sm font-normal', className)}
      {...props}
    >
      {errors.join(', ')}
    </div>
  );
}
