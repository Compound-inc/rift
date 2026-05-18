'use client'

import { useMemo } from 'react'
import {
  useHrApplicationsForPosition,
  useHrCandidates,
} from '@/lib/frontend/hr/recruitment'
import type { HrCandidateView } from '@/lib/frontend/hr/recruitment'
import type { HrApplicationStage } from '@/lib/shared/hr/recruitment'

function formatAppliedAt(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isApplicationProfilePending(input: {
  readonly stage: HrApplicationStage
  readonly affinityScore: number | null
}): boolean {
  return (
    input.affinityScore === null &&
    (input.stage === 'uploaded' || input.stage === 'scoring')
  )
}

export function buildPositionCandidateHeadline(input: {
  readonly stage: HrApplicationStage
  readonly candidateHeadline: string | null | undefined
  readonly affinityScore: number | null
  readonly rejectionReason: string | null
  readonly affinityModel: string | null
}): string {
  if (input.stage === 'rejected') {
    return rejectionLabel(input.rejectionReason)
  }

  // The Candidate profile may already have an AI headline from an earlier
  // Application. While the current Application is still scoring, the table
  // renders a skeleton instead of showing stale persona data.
  if (isApplicationProfilePending(input)) return ''

  if (input.affinityScore === null) return 'Pipeline · scoring pending'

  if (input.candidateHeadline) return input.candidateHeadline

  return `Score ${input.affinityScore}/100${
    input.affinityModel ? ` · ${input.affinityModel}` : ''
  }`
}

function rejectionLabel(reason: string | null): string {
  if (!reason) return 'Rejected'
  // Codes shipped by workflow steps + the bulk-upload action.
  switch (reason) {
    case 'cv-missing-text':
      return 'Rejected · CV did not include extractable text'
    case 'cv-unidentifiable':
      return 'Rejected · could not identify the candidate from the CV'
    case 'evaluation-failed':
      return 'Rejected · failed the evaluation'
    case 'evaluation-timeout':
      return 'Rejected · evaluation expired without submission'
    case 'background-check-failed':
      return 'Rejected · failed the background check'
    case 'background-check-timeout':
      return 'Rejected · background check timed out'
    default:
      if (reason.startsWith('affinity-failed')) {
        return 'Rejected · automatic scoring failed'
      }
      return `Rejected · ${reason.replace(/-/g, ' ')}`
  }
}

/**
 * Row shape for the candidates table on the Position detail page.
 * Composes Application data with the joined Candidate persona so the
 * row can render name, headline, location, and CV-on-file flag in one
 * pass without each `<td>` doing its own lookup.
 */
export type HrPositionCandidate = {
  readonly id: string
  readonly applicationId: string
  readonly name: string
  readonly headline: string
  readonly profilePending: boolean
  readonly stage: HrApplicationStage
  readonly affinityScore: number | null
  readonly affinityRationale: string | null
  readonly appliedAt: string
  readonly source: string
  readonly resumeOnFile: boolean
  readonly location: string | null
  readonly skills: readonly string[]
}

/**
 * View-model for the Position detail page's candidates table. Joins
 * the Position's Applications to their Candidate personas via the
 * org-scoped `useHrCandidates` query and returns rows ready to render.
 *
 * Loading is "loading until both sides have completed" so the UI
 * doesn't flash an empty table when the Applications resolve before
 * the Candidates do.
 */
export function useHrPositionApplications(positionId: string): {
  readonly candidates: readonly HrPositionCandidate[]
  readonly loading: boolean
} {
  const { applications, loading: applicationsLoading } =
    useHrApplicationsForPosition({ positionId })
  const { candidates: profiles, loading: candidatesLoading } = useHrCandidates({
    includeArchived: true,
  })

  const candidatesById = useMemo(() => {
    const map = new Map<string, HrCandidateView>()
    for (const profile of profiles) map.set(profile.id, profile)
    return map
  }, [profiles])

  const candidates = useMemo<readonly HrPositionCandidate[]>(() => {
    return applications.map((application) => {
      const candidate = candidatesById.get(application.candidateId)
      const candidateName = (candidate?.displayName ?? '').trim()
      const profilePending = isApplicationProfilePending({
        stage: application.stage,
        affinityScore: application.affinityScore,
      })
      const isRejectedUnidentified =
        application.stage === 'rejected' &&
        application.rejectionReason === 'cv-unidentifiable'
      const displayName =
        profilePending && candidate?.email
          ? candidate.email
          : candidateName.length > 0
            ? candidateName
            : isRejectedUnidentified
              ? '—'
              : 'Unknown candidate'
      return {
        id: application.candidateId,
        applicationId: application.id,
        name: displayName,
        headline: buildPositionCandidateHeadline({
          stage: application.stage,
          candidateHeadline: candidate?.headline,
          affinityScore: application.affinityScore,
          rejectionReason: application.rejectionReason,
          affinityModel: application.affinityModel,
        }),
        profilePending,
        stage: application.stage,
        affinityScore: application.affinityScore,
        affinityRationale: application.affinityRationale,
        appliedAt: formatAppliedAt(application.updatedAt),
        source: application.source || 'Manual',
        resumeOnFile: application.cvAttachmentId !== null,
        location: candidate?.location ?? null,
        skills: candidate?.skills ?? [],
      }
    })
  }, [applications, candidatesById])

  return {
    candidates,
    loading: applicationsLoading || candidatesLoading,
  }
}
