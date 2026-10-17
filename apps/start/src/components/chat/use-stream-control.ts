import { useCallback, useRef } from 'react'
import { m } from '@/paraglide/messages.js'
import { generationQueue } from './generation-queue-store'

// Keep suppression across thread navigation until a deliberate new send. Zero
// can still report "generation" briefly after the client has detached.
const stoppedThreads = new Set<string>()
export const isThreadStopRequested = (threadId?: string) =>
  !!threadId && stoppedThreads.has(threadId)
export const clearThreadStopRequest = (threadId?: string) => {
  if (threadId) stoppedThreads.delete(threadId)
}

export function useStreamControl(input: {
  readonly threadId?: string
  readonly status: string
  readonly attachedRequestId?: string
  readonly stop: () => Promise<void>
  readonly clearError: () => void
  readonly onError: (error: Error) => void
  readonly onStopped: () => void
}) {
  const latest = useRef(input)
  latest.current = input
  const pending = useRef(new Set<string>())
  return useCallback(async () => {
    const current = latest.current
    const threadId = current.threadId
    if (!threadId || pending.current.has(threadId)) return
    pending.current.add(threadId)
    stoppedThreads.add(threadId)
    generationQueue.pause(threadId)
    // A resumed response may have been started by another device. Only a
    // submitted POST may use the locally generated cancellation ID.
    const requestId =
      current.attachedRequestId ??
      (current.status === 'submitted'
        ? generationQueue.get(threadId).requestId
        : undefined)
    const query = new URLSearchParams({ threadId })
    if (requestId) query.set('targetRequestId', requestId)
    try {
      // Submitted requests may still be authenticating before registering their
      // stream. Keep the POST attached until the server acknowledges its abort.
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const response = await fetch(`/api/chat?${query}`, {
          method: 'DELETE',
          credentials: 'include',
          signal: AbortSignal.timeout(5000),
        })
        // The first POST may still be creating the optimistic thread.
        if (
          response.status === 404 &&
          latest.current.threadId === threadId &&
          (latest.current.status === 'submitted' ||
            latest.current.status === 'streaming')
        ) {
          await new Promise((resolve) => setTimeout(resolve, 250))
          continue
        }
        if (!response.ok) throw new Error(m.chat_stop_failed())
        await response.json()
        if (
          latest.current.threadId !== threadId ||
          latest.current.status === 'ready' ||
          latest.current.status === 'error'
        ) {
          await current.stop()
          current.clearError()
          if (latest.current.threadId === threadId) current.onStopped()
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      throw new Error(m.chat_stop_failed())
    } catch (error) {
      clearThreadStopRequest(threadId)
      // Leave the stream attached if the server could not accept the stop, so
      // the user can retry and still sees the response that is being generated.
      if (latest.current.threadId === threadId)
        current.onError(
          error instanceof Error ? error : new Error(m.chat_stop_failed()),
        )
    } finally {
      pending.current.delete(threadId)
    }
  }, [])
}
