import type { ChatAttachment } from './attachments'

/**
 * Metadata added by the server to streamed assistant messages.
 * This type is intentionally client-safe (no backend runtime imports).
 */
export type ChatMessageMetadata = {
  readonly status?:
    | 'thinking'
    | 'waiting'
    | 'streaming'
    | 'done'
    | 'error'
    | 'error.rejected'
    | 'cancelled'
    | 'deleted'
  readonly errorMessage?: string
  readonly threadId?: string
  readonly requestId?: string
  readonly model?: string
  readonly modelSource?: 'thread' | 'request'
  readonly startedAt?: number
  readonly completedAt?: number
  readonly finishReason?: string
  readonly totalTokens?: number
  readonly attachments?: readonly ChatAttachment[]
}
