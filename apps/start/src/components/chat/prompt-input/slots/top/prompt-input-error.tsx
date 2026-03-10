// Error banner for prompt input, with optional trace ID display.
'use client'

import { useRef, useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, X } from 'lucide-react'
import { cn, copyToClipboard } from '@rift/utils'
import type { HTMLAttributes } from 'react'
import { Button } from '@rift/ui/button'
import { m } from '@/paraglide/messages.js'

export type PromptInputErrorProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  error?: string | null
  onDismiss?: () => void
  message?: string | null
  children?: React.ReactNode
  /** Trace ID for debugging */
  traceId?: string | null
}

export function PromptInputError({
  className,
  error: errorProp,
  message,
  onDismiss,
  children,
  traceId,
  ...props
}: PromptInputErrorProps) {
  const error = errorProp ?? message
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (!error && !children) return null

  return (
    <div
      ref={containerRef}
      className={cn(
        '-mt-1.5 -mx-1.5 rounded-t-2xl',
        'bg-surface-error text-foreground-error mb-3',
        className
      )}
      role="alert"
      {...props}
    >
      <div
        className="flex gap-2 px-3 py-2.5 min-h-[2.5rem] text-sm"
        style={{ alignItems: 'center' }}
      >
        <AlertTriangle className="size-5 shrink-0 text-foreground-error" aria-hidden />
        <div className="flex-1 min-w-0 max-h-[200px] overflow-y-auto leading-snug flex items-center gap-1 flex-wrap">
          {error ?? children}
          {traceId && (
            <span className="inline-flex items-center shrink-0">
              <Button
                variant="dangerLight"
                size="icon"
                onClick={() => setOpen((o) => !o)}
                title={m.chat_prompt_error_show_trace_id_title()}
              >
                <ChevronDown className={cn('size-4', open && 'rotate-180')} aria-hidden />
              </Button>
            </span>
          )}
        </div>
        {onDismiss && (
          <Button
            variant="dangerLight"
            size="icon"
            onClick={onDismiss}
            title={m.chat_prompt_error_dismiss_title()}
          >
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      {open && traceId && (
        <div className="px-3 pb-3 pt-1 border-t border-foreground-error/20">
          <div className="text-sm font-medium opacity-90 mb-0.5">{m.chat_prompt_error_trace_id_label()}</div>
          <button
            type="button"
            onClick={() => traceId && copyToClipboard(traceId)}
            className="text-sm break-all text-start hover:underline cursor-pointer"
          >
            {traceId}
          </button>
        </div>
      )}
    </div>
  )
}
