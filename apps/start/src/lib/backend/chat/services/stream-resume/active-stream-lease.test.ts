import { afterEach, describe, expect, it, vi } from 'vitest'
import { maintainActiveStreamLease } from './active-stream-lease'

afterEach(() => vi.useRealTimers())
describe('active stream lease', () => {
  it('renews throughout a long generation and stops immediately on abort', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const refresh = vi.fn(async () => undefined)
    const dispose = maintainActiveStreamLease({
      signal: controller.signal,
      intervalMs: 100_000,
      refresh,
    })
    await vi.advanceTimersByTimeAsync(400_000)
    expect(refresh).toHaveBeenCalledTimes(4)
    controller.abort('user-stop')
    await vi.advanceTimersByTimeAsync(100_000)
    expect(refresh).toHaveBeenCalledTimes(4)
    dispose()
  })
  it('keeps a high-effort generation discoverable past 35 minutes and releases on completion', async () => {
    vi.useFakeTimers()
    const refresh = vi.fn(async () => undefined)
    const dispose = maintainActiveStreamLease({
      signal: new AbortController().signal,
      intervalMs: 60_000,
      refresh,
    })
    await vi.advanceTimersByTimeAsync(90 * 60_000)
    expect(refresh).toHaveBeenCalledTimes(90)
    dispose()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('retries after refresh failures and releases its timer on cleanup', async () => {
    vi.useFakeTimers()
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error('Redis temporarily unavailable'))
      .mockResolvedValue(undefined)
    const dispose = maintainActiveStreamLease({
      signal: new AbortController().signal,
      intervalMs: 100_000,
      refresh,
    })
    await vi.advanceTimersByTimeAsync(200_000)
    expect(refresh).toHaveBeenCalledTimes(2)
    dispose()
    await vi.advanceTimersByTimeAsync(100_000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })
  it('does not retain a timer for an already stopped stream', () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    controller.abort('user-stop')
    maintainActiveStreamLease({
      signal: controller.signal,
      intervalMs: 100_000,
      refresh: vi.fn(),
    })()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('expires even if cleanup never runs and Redis keeps rejecting renewals', async () => {
    vi.useFakeTimers()
    const refresh = vi.fn(async () => {
      throw new Error('Redis unavailable')
    })
    maintainActiveStreamLease({
      signal: new AbortController().signal,
      intervalMs: 100,
      maxLifetimeMs: 350,
      refresh,
    })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(refresh).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })
})
