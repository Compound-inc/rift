import { Button } from '@rift/ui/button'
import { m } from '@/paraglide/messages.js'
import type { ChatMessageMetadata } from '@/lib/shared/chat-contracts/message-metadata'

/** Terminal state comes from Zero, so every device shows the same outcome. */
export function MessageGenerationStatus({
  messageId,
  status,
  errorMessage,
  canRetry,
  onRetry,
}: {
  messageId: string
  status?: ChatMessageMetadata['status']
  errorMessage?: string
  canRetry: boolean
  onRetry: (messageId: string) => void
}) {
  if (status === 'cancelled')
    return (
      <span className="text-xs text-foreground-secondary">
        {m.chat_stopped()}
      </span>
    )
  if (status !== 'error') return null
  return (
    <div
      role="alert"
      className="flex items-center gap-2 text-sm text-foreground-error"
    >
      <span>{errorMessage ?? m.error_chat_unknown()}</span>
      <Button
        type="button"
        variant="ghost"
        disabled={!canRetry}
        onClick={() => onRetry(messageId)}
      >
        {m.chat_retry()}
      </Button>
    </div>
  )
}
