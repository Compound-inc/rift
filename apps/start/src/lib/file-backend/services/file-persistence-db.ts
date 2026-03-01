import { Effect } from 'effect'
import type { ZeroDatabaseService } from '@/lib/server-effect/services/zero-database.service'
import { FilePersistenceError } from '../domain/errors'

/**
 * Resolves the Zero/Postgres adapter for file flows and translates missing
 * configuration into a typed file persistence error.
 */
export const requireFilePersistenceDb = (input: {
  readonly zeroDatabase: ZeroDatabaseService['Service']
  readonly message: string
  readonly requestId: string
}) =>
  input.zeroDatabase.getOrFail.pipe(
    Effect.mapError(
      (error) =>
        new FilePersistenceError({
          message: input.message,
          requestId: input.requestId,
          cause: error.message,
        }),
    ),
  )
