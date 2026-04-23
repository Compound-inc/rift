'use client'

import { useMemo, useState } from 'react'
import { FileDiff } from '@pierre/diffs/react'
import { parseDiffFromFile } from '@pierre/diffs'
import { useServerFn } from '@tanstack/react-start'
import { Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@rift/ui/button'
import { toast } from 'sonner'
import {
  acceptWritingHunks,
  rejectWritingHunks,
} from '@/lib/frontend/writing/tool'
import type { WritingManuscriptReview } from '@/lib/frontend/writing/manuscript'

type WritingChangeReviewCardProps = {
  readonly filePath: string
  readonly fileTitle: string
  readonly review: WritingManuscriptReview
}

function getReviewLabel(review: WritingManuscriptReview) {
  switch (review.operation) {
    case 'create':
      return 'New AI file'
    case 'delete':
      return 'Pending deletion'
    case 'update':
      return 'AI revision'
    case 'move':
      return 'AI move'
    default:
      return 'Pending change'
  }
}

function getAcceptLabel(review: WritingManuscriptReview) {
  return review.operation === 'delete' ? 'Accept deletion' : 'Accept changes'
}

function getRejectLabel(review: WritingManuscriptReview) {
  return review.operation === 'delete' ? 'Keep file' : 'Reject changes'
}

/**
 * Pending writing changes are reviewed at the file level first. This component
 * renders the canonical diff using Pierre's renderer, while the accept/reject
 * actions still map directly to Rift's persisted hunk model underneath.
 */
export function WritingChangeReviewCard({
  filePath,
  fileTitle,
  review,
}: WritingChangeReviewCardProps) {
  const acceptHunksFn = useServerFn(acceptWritingHunks)
  const rejectHunksFn = useServerFn(rejectWritingHunks)
  const [pendingAction, setPendingAction] = useState<'accept' | 'reject' | null>(null)
  const fileDiff = useMemo(
    () =>
      parseDiffFromFile(
        {
          name: filePath,
          contents: review.baseContent,
          cacheKey: `${review.changeId}:base:${review.baseContent.length}`,
        },
        {
          name: filePath,
          contents: review.proposedContent,
          cacheKey: `${review.changeId}:proposed:${review.proposedContent.length}`,
        },
      ),
    [filePath, review.baseContent, review.changeId, review.proposedContent],
  )

  const runReviewAction = async (action: 'accept' | 'reject') => {
    if (review.hunkIds.length === 0) {
      toast.error('No reviewable hunks were found for this change.')
      return
    }

    setPendingAction(action)
    try {
      if (action === 'accept') {
        await acceptHunksFn({
          data: {
            changeSetId: review.changeSetId,
            hunkIds: [...review.hunkIds],
          },
        })
        toast.success(`${fileTitle} was accepted.`)
      } else {
        await rejectHunksFn({
          data: {
            changeSetId: review.changeSetId,
            hunkIds: [...review.hunkIds],
          },
        })
        toast.success(`${fileTitle} was rejected.`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to review change')
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-amber-300/70 bg-linear-to-b from-amber-50/90 via-surface-base to-surface-base shadow-[0_1px_0_rgba(15,23,42,0.04),0_18px_36px_rgba(245,158,11,0.12)] dark:border-amber-400/20 dark:from-amber-500/10 dark:via-surface-base dark:to-surface-base">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-amber-300/60 px-4 py-4 dark:border-amber-400/20">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-900/80 dark:text-amber-100/80">
            {review.operation === 'delete' ? (
              <Trash2 className="size-3.5" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {getReviewLabel(review)}
          </div>
          <div className="text-sm leading-6 text-foreground-secondary [text-wrap:pretty]">
            {review.changeSetSummary}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-foreground-secondary">
            <span className="rounded-full border border-amber-300/70 bg-amber-100/70 px-2.5 py-1 font-medium tabular-nums text-amber-950 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-50">
              {review.pendingHunkCount.toLocaleString()} pending hunk
              {review.pendingHunkCount === 1 ? '' : 's'}
            </span>
            {review.status === 'partially_applied' ? (
              <span className="rounded-full border border-border-base bg-surface-muted/70 px-2.5 py-1 font-medium">
                Partially applied
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="border border-border-base bg-surface-base text-foreground-secondary hover:text-foreground-primary"
            disabled={pendingAction != null}
            onClick={() => void runReviewAction('reject')}
          >
            {pendingAction === 'reject' ? 'Rejecting...' : getRejectLabel(review)}
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-600/85 active:bg-emerald-600/70"
            disabled={pendingAction != null}
            onClick={() => void runReviewAction('accept')}
          >
            {pendingAction === 'accept' ? 'Accepting...' : getAcceptLabel(review)}
          </Button>
        </div>
      </div>

      <div className="px-2 py-2 md:px-3 md:py-3">
        <FileDiff
          fileDiff={fileDiff}
          disableWorkerPool
          className="overflow-hidden rounded-[1.1rem] border border-border-base/70 bg-surface-base shadow-[0_1px_0_rgba(15,23,42,0.04)]"
          options={{
            diffStyle: 'unified',
            overflow: 'wrap',
            disableFileHeader: true,
            hunkSeparators: 'line-info-basic',
            lineDiffType: 'word',
          }}
        />
      </div>
    </div>
  )
}
