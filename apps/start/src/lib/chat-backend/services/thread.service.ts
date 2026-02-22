import { Effect, Layer, ServiceMap } from 'effect'
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
}

export class ThreadService extends ServiceMap.Service<
  ThreadService,
  ThreadServiceShape
>()('chat-backend/ThreadService') {}

const DEFAULT_THREAD_MODEL = 'gpt-4o-mini'

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
})
