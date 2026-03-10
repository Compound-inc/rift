import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@rift/utils"

const badgeVariants = cva(
  "h-5 gap-1 rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none focus-visible:border-border-strong focus-visible:ring-border-strong/50 focus-visible:ring-[3px] aria-invalid:ring-foreground-error/20 aria-invalid:border-foreground-error overflow-hidden group/badge",
  {
    variants: {
      variant: {
        default: "bg-accent-primary text-white [a]:hover:bg-accent-primary/80",
        secondary: "bg-surface-raised text-foreground-secondary [a]:hover:bg-surface-raised/80",
        destructive: "bg-surface-error/10 [a]:hover:bg-surface-error/20 focus-visible:ring-foreground-error/20 text-foreground-error dark:bg-surface-error/20",
        outline: "border-border-base text-foreground-primary [a]:hover:bg-surface-raised [a]:hover:text-foreground-secondary",
        ghost: "hover:bg-surface-raised hover:text-foreground-secondary dark:hover:bg-surface-raised/50",
        link: "text-accent-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
