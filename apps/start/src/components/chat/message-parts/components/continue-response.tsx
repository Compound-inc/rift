import { Button } from '@rift/ui/button'
import { toast } from 'sonner'
import { useChatActions, useChatMessages } from '../../chat-context'
import { m } from '@/paraglide/messages.js'

/** Follow-ups use the original model when policy permits; empty answers must be retried. */
export function ContinueResponse({
  messageId,
  onRetry,
}: {
  messageId: string
  onRetry?: () => void
}) {
  const { sendMessage, status, selectableModels } = useChatActions()
  const { messages } = useChatMessages()
  const message = messages.at(-1)
  // A follow-up cannot silently redirect a later conversation.
  if (message?.id !== messageId) return null
  const hasText = message.parts.some(
    (part) => part.type === 'text' && part.text.trim(),
  )
  if (!hasText && !onRetry) return null
  const modelId = message.metadata?.model
  const allowedModelId = selectableModels.some(
    (model) => model.id === modelId && !model.locked,
  )
    ? modelId
    : undefined
  return (
    <Button
      variant="ghost"
      size="default"
      disabled={status === 'submitted' || status === 'streaming'}
      onClick={() => {
        if (!hasText) {
          onRetry?.()
          return
        }
        void sendMessage({
          text: m.chat_continue_instruction(),
          ...(allowedModelId ? { modelId: allowedModelId } : {}),
        }).catch((error: unknown) =>
          toast.error(
            error instanceof Error
              ? error.message
              : m.error_chat_stream_failed(),
          ),
        )
      }}
    >
      {hasText ? m.chat_continue_response() : m.chat_retry_response()}
    </Button>
  )
}
