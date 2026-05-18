'use client'

import { useMemo } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@/integrations/zero'
import { isHrApplicationSource } from '@/lib/shared/hr/recruitment'
import type {
  HrApplicationSource,
  HrApplicationStage,
  HrArchiveFilter,
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
  readonly affinitySignals: Record<
    string,
    string | number | boolean | null
  > | null
  readonly affinityModel: string | null
  readonly cvAttachmentId: string | null
  readonly cvText: string | null
  readonly source: HrApplicationSource
  readonly aiProfileSnapshot: Record<
    string,
    string | number | boolean | null
  > | null
  readonly aiSignals: Record<string, string | number | boolean | null> | null
  readonly lastTransitionAt: number | null
  readonly rejectionReason: string | null
  readonly hiredAt: number | null
  readonly archivedAt: number | null
  readonly createdAt: number
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
    affinitySignals: asLooseRecord(row.affinitySignals),
    affinityModel:
      typeof row.affinityModel === 'string' ? row.affinityModel : null,
    cvAttachmentId:
      typeof row.cvAttachmentId === 'string' ? row.cvAttachmentId : null,
    cvText: typeof row.cvText === 'string' ? row.cvText : null,
    source:
      typeof row.source === 'string' && isHrApplicationSource(row.source)
        ? row.source
        : 'Manual',
    aiProfileSnapshot: asLooseRecord(row.aiProfileSnapshot),
    aiSignals: asLooseRecord(row.aiSignals),
    lastTransitionAt:
      typeof row.lastTransitionAt === 'number' ? row.lastTransitionAt : null,
    rejectionReason:
      typeof row.rejectionReason === 'string' ? row.rejectionReason : null,
    hiredAt: typeof row.hiredAt === 'number' ? row.hiredAt : null,
    archivedAt: typeof row.archivedAt === 'number' ? row.archivedAt : null,
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : 0,
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
  }
}

function asLooseRecord(
  value: unknown,
): Record<string, string | number | boolean | null> | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object') return null
  const out: Record<string, string | number | boolean | null> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null) {
      out[key] = null
    } else if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      typeof raw === 'boolean'
    ) {
      out[key] = raw
    }
  }
  return out
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

export type HrPositionArchiveFilter = HrArchiveFilter

export function useHrPositions(input?: {
  readonly archiveFilter?: HrPositionArchiveFilter
}) {
  const [rows, result] = useQuery(
    queries.hrPositions.list({ archiveFilter: input?.archiveFilter }),
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

export function useHrPositionsByIds(input: {
  readonly positionIds: readonly string[]
}) {
  const [rows, result] = useQuery(
    queries.hrPositions.byIds({ positionIds: input.positionIds.slice() }),
  )
  const positions = useMemo(
    () => (rows ?? []).map((row) => asPosition(row as Record<string, unknown>)),
    [rows],
  )
  return {
    positions,
    loading: input.positionIds.length > 0 && result.type !== 'complete',
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

export function useHrApplicationsForCandidate(input: {
  readonly candidateId: string | null | undefined
}) {
  const [rows, result] = useQuery(
    queries.hrApplications.byCandidate({
      candidateId: input.candidateId ?? '__missing__',
      includeArchived: true,
    }),
  )
  const applications = useMemo(
    () =>
      (rows ?? []).map((row) => asApplication(row as Record<string, unknown>)),
    [rows],
  )
  return {
    applications,
    loading: !!input.candidateId && result.type !== 'complete',
  }
}

export function useHrApplication(applicationId: string | null | undefined) {
  const [row, result] = useQuery(
    queries.hrApplications.byId({
      applicationId: applicationId ?? '__missing__',
    }),
  )
  const application = useMemo(() => {
    if (!row) return null
    return asApplication(row as Record<string, unknown>)
  }, [row])
  return {
    application,
    loading: !!applicationId && result.type !== 'complete',
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

export function useHrCandidate(candidateId: string | null | undefined) {
  const [row, result] = useQuery(
    queries.hrCandidates.byId({
      candidateId: candidateId ?? '__missing__',
    }),
  )
  const candidate = useMemo(() => {
    if (!row) return null
    return asCandidate(row as Record<string, unknown>)
  }, [row])
  return {
    candidate,
    loading: !!candidateId && result.type !== 'complete',
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

export type HrEvaluationResponseView = {
  readonly id: string
  readonly applicationId: string
  readonly dispatchId: string
  readonly score: number | null
  readonly scoredBy: 'auto' | 'manual' | 'pending'
  readonly passed: boolean | null
  readonly submittedAt: number
}

function asEvaluationResponse(
  row: Record<string, unknown>,
): HrEvaluationResponseView {
  const scoredBy = (() => {
    const value = row.scoredBy
    if (value === 'auto' || value === 'manual' || value === 'pending') {
      return value
    }
    return 'pending' as const
  })()
  return {
    id: String(row.id ?? ''),
    applicationId: String(row.applicationId ?? ''),
    dispatchId: String(row.dispatchId ?? ''),
    score: typeof row.score === 'number' ? row.score : null,
    scoredBy,
    passed: typeof row.passed === 'boolean' ? row.passed : null,
    submittedAt: typeof row.submittedAt === 'number' ? row.submittedAt : 0,
  }
}

export function useHrEvaluationResponsesForApplication(input: {
  readonly applicationId: string
}) {
  const [rows, result] = useQuery(
    queries.hrEvaluationResponses.byApplication({
      applicationId: input.applicationId,
    }),
  )
  const responses = useMemo(
    () =>
      (rows ?? []).map((row) =>
        asEvaluationResponse(row as Record<string, unknown>),
      ),
    [rows],
  )
  return {
    responses,
    loading: result.type !== 'complete',
  }
}

export type HrBackgroundCheckView = {
  readonly id: string
  readonly applicationId: string
  readonly candidateId: string
  readonly provider: string
  readonly status:
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'cancelled'
  readonly passed: boolean | null
  readonly creditScore: number | null
  readonly legalFlags: ReadonlyArray<{
    readonly code: string
    readonly severity: string
    readonly message: string
  }>
  readonly requestedAt: number
  readonly completedAt: number | null
}

function asBackgroundCheck(
  row: Record<string, unknown>,
): HrBackgroundCheckView {
  const status = (() => {
    const value = row.status
    if (
      value === 'pending' ||
      value === 'in_progress' ||
      value === 'completed' ||
      value === 'failed' ||
      value === 'cancelled'
    ) {
      return value
    }
    return 'pending' as const
  })()
  const legalFlagsRaw = Array.isArray(row.legalFlags) ? row.legalFlags : []
  const legalFlags = legalFlagsRaw.flatMap((flag) => {
    if (!flag || typeof flag !== 'object') return []
    const candidate = flag as {
      code?: unknown
      severity?: unknown
      message?: unknown
    }
    return [
      {
        code: typeof candidate.code === 'string' ? candidate.code : '',
        severity:
          typeof candidate.severity === 'string' ? candidate.severity : '',
        message: typeof candidate.message === 'string' ? candidate.message : '',
      },
    ]
  })
  return {
    id: String(row.id ?? ''),
    applicationId: String(row.applicationId ?? ''),
    candidateId: String(row.candidateId ?? ''),
    provider: String(row.provider ?? ''),
    status,
    passed: typeof row.passed === 'boolean' ? row.passed : null,
    creditScore: typeof row.creditScore === 'number' ? row.creditScore : null,
    legalFlags,
    requestedAt: typeof row.requestedAt === 'number' ? row.requestedAt : 0,
    completedAt: typeof row.completedAt === 'number' ? row.completedAt : null,
  }
}

export function useHrBackgroundCheckForApplication(input: {
  readonly applicationId: string
}) {
  const [rows, result] = useQuery(
    queries.hrBackgroundChecks.byApplication({
      applicationId: input.applicationId,
    }),
  )
  const checks = useMemo(
    () =>
      (rows ?? []).map((row) =>
        asBackgroundCheck(row as Record<string, unknown>),
      ),
    [rows],
  )
  // Latest first by `requestedAt`. The detail UI only ever renders one
  // (rerunning a check is out of scope for v1), so [0] is the canonical row.
  const latest = checks[0] ?? null
  return {
    checks,
    latest,
    loading: result.type !== 'complete',
  }
}
