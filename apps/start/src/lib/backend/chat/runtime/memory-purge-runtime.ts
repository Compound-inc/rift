import { Effect, Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'
import { UpstreamPostgresLayer } from '@/lib/backend/server-effect/services/upstream-postgres.service'
import { runDetachedUnsafe } from '@/lib/backend/server-effect/runtime/detached'
import {
  MemoryPurgeLockService,
  MemoryPurgeLoopService,
} from '../services/personalization/memory-purge-loop.service'
import { MemoryService } from '../services/personalization/memory.service'
import { MemoryPurgeService } from '../services/personalization/memory-purge.service'

const layer = MemoryPurgeService.layer.pipe(
  Layer.provide(MemoryService.layer),
  Layer.provide(UpstreamPostgresLayer),
)
const runtime = makeRuntimeRunner(layer)
export const MemoryPurgeRuntime = { ...runtime, layer }

let kickWorker: (() => void) | undefined
/** SQL commits already queue targets. Only the running app worker schedules kicks. */
export function kickMemoryPurge(): void {
  kickWorker?.()
}

// Only the server entry calls this bootstrap. Importing a runtime from tests or
// the manual purge script never starts a recurring worker.
let stopWorker: (() => Promise<void>) | undefined
export function startMemoryPurgeWorker(): (() => Promise<void>) | undefined {
  if (
    !process.env.SUPERMEMORY_API_KEY?.trim() ||
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST
  )
    return undefined
  if (stopWorker) return stopWorker
  const worker = makeRuntimeRunner(
    MemoryPurgeLoopService.layer.pipe(
      Layer.provide(layer),
      Layer.provide(MemoryPurgeLockService.layer),
    ),
  )
  const stop = async () => {
    kickWorker = undefined
    process.off('SIGINT', shutdown)
    process.off('SIGTERM', shutdown)
    await worker.dispose()
    stopWorker = undefined
  }
  const shutdown = () => {
    void stop()
  }
  stopWorker = stop
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  kickWorker = () =>
    runDetachedUnsafe({
      effect: Effect.tryPromise(() =>
        worker.run(
          Effect.gen(function* () {
            yield* (yield* MemoryPurgeLoopService).kick()
          }),
        ),
      ),
      onFailure: () => Effect.logWarning('memory_purge_kick_failed'),
    })
  runDetachedUnsafe({
    effect: Effect.tryPromise(() => worker.run(Effect.void)),
    onFailure: () => Effect.logWarning('memory_purge_worker_start_failed'),
  })
  return stop
}
