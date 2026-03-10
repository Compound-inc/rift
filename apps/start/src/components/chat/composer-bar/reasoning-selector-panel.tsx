'use client'

import * as React from 'react'
import { ChevronDown, Brain } from 'lucide-react'
import { cn } from '@rift/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@rift/ui/popover'
import type { AiReasoningEffort } from '@/lib/ai-catalog/types'
import { m } from '@/paraglide/messages.js'

/** Readable labels for reasoning effort levels. */
export type ReasoningSelectorPanelProps = {
  value: AiReasoningEffort | undefined
  onValueChange: (effort: AiReasoningEffort | undefined) => void
  options: readonly AiReasoningEffort[]
  /** Used to display the trigger label when value is undefined (model default). */
  defaultReasoningEffort?: AiReasoningEffort
  disabled?: boolean
  className?: string
}

/**
 * Reasoning/effort selector that opens a popover with a list of effort levels.
 */
export function ReasoningSelectorPanel({
  value,
  onValueChange,
  options,
  defaultReasoningEffort,
  disabled = false,
  className,
}: ReasoningSelectorPanelProps) {
  const [open, setOpen] = React.useState(false)
  const reasoningEffortLabels: Record<AiReasoningEffort, string> = {
    none: m.chat_reasoning_effort_none(),
    minimal: m.chat_reasoning_effort_minimal(),
    low: m.chat_reasoning_effort_low(),
    medium: m.chat_reasoning_effort_medium(),
    high: m.chat_reasoning_effort_high(),
    xhigh: m.chat_reasoning_effort_xhigh(),
    max: m.chat_reasoning_effort_max(),
  }

  const handleSelect = React.useCallback(
    (effort: AiReasoningEffort | undefined) => {
      onValueChange(effort)
      setOpen(false)
    },
    [onValueChange],
  )

  const triggerLabel =
    value != null
      ? reasoningEffortLabels[value] ?? value
      : defaultReasoningEffort != null
        ? reasoningEffortLabels[defaultReasoningEffort] ?? defaultReasoningEffort
        : options[0] != null
          ? reasoningEffortLabels[options[0]] ?? options[0]
          : m.chat_reasoning_label()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        tabIndex={-1}
        disabled={disabled}
        aria-label={m.chat_reasoning_select_aria_label()}
        className={cn(
          'h-10 rounded-lg border border-transparent bg-transparent px-3 ltr:pr-8 rtl:pl-8 text-sm font-medium text-foreground-primary outline-none focus:!outline-none focus-visible:!outline-none transition-colors hover:bg-surface-inverse/5 active:bg-surface-inverse/10 focus-visible:border-border-strong focus-visible:ring-[3px] focus-visible:ring-border-strong/50 disabled:pointer-events-none disabled:opacity-50',
          'relative flex items-center gap-2 w-fit group',
          'outline-none rounded-lg [&:focus]:!outline-none [&:focus-visible]:!outline-none',
          className
        )}
      >
        <Brain
          className={cn(
            'size-4 shrink-0 text-foreground-primary transition-[filter]',
            'grayscale group-hover:grayscale-0',
            value ? 'grayscale-0' : ''
          )}
          aria-hidden
        />
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          className="pointer-events-none absolute ltr:right-2 rtl:left-2 top-1/2 size-4 -translate-y-1/2 text-foreground-secondary shrink-0"
          aria-hidden
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        tabIndex={-1}
        className={cn(
          'flex w-fit min-w-[120px] max-w-[min(88vw,180px)] flex-col p-0 overflow-hidden',
          'bg-surface-base text-foreground-primary rounded-lg',
          'outline-none focus:!outline-none focus-visible:!outline-none',
          'animate-none data-open:animate-none data-closed:animate-none'
        )}
      >
        <div
          className="flex flex-col gap-1 outline-none px-1.5 py-1.5"
          onMouseDown={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          {options.map((effort) => (
            <ReasoningRow
              key={effort}
              label={reasoningEffortLabels[effort] ?? effort}
              isSelected={
                value === effort ||
                (value == null && defaultReasoningEffort === effort)
              }
              onSelect={() => handleSelect(effort)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface ReasoningRowProps {
  label: string
  isSelected: boolean
  onSelect: () => void
}

const ReasoningRow = React.memo(function ReasoningRow({
  label,
  isSelected,
  onSelect,
}: ReasoningRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={isSelected}
      className={cn(
        'w-full rounded-lg border border-transparent px-2.5 py-2 text-start text-sm leading-none font-normal transition-[background-color,color,font-weight] duration-0 active:duration-75',
        'hover:bg-surface-inverse/5 active:bg-surface-inverse/10',
        'data-[active=true]:bg-surface-info/25 data-[active=true]:font-medium data-[active=true]:text-foreground-info',
        'data-[active=true]:hover:bg-surface-info/45 data-[active=true]:active:bg-surface-info/75',
        'outline-none focus:!outline-none focus-visible:!outline-none',
        'focus-visible:border-border-strong focus-visible:ring-[3px] focus-visible:ring-border-strong/50'
      )}
    >
      {label}
    </button>
  )
})
