'use client'

import { useCallback, useState } from 'react'
import { Button } from '@rift/ui/button'
import { cn } from '@rift/utils'
import { toast } from 'sonner'
import Upload from 'lucide-react/dist/esm/icons/upload'

/**
 * Bulk CV uploader.
 *
 * Posts directly to the framework HTTP route at
 * `/api/hr/recruitment/positions/:positionId/applications/bulk-upload`.
 */
export function HrBulkCvUploader({ positionId }: { positionId: string }) {
  const [submitting, setSubmitting] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return
      setSubmitting(true)
      try {
        const formData = new FormData()
        for (const file of Array.from(fileList)) {
          formData.append('files', file)
        }
        const response = await fetch(
          `/api/hr/recruitment/positions/${encodeURIComponent(positionId)}/applications/bulk-upload`,
          {
            method: 'POST',
            body: formData,
            credentials: 'same-origin',
          },
        )
        const payload = (await response.json().catch(() => null)) as {
          applicationIds?: string[]
          error?: string
          requestId?: string
          errorTag?: string
          detail?: { cause?: string }
        } | null
        if (!response.ok) {
          const head =
            payload?.error ?? `Upload failed with status ${response.status}`
          const tail = [
            payload?.errorTag ? `tag=${payload.errorTag}` : null,
            payload?.detail?.cause ? `cause=${payload.detail.cause}` : null,
            payload?.requestId ? `requestId=${payload.requestId}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
          throw new Error(tail ? `${head} (${tail})` : head)
        }
        const count = payload?.applicationIds?.length ?? 0
        toast.success(
          `Queued ${count} CV${count === 1 ? '' : 's'} for scoring.`,
        )
      } catch (cause) {
        toast.error(
          cause instanceof Error ? cause.message : 'Failed to upload CVs.',
        )
      } finally {
        setSubmitting(false)
      }
    },
    [positionId],
  )

  return (
    <label
      onDragEnter={(event) => {
        event.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDragOver={(event) => {
        event.preventDefault()
        setDragActive(true)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragActive(false)
        void handleFiles(event.dataTransfer.files)
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-base bg-surface-overlay px-4 py-6 text-center transition-colors',
        dragActive && 'border-foreground-info bg-surface-info/5',
        submitting && 'pointer-events-none opacity-70',
      )}
      aria-disabled={submitting}
    >
      <Upload aria-hidden className="size-5 text-foreground-secondary" />
      <p className="text-sm font-medium text-foreground-strong">
        Drop CVs here or
        <span className="text-[color:var(--accent-primary)]">
          {' '}
          browse files
        </span>
      </p>
      <p className="text-xs text-foreground-tertiary">
        PDFs and plain-text resumes — the platform extracts emails and ranks
        candidates against this position.
      </p>
      <input
        type="file"
        multiple
        accept=".pdf,.txt,.md,.doc,.docx"
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="ghost"
        className="mt-1 border border-border-base"
        disabled={submitting}
        asChild
      >
        <span>{submitting ? 'Uploading…' : 'Select CVs'}</span>
      </Button>
    </label>
  )
}
