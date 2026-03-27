import { makeRuntimeRunner } from './runtime-runner'
import { UpstreamPostgresLayer } from '../services/upstream-postgres.service'
import type { Effect } from 'effect'
import type { PgClient } from '@effect/sql-pg'

const layer = UpstreamPostgresLayer
const runtime = makeRuntimeRunner(layer)

/**
 * Promise bridge for imperative server-only modules that cannot stay in Effect
 * all the way out to their framework boundary.
 */
export function runUpstreamPostgresEffect<TValue, TError>(
  effect: Effect.Effect<TValue, TError, PgClient.PgClient>,
) {
  return runtime.run(effect)
}
