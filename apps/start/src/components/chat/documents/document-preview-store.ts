import { useCallback, useSyncExternalStore } from 'react'
import type { DocumentPreview } from './document-view-model'

const previews = new Map<string, DocumentPreview>()
const latestByDocument = new Map<string, string>()
const activeCalls = new Set<string>()
const listeners = new Set<() => void>()
const subscribe = (callId: string, listener: () => void) => {
  activeCalls.add(callId)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    activeCalls.delete(callId)
  }
}
/** The sidebar lives outside ChatProvider. Share only the selected tool's preview. */
export function publishDocumentPreview(preview: DocumentPreview) {
  previews.set(preview.callId, preview)
  if (preview.documentId)
    latestByDocument.set(preview.documentId, preview.callId)
  // Keep the open panel's originating card while bounding cached body content.
  if (previews.size > 100) {
    const oldest = [...previews.keys()].find((key) => !activeCalls.has(key))
    if (oldest) {
      const evicted = previews.get(oldest)
      previews.delete(oldest)
      if (evicted?.documentId && latestByDocument.get(evicted.documentId) === oldest) latestByDocument.delete(evicted.documentId)
    }
  }
  listeners.forEach((listener) => listener())
}
export function useDocumentPreview(callId: string) {
  const subscribeToCall = useCallback((listener: () => void) => subscribe(callId, listener), [callId])
  return useSyncExternalStore(
    subscribeToCall,
    () => {
      const original = previews.get(callId)
      const latestId = original?.documentId
        ? latestByDocument.get(original.documentId)
        : undefined
      return latestId ? (previews.get(latestId) ?? original) : original
    },
    () => undefined,
  )
}
