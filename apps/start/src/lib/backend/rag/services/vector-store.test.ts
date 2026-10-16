import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkVectorStoreHealth, isQdrantConnectionError } from './vector-store'

/** Bun's fetch rejects a refused connection with this shape. */
function bunConnectionRefused(): Error {
  return Object.assign(
    new Error('Unable to connect. Is the computer able to access the url?'),
    { code: 'ConnectionRefused' },
  )
}

describe('isQdrantConnectionError', () => {
  it('matches refused connections from Bun and Node fetch', () => {
    expect(isQdrantConnectionError(bunConnectionRefused())).toBe(true)
    expect(isQdrantConnectionError(new TypeError('fetch failed'))).toBe(true)
  })

  it('does not match our own timeouts or HTTP-level failures', () => {
    const abort = new Error('The operation was aborted')
    abort.name = 'AbortError'
    expect(isQdrantConnectionError(abort)).toBe(false)
    expect(
      isQdrantConnectionError(new Error('Qdrant request failed with status 500')),
    ).toBe(false)
    expect(isQdrantConnectionError('not an error')).toBe(false)
  })
})

describe('qdrant wake-up retries', () => {
  beforeEach(() => {
    vi.stubEnv('QDRANT_URL', 'http://qdrant.test:6333')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('retries refused connections while a slept Qdrant boots', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(bunConnectionRefused())
      .mockRejectedValueOnce(bunConnectionRefused())
      .mockResolvedValue(Response.json({ result: { collections: [] } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(checkVectorStoreHealth()).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('gives up once the wake budget is spent', async () => {
    vi.stubEnv('QDRANT_WAKE_TIMEOUT_MS', '300')
    const fetchMock = vi.fn().mockRejectedValue(bunConnectionRefused())
    vi.stubGlobal('fetch', fetchMock)

    await expect(checkVectorStoreHealth()).resolves.toBe(false)
    // 250ms backoff fits the 300ms budget once; the next 500ms does not.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry HTTP errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ error: 'boom' }, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(checkVectorStoreHealth()).resolves.toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
