'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  deleteProjectSource,
  retryProjectSourceIndex,
  uploadProjectSources,
} from './project-sources.functions'

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed'
}

export function useProjectSources(projectId: string) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)

  const runAction = (action: () => Promise<unknown>) =>
    new Promise<void>((resolve) => {
      startTransition(() => {
        void action()
          .then(() => {
            setError(null)
            resolve()
          })
          .catch((nextError) => {
            const message = toMessage(nextError)
            setError(message)
            toast.error(message)
            resolve()
          })
      })
    })

  return {
    uploading,
    pending: isPending,
    error,
    upload: async (files: readonly File[]) => {
      if (files.length === 0) return
      setUploading(true)
      const formData = new FormData()
      formData.set('projectId', projectId)
      for (const file of files) formData.append('files', file)
      try {
        await uploadProjectSources({ data: formData })
        setError(null)
      } catch (nextError) {
        const message = toMessage(nextError)
        setError(message)
        toast.error(message)
      } finally {
        setUploading(false)
      }
    },
    remove: (attachmentId: string) =>
      runAction(() =>
        deleteProjectSource({ data: { projectId, attachmentId } }),
      ),
    retryIndex: (attachmentId: string) =>
      runAction(() =>
        retryProjectSourceIndex({ data: { projectId, attachmentId } }),
      ),
  }
}
