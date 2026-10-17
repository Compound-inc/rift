import type { ThreadCompaction } from '@/lib/shared/chat-contracts/compaction'
import { m } from '@/paraglide/messages.js'

/**
 * Quiet marker at the point where older turns were compacted. The summary
 * itself is model context, not something users need to read, so only the
 * fact that earlier messages were condensed is shown. The messages above the
 * marker stay visible in the thread.
 */
export function CompactionDivider({
  checkpoint,
}: {
  checkpoint: ThreadCompaction
}) {
  return (
    <div className="mx-auto my-6 flex w-full max-w-2xl items-center gap-3 px-1 text-xs text-foreground-tertiary">
      <span aria-hidden className="h-px flex-1 bg-border-base" />
      <p className="shrink-0">
        {checkpoint.kind === 'sliding-window'
          ? m.chat_compaction_omitted()
          : m.chat_compaction_divider()}
      </p>
      <span aria-hidden className="h-px flex-1 bg-border-base" />
    </div>
  )
}
