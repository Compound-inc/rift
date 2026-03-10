"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@rift/utils"

const labelVariants = cva(
  "gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default: "text-foreground-primary",
        muted: "text-black/70 dark:text-white/70",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export type LabelProps = React.ComponentProps<"label"> &
  VariantProps<typeof labelVariants>

function Label({ className, variant = "default", ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      data-variant={variant}
      className={cn(labelVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Label, labelVariants }
