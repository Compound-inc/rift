// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generationQueue } from './generation-queue-store'
import {
  clearThreadStopRequest,
  isThreadStopRequested,
  useStreamControl,
} from './use-stream-control'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  clearThreadStopRequest('stop-client')
  generationQueue.clear('stop-client')
})
const createInput = () => ({
  threadId: 'stop-client',
  status: 'streaming',
  stop: vi.fn(async () => undefined),
  clearError: vi.fn(),
  onError: vi.fn(),
  onStopped: vi.fn(),
})
describe('client stream stop', () => {
  it('requests server cancellation before detaching and pauses the queue', async () => {
    const input = createInput()
    generationQueue.add('stop-client', { id: 'queued', text: 'next' })
    const fetchMock = vi.fn(async () => {
      expect(input.stop).not.toHaveBeenCalled()
      input.status = 'ready'
      return Response.json({ stopped: true })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useStreamControl(input))
    await act(async () => {
      await result.current()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat?threadId=stop-client',
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    )
    expect(input.stop).toHaveBeenCalledOnce()
    expect(input.clearError).toHaveBeenCalledOnce()
    expect(isThreadStopRequested('stop-client')).toBe(true)
    expect(generationQueue.get('stop-client').paused).toBe(true)
  })
  it('waits for a submitted POST to register its stream', async () => {
    vi.useFakeTimers()
    const input = { ...createInput(), status: 'submitted' }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ stopped: false }))
      .mockImplementationOnce(async () => {
        input.status = 'ready'
        return Response.json({ stopped: true })
      })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useStreamControl(input))
    await act(async () => {
      const stopped = result.current()
      await vi.advanceTimersByTimeAsync(500)
      await stopped
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(input.stop).toHaveBeenCalledOnce()
  })
  it('targets a resumed generation from another device instead of the previous local POST', async () => {
    generationQueue.start('stop-client', 'local-R1')
    generationQueue.finish('stop-client', 'local-answer', true)
    expect(generationQueue.get('stop-client').requestId).toBeUndefined()
    const input = { ...createInput(), attachedRequestId: 'remote-R2' }
    const fetchMock = vi.fn(async (_url: string) => {
      input.status = 'ready'
      return Response.json({ stopped: true })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useStreamControl(input))
    await act(async () => {
      await result.current()
    })
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/chat?threadId=stop-client&targetRequestId=remote-R2',
    )
    expect(input.onError).not.toHaveBeenCalled()
    expect(input.stop).toHaveBeenCalledOnce()
  })
  it('uses a thread-wide stop when a resumed stream has no request metadata', async () => {
    generationQueue.start('stop-client', 'stale-local-R1')
    const input = createInput()
    const fetchMock = vi.fn(async (_url: string) => {
      input.status = 'ready'
      return Response.json({ stopped: true })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useStreamControl(input))
    await act(async () => {
      await result.current()
    })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/chat?threadId=stop-client')
  })
  it('keeps the response attached and reports a failed server cancellation', async () => {
    const input = createInput()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 403 })),
    )
    const { result } = renderHook(() => useStreamControl(input))
    await act(async () => {
      await result.current()
    })
    expect(input.stop).not.toHaveBeenCalled()
    expect(input.onError).toHaveBeenCalledOnce()
    expect(isThreadStopRequested('stop-client')).toBe(false)
  })
  it('retries through submitted to streaming and ignores a stale stop acknowledgement', async () => {
    vi.useFakeTimers()
    const input = { ...createInput(), status: 'submitted' }
    generationQueue.start('stop-client', 'request-uuid')
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => {
        input.status = 'streaming'
        return Response.json({ stopped: false })
      })
      .mockResolvedValueOnce(Response.json({ stopped: true }))
      .mockImplementationOnce(async () => {
        input.status = 'ready'
        return Response.json({ stopped: true })
      })
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useStreamControl(input))
    await act(async () => {
      const stopping = result.current()
      await vi.advanceTimersByTimeAsync(250)
      expect(input.stop).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(250)
      await stopping
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][0]).toContain('targetRequestId=request-uuid')
    expect(input.stop).toHaveBeenCalledOnce()
  })
})
