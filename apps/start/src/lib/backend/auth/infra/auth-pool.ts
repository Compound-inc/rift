import { requireZeroUpstreamPool } from '@/lib/backend/server-effect/infra/zero-upstream-pool'

/**
 * Auth, billing, and organization services all share the same upstream Postgres
 * pool. Keeping the pool in its own module avoids import cycles between Better
 * Auth configuration and the billing synchronization helpers.
 */
export const authPool = requireZeroUpstreamPool()
