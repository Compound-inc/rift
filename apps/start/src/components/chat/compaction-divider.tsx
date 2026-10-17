import type { ThreadCompaction } from '@/lib/shared/chat-contracts/compaction'
import { m } from '@/paraglide/messages.js'

/** Native details provides keyboard access without another overlay or state. */
export function CompactionDivider({
  checkpoint,
}: {
  checkpoint: ThreadCompaction
}) {
  return (
    <details className="mx-auto my-4 w-full max-w-2xl border-y border-base py-1 text-xs text-foreground-tertiary">
      <summary className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3 hover:bg-surface-overlay focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-strong">
        <span>
          {checkpoint.kind === 'sliding-window'
            ? m.chat_compaction_omitted()
            : m.chat_compaction_divider()}
        </span>
        <span className="underline underline-offset-2">
          {m.chat_compaction_view()}
        </span>
      </summary>
      {checkpoint.kind === 'sliding-window' && (
        <p className="px-3 py-2 text-xs">{m.chat_compaction_fallback()}</p>
      )}
      <p className="max-h-72 overflow-y-auto whitespace-pre-wrap px-3 py-3 text-sm leading-relaxed text-foreground-primary">
        {checkpoint.summary}
      </p>
    </details>
  )
}
