import type {
  HrApplicationStage,
  HrPositionEmploymentType,
  HrPositionStatus,
  HrPositionWorkArrangement,
  HrTestKind,
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
  readonly recommendedTestKinds: readonly HrTestKind[]
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

export type HrTestTemplateRow = {
  readonly id: string
  readonly organizationId: string
  readonly kind: HrTestKind
  readonly title: string
  readonly description: string
  readonly defaultPassingScore: number
  readonly questions: readonly Record<
    string,
    string | number | boolean | null
  >[]
  readonly isBuiltIn: boolean
  readonly archivedAt: number | null
  readonly createdAt: number
  readonly updatedAt: number
}

export type HrPositionTestRequirementRow = {
  readonly id: string
  readonly organizationId: string
  readonly positionId: string
  readonly testTemplateId: string
  readonly minimumScore: number | null
  readonly weight: number
  readonly isRequired: boolean
  readonly createdAt: number
  readonly updatedAt: number
}

export type HrTestDispatchRow = {
  readonly id: string
  readonly organizationId: string
  readonly applicationId: string
  readonly testTemplateId: string
  readonly dispatchedVia: string
  readonly status: 'sent' | 'completed' | 'expired' | 'cancelled'
  readonly resumeWebhookUrl: string | null
  readonly idempotencyKey: string
  readonly expiresAt: number | null
  readonly dispatchedAt: number
  readonly completedAt: number | null
  readonly createdAt: number
  readonly updatedAt: number
}
