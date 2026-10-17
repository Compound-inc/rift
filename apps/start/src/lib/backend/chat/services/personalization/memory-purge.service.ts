import { PgClient } from '@effect/sql-pg'
import { Duration, Effect, Layer, ServiceMap } from 'effect'
import { MemoryService } from './memory.service'
import { MemoryError } from './domain'

export const MEMORY_PURGE_DELAY_MS = 30_000
/** Never retry faster than the drain/recheck interval; cap outage retries at a day. */
export function purgeRetryDelayMs(attempts: number): number {
  return Math.min(
    86_400_000,
    MEMORY_PURGE_DELAY_MS * 2 ** Math.min(attempts, 12),
  )
}

export type PurgeTarget = {
  namespace: string
  document_id?: string
  purge_attempts: number
  purge_passes: number
}

/** Two successful, spaced deletion passes are required, including after a crash. */
export function purgeTransition(target: PurgeTarget, success: boolean) {
  return {
    status: success && target.purge_passes >= 1 ? 'purged' : 'purge_pending',
    passes: success ? target.purge_passes + 1 : target.purge_passes,
    delayMs: success
      ? MEMORY_PURGE_DELAY_MS
      : purgeRetryDelayMs(target.purge_attempts + 1),
  }
}

export class MemoryPurgeService extends ServiceMap.Service<
  MemoryPurgeService,
  {
    drain: (limit?: number) => Effect.Effect<number, MemoryError>
  }
>()('chat-backend/MemoryPurgeService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const memory = yield* MemoryService
      return {
        drain: Effect.fn('MemoryPurgeService.drain')((limit = 16) =>
          Effect.gen(function* () {
            // Missing credentials never consume a target or report successful deletion.
            if (!memory.configured) {
              yield* Effect.logWarning('memory_purge_credentials_missing')
              return 0
            }
            let processed = 0
            for (const table of [
              'memory_namespaces',
              'memory_documents',
            ] as const) {
              yield* Effect.forEach(
                Array.from({ length: limit }),
                () =>
                  sql.withTransaction(
                    Effect.gen(function* () {
                      // Hold the row lock through the bounded HTTP call. Other workers skip it;
                      // a process crash rolls back the attempt and leaves the target due.
                      const [target] =
                        yield* sql<PurgeTarget>`SELECT * FROM ${sql(table)}
              WHERE status IN ('retired', 'purge_pending') AND next_attempt_at <= NOW()
              ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1`
                      if (!target) return
                      processed += 1
                      const deleted = yield* (
                        table === 'memory_documents'
                          ? memory.deleteDocument(
                              target.namespace,
                              target.document_id!,
                            )
                          : memory.purgeNamespace(target.namespace)
                      ).pipe(
                        Effect.timeout(Duration.seconds(10)),
                        Effect.as(true),
                        Effect.catch(() =>
                          Effect.logWarning('memory_purge_failed').pipe(
                            Effect.as(false),
                          ),
                        ),
                      )
                      const next = purgeTransition(target, deleted)
                      yield* sql`UPDATE ${sql(table)} SET status = ${next.status}, purge_attempts = purge_attempts + 1,
              purge_passes = ${next.passes}, next_attempt_at = clock_timestamp() + ${next.delayMs} * INTERVAL '1 millisecond',
              last_purge_error = ${deleted ? null : 'Vendor deletion failed'},
              ${
                table === 'memory_namespaces'
                  ? sql`user_id = CASE WHEN ${next.status} = 'purged' THEN NULL ELSE user_id END,
                    organization_id = CASE WHEN ${next.status} = 'purged' THEN NULL ELSE organization_id END,
                    generation = CASE WHEN ${next.status} = 'purged' THEN NULL ELSE generation END,`
                  : sql`thread_id = CASE WHEN ${next.status} = 'purged' THEN NULL ELSE thread_id END,`
              }
              purged_at = ${next.status === 'purged' ? new Date() : null}
              WHERE namespace = ${target.namespace} ${table === 'memory_documents' ? sql`AND document_id = ${target.document_id!}` : sql``}`
                    }),
                  ),
                { concurrency: 4 },
              )
            }
            return processed
          }).pipe(
            Effect.mapError(
              () =>
                new MemoryError({
                  operation: 'purge',
                  message: 'Memory purge ledger failed',
                }),
            ),
          ),
        ),
      }
    }),
  )
}
