"use client"
import { cn } from "@workspace/ui/lib/utils"

export function FormError({
  className,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<string>
}) {
  if (!errors?.length) {
    return null
  }

  return (
    <div
      role="alert"
      className={cn("text-sm font-normal text-destructive", className)}
      {...props}
    >
      {errors.join(", ")}
    </div>
  )
}
