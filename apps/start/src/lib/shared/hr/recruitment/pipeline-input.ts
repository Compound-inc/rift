/**
 * Recruitment workflow input contract.
 *
 * Workflow functions in `lib/backend/hr/recruitment/workflows/` import
 * ONLY from this module (and its sibling type modules) plus the
 * `workflow` SDK. They cannot import services, Effect, or Zero — those
 * paths leak Node-only APIs into the workflow sandbox. The shape here
 * is the value-passable handoff between the route that starts the
 * workflow and the steps that drive it.
 */

export type CandidatePipelineWorkflowInput = {
  /** Authoritative org id; every step re-validates this before mutations. */
  readonly organizationId: string
  /** Application row id created by the bulk-upload route. */
  readonly applicationId: string
  /** Candidate id (org-scoped). Convenience to skip the application lookup. */
  readonly candidateId: string
  /** Position id (org-scoped). */
  readonly positionId: string
  /** Whether the org currently has the `hr.background-check` addon. */
  readonly hasBackgroundCheckAddon: boolean
  /** Idempotency salt unique to this run. */
  readonly runIdempotencyKey: string
  /** Sleep budget for waiting on a single test completion. */
  readonly testTimeoutDays: number
  /** Whether the org has AI re-rank scoring enabled. */
  readonly aiRerankEnabled: boolean
  /** Top-K cap for AI re-rank */
  readonly aiRerankTopK: number
  /** ID for telemetry correlation across services. */
  readonly requestId: string
}

/**
 * Result emitted by the test dispatcher step. Returned to the workflow
 * so it can record metadata before suspending on the webhook.
 */
export type DispatchTestResult = {
  readonly dispatchId: string
  readonly testTemplateId: string
  /** URL the candidate-side completion endpoint hits to resume the workflow. */
  readonly resumeWebhookUrl: string
  /** Provided by the dispatcher so steps can be replayed safely. */
  readonly idempotencyKey: string
}

export type TestSubmissionPayload = {
  readonly dispatchId: string
  readonly applicationId: string
  /** Score derived from candidate answers, 0..100. */
  readonly score: number
  readonly passed: boolean
  /** Optional opaque answer payload, kept JSON-serializable. */
  readonly answers: readonly Record<string, string | number | boolean | null>[]
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
