import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@rift/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-border-default bg-transparent px-3 py-2 text-content-emphasis transition-colors",
        "placeholder:text-content-muted",
        "focus-visible:border-content-subtle focus-visible:ring-3 focus-visible:ring-content-subtle/50 focus-visible:outline-none",
        "aria-invalid:border-content-error aria-invalid:ring-3 aria-invalid:ring-content-error/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:h-6 file:text-sm file:font-medium file:text-content-emphasis file:inline-flex file:border-0 file:bg-transparent",
        "sm:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
