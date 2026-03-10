"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { motion } from "motion/react"
import type { ReactElement, ReactNode } from "react"

import { cn } from "@rift/utils"

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  tabIndex = -1,
  className,
  ...props
}: TooltipPrimitive.Trigger.Props) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      tabIndex={tabIndex}
      className={cn(
        "outline-none focus:!outline-none focus-visible:!outline-none",
        className
      )}
      {...props}
    />
  )
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  hideArrow = false,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & { hideArrow?: boolean }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50 pointer-events-none"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 rounded-md px-3 py-1.5 text-xs data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 bg-black text-white z-50 w-fit max-w-xs origin-(--transform-origin) pointer-events-none",
            className
          )}
          {...props}
        >
          {children}
          {!hideArrow && (
            <TooltipPrimitive.Arrow
              className={cn(
                "size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]",
                "data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2",
                "data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2",
                "rtl:data-[side=inline-end]:-right-1 rtl:data-[side=inline-end]:left-auto",
                "rtl:data-[side=inline-start]:-left-1 rtl:data-[side=inline-start]:right-auto",
                "z-50 data-[side=bottom]:top-1 bg-black fill-black stroke-black",
                "data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2",
                "data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2",
                "data-[side=top]:-bottom-2.5 pointer-events-none"
              )}
            />
          )}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

// Sidebar group variant: name + optional description (animated) + optional "Learn more" link
function SidebarGroupTooltipContent({
  name,
  description,
  learnMoreHref,
}: {
  name: string
  description?: string
  learnMoreHref?: string
}) {
  return (
    <div>
      <span className="font-medium text-md">{name}</span>
      {description ? (
        <motion.div
          initial={{ opacity: 0, width: 0, height: 0 }}
          animate={{ opacity: 1, width: "auto", height: "auto" }}
          transition={{ delay: 0.5, duration: 0.25, type: "spring" }}
          className="overflow-hidden"
        >
          <div className="w-44 py-1 text-xs tracking-tight">
            <p className="text-foreground-secondary">{description}</p>
            {learnMoreHref ? (
              <div className="mt-2.5">
                <a
                  href={learnMoreHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white underline"
                >
                  Learn more
                </a>
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </div>
  )
}

export type SidebarGroupTooltipProps = {
  name: string
  description?: string
  learnMoreHref?: string
  disabled?: boolean
  children: ReactElement
}

function SidebarGroupTooltip({
  name,
  description,
  learnMoreHref,
  disabled = false,
  children,
}: SidebarGroupTooltipProps) {
  const content: ReactNode = (
    <SidebarGroupTooltipContent
      name={name}
      description={description}
      learnMoreHref={learnMoreHref}
    />
  )

  if (disabled) {
    return <>{children}</>
  }

  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        side="inline-end"
        sideOffset={8}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, SidebarGroupTooltip }
