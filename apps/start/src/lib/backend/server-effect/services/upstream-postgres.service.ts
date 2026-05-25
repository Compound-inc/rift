import { PgClient } from '@effect/sql-pg'
import { Effect, Schema } from 'effect'
import { SqlError } from 'effect/unstable/sql'
import { requireZeroUpstreamPool } from '@/lib/backend/server-effect/infra/zero-upstream-pool'

export type UpstreamSqlClient = PgClient.PgClient

/**
 * Shared upstream Postgres client layer.
 */
export const UpstreamPostgresLayer = PgClient.layerFromPool({
  acquire: Effect.acquireRelease(
    Effect.sync(() => requireZeroUpstreamPool()),
    () => Effect.void,
  ),
  applicationName: 'rift-upstream-postgres',
  spanAttributes: {
    'rift.db.role': 'upstream',
  },
})

const encodeJsonString = Schema.encodeSync(Schema.UnknownFromJsonString)

export function sqlJson(client: UpstreamSqlClient, value: unknown) {
  return client.json(encodeJsonString(value))
}

/**
 * `@effect/sql-pg` wraps every driver failure in a `SqlError` whose own
 * `message` is a static `"Failed to execute statement"` and whose `cause`
 * carries the real postgres error. We surface the inner message so logs
 * show something actionable instead of just the wrapper text.
 */
export function formatSqlClientCause(cause: unknown): string {
  if (cause instanceof SqlError.SqlError) {
    const inner =
      cause.cause instanceof Error && cause.cause.message.trim().length > 0
        ? cause.cause.message.trim()
        : ''
    if (inner) {
      return cause.message && cause.message.trim().length > 0
        ? `${cause.message.trim()}: ${inner}`
        : inner
    }
    if (cause.message && cause.message.trim().length > 0) {
      return cause.message
    }
  }

  if (cause instanceof Error) {
    return cause.message
  }

  return String(cause)
}
