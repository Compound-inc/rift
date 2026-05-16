'use client'

import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list'
import { useHrEvaluationDispatchesForApplication } from '@/lib/frontend/hr/recruitment'

/**
 * Inline "Take evaluation" link for a candidate row.
 *
 * Reads the latest dispatch for the application via Zero. Until we
 * land an email channel, the workflow stores the signed completion
 * URL on the dispatch row and the recruiter clicks it from here to
 * play the candidate role and advance the workflow.
 *
 * Renders nothing when there's no outstanding dispatch (workflow
 * either hasn't sent one yet or it's been completed).
 */
export function HrEvaluationLink({
  applicationId,
}: {
  readonly applicationId: string
}) {
  const { dispatches } = useHrEvaluationDispatchesForApplication({
    applicationId,
  })
  // Workflow only ever has one outstanding dispatch per application;
  // the query is ordered by `dispatchedAt desc` so [0] is the latest.
  const latest = dispatches[0]
  if (!latest) return null
  if (latest.status !== 'sent') return null
  if (!latest.completionUrl) return null

  return (
    <a
      href={latest.completionUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-foreground-info hover:underline"
    >
      <ClipboardList aria-hidden className="size-3" />
      Take evaluation
    </a>
  )
}
