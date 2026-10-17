/**
 * A generation can outlive the active-key TTL. Renew its lease until abort or
 * cleanup, without making a temporary Redis outage fail an otherwise live model.
 * The caller must compare ownership atomically before extending the key.
 * A lost cleanup cannot renew forever: after two hours, the key may only
 * survive for its remaining Redis TTL.
 */
export function maintainActiveStreamLease(input: {
  readonly signal: AbortSignal
  readonly intervalMs: number
  readonly maxLifetimeMs?: number
  readonly refresh: () => Promise<unknown>
}): () => void {
  if (input.signal.aborted) return () => {}
  const expiresAt = Date.now() + (input.maxLifetimeMs ?? 2 * 60 * 60 * 1000)
  const timer = setInterval(() => {
    if (Date.now() >= expiresAt) {
      dispose()
      return
    }
    void input.refresh().catch(() => undefined)
  }, input.intervalMs)
  const dispose = () => {
    clearInterval(timer)
    input.signal.removeEventListener('abort', dispose)
  }
  input.signal.addEventListener('abort', dispose, { once: true })
  return dispose
}
