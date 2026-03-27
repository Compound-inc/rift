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

export function formatSqlClientCause(cause: unknown): string {
  if (cause instanceof SqlError.SqlError) {
    if (cause.message && cause.message.trim().length > 0) {
      return cause.message
    }

    if (cause.cause instanceof Error && cause.cause.message.trim().length > 0) {
      return cause.cause.message
    }
  }

  if (cause instanceof Error) {
    return cause.message
  }

  return String(cause)
}
