import { Context, Effect, Layer } from 'effect'
import { ThreadForbiddenError, ThreadNotFoundError } from '../domain/errors'
import { getMemoryState } from '../infra/memory/state'

export type ThreadServiceShape = {
  readonly createThread: (input: {
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<{ readonly threadId: string; readonly createdAt: number }>
  readonly assertThreadAccess: (input: {
    readonly userId: string
    readonly threadId: string
    readonly requestId: string
  }) => Effect.Effect<void, ThreadNotFoundError | ThreadForbiddenError>
}

export class ThreadService extends Context.Tag('chat-backend/ThreadService')<
  ThreadService,
  ThreadServiceShape
>() {}

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
  assertThreadAccess: ({ userId, threadId, requestId }) =>
    Effect.gen(function* () {
      const thread = getMemoryState().threads.get(threadId)
      if (!thread) {
        return yield* Effect.fail(
          new ThreadNotFoundError({ message: 'Thread not found', requestId, threadId }),
        )
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
      return undefined
    }),
})
