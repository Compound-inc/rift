import { Effect } from 'effect'
import { sqlJson } from '@/lib/backend/server-effect'
import type { UpstreamSqlClient } from '@/lib/backend/server-effect'
import type {
  HrApplicationRow,
  HrCandidateRow,
  HrEvaluationDispatchRow,
  HrPositionRow,
} from '../domain/types'
import {
  isHrApplicationStage,
  isHrEvaluationKind,
} from '@/lib/shared/hr/recruitment'
import type {
  HrApplicationStage,
  HrEvaluationKind,
  HrPositionEmploymentType,
  HrPositionStatus,
  HrPositionWorkArrangement,
} from '@/lib/shared/hr/recruitment'

/**
 * Database row mappers shared by the recruitment services.
 * Tests stub the `UpstreamSqlClient` directly.
 */

type RawRow = Record<string, unknown>

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'bigint') return Number(value)
  return null
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  return String(value)
}

function toBooleanOrFalse(value: unknown): boolean {
  return value === true
}

function toJsonObjectOrNull(
  value: unknown,
): Record<string, string | number | boolean | null> | null {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return toJsonObjectOrNull(parsed)
    } catch {
      return null
    }
  }
  if (typeof value !== 'object') return null
  const result: Record<string, string | number | boolean | null> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      typeof raw === 'boolean' ||
      raw === null
    ) {
      result[key] = raw
    }
  }
  return result
}

function toStringArray(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string')
  }
  if (typeof value === 'string') {
    try {
      return toStringArray(JSON.parse(value))
    } catch {
      return []
    }
  }
  return []
}

function toAliasArray(
  value: unknown,
): readonly { name?: string; email?: string }[] {
  if (typeof value === 'string') {
    try {
      return toAliasArray(JSON.parse(value))
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  const result: { name?: string; email?: string }[] = []
  for (const entry of value) {
    if (entry && typeof entry === 'object') {
      const candidate = entry as { name?: unknown; email?: unknown }
      const next: { name?: string; email?: string } = {}
      if (typeof candidate.name === 'string') next.name = candidate.name
      if (typeof candidate.email === 'string') next.email = candidate.email
      if (next.name || next.email) result.push(next)
    }
  }
  return result
}

function toEvaluationKindArray(value: unknown): readonly HrEvaluationKind[] {
  return toStringArray(value).filter(isHrEvaluationKind)
}

function toEmbeddingArray(value: unknown): readonly number[] | null {
  if (Array.isArray(value)) {
    const numbers = value
      .map((entry) => (typeof entry === 'number' ? entry : Number(entry)))
      .filter((entry) => Number.isFinite(entry))
    return numbers.length > 0 ? numbers : null
  }
  if (typeof value === 'string') {
    try {
      return toEmbeddingArray(JSON.parse(value))
    } catch {
      return null
    }
  }
  return null
}

function normalizeStatus(value: unknown): HrPositionStatus {
  if (
    value === 'draft' ||
    value === 'open' ||
    value === 'paused' ||
    value === 'filled' ||
    value === 'archived'
  ) {
    return value
  }
  return 'draft'
}

function normalizeArrangement(value: unknown): HrPositionWorkArrangement {
  if (value === 'remote' || value === 'hybrid' || value === 'onsite') {
    return value
  }
  return 'hybrid'
}

function normalizeEmploymentType(value: unknown): HrPositionEmploymentType {
  if (
    value === 'full_time' ||
    value === 'part_time' ||
    value === 'contract' ||
    value === 'internship'
  ) {
    return value
  }
  return 'full_time'
}

function normalizeStage(value: unknown): HrApplicationStage {
  if (typeof value === 'string' && isHrApplicationStage(value)) {
    return value
  }
  return 'uploaded'
}

export function toHrPositionRow(row: RawRow): HrPositionRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    title: String(row.title ?? ''),
    department: String(row.department ?? ''),
    location: String(row.location ?? ''),
    arrangement: normalizeArrangement(row.arrangement),
    employmentType: normalizeEmploymentType(row.employment_type),
    status: normalizeStatus(row.status),
    description: String(row.description ?? ''),
    hiringManager: String(row.hiring_manager ?? ''),
    compensation: String(row.compensation ?? ''),
    tags: toStringArray(row.tags),
    recommendedEvaluationKinds: toEvaluationKindArray(
      row.recommended_evaluation_kinds,
    ),
    descriptionEmbedding: toEmbeddingArray(row.description_embedding),
    descriptionEmbeddingModel: toStringOrNull(row.description_embedding_model),
    descriptionEmbeddingDimensions: toNumberOrNull(
      row.description_embedding_dimensions,
    ),
    descriptionEmbeddingUpdatedAt: toNumberOrNull(
      row.description_embedding_updated_at,
    ),
    archivedAt: toNumberOrNull(row.archived_at),
    archivedBy: toStringOrNull(row.archived_by),
    createdAt: toNumberOrNull(row.created_at) ?? Date.now(),
    updatedAt: toNumberOrNull(row.updated_at) ?? Date.now(),
    createdBy: String(row.created_by ?? ''),
  }
}

export function toHrCandidateRow(row: RawRow): HrCandidateRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    normalizedEmail: toStringOrNull(row.normalized_email),
    email: toStringOrNull(row.email),
    displayName: String(row.display_name ?? ''),
    phone: toStringOrNull(row.phone),
    latestCvAttachmentId: toStringOrNull(row.latest_cv_attachment_id),
    latestCvText: toStringOrNull(row.latest_cv_text),
    latestCvEmbedding: toEmbeddingArray(row.latest_cv_embedding),
    latestCvEmbeddingModel: toStringOrNull(row.latest_cv_embedding_model),
    latestCvEmbeddingDimensions: toNumberOrNull(
      row.latest_cv_embedding_dimensions,
    ),
    latestCvIndexedAt: toNumberOrNull(row.latest_cv_indexed_at),
    aliases: toAliasArray(row.aliases),
    tags: toStringArray(row.tags),
    mergedIntoCandidateId: toStringOrNull(row.merged_into_candidate_id),
    needsContactReview: toBooleanOrFalse(row.needs_contact_review),
    archivedAt: toNumberOrNull(row.archived_at),
    archivedBy: toStringOrNull(row.archived_by),
    notes: toStringOrNull(row.notes),
    location: toStringOrNull(row.location),
    headline: toStringOrNull(row.headline),
    summary: toStringOrNull(row.summary),
    yearsOfExperience: toNumberOrNull(row.years_of_experience),
    skills: toStringArray(row.skills),
    languages: toStringArray(row.languages),
    highestDegree: toStringOrNull(row.highest_degree),
    profileSource: toStringOrNull(row.profile_source),
    createdAt: toNumberOrNull(row.created_at) ?? Date.now(),
    updatedAt: toNumberOrNull(row.updated_at) ?? Date.now(),
  }
}

export function toHrApplicationRow(row: RawRow): HrApplicationRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    candidateId: String(row.candidate_id),
    positionId: String(row.position_id),
    stage: normalizeStage(row.stage),
    affinityScore: toNumberOrNull(row.affinity_score),
    affinityRationale: toStringOrNull(row.affinity_rationale),
    affinitySignals: toJsonObjectOrNull(row.affinity_signals),
    affinityModel: toStringOrNull(row.affinity_model),
    cvAttachmentId: toStringOrNull(row.cv_attachment_id),
    cvText: toStringOrNull(row.cv_text),
    cvEmbedding: toEmbeddingArray(row.cv_embedding),
    cvEmbeddingModel: toStringOrNull(row.cv_embedding_model),
    workflowRunId: toStringOrNull(row.workflow_run_id),
    lastTransitionAt: toNumberOrNull(row.last_transition_at),
    lastError: toStringOrNull(row.last_error),
    rejectionReason: toStringOrNull(row.rejection_reason),
    hiredAt: toNumberOrNull(row.hired_at),
    archivedAt: toNumberOrNull(row.archived_at),
    archivedBy: toStringOrNull(row.archived_by),
    createdAt: toNumberOrNull(row.created_at) ?? Date.now(),
    updatedAt: toNumberOrNull(row.updated_at) ?? Date.now(),
  }
}

export function toHrEvaluationDispatchRow(
  row: RawRow,
): HrEvaluationDispatchRow {
  const status = (() => {
    if (
      row.status === 'sent' ||
      row.status === 'completed' ||
      row.status === 'expired' ||
      row.status === 'cancelled'
    ) {
      return row.status
    }
    return 'sent' as const
  })()
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    applicationId: String(row.application_id),
    evaluationCatalogId: String(row.evaluation_catalog_id),
    dispatchedVia: String(row.dispatched_via ?? 'inline_link'),
    status,
    resumeHookToken: toStringOrNull(row.resume_hook_token),
    idempotencyKey: String(row.idempotency_key ?? ''),
    expiresAt: toNumberOrNull(row.expires_at),
    dispatchedAt: toNumberOrNull(row.dispatched_at) ?? Date.now(),
    completedAt: toNumberOrNull(row.completed_at),
    completionUrl: toStringOrNull(row.completion_url),
    createdAt: toNumberOrNull(row.created_at) ?? Date.now(),
    updatedAt: toNumberOrNull(row.updated_at) ?? Date.now(),
  }
}

/** Wrap a value for an `@effect/sql-pg` JSON column. */
export function jsonValue(client: UpstreamSqlClient, value: unknown) {
  return sqlJson(client, value)
}

export function runQuery<TRow>(input: {
  readonly run: () => Promise<readonly TRow[]>
  readonly toError: (cause: unknown) => Error
}): Effect.Effect<readonly TRow[], Error> {
  return Effect.tryPromise({
    try: input.run,
    catch: input.toError,
  })
}
