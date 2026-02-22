import type { UIMessage } from 'ai'
import { Effect, Layer, ServiceMap } from 'effect'
import { MessagePersistenceError } from '../domain/errors'
import type { IncomingUserMessage } from '../domain/schemas'
import { getUserMessageText } from '../domain/schemas'
import { getMemoryState } from '../infra/memory/state'
import { getZeroDatabase, zql } from '../infra/zero/db'

// Message persistence adapter backed by Zero + upstream Postgres.
export type MessageStoreServiceShape = {
  readonly loadThreadMessages: (input: {
    readonly threadId: string
    readonly requestId: string
  }) => Effect.Effect<UIMessage[], MessagePersistenceError>
  readonly appendUserMessage: (input: {
    readonly threadDbId: string
    readonly threadId: string
    readonly message: IncomingUserMessage
    readonly userId: string
    readonly model: string
    readonly requestId: string
  }) => Effect.Effect<UIMessage, MessagePersistenceError>
  readonly startAssistantMessage: (input: {
    readonly threadDbId: string
    readonly threadId: string
    readonly userId: string
    readonly assistantMessageId: string
    readonly model: string
    readonly requestId: string
  }) => Effect.Effect<void, MessagePersistenceError>
  readonly finalizeAssistantMessage: (input: {
    readonly threadDbId: string
    readonly threadModel: string
    readonly threadId: string
    readonly userId: string
    readonly assistantMessageId: string
    readonly ok: boolean
    readonly finalContent: string
    readonly errorMessage?: string
    readonly requestId: string
  }) => Effect.Effect<void, MessagePersistenceError>
}

export class MessageStoreService extends ServiceMap.Service<
  MessageStoreService,
  MessageStoreServiceShape
>()('chat-backend/MessageStoreService') {}

const toUserMessage = (message: IncomingUserMessage): UIMessage => ({
  id: message.id,
  role: 'user',
  parts: [{ type: 'text', text: getUserMessageText(message) }],
})

export const MessageStoreZero = Layer.succeed(MessageStoreService, {
  loadThreadMessages: ({ threadId, requestId }) =>
    Effect.tryPromise({
      try: async () => {
        const db = getZeroDatabase()
        if (!db) {
          throw new Error('ZERO_UPSTREAM_DB is not configured')
        }

        const messages = await db.run(
          zql.message.where('threadId', threadId).orderBy('created_at', 'asc'),
        )

        return messages.map((message) => ({
          id: message.messageId,
          role: message.role,
          parts: [{ type: 'text', text: message.content }],
          metadata:
            message.role === 'assistant'
              ? {
                  model: message.model,
                }
              : undefined,
        }))
      },
      catch: (error) =>
        new MessagePersistenceError({
          message: 'Failed to load messages',
          requestId,
          threadId,
          cause: String(error),
        }),
    }),
  appendUserMessage: ({ threadDbId, threadId, message, userId, model, requestId }) =>
    Effect.tryPromise({
      try: async () => {
        const db = getZeroDatabase()
        if (!db) {
          throw new Error('ZERO_UPSTREAM_DB is not configured')
        }

        const now = Date.now()
        await db.transaction(async (tx) => {
          try {
            await tx.mutate.message.insert({
              // Deterministic key makes retries naturally idempotent.
              id: message.id,
              messageId: message.id,
              threadId,
              userId,
              content: getUserMessageText(message),
              status: 'done',
              role: 'user',
              created_at: now,
              updated_at: now,
              model,
              attachmentsIds: [],
            })
          } catch {
            // Duplicate insert on retry; row already exists.
            return
          }

          await tx.mutate.thread.update({
            id: threadDbId,
            updatedAt: now,
            lastMessageAt: now,
          })
        })

        return toUserMessage(message)
      },
      catch: (error) =>
        new MessagePersistenceError({
          message: 'Failed to append user message',
          requestId,
          threadId,
          cause: String(error),
        }),
    }),
  startAssistantMessage: ({ threadDbId, threadId, userId, assistantMessageId, model, requestId }) =>
    Effect.tryPromise({
      try: async () => {
        const db = getZeroDatabase()
        if (!db) {
          throw new Error('ZERO_UPSTREAM_DB is not configured')
        }

        const now = Date.now()
        await db.transaction(async (tx) => {
          try {
          await tx.mutate.message.insert({
            // Deterministic key makes retries naturally idempotent.
            id: assistantMessageId,
            messageId: assistantMessageId,
            threadId,
            userId,
            content: '',
            status: 'streaming',
            role: 'assistant',
            created_at: now,
            updated_at: now,
            model,
            attachmentsIds: [],
          })
          } catch {
            // Duplicate insert on retry; row already exists.
            return
          }

          await tx.mutate.thread.update({
            id: threadDbId,
            generationStatus: 'generation',
            updatedAt: now,
            lastMessageAt: now,
            model,
          })
        })
      },
      catch: (error) =>
        new MessagePersistenceError({
          message: 'Failed to start assistant message',
          requestId,
          threadId,
          cause: String(error),
        }),
    }),
  finalizeAssistantMessage: ({
    threadDbId,
    threadModel,
    threadId,
    userId,
    assistantMessageId,
    ok,
    finalContent,
    errorMessage,
    requestId,
  }) =>
    Effect.tryPromise({
      try: async () => {
        const db = getZeroDatabase()
        if (!db) {
          throw new Error('ZERO_UPSTREAM_DB is not configured')
        }

        const now = Date.now()
        await db.transaction(async (tx) => {
          const existing = await tx.run(
            zql.message
              .where('id', assistantMessageId)
              .where('userId', userId)
              .one(),
          )

          if (existing) {
            const update: {
              id: string
              content: string
              status: 'done' | 'error'
              updated_at: number
              serverError?: { type: string; message: string }
            } = {
              id: existing.id,
              content: finalContent,
              status: ok ? 'done' : 'error',
              updated_at: now,
            }

            if (!ok) {
              update.serverError = {
                type: 'stream_error',
                message: errorMessage ?? 'Assistant stream failed',
              }
            }

            await tx.mutate.message.update(update)
          } else {
            const insert: {
              id: string
              messageId: string
              threadId: string
              userId: string
              content: string
              status: 'done' | 'error'
              role: 'assistant'
              created_at: number
              updated_at: number
              model: string
              attachmentsIds: readonly string[]
              serverError?: { type: string; message: string }
            } = {
              id: assistantMessageId,
              messageId: assistantMessageId,
              threadId,
              userId,
              content: finalContent,
              status: ok ? 'done' : 'error',
              role: 'assistant',
              created_at: now,
              updated_at: now,
              model: threadModel,
              attachmentsIds: [],
            }
            if (!ok) {
              insert.serverError = {
                type: 'stream_error',
                message: errorMessage ?? 'Assistant stream failed',
              }
            }
            await tx.mutate.message.insert(insert)
          }

          await tx.mutate.thread.update({
            id: threadDbId,
            generationStatus: ok ? 'completed' : 'failed',
            updatedAt: now,
            lastMessageAt: now,
          })
        })
      },
      catch: (error) =>
        new MessagePersistenceError({
          message: 'Failed to finalize assistant message',
          requestId,
          threadId,
          cause: String(error),
        }),
    }),
})

// Test-only adapter retained for deterministic unit tests.
export const MessageStoreMemory = Layer.succeed(MessageStoreService, {
  loadThreadMessages: ({ threadId, requestId }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw new Error('missing thread message store')
      }
      return existing.slice()
    }).pipe(
      Effect.catch((error) =>
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
        throw new Error('missing thread message store')
      }
      const uiMessage = toUserMessage(message)
      existing.push(uiMessage)
      return uiMessage
    }).pipe(
      Effect.catch((error) =>
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
  startAssistantMessage: ({ threadId, assistantMessageId, requestId }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw new Error('missing thread message store')
      }
      const hasAssistant = existing.some((message) => message.id === assistantMessageId)
      if (!hasAssistant) {
        existing.push({
          id: assistantMessageId,
          role: 'assistant',
          parts: [{ type: 'text', text: '' }],
        })
      }
    }).pipe(
      Effect.catch((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to start assistant message',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),
  finalizeAssistantMessage: ({
    threadId,
    assistantMessageId,
    finalContent,
    requestId,
  }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw new Error('missing thread message store')
      }
      const target = existing.find((message) => message.id === assistantMessageId)
      if (!target) {
        existing.push({
          id: assistantMessageId,
          role: 'assistant',
          parts: [{ type: 'text', text: finalContent }],
        })
        return
      }
      target.parts = [{ type: 'text', text: finalContent }]
    }).pipe(
      Effect.catch((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to finalize assistant message',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),
})
