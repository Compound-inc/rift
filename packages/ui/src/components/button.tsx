"use client"

import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@rift/utils"

const buttonVariants = cva(
  "focus-visible:border-border-emphasis focus-visible:ring-border-emphasis/50 aria-invalid:ring-content-error/20 dark:aria-invalid:ring-content-error/40 aria-invalid:border-content-error dark:aria-invalid:border-content-error/50 rounded-lg border border-transparent bg-clip-padding text-sm font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none hover:bg-bg-inverted/5 active:bg-bg-inverted/10",
  {
    variants: {
      variant: {
        default:
          "bg-accent-default text-content-inverted hover:bg-accent-default hover:opacity-80",
        ghost:
          "bg-transparent text-content-default",
        danger:
        "border-red-500 bg-red-500 text-white hover:bg-red-600 hover:ring-red-100",
        dangerLight:
        "text-content-error hover:bg-content-error/10 hover:text-content-error/80",
        sidebarIcon:
          "focus-visible:ring-2 focus-visible:ring-border-emphasis/50 data-[active=true]:bg-bg-default data-[active=true]:hover:bg-bg-default data-[active=true]:active:bg-bg-default",
        sidebarNavItem:
          "flex h-8 w-full items-center justify-between rounded-lg p-2 text-sm leading-none font-normal text-content-default outline-none transition-[background-color,color,font-weight] duration-75 focus-visible:ring-2 focus-visible:ring-border-emphasis hover:bg-bg-inverted/5 active:bg-bg-inverted/10 data-[active=true]:bg-bg-info/25 data-[active=true]:font-medium data-[active=true]:text-content-info data-[active=true]:hover:bg-bg-info/45 data-[active=true]:active:bg-bg-info/75",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon:
          "aspect-square h-10 w-10 rounded-lg",
        iconSmall: 
          "aspect-square h-5 w-5",
        iconSidebar:
          "size-11 rounded-lg transition-colors duration-150 [&_svg:not([class*='size-'])]:size-5",
        sidebarNavItem:
         "min-h-8 shrink-0",
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
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  if (asChild) {
    const { children, ...rest } = props
    const child = React.Children.only(children) as React.ReactElement<{
      className?: string
      [key: string]: unknown
    }>
    const merged = {
      className: cn(
        buttonVariants({ variant, size }),
        child.props?.className,
        className
      ),
      "data-slot": "button",
      ...rest,
    }
    return React.cloneElement(child, merged)
  }

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
