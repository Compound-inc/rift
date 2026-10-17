import { Duration, Effect, Layer, Scope, ServiceMap } from 'effect'
import { createClient } from 'redis'
import { isRedisDisabled } from '@/utils/app-feature-flags'
import { MemoryError } from './domain'
import { makeMemoryPurgeLock } from './memory-purge-lock'
import {
  MEMORY_PURGE_DELAY_MS,
  MemoryPurgeService,
} from './memory-purge.service'

export const MEMORY_PURGE_INTERVAL_MS = 60_000
export const MEMORY_PURGE_TICK_MS = 45_000
const lockError = () =>
  new MemoryError({
    operation: 'purge_lock',
    message: 'Memory purge lease failed',
  })

export class MemoryPurgeLockService extends ServiceMap.Service<
  MemoryPurgeLockService,
  {
    acquire: (token: string) => Effect.Effect<boolean, MemoryError>
    release: (token: string) => Effect.Effect<void, MemoryError>
  }
>()('chat-backend/MemoryPurgeLockService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const redisUrl = process.env.REDIS_URL
      const client =
        redisUrl && !isRedisDisabled
          ? createClient({
              url: redisUrl,
              disableOfflineQueue: true,
              socket: { connectTimeout: 3_000, reconnectStrategy: false },
            })
          : undefined
      // Redis emits socket errors separately from rejected commands. Tick failures
      // go through Effect observability; this listener prevents an uncaught event.
      client?.on('error', () => undefined)
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          if (client?.isOpen) client.destroy()
        }),
      )
      const lock = makeMemoryPurgeLock(
        client
          ? {
              set: async (key, token, options) => {
                // Connect lazily so an outage retries next tick and never blocks requests.
                if (!client.isOpen) await client.connect()
                return client.set(key, token, options)
              },
              eval: (script, options) => client.eval(script, options),
            }
          : undefined,
      )
      return {
        acquire: Effect.fn('MemoryPurgeLockService.acquire')((token) =>
          Effect.tryPromise({
            try: () => lock.acquire(token),
            catch: lockError,
          }),
        ),
        release: Effect.fn('MemoryPurgeLockService.release')((token) =>
          Effect.tryPromise({
            try: () => lock.release(token),
            catch: lockError,
          }),
        ),
      }
    }),
  )
}

/** Bound each batch and yield before checking for more due work. */
export const drainMemoryPurges = Effect.fn('memory.drainDuePurges')(
  function* () {
    const purge = yield* MemoryPurgeService
    while ((yield* purge.drain(16)) > 0)
      yield* Effect.sleep(Duration.millis(10))
  },
)

export const memoryPurgeTick = Effect.fn('memory.purgeTick')(function* () {
  const lock = yield* MemoryPurgeLockService
  const token = crypto.randomUUID()
  yield* Effect.acquireUseRelease(
    lock.acquire(token).pipe(Effect.timeout(Duration.seconds(5))),
    (acquired) =>
      acquired
        ? drainMemoryPurges().pipe(
            Effect.timeout(Duration.millis(MEMORY_PURGE_TICK_MS)),
          )
        : Effect.void,
    (acquired) =>
      acquired
        ? lock.release(token).pipe(
            Effect.timeout(Duration.seconds(5)),
            Effect.catchCause(() =>
              Effect.logWarning('memory_purge_lock_release_failed'),
            ),
          )
        : Effect.void,
  )
})

/** The layer's scope owns the timer and interrupts in-flight work on disposal. */
export class MemoryPurgeLoopService extends ServiceMap.Service<
  MemoryPurgeLoopService,
  { readonly running: true; readonly kick: () => Effect.Effect<void> }
>()('chat-backend/MemoryPurgeLoopService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const scope = yield* Scope.Scope
      const tick = memoryPurgeTick().pipe(
        Effect.provideService(
          MemoryPurgeLockService,
          yield* MemoryPurgeLockService,
        ),
        Effect.provideService(MemoryPurgeService, yield* MemoryPurgeService),
        Effect.catchCause(() => Effect.logWarning('memory_purge_tick_failed')),
      )
      yield* Effect.gen(function* () {
        yield* Effect.sleep(Duration.millis(MEMORY_PURGE_INTERVAL_MS))
        while (true) {
          const startedAt = Date.now()
          yield* tick
          yield* Effect.sleep(
            Duration.millis(
              Math.max(0, MEMORY_PURGE_INTERVAL_MS - (Date.now() - startedAt)),
            ),
          )
        }
      }).pipe(Effect.forkScoped)
      return {
        running: true as const,
        // Deletion hooks share the loop's lease and scope. Shutdown cancels
        // delayed kicks too, rather than leaving detached timers or Redis alive.
        kick: Effect.fn('MemoryPurgeLoopService.kick')(() =>
          Effect.sleep(Duration.millis(MEMORY_PURGE_DELAY_MS + 100)).pipe(
            Effect.andThen(tick),
            Effect.forkIn(scope),
            Effect.asVoid,
          ),
        ),
      }
    }),
  )
}
