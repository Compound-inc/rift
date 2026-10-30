import { m } from '@/paraglide/messages.js'
import type { ChatMessageMetadata } from '@/lib/shared/chat-contracts/message-metadata'

/** Failures live by the composer; only a stopped turn needs an inline label. */
export function MessageGenerationStatus({
  status,
}: {
  status?: ChatMessageMetadata['status']
}) {
  if (status !== 'cancelled') return null
  return (
    <span className="text-xs text-foreground-secondary">
      {m.chat_stopped()}
    </span>
  )
}
