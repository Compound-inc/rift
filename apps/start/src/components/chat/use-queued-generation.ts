import { useEffect } from 'react'
import {
  canAdvanceQueue,
  generationQueue,
  useGenerationQueue,
} from './generation-queue-store'
import type { QueuedMessage } from './generation-queue-store'

// Remember observed rows across navigation so a deleted thread also loses its queue.
const observedThreads = new Set<string>()

export function useQueuedGeneration(input: {
  readonly threadId?: string
  readonly status: string
  readonly generationStatus?: string
  readonly threadExists?: boolean
  readonly threadQueryComplete?: boolean
  readonly messages: readonly {
    readonly messageId: string
    readonly role: string
    readonly status?: string
  }[]
  readonly sendMessage: (item: QueuedMessage) => Promise<void>
}) {
  const state = useGenerationQueue(input.threadId)
  useEffect(() => {
    if (!input.threadId) return
    if (input.threadExists) {
      observedThreads.add(input.threadId)
    } else if (
      input.threadQueryComplete &&
      observedThreads.has(input.threadId)
    ) {
      // An incomplete first-send query is not evidence that a thread was deleted.
      observedThreads.delete(input.threadId)
      generationQueue.clear(input.threadId)
    }
  }, [input.threadId, input.threadExists, input.threadQueryComplete])
  useEffect(() => {
    if (!input.threadId || !state.items.length) return
    // A thread can still show the previous failure while Zero catches up.
    // Only this generation's persisted row can pause a successful SDK finish.
    const finishedMessage = input.messages.find(
      (message) => message.messageId === state.awaitingMessageId,
    )
    if (
      finishedMessage?.status === 'error' ||
      finishedMessage?.status === 'cancelled'
    ) {
      if (!state.paused) generationQueue.pause(input.threadId)
      return
    }
    if (
      !canAdvanceQueue(state, {
        ...input,
        busy: input.status === 'streaming' || input.status === 'submitted',
      })
    )
      return
    const next = generationQueue.claim(input.threadId, state.items[0].id)
    if (next)
      void input.sendMessage(next).catch(() => {
        generationQueue.restore(input.threadId!, next)
        generationQueue.pause(input.threadId!)
      })
  }, [
    input.threadId,
    input.status,
    input.generationStatus,
    input.messages,
    input.sendMessage,
    state,
  ])
}
