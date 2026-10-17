/** A lease lasts longer than the worker's bounded tick, so it needs no renewal. */
export const MEMORY_PURGE_LOCK_TTL_MS = 90_000
export const MEMORY_PURGE_LOCK_KEY = 'rift:memory:purge:lock'
const RELEASE_LOCK = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`

export type PurgeLockRedis = {
  set: (
    key: string,
    token: string,
    options: { NX: true; PX: number },
  ) => Promise<unknown>
  eval: (
    script: string,
    options: { keys: string[]; arguments: string[] },
  ) => Promise<unknown>
}

/** Redis owns cluster exclusion; without Redis, exclusion is process-local. */
export function makeMemoryPurgeLock(redis?: PurgeLockRedis) {
  let owner: string | undefined
  return {
    async acquire(token: string): Promise<boolean> {
      if (redis)
        return (
          (await redis.set(MEMORY_PURGE_LOCK_KEY, token, {
            NX: true,
            PX: MEMORY_PURGE_LOCK_TTL_MS,
          })) === 'OK'
        )
      if (owner) return false
      owner = token
      return true
    },
    async release(token: string): Promise<void> {
      if (redis) {
        // A timed-out owner must never delete a replacement owner's lease.
        await redis.eval(RELEASE_LOCK, {
          keys: [MEMORY_PURGE_LOCK_KEY],
          arguments: [token],
        })
      } else if (owner === token) owner = undefined
    },
  }
}
