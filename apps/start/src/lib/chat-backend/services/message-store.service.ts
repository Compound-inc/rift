import type { UIMessage } from 'ai'
import { Context, Effect, Layer } from 'effect'
import { MessagePersistenceError } from '../domain/errors'
import type { IncomingUserMessage } from '../domain/schemas'
import { getUserMessageText } from '../domain/schemas'
import { getMemoryState } from '../infra/memory/state'

export type MessageStoreServiceShape = {
  readonly loadThreadMessages: (input: {
    readonly threadId: string
    readonly requestId: string
  }) => Effect.Effect<UIMessage[], MessagePersistenceError>
  readonly appendUserMessage: (input: {
    readonly threadId: string
    readonly message: IncomingUserMessage
    readonly requestId: string
  }) => Effect.Effect<UIMessage, MessagePersistenceError>
  readonly appendAssistantMessage: (input: {
    readonly threadId: string
    readonly messages: UIMessage[]
    readonly requestId: string
  }) => Effect.Effect<void, MessagePersistenceError>
}

export class MessageStoreService extends Context.Tag(
  'chat-backend/MessageStoreService',
)<MessageStoreService, MessageStoreServiceShape>() {}

const missingThreadError = (threadId: string, requestId: string) =>
  new MessagePersistenceError({
    message: 'Thread message store not found',
    requestId,
    threadId,
  })

export const MessageStoreMemory = Layer.succeed(MessageStoreService, {
  loadThreadMessages: ({ threadId, requestId }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw missingThreadError(threadId, requestId)
      }
      return existing.slice()
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to load messages',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),

  appendUserMessage: ({ threadId, message, requestId }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw missingThreadError(threadId, requestId)
      }

      const uiMessage: UIMessage = {
        id: message.id,
        role: 'user',
        parts: [{ type: 'text', text: getUserMessageText(message) }],
      }

      existing.push(uiMessage)
      return uiMessage
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to append user message',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),

  appendAssistantMessage: ({ threadId, messages, requestId }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw missingThreadError(threadId, requestId)
      }

      const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
      if (lastAssistant) {
        existing.push(lastAssistant)
      }
    }).pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to append assistant message',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),
})
