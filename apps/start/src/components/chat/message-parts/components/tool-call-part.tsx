import { cn } from '@rift/utils'
import { Loader2, Wrench } from 'lucide-react'

type ToolCallPartProps = {
  toolName: string
  state?: string
}

/**
 * Minimal reusable tool-call status row.
 * This is intentionally compact and generic so tool-specific UIs can be layered
 * later by adding more specialized renderers before this fallback renderer.
 */
export function ToolCallPart({ toolName, state }: ToolCallPartProps) {
  const isStreaming =
    state === 'input-streaming' || state === 'input-available'
  const label = state ? state.replaceAll('-', ' ') : 'called'

  return (
    <div className="mb-2 flex items-center gap-2 rounded-md border border-border-faint/60 bg-surface-base/20 px-2.5 py-1.5">
      {isStreaming ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Wrench className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className="truncate text-foreground-secondary text-xs">
        Tool <strong className="text-foreground-primary">{toolName}</strong>
      </span>
      <span
        className={cn(
          'ltr:ml-auto rtl:mr-auto rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
          isStreaming
            ? 'bg-surface-raised text-foreground-secondary'
            : 'bg-surface-raised/70 text-foreground-primary',
        )}
      >
        {label}
      </span>
    </div>
  )
}
