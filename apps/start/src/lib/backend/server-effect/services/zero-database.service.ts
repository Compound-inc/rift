import { Effect, Layer, Schema, ServiceMap } from 'effect'
import { getZeroDatabase } from '@/lib/backend/chat/infra/zero/db'

export class ZeroDatabaseNotConfiguredError extends Schema.TaggedErrorClass<ZeroDatabaseNotConfiguredError>()(
  'ZeroDatabaseNotConfiguredError',
  {
    message: Schema.String,
  },
) {}

export type ZeroDatabase = NonNullable<ReturnType<typeof getZeroDatabase>>

export type ZeroDatabaseServiceShape = {
  readonly getOrFail: Effect.Effect<
    ZeroDatabase,
    ZeroDatabaseNotConfiguredError
  >
  readonly withDatabase: <TValue, TError, TRequirements>(
    run: (db: ZeroDatabase) => Effect.Effect<TValue, TError, TRequirements>,
  ) => Effect.Effect<
    TValue,
    TError | ZeroDatabaseNotConfiguredError,
    TRequirements
  >
}

/**
 * Shared service that resolves the Zero/Postgres adapter once per request path.
 */
export class ZeroDatabaseService extends ServiceMap.Service<
  ZeroDatabaseService,
  ZeroDatabaseServiceShape
>()('server-effect/ZeroDatabaseService') {
  static readonly layer = Layer.effect(
    this,
    Effect.sync(() => {
      const getOrFail: ZeroDatabaseServiceShape['getOrFail'] = Effect.sync(() =>
        getZeroDatabase(),
      ).pipe(
        Effect.flatMap((db) =>
          db
            ? Effect.succeed(db)
            : Effect.fail(
                new ZeroDatabaseNotConfiguredError({
                  message: 'ZERO_UPSTREAM_DB is not configured',
                }),
              ),
        ),
      )

      const withDatabase: ZeroDatabaseServiceShape['withDatabase'] = (run) =>
        Effect.flatMap(getOrFail, run)

      return {
        getOrFail,
        withDatabase,
      }
    }),
  )
}
