import { Effect, Layer, ManagedRuntime } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  makeMemoryPurgeLock,
  MEMORY_PURGE_LOCK_KEY,
  MEMORY_PURGE_LOCK_TTL_MS,
} from './memory-purge-lock'
import {
  MemoryPurgeLockService,
  MemoryPurgeLoopService,
  memoryPurgeTick,
  MEMORY_PURGE_INTERVAL_MS,
  MEMORY_PURGE_TICK_MS,
} from './memory-purge-loop.service'
import { MemoryPurgeService } from './memory-purge.service'
import { MemoryError } from './domain'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function fixture() {
  const acquire = vi.fn<MemoryPurgeLockService['Service']['acquire']>(() =>
    Effect.succeed(true),
  )
  const release = vi.fn<MemoryPurgeLockService['Service']['release']>(
    () => Effect.void,
  )
  const drain = vi.fn<MemoryPurgeService['Service']['drain']>(() =>
    Effect.succeed(0),
  )
  const deps = Layer.mergeAll(
    Layer.succeed(MemoryPurgeLockService, { acquire, release }),
    Layer.succeed(MemoryPurgeService, { drain }),
  )
  return {
    acquire,
    release,
    drain,
    deps,
    tick: () => Effect.runPromise(memoryPurgeTick().pipe(Effect.provide(deps))),
  }
}

describe('purge lease', () => {
  it('uses SET NX PX and compare-and-delete so an expired owner cannot release a replacement lease', async () => {
    let owner: string | undefined
    const set = vi.fn(
      async (_key: string, token: string, _options: unknown) => {
        if (owner) return null
        owner = token
        return 'OK'
      },
    )
    const evalScript = vi.fn(
      async (
        script: string,
        options: { keys: string[]; arguments: string[] },
      ) => {
        expect(script).toContain("redis.call('get', KEYS[1]) == ARGV[1]")
        expect(script).toContain("redis.call('del', KEYS[1])")
        if (owner === options.arguments[0]) owner = undefined
      },
    )
    const first = makeMemoryPurgeLock({ set, eval: evalScript })
    const second = makeMemoryPurgeLock({ set, eval: evalScript })
    expect(await first.acquire('first')).toBe(true)
    expect(await second.acquire('second')).toBe(false)
    expect(set).toHaveBeenCalledWith(MEMORY_PURGE_LOCK_KEY, 'first', {
      NX: true,
      PX: MEMORY_PURGE_LOCK_TTL_MS,
    })
    owner = undefined // Simulate expiry.
    expect(await second.acquire('second')).toBe(true)
    await first.release('first')
    expect(await first.acquire('third')).toBe(false)
    await second.release('second')
    expect(await first.acquire('third')).toBe(true)
  })

  it('retains token ownership with the in-memory fallback', async () => {
    const lock = makeMemoryPurgeLock()
    expect(await lock.acquire('first')).toBe(true)
    await lock.release('other')
    expect(await lock.acquire('second')).toBe(false)
    await lock.release('first')
    expect(await lock.acquire('second')).toBe(true)
  })
})

describe('purge worker', () => {
  it('skips work when another instance holds the lease', async () => {
    const test = fixture()
    test.acquire.mockReturnValue(Effect.succeed(false))
    await test.tick()
    expect(test.drain).not.toHaveBeenCalled()
    expect(test.release).not.toHaveBeenCalled()
  })

  it('drains bounded batches until nothing is due and yields between batches', async () => {
    vi.useFakeTimers()
    const test = fixture()
    test.drain
      .mockReturnValueOnce(Effect.succeed(32))
      .mockReturnValueOnce(Effect.succeed(1))
    const tick = test.tick()
    await vi.advanceTimersByTimeAsync(1)
    expect(test.drain).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(25)
    await tick
    expect(test.drain.mock.calls).toEqual([[16], [16], [16]])
    expect(test.release.mock.calls[0][0]).toBe(test.acquire.mock.calls[0][0])
  })

  it('releases the lease on failure or timeout, before its TTL expires', async () => {
    vi.useFakeTimers()
    const test = fixture()
    test.drain.mockReturnValueOnce(
      Effect.fail(new MemoryError({ operation: 'purge', message: 'failed' })),
    )
    await expect(test.tick()).rejects.toThrow()
    expect(test.release).toHaveBeenCalledTimes(1)
    test.drain.mockReturnValue(Effect.never)
    const tick = test.tick().catch(() => undefined)
    await vi.advanceTimersByTimeAsync(MEMORY_PURGE_TICK_MS + 1)
    await tick
    expect(test.release).toHaveBeenCalledTimes(2)
    expect(MEMORY_PURGE_TICK_MS + 10_000).toBeLessThan(MEMORY_PURGE_LOCK_TTL_MS)
  })

  it('retries failures and second passes on later ticks, and stops on runtime disposal', async () => {
    vi.useFakeTimers()
    const test = fixture()
    const runtime = ManagedRuntime.make(
      MemoryPurgeLoopService.layer.pipe(Layer.provide(test.deps)),
    )
    await runtime.runPromise(Effect.void)
    expect(test.drain).not.toHaveBeenCalled()
    test.drain.mockReturnValueOnce(
      Effect.fail(new MemoryError({ operation: 'purge', message: 'outage' })),
    )
    await vi.advanceTimersByTimeAsync(MEMORY_PURGE_INTERVAL_MS)
    expect(test.drain).toHaveBeenCalledTimes(1)
    // A successful first pass schedules its recheck in SQL. The following tick
    // picks it up naturally, without a request hook or external scheduler.
    test.drain.mockReturnValueOnce(Effect.succeed(1))
    await vi.advanceTimersByTimeAsync(MEMORY_PURGE_INTERVAL_MS + 20)
    expect(test.drain).toHaveBeenCalledTimes(3)
    test.drain.mockReturnValueOnce(Effect.succeed(1))
    await vi.advanceTimersByTimeAsync(MEMORY_PURGE_INTERVAL_MS + 20)
    expect(test.drain).toHaveBeenCalledTimes(5)
    await runtime.dispose()
    await vi.advanceTimersByTimeAsync(MEMORY_PURGE_INTERVAL_MS * 2)
    expect(test.drain).toHaveBeenCalledTimes(5)
  })

  it('interrupts an in-flight drain and releases its lease on shutdown', async () => {
    vi.useFakeTimers()
    const test = fixture()
    let interrupted = false
    test.drain.mockReturnValue(
      Effect.never.pipe(
        Effect.ensuring(
          Effect.sync(() => {
            interrupted = true
          }),
        ),
      ),
    )
    const runtime = ManagedRuntime.make(
      MemoryPurgeLoopService.layer.pipe(Layer.provide(test.deps)),
    )
    await runtime.runPromise(Effect.void)
    await vi.advanceTimersByTimeAsync(MEMORY_PURGE_INTERVAL_MS)
    await runtime.dispose()
    expect(interrupted).toBe(true)
    expect(test.release).toHaveBeenCalledTimes(1)
  })
})

it('does not bootstrap a recurring worker in tests or without credentials', async () => {
  const { startMemoryPurgeWorker } =
    await import('../../runtime/memory-purge-runtime')
  vi.stubEnv('SUPERMEMORY_API_KEY', 'test-key')
  expect(startMemoryPurgeWorker()).toBeUndefined()
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('VITEST', '')
  vi.stubEnv('SUPERMEMORY_API_KEY', '')
  expect(startMemoryPurgeWorker()).toBeUndefined()
})

it('cancels delayed deletion kicks together with the server worker', async () => {
  vi.useFakeTimers()
  const test = fixture()
  const runtime = ManagedRuntime.make(
    MemoryPurgeLoopService.layer.pipe(Layer.provide(test.deps)),
  )
  await runtime.runPromise(
    Effect.gen(function* () {
      yield* (yield* MemoryPurgeLoopService).kick()
    }),
  )
  await runtime.dispose()
  await vi.advanceTimersByTimeAsync(MEMORY_PURGE_INTERVAL_MS * 2)
  expect(test.acquire).not.toHaveBeenCalled()
})

it('keeps a 60-second cadence when a tick takes time', async () => {
  vi.useFakeTimers()
  const test = fixture()
  test.drain.mockImplementation(() =>
    Effect.sleep('20 seconds').pipe(Effect.as(0)),
  )
  const runtime = ManagedRuntime.make(
    MemoryPurgeLoopService.layer.pipe(Layer.provide(test.deps)),
  )
  await runtime.runPromise(Effect.void)
  await vi.advanceTimersByTimeAsync(MEMORY_PURGE_INTERVAL_MS)
  expect(test.drain).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(MEMORY_PURGE_INTERVAL_MS)
  expect(test.drain).toHaveBeenCalledTimes(2)
  await runtime.dispose()
})
