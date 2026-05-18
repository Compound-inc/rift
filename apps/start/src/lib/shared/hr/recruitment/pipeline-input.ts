/**
 * Recruitment workflow input contract.
 *
 * Workflow functions in `lib/backend/hr/recruitment/workflows/` import
 * ONLY from this module (and its sibling type modules) plus the
 * `workflow` SDK. The shape here is the value-passable handoff
 * between the route that starts the workflow and the steps that drive
 * it.
 */

export type CandidatePipelineWorkflowInput = {
  /** Authoritative org id; every step re-validates this before mutations. */
  readonly organizationId: string
  /** Application row id created by the bulk-upload route. */
  readonly applicationId: string
  /** Candidate id (org-scoped). */
  readonly candidateId: string
  /** Position id (org-scoped). */
  readonly positionId: string
  /** Whether the org currently has the `hr.recruitment.background-check` addon. */
  readonly hasBackgroundCheckAddon: boolean
  /** Idempotency salt unique to this run. */
  readonly runIdempotencyKey: string
  /** Sleep budget for waiting on a single evaluation completion. */
  readonly evaluationTimeoutDays: number
  /** ID for telemetry correlation across services. */
  readonly requestId: string
}

/**
 * Result emitted by the evaluation dispatcher step. Returned to the
 * workflow so it can record metadata before suspending on the hook.
 */
export type DispatchEvaluationResult = {
  readonly dispatchId: string
  readonly evaluationCatalogId: string
  /** Hook token used by `resumeHook(...)` from the completion route. */
  readonly resumeHookToken: string
  /** Idempotency key, so retries dedupe. */
  readonly idempotencyKey: string
}

export type EvaluationSubmissionPayload = {
  readonly dispatchId: string
  readonly applicationId: string
  /** Score derived from candidate answers, 0..100. */
  readonly score: number
  readonly passed: boolean
  /** Question id → choice id mapping. */
  readonly answers: readonly { questionId: string; choiceId: string }[]
  readonly submittedAt: number
}

export type BackgroundCheckPayload = {
  readonly applicationId: string
  readonly checkId: string
  readonly passed: boolean
  readonly creditScore?: number
  readonly legalFlags: readonly {
    readonly code: string
    readonly severity: string
    readonly message: string
  }[]
  readonly completedAt: number
}

export type FinalizeApplicationOutcome =
  | { readonly outcome: 'advanced' }
  | { readonly outcome: 'rejected'; readonly reason: string }
