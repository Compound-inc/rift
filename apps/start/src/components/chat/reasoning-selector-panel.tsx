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

/** Readable labels for reasoning effort levels. */
const REASONING_EFFORT_LABELS: Record<AiReasoningEffort, string> = {
  none: 'None',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
}

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
 * Matches the model selector panel styling (trigger button, popover, row states)
 * but simplified for the smaller option set—no search or sidebar filters.
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

  const handleSelect = React.useCallback(
    (effort: AiReasoningEffort | undefined) => {
      onValueChange(effort)
      setOpen(false)
    },
    [onValueChange],
  )

  const triggerLabel =
    value != null
      ? REASONING_EFFORT_LABELS[value] ?? value
      : defaultReasoningEffort != null
        ? REASONING_EFFORT_LABELS[defaultReasoningEffort] ?? defaultReasoningEffort
        : options[0] != null
          ? REASONING_EFFORT_LABELS[options[0]] ?? options[0]
          : 'Reasoning'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        tabIndex={-1}
        disabled={disabled}
        aria-label="Select reasoning effort"
        className={cn(
          'h-10 rounded-lg border border-transparent bg-transparent px-3 pr-8 text-sm font-medium text-content-default outline-none focus:!outline-none focus-visible:!outline-none transition-colors hover:bg-bg-inverted/5 active:bg-bg-inverted/10 focus-visible:border-border-emphasis focus-visible:ring-[3px] focus-visible:ring-border-emphasis/50 disabled:pointer-events-none disabled:opacity-50',
          'relative flex items-center gap-2 w-fit group',
          'outline-none rounded-lg [&:focus]:!outline-none [&:focus-visible]:!outline-none',
          className
        )}
      >
        <Brain
          className={cn(
            'size-4 shrink-0 text-content-default transition-[filter]',
            'grayscale group-hover:grayscale-0',
            value ? 'grayscale-0' : ''
          )}
          aria-hidden
        />
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-content-muted shrink-0"
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
          'bg-bg-default text-content-default rounded-lg',
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
              label={REASONING_EFFORT_LABELS[effort] ?? effort}
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
        'w-full rounded-lg border border-transparent px-2.5 py-2 text-left text-sm leading-none font-normal transition-[background-color,color,font-weight] duration-0 active:duration-75',
        'hover:bg-bg-inverted/5 active:bg-bg-inverted/10',
        'data-[active=true]:bg-bg-info/25 data-[active=true]:font-medium data-[active=true]:text-content-info',
        'data-[active=true]:hover:bg-bg-info/45 data-[active=true]:active:bg-bg-info/75',
        'outline-none focus:!outline-none focus-visible:!outline-none',
        'focus-visible:border-border-emphasis focus-visible:ring-[3px] focus-visible:ring-border-emphasis/50'
      )}
    >
      {label}
    </button>
  )
})
