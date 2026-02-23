/**
 * Metadata added by the server to streamed assistant messages.
 * This type is intentionally client-safe (no backend runtime imports).
 */
export type ChatMessageMetadata = {
  readonly threadId?: string
  readonly requestId?: string
  readonly model?: string
  readonly modelSource?: 'fixed'
  readonly startedAt?: number
  readonly completedAt?: number
  readonly totalTokens?: number
}
