import { useSyncExternalStore } from 'react'
import type { CompactionProgress } from '@/lib/shared/chat-contracts/compaction'

const progressByThread = new Map<string, CompactionProgress>()
const listeners = new Set<() => void>()

/** Transient stream progress is thread-scoped, so navigation cannot leak it. */
export function setCompactionProgress(progress: CompactionProgress) {
  progressByThread.set(progress.threadId, progress)
  for (const listener of listeners) listener()
}

export function clearCompactionProgress(threadId: string | undefined) {
  if (!threadId || !progressByThread.delete(threadId)) return
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useCompactionProgress(threadId: string | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => (threadId ? progressByThread.get(threadId) : undefined),
    () => undefined,
  )
}
