// Streaming indicator shown while the model is responding.
'use client'

import { cn } from '@rift/utils'
import type { HTMLAttributes } from 'react'

export type PromptInputThinkingProps = HTMLAttributes<HTMLDivElement> & {
  /** When true, the slot expands to show the thinking state */
  isVisible?: boolean
  onCancel?: () => void
}

/**
 * Thinking status slot. Renders above the input; collapses when not visible.
 */
export function PromptInputThinking({
  className,
  isVisible = false,
  onCancel,
  ...props
}: PromptInputThinkingProps) {
  return (
    <div
      className={cn(
        'grid overflow-hidden transition-[grid-template-rows] duration-500 ease-out',
        isVisible ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className
      )}
      {...props}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border-muted/60 px-2 py-1.5 pb-2">
          <div
            className="flex items-center gap-2 text-content-muted"
            aria-live="polite"
          >
            <div
              className={cn(
                'size-2 shrink-0 rounded-full bg-ai',
                isVisible && 'animate-pulse-size'
              )}
              aria-hidden
            />
            <span className="text-sm">Thinking…</span>
          </div>
          {isVisible ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-1.5 py-1 text-sm text-content-muted outline-none transition-colors hover:bg-bg-subtle hover:text-content-default focus-visible:ring-2 focus-visible:ring-border-emphasis"
              aria-label="Cancel"
            >
              Cancel
            </button>
          ) : (
            <div className="h-7 shrink-0" aria-hidden />
          )}
        </div>
      </div>
    </div>
  )
}
