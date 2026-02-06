import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-button-secondary-hover text-button-secondary-text-hover hover:bg-button-secondary-hover/90",
        destructive:
          "bg-button-destructive text-secondary",
        outline:
          "bg-button-secondary-hover text-button-secondary-text-hover hover:bg-button-secondary-hover/90",
        secondary:
          "bg-button-secondary text-button-secondary-text hover:bg-button-secondary-hover hover:text-button-secondary-text-hover",
        ghost:
          "bg-transparent text-button-secondary-text hover:bg-button-secondary-hover hover:text-button-secondary-text-hover",
        link:
         "bg-button-link text-secondary",
        accent:
         "bg-button-accent text-white dark:text-white",
      },
      size: {
        default: "rounded-3xl h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "rounded-md h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "rounded-3xl h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
