import { Effect } from 'effect'
import { MessagePersistenceError } from '@/lib/chat-backend/domain/errors'
import type { ZeroDatabaseService } from '@/lib/server-effect/services/zero-database.service'

/**
 * Resolves the Zero/Postgres adapter and maps infrastructure configuration
 * failures into the chat-domain persistence error with request context.
 */
export const requireMessagePersistenceDb = (input: {
  readonly zeroDatabase: ZeroDatabaseService['Service']
  readonly message: string
  readonly requestId: string
  readonly threadId: string
}) =>
  input.zeroDatabase.getOrFail.pipe(
    Effect.mapError(
      (error) =>
        new MessagePersistenceError({
          message: input.message,
          requestId: input.requestId,
          threadId: input.threadId,
          cause: error.message,
        }),
    ),
  )
