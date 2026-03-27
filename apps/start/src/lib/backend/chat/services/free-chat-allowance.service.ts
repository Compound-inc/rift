import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { QuotaExceededError, RateLimitPersistenceError } from '../domain/errors'
import { getMemoryState } from '../infra/memory/state'
import { runDetachedObserved } from '@/lib/backend/server-effect/runtime/detached'
import {
  formatSqlClientCause,
} from '@/lib/backend/server-effect/services/upstream-postgres.service'

const RETENTION_WINDOWS = 2

export type FreeChatAllowanceServiceShape = {
  readonly assertAllowed: (input: {
    readonly userId: string
    readonly requestId: string
    readonly policyKey: string
    readonly windowMs: number
    readonly maxRequests: number
  }) => Effect.Effect<
    {
      readonly allowed: true
      readonly remaining: number
      readonly hits: number
      readonly evaluatedAt: number
    },
    QuotaExceededError | RateLimitPersistenceError
  >
}

/**
 * Free-tier allowance tracking stays user-scoped because anonymous users and
 * unsubscribed users do not necessarily have a paid workspace seat model.
 */
export class FreeChatAllowanceService extends ServiceMap.Service<
  FreeChatAllowanceService,
  FreeChatAllowanceServiceShape
>()('chat-backend/FreeChatAllowanceService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      return {
        assertAllowed: Effect.fn('FreeChatAllowanceService.assertAllowedLive')(
          ({ userId, requestId, policyKey, windowMs, maxRequests }) =>
            Effect.gen(function* () {
              const now = Date.now()
              const windowStartMs = Math.floor(now / windowMs) * windowMs
              const [counterRow] = yield* sql<{ hits: number }>`
                insert into chat_free_allowance_window (
                  user_id,
                  policy_key,
                  window_started_at,
                  hits,
                  updated_at
                )
                values (${userId}, ${policyKey}, ${windowStartMs}, 1, ${now})
                on conflict (user_id, policy_key, window_started_at) do update
                set hits = chat_free_allowance_window.hits + 1,
                    updated_at = excluded.updated_at
                returning hits
              `
              const hits = counterRow?.hits ?? 1

              yield* runDetachedObserved({
                effect: sql`
                  delete from chat_free_allowance_window
                  where user_id = ${userId}
                    and policy_key = ${policyKey}
                    and window_started_at < ${
                      windowStartMs - (windowMs * RETENTION_WINDOWS)
                    }
                `,
                onFailure: (error) =>
                  Effect.logDebug('Failed to cleanup expired free-chat allowance windows').pipe(
                    Effect.annotateLogs({
                      userId,
                      requestId,
                      policyKey,
                      cause: formatSqlClientCause(error),
                    }),
                  ),
              })

              if (hits > maxRequests) {
                return yield* Effect.fail(
                  new QuotaExceededError({
                    message: 'Free chat allowance exhausted',
                    requestId,
                    userId,
                    retryAfterMs: windowMs - (now - windowStartMs),
                    reasonCode: 'free_allowance_exhausted',
                  }),
                )
              }

              return {
                allowed: true as const,
                remaining: maxRequests - hits,
                hits,
                evaluatedAt: now,
              }
            }).pipe(
              Effect.mapError((error) =>
                error instanceof QuotaExceededError
                  ? error
                  : new RateLimitPersistenceError({
                      message: 'Failed to evaluate free chat allowance',
                      requestId,
                      userId,
                      cause: formatSqlClientCause(error),
                    }),
              ),
            ),
        ),
      }
    }),
  )

  static readonly layerMemory = Layer.succeed(this, {
    assertAllowed: Effect.fn('FreeChatAllowanceService.assertAllowedMemory')(
      function* ({
        userId,
        requestId,
        policyKey,
        windowMs,
        maxRequests,
      }: {
        readonly userId: string
        readonly requestId: string
        readonly policyKey: string
        readonly windowMs: number
        readonly maxRequests: number
      }) {
        const now = Date.now()
        const key = `${userId}:${policyKey}`
        const bucket = getMemoryState().freeAllowances.get(key)

        if (!bucket || now - bucket.windowStartMs >= windowMs) {
          getMemoryState().freeAllowances.set(key, {
            windowStartMs: now,
            hits: 1,
          })
          return {
            allowed: true as const,
            remaining: maxRequests - 1,
            hits: 1,
            evaluatedAt: now,
          }
        }

        if (bucket.hits >= maxRequests) {
          return yield* Effect.fail(
            new QuotaExceededError({
              message: 'Free chat allowance exhausted',
              requestId,
              userId,
              retryAfterMs: windowMs - (now - bucket.windowStartMs),
              reasonCode: 'free_allowance_exhausted',
            }),
          )
        }

        bucket.hits += 1
        getMemoryState().freeAllowances.set(key, bucket)
        return {
          allowed: true as const,
          remaining: maxRequests - bucket.hits,
          hits: bucket.hits,
          evaluatedAt: now,
        }
      },
    ),
  })
}
