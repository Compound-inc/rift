import { useSyncExternalStore } from 'react'
import type {
  ChatAttachment,
  ChatAttachmentInput,
} from '@/lib/shared/chat-contracts/attachments'

export type QueuedMessage = {
  readonly id: string
  readonly text: string
  readonly attachments?: readonly ChatAttachmentInput[]
  readonly attachmentManifest?: readonly ChatAttachment[]
}

type QueueState = {
  readonly items: readonly QueuedMessage[]
  readonly paused: boolean
  readonly requestId?: string
  readonly generationPending?: boolean
  readonly awaitingMessageId?: string
}
const empty: QueueState = { items: [], paused: false }
const queues = new Map<string, QueueState>()
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
function write(threadId: string, next: QueueState) {
  queues.set(threadId, next)
  for (const listener of listeners) listener()
}

/** Client-only queues are isolated by thread and never hold uploading files. */
export const generationQueue = {
  get: (threadId?: string): QueueState =>
    threadId ? (queues.get(threadId) ?? empty) : empty,
  add(threadId: string, item: QueuedMessage) {
    const current = this.get(threadId)
    write(threadId, { ...current, items: [...current.items, item] })
  },
  restore(threadId: string, item: QueuedMessage) {
    if (!queues.has(threadId)) return
    const current = this.get(threadId)
    write(threadId, { ...current, items: [item, ...current.items] })
  },
  remove(threadId: string, id: string): QueuedMessage | undefined {
    const current = this.get(threadId)
    const item = current.items.find((entry) => entry.id === id)
    write(threadId, {
      ...current,
      items: current.items.filter((entry) => entry.id !== id),
    })
    return item
  },
  /** Clear completion from the preceding request before any new POST starts. */
  start(threadId: string, requestId?: string) {
    write(threadId, {
      ...this.get(threadId),
      paused: false,
      requestId,
      generationPending: true,
      awaitingMessageId: undefined,
    })
  },
  /** Reconnects may attach a generation sent by another device. */
  clearRequestId(threadId: string) {
    write(threadId, { ...this.get(threadId), requestId: undefined })
  },
  pause(threadId: string) {
    write(threadId, {
      ...this.get(threadId),
      paused: this.get(threadId).items.length > 0,
      awaitingMessageId: undefined,
    })
  },
  finish(threadId: string, messageId: string, succeeded: boolean) {
    const current = this.get(threadId)
    write(threadId, {
      ...current,
      paused: current.items.length > 0 && (current.paused || !succeeded),
      generationPending: false,
      requestId: undefined,
      awaitingMessageId: succeeded ? messageId : undefined,
    })
  },
  /** Claim before sending so rerenders cannot dispatch the same item twice. */
  claim(threadId: string, id: string): QueuedMessage | undefined {
    const item = this.remove(threadId, id)
    write(threadId, {
      ...this.get(threadId),
      paused: false,
      awaitingMessageId: undefined,
    })
    return item
  },
  clear(threadId: string) {
    queues.delete(threadId)
    for (const listener of listeners) listener()
  },
}

export function useGenerationQueue(threadId?: string) {
  return useSyncExternalStore(
    subscribe,
    () => generationQueue.get(threadId),
    () => empty,
  )
}

/** Wait for Zero's final row, including branch CAS, before advancing the queue. */
export function canAdvanceQueue(
  state: QueueState,
  input: {
    readonly busy: boolean
    readonly generationStatus?: string
    readonly messages: readonly {
      readonly messageId: string
      readonly status?: string
      readonly role?: string
    }[]
  },
): boolean {
  return (
    !input.busy &&
    !state.generationPending &&
    input.messages.at(-1)?.role !== 'user' &&
    !state.paused &&
    state.items.length > 0 &&
    input.generationStatus === 'completed' &&
    input.messages.some(
      (message) =>
        message.messageId === state.awaitingMessageId &&
        message.status === 'done',
    )
  )
}
