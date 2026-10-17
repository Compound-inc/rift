import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Button } from '@rift/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@rift/ui/tooltip'
import { cn } from '@rift/utils'

/**
 * Word-style toolbar for the document panel: one contained strip with grouped
 * controls separated by hairlines.
 *
 * Follows the ARIA toolbar pattern: the toolbar is a single Tab stop, and
 * Arrow Left/Right, Home and End move focus between enabled buttons (roving
 * tabindex). Disabled buttons are skipped.
 */
export function DocumentToolbar({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  const items = () =>
    [...(ref.current?.querySelectorAll<HTMLButtonElement>('[data-toolbar-item]') ?? [])].filter(
      (item) => !item.disabled,
    )

  const focusItem = (target: HTMLButtonElement | undefined) => {
    if (!target) return
    for (const item of items()) item.tabIndex = item === target ? 0 : -1
    target.focus()
  }

  // Keep exactly one enabled item tabbable as buttons enable/disable.
  useEffect(() => {
    const enabled = items()
    if (!enabled.length) return
    if (!enabled.some((item) => item.tabIndex === 0)) {
      enabled.forEach((item, index) => (item.tabIndex = index === 0 ? 0 : -1))
    }
  })

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items()
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const next = rtl ? 'ArrowLeft' : 'ArrowRight'
    const previous = rtl ? 'ArrowRight' : 'ArrowLeft'
    const target =
      event.key === next
        ? enabled[(index + 1) % enabled.length]
        : event.key === previous
          ? enabled[(index - 1 + enabled.length) % enabled.length]
          : event.key === 'Home'
            ? enabled[0]
            : event.key === 'End'
              ? enabled[enabled.length - 1]
              : undefined
    if (!target) return
    event.preventDefault()
    focusItem(target)
  }

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        const target = event.target as HTMLElement
        if (target.matches('[data-toolbar-item]'))
          for (const item of items()) item.tabIndex = item === target ? 0 : -1
      }}
      className="flex items-center gap-0.5 rounded-xl bg-surface-inverse/[0.04] p-1"
    >
      {children}
    </div>
  )
}

export function DocumentToolbarDivider() {
  return (
    <span
      aria-hidden
      className="mx-1 h-5 w-px shrink-0 bg-foreground-tertiary/20"
    />
  )
}

/**
 * Toolbar button with a tooltip. Icon-only by default; pass `showLabel` for
 * the primary action so it reads like a labeled ribbon button.
 */
export function DocumentToolbarButton({
  label,
  icon,
  onClick,
  disabled,
  showLabel = false,
}: {
  readonly label: string
  readonly icon: ReactNode
  readonly onClick: () => void
  readonly disabled?: boolean
  readonly showLabel?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            data-toolbar-item=""
            aria-label={showLabel ? undefined : label}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              'h-8 shrink-0 rounded-lg text-foreground-tertiary hover:bg-surface-base hover:text-foreground-primary hover:shadow-[0_1px_2px_rgb(0_0_0/0.06)] active:bg-surface-base',
              showLabel ? 'gap-1.5 px-2.5 text-xs font-medium' : 'w-8 px-0',
            )}
          >
            {icon}
            {showLabel ? <span>{label}</span> : null}
          </Button>
        }
      />
      {showLabel ? null : (
        <TooltipContent side="bottom" sideOffset={6}>
          {label}
        </TooltipContent>
      )}
    </Tooltip>
  )
}
