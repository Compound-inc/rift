import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { runUpstreamPostgresEffect } from '@/lib/backend/server-effect/runtime/upstream-postgres-runtime'

/**
 * Central auth runtime boundary for auth-owned Effect programs.
 *
 * Auth services use this helper rather than calling the upstream postgres
 * runtime directly so runtime ownership stays explicit within the auth domain.
 */
export function runAuthRuntimeEffect<TValue>(
  effect: Effect.Effect<TValue, unknown, PgClient.PgClient>,
): Promise<TValue> {
  return runUpstreamPostgresEffect(effect)
}
