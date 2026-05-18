'use client'

import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list'
import { useHrEvaluationDispatchesForApplication } from '@/lib/frontend/hr/recruitment'

export function HrEvaluationLink({
  applicationId,
}: {
  readonly applicationId: string
}) {
  const { dispatches } = useHrEvaluationDispatchesForApplication({
    applicationId,
  })
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
