'use client'

import { useMemo } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@/integrations/zero'
import type {
  HrApplicationStage,
  HrEvaluationKind,
  HrPositionEmploymentType,
  HrPositionStatus,
  HrPositionWorkArrangement,
} from '@/lib/shared/hr/recruitment'

export type HrPositionView = {
  readonly id: string
  readonly title: string
  readonly department: string
  readonly location: string
  readonly arrangement: HrPositionWorkArrangement
  readonly employmentType: HrPositionEmploymentType
  readonly status: HrPositionStatus
  readonly description: string
  readonly hiringManager: string
  readonly compensation: string
  readonly tags: readonly string[]
  readonly recommendedEvaluationKinds: readonly HrEvaluationKind[]
  readonly archivedAt: number | null
  readonly createdAt: number
  readonly updatedAt: number
}

export type HrApplicationView = {
  readonly id: string
  readonly candidateId: string
  readonly positionId: string
  readonly stage: HrApplicationStage
  readonly affinityScore: number | null
  readonly affinityRationale: string | null
  readonly affinityModel: string | null
  readonly cvAttachmentId: string | null
  readonly lastTransitionAt: number | null
  readonly rejectionReason: string | null
  readonly archivedAt: number | null
  readonly updatedAt: number
}

export type HrCandidateView = {
  readonly id: string
  readonly displayName: string
  readonly email: string | null
  readonly phone: string | null
  readonly tags: readonly string[]
  readonly needsContactReview: boolean
  readonly archivedAt: number | null
  readonly updatedAt: number
  readonly location: string | null
  readonly headline: string | null
  readonly summary: string | null
  readonly yearsOfExperience: number | null
  readonly skills: readonly string[]
  readonly languages: readonly string[]
  readonly highestDegree: string | null
  readonly profileSource: string | null
}

export type HrEvaluationDispatchView = {
  readonly id: string
  readonly applicationId: string
  readonly evaluationCatalogId: string
  readonly status: 'sent' | 'completed' | 'expired' | 'cancelled'
  readonly completionUrl: string | null
  readonly dispatchedAt: number
  readonly completedAt: number | null
}

function asPosition(row: Record<string, unknown>): HrPositionView {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    department: String(row.department ?? ''),
    location: String(row.location ?? ''),
    arrangement: (row.arrangement as HrPositionWorkArrangement) ?? 'hybrid',
    employmentType:
      (row.employmentType as HrPositionEmploymentType) ?? 'full_time',
    status: (row.status as HrPositionStatus) ?? 'draft',
    description: String(row.description ?? ''),
    hiringManager: String(row.hiringManager ?? ''),
    compensation: String(row.compensation ?? ''),
    tags: Array.isArray(row.tags) ? (row.tags as readonly string[]) : [],
    recommendedEvaluationKinds: Array.isArray(row.recommendedEvaluationKinds)
      ? (row.recommendedEvaluationKinds as readonly HrEvaluationKind[])
      : [],
    archivedAt: typeof row.archivedAt === 'number' ? row.archivedAt : null,
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : 0,
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
  }
}

function asApplication(row: Record<string, unknown>): HrApplicationView {
  return {
    id: String(row.id ?? ''),
    candidateId: String(row.candidateId ?? ''),
    positionId: String(row.positionId ?? ''),
    stage: (row.stage as HrApplicationStage) ?? 'uploaded',
    affinityScore:
      typeof row.affinityScore === 'number' ? row.affinityScore : null,
    affinityRationale:
      typeof row.affinityRationale === 'string' ? row.affinityRationale : null,
    affinityModel:
      typeof row.affinityModel === 'string' ? row.affinityModel : null,
    cvAttachmentId:
      typeof row.cvAttachmentId === 'string' ? row.cvAttachmentId : null,
    lastTransitionAt:
      typeof row.lastTransitionAt === 'number' ? row.lastTransitionAt : null,
    rejectionReason:
      typeof row.rejectionReason === 'string' ? row.rejectionReason : null,
    archivedAt: typeof row.archivedAt === 'number' ? row.archivedAt : null,
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
  }
}

function asCandidate(row: Record<string, unknown>): HrCandidateView {
  return {
    id: String(row.id ?? ''),
    displayName: String(row.displayName ?? ''),
    email: typeof row.email === 'string' ? row.email : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    tags: Array.isArray(row.tags) ? (row.tags as readonly string[]) : [],
    needsContactReview: row.needsContactReview === true,
    archivedAt: typeof row.archivedAt === 'number' ? row.archivedAt : null,
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
    location: typeof row.location === 'string' ? row.location : null,
    headline: typeof row.headline === 'string' ? row.headline : null,
    summary: typeof row.summary === 'string' ? row.summary : null,
    yearsOfExperience:
      typeof row.yearsOfExperience === 'number' ? row.yearsOfExperience : null,
    skills: Array.isArray(row.skills) ? (row.skills as readonly string[]) : [],
    languages: Array.isArray(row.languages)
      ? (row.languages as readonly string[])
      : [],
    highestDegree:
      typeof row.highestDegree === 'string' ? row.highestDegree : null,
    profileSource:
      typeof row.profileSource === 'string' ? row.profileSource : null,
  }
}

export function useHrPositions(input?: { readonly includeArchived?: boolean }) {
  const [rows, result] = useQuery(
    queries.hrPositions.list({ includeArchived: input?.includeArchived }),
  )
  const positions = useMemo(
    () => (rows ?? []).map((row) => asPosition(row as Record<string, unknown>)),
    [rows],
  )
  return {
    positions,
    loading: result.type !== 'complete',
  }
}

export function useHrPosition(positionId: string | null | undefined) {
  const [row, result] = useQuery(
    queries.hrPositions.byId({ positionId: positionId ?? '__missing__' }),
  )
  const position = useMemo(() => {
    if (!row) return null
    return asPosition(row as Record<string, unknown>)
  }, [row])
  return {
    position,
    loading: !!positionId && result.type !== 'complete',
  }
}

export function useHrApplicationsForPosition(input: {
  readonly positionId: string
  readonly includeArchived?: boolean
}) {
  const [rows, result] = useQuery(
    queries.hrApplications.byPosition({
      positionId: input.positionId,
      includeArchived: input.includeArchived,
    }),
  )
  const applications = useMemo(
    () =>
      (rows ?? []).map((row) => asApplication(row as Record<string, unknown>)),
    [rows],
  )
  return {
    applications,
    loading: result.type !== 'complete',
  }
}

export function useHrCandidates(input?: {
  readonly includeArchived?: boolean
}) {
  const [rows, result] = useQuery(
    queries.hrCandidates.list({ includeArchived: input?.includeArchived }),
  )
  const candidates = useMemo(
    () =>
      (rows ?? []).map((row) => asCandidate(row as Record<string, unknown>)),
    [rows],
  )
  return {
    candidates,
    loading: result.type !== 'complete',
  }
}

function asEvaluationDispatch(
  row: Record<string, unknown>,
): HrEvaluationDispatchView {
  const status = (() => {
    const value = row.status
    if (
      value === 'sent' ||
      value === 'completed' ||
      value === 'expired' ||
      value === 'cancelled'
    ) {
      return value
    }
    return 'sent' as const
  })()
  return {
    id: String(row.id ?? ''),
    applicationId: String(row.applicationId ?? ''),
    evaluationCatalogId: String(row.evaluationCatalogId ?? ''),
    status,
    completionUrl:
      typeof row.completionUrl === 'string' ? row.completionUrl : null,
    dispatchedAt: typeof row.dispatchedAt === 'number' ? row.dispatchedAt : 0,
    completedAt: typeof row.completedAt === 'number' ? row.completedAt : null,
  }
}

export function useHrEvaluationDispatchesForApplication(input: {
  readonly applicationId: string
}) {
  const [rows, result] = useQuery(
    queries.hrEvaluationDispatches.byApplication({
      applicationId: input.applicationId,
    }),
  )
  const dispatches = useMemo(
    () =>
      (rows ?? []).map((row) =>
        asEvaluationDispatch(row as Record<string, unknown>),
      ),
    [rows],
  )
  return {
    dispatches,
    loading: result.type !== 'complete',
  }
}
