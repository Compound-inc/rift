'use client'

import { useMemo } from 'react'
import {
  useHrApplicationsForCandidate,
  useHrCandidate,
  useHrPositionsByIds,
} from '@/lib/frontend/hr/recruitment'
import type {
  HrApplicationView,
  HrCandidateView,
  HrPositionView,
} from '@/lib/frontend/hr/recruitment'
import type { HrApplicationStage } from '@/lib/shared/hr/recruitment'

/**
 * Convenience shape combining the persona record (Candidate) with one
 * Application + the Position the Application targets, ready for
 * rendering as a card on the activity timeline.
 */
export type HrCandidateApplicationCard = {
  readonly applicationId: string
  readonly candidateId: string
  readonly positionId: string
  readonly positionTitle: string
  readonly positionDepartment: string
  readonly positionArchived: boolean
  readonly stage: HrApplicationStage
  readonly affinityScore: number | null
  readonly affinityRationale: string | null
  readonly affinityModel: string | null
  readonly rejectionReason: string | null
  readonly hiredAt: number | null
  readonly archivedAt: number | null
  readonly appliedAt: number
  readonly lastTransitionAt: number | null
  readonly updatedAt: number
}

/**
 * Composed view-model for the Candidate profile page. Wraps the raw
 * `useHrCandidate` + `useHrApplicationsForCandidate` queries and joins
 * the Application list to its Position so each timeline card has the
 * Position title + archived flag without the component re-implementing
 * the join.
 *
 * Returned `applications` are already sorted by `updatedAt` desc to
 * match how the parent profile shows the most recently active first.
 */
export function useHrCandidateProfileViewModel(input: {
  readonly candidateId: string | null
}): {
  readonly candidate: HrCandidateView | null
  readonly applications: readonly HrCandidateApplicationCard[]
  readonly loading: boolean
} {
  const { candidate, loading: candidateLoading } = useHrCandidate(
    input.candidateId,
  )
  const { applications, loading: applicationsLoading } =
    useHrApplicationsForCandidate({ candidateId: input.candidateId })
  const positionIds = useMemo(
    () =>
      Array.from(
        new Set(applications.map((application) => application.positionId)),
      ),
    [applications],
  )
  const { positions, loading: positionsLoading } = useHrPositionsByIds({
    positionIds,
  })

  const positionsById = useMemo(() => {
    const map = new Map<string, HrPositionView>()
    for (const position of positions) map.set(position.id, position)
    return map
  }, [positions])

  const cards = useMemo<readonly HrCandidateApplicationCard[]>(() => {
    return applications.map((application) =>
      buildCard({
        application,
        position: positionsById.get(application.positionId),
      }),
    )
  }, [applications, positionsById])

  return {
    candidate,
    applications: cards,
    loading: candidateLoading || applicationsLoading || positionsLoading,
  }
}

function buildCard(input: {
  readonly application: HrApplicationView
  readonly position: HrPositionView | undefined
}): HrCandidateApplicationCard {
  const { application, position } = input
  return {
    applicationId: application.id,
    candidateId: application.candidateId,
    positionId: application.positionId,
    positionTitle: position?.title ?? 'Unknown position',
    positionDepartment: position?.department ?? '',
    // Archive is a visibility flag on the Position, not a lifecycle status.
    // Timeline cards use it only to signal that the linked Position was cleaned
    // out of the active dashboard.
    positionArchived: position ? position.archivedAt !== null : false,
    stage: application.stage,
    affinityScore: application.affinityScore,
    affinityRationale: application.affinityRationale,
    affinityModel: application.affinityModel,
    rejectionReason: application.rejectionReason,
    hiredAt: application.hiredAt,
    archivedAt: application.archivedAt,
    appliedAt: application.createdAt,
    lastTransitionAt: application.lastTransitionAt,
    updatedAt: application.updatedAt,
  }
}
