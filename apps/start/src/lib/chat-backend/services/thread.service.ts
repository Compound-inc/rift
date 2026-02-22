import { Effect, Layer, ServiceMap } from 'effect'
import { generateText } from 'ai'
import {
  MessagePersistenceError,
  ThreadForbiddenError,
  ThreadNotFoundError,
} from '../domain/errors'
import { getMemoryState } from '../infra/memory/state'
import { getZeroDatabase, zql } from '../infra/zero/db'

/**
 * Thread lifecycle and authorization checks.
 * This implementation persists directly to Zero's upstream Postgres database.
 */
export type ThreadServiceShape = {
  readonly createThread: (input: {
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly threadId: string; readonly createdAt: number },
    MessagePersistenceError
  >
  readonly assertThreadAccess: (input: {
    readonly userId: string
    readonly threadId: string
    readonly requestId: string
    readonly createIfMissing?: boolean
  }) => Effect.Effect<
    {
      readonly dbId: string
      readonly threadId: string
      readonly userId: string
      readonly model: string
    },
    ThreadNotFoundError | ThreadForbiddenError | MessagePersistenceError
  >
  readonly autoGenerateTitle: (input: {
    readonly userId: string
    readonly threadId: string
    readonly userMessage: string
    readonly requestId: string
  }) => Effect.Effect<void, MessagePersistenceError>
}

export class ThreadService extends ServiceMap.Service<
  ThreadService,
  ThreadServiceShape
>()('chat-backend/ThreadService') {}

const DEFAULT_THREAD_MODEL = 'gpt-4o-mini'
const DEFAULT_THREAD_TITLE = 'Nuevo Chat'
const MAX_USER_MESSAGE_LENGTH = 200
const MAX_TITLE_WORDS = 8
const MAX_TITLE_LENGTH = 50

function trimUserMessage(message: string): string {
  const trimmed = message.trim()
  if (trimmed.length <= MAX_USER_MESSAGE_LENGTH) {
    return trimmed
  }
  return `${trimmed.slice(0, MAX_USER_MESSAGE_LENGTH)}...`
}

function cleanGeneratedTitle(text: string): string {
  return text
    .replace(/[#*_`"'~-]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, MAX_TITLE_WORDS)
    .join(' ')
    .slice(0, MAX_TITLE_LENGTH)
}

export const ThreadServiceZero = Layer.succeed(ThreadService, {
  createThread: ({ userId, requestId }) =>
    Effect.tryPromise({
      try: async () => {
        const db = getZeroDatabase()
        if (!db) {
          throw new Error('ZERO_UPSTREAM_DB is not configured')
        }

        const now = Date.now()
        const threadId = crypto.randomUUID()

        // Use a UUID primary key for the SQL row and a public threadId for routing.
        await db.transaction(async (tx) => {
          await tx.mutate.thread.insert({
            id: crypto.randomUUID(),
            threadId,
            title: 'Nuevo Chat',
            createdAt: now,
            updatedAt: now,
            lastMessageAt: now,
            generationStatus: 'pending',
            visibility: 'visible',
            userSetTitle: false,
            userId,
            model: DEFAULT_THREAD_MODEL,
            pinned: false,
            allowAttachments: true,
          })
        })

        return { threadId, createdAt: now }
      },
      catch: (error) =>
        new MessagePersistenceError({
          message: 'Failed to create thread',
          requestId,
          threadId: 'new-thread',
          cause: String(error),
        }),
    }),
  assertThreadAccess: ({ userId, threadId, requestId, createIfMissing }) =>
    Effect.tryPromise({
      try: async () => {
        const db = getZeroDatabase()
        if (!db) {
          throw new Error('ZERO_UPSTREAM_DB is not configured')
        }

        const now = Date.now()
        let thread = await db.run(zql.thread.where('threadId', threadId).one())
        if (!thread) {
          if (!createIfMissing) {
            throw new ThreadNotFoundError({
              message: 'Thread not found',
              requestId,
              threadId,
            })
          }

          try {
            await db.transaction(async (tx) => {
              await tx.mutate.thread.insert({
                id: threadId,
                threadId,
                title: 'Nuevo Chat',
                createdAt: now,
                updatedAt: now,
                lastMessageAt: now,
                generationStatus: 'pending',
                visibility: 'visible',
                userSetTitle: false,
                userId,
                model: DEFAULT_THREAD_MODEL,
                pinned: false,
                allowAttachments: true,
              })
            })
          } catch {
            // Another writer may have created this thread concurrently.
          }

          thread = await db.run(zql.thread.where('threadId', threadId).one())
          if (!thread) {
            throw new Error('Thread was not created')
          }
        }

        if (thread.userId !== userId) {
          throw new ThreadForbiddenError({
            message: 'Thread is not owned by user',
            requestId,
            threadId,
            userId,
          })
        }

        return {
          dbId: thread.id,
          threadId: thread.threadId,
          userId: thread.userId,
          model: thread.model,
        }
      },
      catch: (error) => {
        if (error instanceof ThreadNotFoundError || error instanceof ThreadForbiddenError) {
          return error
        }

        return new MessagePersistenceError({
          message: 'Failed to validate thread access',
          requestId,
          threadId,
          cause: String(error),
        })
      },
    }),
  autoGenerateTitle: ({ userId, threadId, userMessage, requestId }) =>
    Effect.tryPromise({
      try: async () => {
        const db = getZeroDatabase()
        if (!db) {
          throw new Error('ZERO_UPSTREAM_DB is not configured')
        }

        const trimmedMessage = trimUserMessage(userMessage)
        if (!trimmedMessage) return

        const thread = await db.run(zql.thread.where('threadId', threadId).one())
        if (!thread) return
        if (thread.userId !== userId) return
        if (thread.userSetTitle) return
        if (thread.title !== DEFAULT_THREAD_TITLE) return

        const { openai } = await import('@ai-sdk/openai')
        const generation = await generateText({
          model: openai(DEFAULT_THREAD_MODEL),
          prompt: `You are an expert title generator. You are given a message and you need to generate a short title based on it.
- you will generate a short 3-4 words title based on the first message a user begins a conversation with
- the title should creative and unique
- do not write anything other than the title
- do not use quotes or colons
- do not use any other text other than the title
- the title should be in same language as the user message
User message: ${trimmedMessage}`,
          temperature: 0.5,
          maxOutputTokens: 50,
        })

        const cleanTitle = cleanGeneratedTitle(generation.text)
        const finalTitle = cleanTitle || DEFAULT_THREAD_TITLE

        if (finalTitle === DEFAULT_THREAD_TITLE) return

        await db.transaction(async (tx) => {
          await tx.mutate.thread.update({
            id: thread.id,
            title: finalTitle,
            updatedAt: Date.now(),
          })
        })
      },
      catch: (error) =>
        new MessagePersistenceError({
          message: 'Failed to auto-generate thread title',
          requestId,
          threadId,
          cause: String(error),
        }),
    }),
})

// Test-only adapter retained for deterministic unit tests.
export const ThreadServiceMemory = Layer.succeed(ThreadService, {
  createThread: ({ userId }) =>
    Effect.sync(() => {
      const now = Date.now()
      const threadId = crypto.randomUUID()
      getMemoryState().threads.set(threadId, {
        threadId,
        userId,
        createdAt: now,
        updatedAt: now,
      })
      getMemoryState().messages.set(threadId, [])
      return { threadId, createdAt: now }
    }),
  assertThreadAccess: ({ userId, threadId, requestId, createIfMissing }) =>
    Effect.gen(function* () {
      let thread = getMemoryState().threads.get(threadId)
      if (!thread) {
        if (!createIfMissing) {
          return yield* Effect.fail(
            new ThreadNotFoundError({ message: 'Thread not found', requestId, threadId }),
          )
        }
        const now = Date.now()
        const created = {
          threadId,
          userId,
          createdAt: now,
          updatedAt: now,
        }
        getMemoryState().threads.set(threadId, created)
        getMemoryState().messages.set(threadId, [])
        thread = created
      }
      if (thread.userId !== userId) {
        return yield* Effect.fail(
          new ThreadForbiddenError({
            message: 'Thread is not owned by user',
            requestId,
            threadId,
            userId,
          }),
        )
      }
      return {
        dbId: thread.threadId,
        threadId: thread.threadId,
        userId: thread.userId,
        model: DEFAULT_THREAD_MODEL,
      }
    }),
  autoGenerateTitle: () => Effect.void,
})
