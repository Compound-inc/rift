import * as React from "react"

import { cn } from "@rift/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "block w-full min-w-0 rounded-md border border-border-base bg-transparent px-3 py-2 text-sm text-foreground-strong transition-colors placeholder:text-foreground-secondary focus-visible:border-foreground-tertiary focus-visible:ring-3 focus-visible:ring-foreground-tertiary/50 focus-visible:outline-none aria-invalid:border-foreground-error aria-invalid:ring-3 aria-invalid:ring-foreground-error/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 min-h-16 resize-y",
        className
      )}
      {...props}
    />
  )
})

export { Textarea }
