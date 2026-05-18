import type {
  HrApplicationSource,
  HrApplicationStage,
  HrPositionEmploymentType,
  HrPositionStatus,
  HrPositionWorkArrangement,
} from '@/lib/shared/hr/recruitment'

export type HrPositionRow = {
  readonly id: string
  readonly organizationId: string
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

  readonly descriptionEmbedding: readonly number[] | null
  readonly descriptionEmbeddingModel: string | null
  readonly descriptionEmbeddingDimensions: number | null
  readonly descriptionEmbeddingUpdatedAt: number | null
  readonly archivedAt: number | null
  readonly archivedBy: string | null
  readonly createdAt: number
  readonly updatedAt: number
  readonly createdBy: string
}

export type HrCandidateRow = {
  readonly id: string
  readonly organizationId: string
  readonly normalizedEmail: string | null
  readonly email: string | null
  readonly displayName: string
  readonly phone: string | null
  readonly latestCvAttachmentId: string | null
  readonly latestCvText: string | null
  readonly latestCvEmbedding: readonly number[] | null
  readonly latestCvEmbeddingModel: string | null
  readonly latestCvEmbeddingDimensions: number | null
  readonly latestCvIndexedAt: number | null
  readonly aliases: readonly { name?: string; email?: string }[]
  readonly tags: readonly string[]
  readonly mergedIntoCandidateId: string | null
  readonly needsContactReview: boolean
  readonly archivedAt: number | null
  readonly archivedBy: string | null
  readonly notes: string | null
  /** AI-extracted profile fields. Null when no analysis has run yet. */
  readonly location: string | null
  readonly headline: string | null
  readonly summary: string | null
  readonly yearsOfExperience: number | null
  readonly skills: readonly string[]
  readonly languages: readonly string[]
  readonly highestDegree: string | null
  readonly profileSource: string | null
  readonly createdAt: number
  readonly updatedAt: number
}

export type HrApplicationRow = {
  readonly id: string
  readonly organizationId: string
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
  /**
   * Snapshot of the CV embedding captured at application creation /
   * affinity scoring time. Frozen with the application so a later
   * candidate re-extraction does not rewrite historical scoring inputs.
   */
  readonly cvEmbedding: readonly number[] | null
  readonly cvEmbeddingModel: string | null
  readonly workflowRunId: string | null
  readonly lastTransitionAt: number | null
  readonly lastError: string | null
  readonly rejectionReason: string | null
  readonly hiredAt: number | null
  readonly archivedAt: number | null
  readonly archivedBy: string | null
  readonly createdAt: number
  readonly updatedAt: number
}

/**
 * Evaluation dispatch row. The `evaluationCatalogId` field is the id
 * of an entry in `lib/shared/hr/recruitment/evaluation-catalog.ts`.
 */
export type HrEvaluationDispatchRow = {
  readonly id: string
  readonly organizationId: string
  readonly applicationId: string
  readonly evaluationCatalogId: string
  readonly dispatchedVia: string
  readonly status: 'sent' | 'completed' | 'expired' | 'cancelled'
  /** Hook token used by the workflow's `resumeHook(...)` call. */
  readonly resumeHookToken: string | null
  readonly idempotencyKey: string
  readonly expiresAt: number | null
  readonly dispatchedAt: number
  readonly completedAt: number | null
  /**
   * Signed URL the admin / candidate follows in the browser to take
   * the evaluation. Persisted at dispatch time so re-issued URLs match
   * the original (the email channel will reuse it verbatim).
   */
  readonly completionUrl: string | null
  readonly createdAt: number
  readonly updatedAt: number
}
