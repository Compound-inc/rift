import { Schema } from 'effect'
import type { ChatMessageMetadata } from '@/lib/chat-contracts/message-metadata'

// Validation for inbound chat payloads and shared types used by the orchestrator.
const IncomingMessagePart = Schema.Struct({
  type: Schema.String,
  text: Schema.optional(Schema.String),
})

export const IncomingUserMessage = Schema.Struct({
  id: Schema.String,
  role: Schema.Literal('user'),
  parts: Schema.Array(IncomingMessagePart),
})

export type IncomingUserMessage = Schema.Schema.Type<typeof IncomingUserMessage>

export const ChatStreamRequest = Schema.Struct({
  threadId: Schema.String,
  message: IncomingUserMessage,
})

export type ChatStreamRequest = Schema.Schema.Type<typeof ChatStreamRequest>

export const ChatThreadCreateResponse = Schema.Struct({
  threadId: Schema.String,
})

export type ChatThreadCreateResponse = Schema.Schema.Type<
  typeof ChatThreadCreateResponse
>

export function getUserMessageText(message: IncomingUserMessage): string {
  return message.parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n\n')
    .trim()
}

export type { ChatMessageMetadata }
