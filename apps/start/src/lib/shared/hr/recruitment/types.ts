/**
 * Shared HR recruitment domain types.
 */

/** Lifecycle for a job opening. Mirrors the `hr_position.status` check. */
export type HrPositionStatus =
  | 'draft'
  | 'open'
  | 'paused'
  | 'filled'
  | 'archived'

export type HrPositionEmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'

export type HrPositionWorkArrangement = 'remote' | 'hybrid' | 'onsite'

/**
 * Application stages, in order. The candidate-pipeline workflow advances
 * an application through these stages exactly once per "use workflow"
 * step. Both the UI funnel and the workflow steps key off this enum, so
 * never rename a value without updating both ends.
 *
 * - uploaded               → CV stored, awaiting ingest
 * - scoring                → CV ingested, affinity scoring in progress
 * - awaiting_test          → tests dispatched, waiting on candidate
 * - evaluating             → tests submitted, awaiting eval (manual or auto)
 * - awaiting_verification  → background check addon stage (gated by entitlement)
 * - advanced               → all required stages cleared, ready for human
 *                            review / outreach
 * - rejected               → declined at any stage; rejectionReason captures why
 * - hired                  → final accepted state; mutated by manual hire action
 */
export type HrApplicationStage =
  | 'uploaded'
  | 'scoring'
  | 'awaiting_test'
  | 'evaluating'
  | 'awaiting_verification'
  | 'advanced'
  | 'rejected'
  | 'hired'

export const HR_APPLICATION_STAGES: readonly HrApplicationStage[] = [
  'uploaded',
  'scoring',
  'awaiting_test',
  'evaluating',
  'awaiting_verification',
  'advanced',
  'rejected',
  'hired',
] as const

export const HR_TERMINAL_APPLICATION_STAGES = new Set<HrApplicationStage>([
  'rejected',
  'hired',
])

export type HrTestKind =
  | 'technical'
  | 'honesty'
  | 'background'
  | 'language'
  | 'behavioral'
  | 'custom'

export const HR_TEST_KINDS: readonly HrTestKind[] = [
  'technical',
  'honesty',
  'background',
  'language',
  'behavioral',
  'custom',
] as const

export type HrTestDispatchStatus =
  | 'sent'
  | 'completed'
  | 'expired'
  | 'cancelled'

export type HrBackgroundCheckStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * Compact summary used by the affinity scorer to feed both stages.
 * Holds only what is safe to ship across a workflow `use step` boundary
 * (everything is JSON-serializable).
 */
export type HrPositionRequirementSummary = {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly tags: readonly string[]
  readonly recommendedTestKinds: readonly HrTestKind[]
}

export type HrCvSummary = {
  readonly applicationId: string
  readonly candidateId: string
  readonly cvText: string
}

export type HrAffinityResult = {
  /** Final composite score, 0..100. */
  readonly score: number
  /** One-paragraph human-readable rationale, optional. */
  readonly rationale?: string
  /** Stable signal map used by the UI drawer (e.g. `embeddingScore`). */
  readonly signals: Record<string, string | number | boolean | null>
  /** Identifier of the model / heuristic that produced the score. */
  readonly model: string
}

export function isHrApplicationStage(
  value: string,
): value is HrApplicationStage {
  return (HR_APPLICATION_STAGES as readonly string[]).includes(value)
}

export function isHrTestKind(value: string): value is HrTestKind {
  return (HR_TEST_KINDS as readonly string[]).includes(value)
}
