'use client'

import { useState } from 'react'
import { Button } from '@rift/ui/button'
import { toast } from 'sonner'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'

export function HrCleanCvsButton({ positionId }: { positionId: string }) {
  const [submitting, setSubmitting] = useState(false)

  const handleClick = async () => {
    if (submitting) return
    if (
      !window.confirm(
        'Delete every application, dispatch, and background-check row for this position? Candidate profiles are preserved.',
      )
    ) {
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/hr/recruitment/positions/${encodeURIComponent(positionId)}/applications/clear`,
        {
          method: 'POST',
          credentials: 'same-origin',
        },
      )
      const payload = (await response.json().catch(() => null)) as {
        deleted?: number
        error?: string
        requestId?: string
      } | null
      if (!response.ok) {
        throw new Error(
          payload?.error ?? `Cleanup failed with status ${response.status}`,
        )
      }
      const deleted = payload?.deleted ?? 0
      toast.success(
        `Cleared ${deleted} application${deleted === 1 ? '' : 's'} for this position.`,
      )
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'Failed to clear applications.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="border border-border-base text-foreground-error"
      onClick={handleClick}
      disabled={submitting}
    >
      <Trash2 aria-hidden className="size-4" />
      {submitting ? 'Clearing…' : 'Clean CVs'}
    </Button>
  )
}
