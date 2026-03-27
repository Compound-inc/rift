'use client'

import { useState, useTransition } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { toast } from 'sonner'
import { queries } from '@/integrations/zero'
import type { OrgKnowledgeListItem } from '@/lib/shared/org-knowledge'
import {
  summarizeOrgKnowledgeIndexError,
} from '@/lib/shared/org-knowledge'
import {
  deleteOrgKnowledge,
  retryOrgKnowledgeIndex,
  setOrgKnowledgeActive,
  uploadOrgKnowledge,
} from './org-knowledge.functions'

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed'
}

function toOrgKnowledgeStatus(value: unknown): OrgKnowledgeListItem['status'] {
  return value === 'deleted' || value === 'uploaded' ? value : undefined
}

function normalizeItems(rows: readonly unknown[]): readonly OrgKnowledgeListItem[] {
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((row) => ({
      id: typeof row.id === 'string' ? row.id : '',
      fileName: typeof row.fileName === 'string' ? row.fileName : 'Untitled file',
      mimeType: typeof row.mimeType === 'string' ? row.mimeType : 'application/octet-stream',
      fileSize: typeof row.fileSize === 'number' ? row.fileSize : 0,
      status: toOrgKnowledgeStatus(row.status),
      orgKnowledgeActive:
        typeof row.orgKnowledgeActive === 'boolean'
          ? row.orgKnowledgeActive
          : false,
      vectorIndexedAt:
        typeof row.vectorIndexedAt === 'number' ? row.vectorIndexedAt : undefined,
      vectorError:
        typeof row.vectorError === 'string'
          ? summarizeOrgKnowledgeIndexError(row.vectorError)
          : undefined,
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
      createdAt: typeof row.createdAt === 'number' ? row.createdAt : 0,
    }))
    .filter((row) => row.id.length > 0)
}

export function useOrgKnowledge() {
  const [rows, result] = useQuery(
    queries.orgKnowledge.list({
      includeInactive: true,
    }),
  )
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
    items: normalizeItems(rows),
    loading: result.type !== 'complete',
    uploading,
    pending: isPending,
    error,
    upload: async (file: File) => {
      setUploading(true)
      const formData = new FormData()
      formData.set('file', file)
      try {
        await uploadOrgKnowledge({ data: formData })
        setError(null)
      } catch (nextError) {
        const message = toMessage(nextError)
        setError(message)
        toast.error(message)
      } finally {
        setUploading(false)
      }
    },
    setActive: (attachmentId: string, active: boolean) =>
      runAction(() => setOrgKnowledgeActive({ data: { attachmentId, active } })),
    remove: (attachmentId: string) =>
      runAction(() => deleteOrgKnowledge({ data: { attachmentId } })),
    retryIndex: (attachmentId: string) =>
      runAction(() => retryOrgKnowledgeIndex({ data: { attachmentId } })),
  }
}
