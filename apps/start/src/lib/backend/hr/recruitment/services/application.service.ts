import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import {
  HR_TERMINAL_APPLICATION_STAGES,
  isHrApplicationSource,
  isHrApplicationStage,
  normalizeAffinityRationale,
  normalizeApplicationStage,
  normalizeCvText,
  normalizeTextField,
  sanitizeCvForEmbedding,
} from '@/lib/shared/hr/recruitment'
import type {
  HrApplicationSource,
  HrApplicationStage,
} from '@/lib/shared/hr/recruitment'
import {
  HrApplicationNotFoundError,
  HrApplicationStageConflictError,
  HrCrossOrgAccessError,
  HrPersistenceError,
} from '../domain/errors'
import type { HrApplicationRow } from '../domain/types'
import { jsonValue, toHrApplicationRow } from './persistence'

export type CreateApplicationInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly candidateId: string
  readonly positionId: string
  readonly cvAttachmentId: string | null
  readonly cvText: string | null
  readonly source?: HrApplicationSource
}

export type SetApplicationStageInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly applicationId: string
  readonly expectedStage?: HrApplicationStage
  readonly nextStage: HrApplicationStage
  readonly rejectionReason?: string
  readonly lastError?: string
  readonly hiredAt?: number
}

export type SetApplicationAffinityInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly applicationId: string
  readonly score: number
  readonly rationale?: string
  readonly signals?: Record<string, string | number | boolean | null>
  readonly model: string
  readonly embedding?: readonly number[]
  readonly embeddingModel?: string
  readonly aiProfileSnapshot?: Record<
    string,
    string | number | boolean | null
  > | null
}

export type AttachWorkflowRunInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly applicationId: string
  readonly workflowRunId: string
}

export type ArchiveApplicationInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly applicationId: string
  readonly userId: string
  readonly archive: boolean
}

export type HrApplicationServiceShape = {
  readonly create: (
    input: CreateApplicationInput,
  ) => Effect.Effect<HrApplicationRow, HrPersistenceError>
  readonly findById: (input: {
    readonly organizationId: string
    readonly applicationId: string
    readonly requestId: string
  }) => Effect.Effect<
    HrApplicationRow,
    HrApplicationNotFoundError | HrPersistenceError | HrCrossOrgAccessError
  >
  readonly listForPosition: (input: {
    readonly organizationId: string
    readonly requestId: string
    readonly positionId: string
    readonly includeArchived?: boolean
  }) => Effect.Effect<readonly HrApplicationRow[], HrPersistenceError>
  readonly listForCandidate: (input: {
    readonly organizationId: string
    readonly requestId: string
    readonly candidateId: string
  }) => Effect.Effect<readonly HrApplicationRow[], HrPersistenceError>
  readonly setStage: (
    input: SetApplicationStageInput,
  ) => Effect.Effect<
    HrApplicationRow,
    | HrApplicationNotFoundError
    | HrApplicationStageConflictError
    | HrPersistenceError
    | HrCrossOrgAccessError
  >
  readonly setAffinity: (
    input: SetApplicationAffinityInput,
  ) => Effect.Effect<
    HrApplicationRow,
    HrApplicationNotFoundError | HrPersistenceError | HrCrossOrgAccessError
  >
  readonly attachWorkflowRun: (
    input: AttachWorkflowRunInput,
  ) => Effect.Effect<
    HrApplicationRow,
    HrApplicationNotFoundError | HrPersistenceError | HrCrossOrgAccessError
  >
  readonly archive: (
    input: ArchiveApplicationInput,
  ) => Effect.Effect<
    HrApplicationRow,
    HrApplicationNotFoundError | HrPersistenceError | HrCrossOrgAccessError
  >
  /**
   * Debug-only: hard-delete every application + dependent row for a
   * position so a fresh test cycle can run against the same position
   * without stale data. The candidate rows themselves stay so we keep
   * the long-lived candidate dedup history intact.
   */
  readonly hardDeleteForPosition: (input: {
    readonly organizationId: string
    readonly requestId: string
    readonly positionId: string
  }) => Effect.Effect<{ readonly deleted: number }, HrPersistenceError>
}

function toPersistenceError(input: {
  readonly organizationId: string
  readonly requestId: string
  readonly operation: string
  readonly message: string
  readonly cause?: unknown
}) {
  return new HrPersistenceError({
    message: input.message,
    operation: input.operation,
    organizationId: input.organizationId,
    requestId: input.requestId,
    cause: input.cause ? String(input.cause) : undefined,
  })
}

function toCrossOrg(input: {
  readonly organizationId: string
  readonly requestId: string
  readonly resourceId: string
  readonly actualOrganizationId?: string
}) {
  return new HrCrossOrgAccessError({
    message: `Application ${input.resourceId} does not belong to organization ${input.organizationId}.`,
    organizationId: input.organizationId,
    requestId: input.requestId,
    resource: 'hr_application',
    resourceId: input.resourceId,
    actualOrganizationId: input.actualOrganizationId,
  })
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

function normalizeApplicationSource(
  source: HrApplicationSource | undefined,
): HrApplicationSource {
  if (source && isHrApplicationSource(source)) return source
  return 'Manual'
}

type ApplicationRawRow = Record<string, unknown>

export class HrApplicationService extends ServiceMap.Service<
  HrApplicationService,
  HrApplicationServiceShape
>()('hr/recruitment/HrApplicationService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient

      const findByIdInternal = Effect.fn(
        'HrApplicationService.findById.internal',
      )(
        (input: {
          readonly organizationId: string
          readonly applicationId: string
          readonly requestId: string
        }): Effect.Effect<
          HrApplicationRow,
          | HrApplicationNotFoundError
          | HrPersistenceError
          | HrCrossOrgAccessError
        > =>
          Effect.gen(function* () {
            const rows = yield* client<ApplicationRawRow>`
              select * from hr_application
              where id = ${input.applicationId}
              limit 1
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'findApplicationById',
                  message: 'Failed to load application.',
                  cause,
                }),
              ),
            )
            const [row] = rows
            if (!row) {
              return yield* Effect.fail(
                new HrApplicationNotFoundError({
                  message: `Application ${input.applicationId} not found.`,
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  applicationId: input.applicationId,
                }),
              )
            }
            const application = toHrApplicationRow(row)
            if (application.organizationId !== input.organizationId) {
              return yield* Effect.fail(
                toCrossOrg({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  resourceId: input.applicationId,
                  actualOrganizationId: application.organizationId,
                }),
              )
            }
            return application
          }),
      )

      const create: HrApplicationServiceShape['create'] = Effect.fn(
        'HrApplicationService.create',
      )((input) =>
        Effect.gen(function* () {
          const id = crypto.randomUUID()
          const now = Date.now()
          const cvText = normalizeCvText(input.cvText)
          const source = normalizeApplicationSource(input.source)
          const rows = yield* client<ApplicationRawRow>`
            insert into hr_application (
              id, organization_id, candidate_id, position_id,
              stage,
              affinity_score, affinity_rationale, affinity_signals, affinity_model,
              cv_attachment_id, cv_text, source, cv_embedding, cv_embedding_model,
              workflow_run_id, last_transition_at, last_error,
              rejection_reason, hired_at, archived_at, archived_by,
              created_at, updated_at
            )
            values (
              ${id}, ${input.organizationId}, ${input.candidateId}, ${input.positionId},
              'uploaded',
              null, null, null, null,
              ${input.cvAttachmentId}, ${cvText ? sanitizeCvForEmbedding(cvText) : null}, ${source}, null, null,
              null, ${now}, null,
              null, null, null, null,
              ${now}, ${now}
            )
            on conflict (position_id, candidate_id) do update set
              cv_attachment_id = excluded.cv_attachment_id,
              cv_text = excluded.cv_text,
              source = excluded.source,
              updated_at = excluded.updated_at
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'createApplication',
                message: 'Failed to create application.',
                cause,
              }),
            ),
          )
          const [row] = rows
          if (!row) {
            return yield* Effect.fail(
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'createApplication',
                message: 'Insert returned no row.',
              }),
            )
          }
          return toHrApplicationRow(row)
        }),
      )

      const setStage: HrApplicationServiceShape['setStage'] = Effect.fn(
        'HrApplicationService.setStage',
      )((input) =>
        Effect.gen(function* () {
          const existing = yield* findByIdInternal({
            organizationId: input.organizationId,
            requestId: input.requestId,
            applicationId: input.applicationId,
          })
          if (
            input.expectedStage &&
            existing.stage !== input.expectedStage &&
            !HR_TERMINAL_APPLICATION_STAGES.has(existing.stage)
          ) {
            return yield* Effect.fail(
              new HrApplicationStageConflictError({
                message: `Application is in stage ${existing.stage}; expected ${input.expectedStage}.`,
                organizationId: input.organizationId,
                requestId: input.requestId,
                applicationId: input.applicationId,
                expectedStage: input.expectedStage,
                actualStage: existing.stage,
              }),
            )
          }
          const stage = isHrApplicationStage(input.nextStage)
            ? input.nextStage
            : normalizeApplicationStage(input.nextStage)
          const now = Date.now()
          const rejectionReason =
            stage === 'rejected'
              ? normalizeTextField(
                  input.rejectionReason ?? existing.rejectionReason ?? '',
                )
              : null
          const lastError =
            input.lastError !== undefined
              ? normalizeTextField(input.lastError)
              : existing.lastError
          const hiredAt = stage === 'hired' ? (input.hiredAt ?? now) : null

          const rows = yield* client<ApplicationRawRow>`
            update hr_application
            set
              stage = ${stage},
              last_transition_at = ${now},
              rejection_reason = ${rejectionReason},
              last_error = ${lastError},
              hired_at = ${hiredAt},
              updated_at = ${now}
            where id = ${input.applicationId}
              and organization_id = ${input.organizationId}
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'setApplicationStage',
                message: 'Failed to update application stage.',
                cause,
              }),
            ),
          )
          const [row] = rows
          if (!row) {
            return yield* Effect.fail(
              new HrApplicationNotFoundError({
                message: `Application ${input.applicationId} not found.`,
                organizationId: input.organizationId,
                requestId: input.requestId,
                applicationId: input.applicationId,
              }),
            )
          }
          return toHrApplicationRow(row)
        }),
      )

      const setAffinity: HrApplicationServiceShape['setAffinity'] = Effect.fn(
        'HrApplicationService.setAffinity',
      )((input) =>
        Effect.gen(function* () {
          yield* findByIdInternal({
            organizationId: input.organizationId,
            requestId: input.requestId,
            applicationId: input.applicationId,
          })
          const now = Date.now()
          const rows = yield* client<ApplicationRawRow>`
            update hr_application
            set
              affinity_score = ${clampScore(input.score)},
              affinity_rationale = ${input.rationale ? normalizeAffinityRationale(input.rationale) : null},
              affinity_signals = ${
                input.signals ? jsonValue(client, input.signals) : null
              },
              ai_profile_snapshot = ${
                input.aiProfileSnapshot
                  ? jsonValue(client, input.aiProfileSnapshot)
                  : null
              },
              ai_signals = ${
                input.signals ? jsonValue(client, input.signals) : null
              },
              affinity_model = ${input.model},
              cv_embedding = COALESCE(${
                input.embedding ? jsonValue(client, input.embedding) : null
              }, cv_embedding),
              cv_embedding_model = COALESCE(${input.embeddingModel ?? null}, cv_embedding_model),
              updated_at = ${now}
            where id = ${input.applicationId}
              and organization_id = ${input.organizationId}
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'setApplicationAffinity',
                message: 'Failed to record affinity score.',
                cause,
              }),
            ),
          )
          const [row] = rows
          if (!row) {
            return yield* Effect.fail(
              new HrApplicationNotFoundError({
                message: `Application ${input.applicationId} not found.`,
                organizationId: input.organizationId,
                requestId: input.requestId,
                applicationId: input.applicationId,
              }),
            )
          }
          return toHrApplicationRow(row)
        }),
      )

      const attachWorkflowRun: HrApplicationServiceShape['attachWorkflowRun'] =
        Effect.fn('HrApplicationService.attachWorkflowRun')((input) =>
          Effect.gen(function* () {
            yield* findByIdInternal({
              organizationId: input.organizationId,
              requestId: input.requestId,
              applicationId: input.applicationId,
            })
            const now = Date.now()
            const rows = yield* client<ApplicationRawRow>`
              update hr_application
              set workflow_run_id = ${input.workflowRunId}, updated_at = ${now}
              where id = ${input.applicationId}
                and organization_id = ${input.organizationId}
              returning *
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'attachWorkflowRun',
                  message: 'Failed to attach workflow run id.',
                  cause,
                }),
              ),
            )
            const [row] = rows
            if (!row) {
              return yield* Effect.fail(
                new HrApplicationNotFoundError({
                  message: `Application ${input.applicationId} not found.`,
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  applicationId: input.applicationId,
                }),
              )
            }
            return toHrApplicationRow(row)
          }),
        )

      const listForPosition: HrApplicationServiceShape['listForPosition'] =
        Effect.fn('HrApplicationService.listForPosition')((input) =>
          Effect.gen(function* () {
            const archivedClause = client.literal(
              input.includeArchived ? 'TRUE' : 'archived_at is null',
            )
            const rows = yield* client<ApplicationRawRow>`
              select * from hr_application
              where organization_id = ${input.organizationId}
                and position_id = ${input.positionId}
                and ${archivedClause}
              order by
                affinity_score desc nulls last,
                updated_at desc
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'listApplicationsForPosition',
                  message: 'Failed to list applications.',
                  cause,
                }),
              ),
            )
            return rows.map(toHrApplicationRow)
          }),
        )

      const listForCandidate: HrApplicationServiceShape['listForCandidate'] =
        Effect.fn('HrApplicationService.listForCandidate')((input) =>
          Effect.gen(function* () {
            const rows = yield* client<ApplicationRawRow>`
              select * from hr_application
              where organization_id = ${input.organizationId}
                and candidate_id = ${input.candidateId}
              order by updated_at desc
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'listApplicationsForCandidate',
                  message: 'Failed to list applications.',
                  cause,
                }),
              ),
            )
            return rows.map(toHrApplicationRow)
          }),
        )

      const archive: HrApplicationServiceShape['archive'] = Effect.fn(
        'HrApplicationService.archive',
      )((input) =>
        Effect.gen(function* () {
          yield* findByIdInternal({
            organizationId: input.organizationId,
            requestId: input.requestId,
            applicationId: input.applicationId,
          })
          const now = Date.now()
          const rows = yield* client<ApplicationRawRow>`
            update hr_application
            set
              archived_at = ${input.archive ? now : null},
              archived_by = ${input.archive ? input.userId : null},
              updated_at = ${now}
            where id = ${input.applicationId}
              and organization_id = ${input.organizationId}
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'archiveApplication',
                message: 'Failed to archive application.',
                cause,
              }),
            ),
          )
          const [row] = rows
          if (!row) {
            return yield* Effect.fail(
              new HrApplicationNotFoundError({
                message: `Application ${input.applicationId} not found.`,
                organizationId: input.organizationId,
                requestId: input.requestId,
                applicationId: input.applicationId,
              }),
            )
          }
          return toHrApplicationRow(row)
        }),
      )

      const hardDeleteForPosition: HrApplicationServiceShape['hardDeleteForPosition'] =
        Effect.fn('HrApplicationService.hardDeleteForPosition')((input) =>
          Effect.gen(function* () {
            yield* client`
              delete from hr_evaluation_response
              where organization_id = ${input.organizationId}
                and application_id in (
                  select id from hr_application
                  where organization_id = ${input.organizationId}
                    and position_id = ${input.positionId}
                )
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'hardDeleteApplicationsForPosition.responses',
                  message: 'Failed to delete evaluation responses.',
                  cause,
                }),
              ),
            )
            yield* client`
              delete from hr_evaluation_dispatch
              where organization_id = ${input.organizationId}
                and application_id in (
                  select id from hr_application
                  where organization_id = ${input.organizationId}
                    and position_id = ${input.positionId}
                )
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'hardDeleteApplicationsForPosition.dispatches',
                  message: 'Failed to delete evaluation dispatches.',
                  cause,
                }),
              ),
            )
            yield* client`
              delete from hr_background_check
              where organization_id = ${input.organizationId}
                and application_id in (
                  select id from hr_application
                  where organization_id = ${input.organizationId}
                    and position_id = ${input.positionId}
                )
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'hardDeleteApplicationsForPosition.bgChecks',
                  message: 'Failed to delete background checks.',
                  cause,
                }),
              ),
            )
            const deletedRows = yield* client<{ count: string | number }>`
              with deleted as (
                delete from hr_application
                where organization_id = ${input.organizationId}
                  and position_id = ${input.positionId}
                returning id
              )
              select count(*)::int as count from deleted
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'hardDeleteApplicationsForPosition.applications',
                  message: 'Failed to delete applications.',
                  cause,
                }),
              ),
            )
            const [row] = deletedRows
            const deleted =
              typeof row?.count === 'number'
                ? row.count
                : Number(row?.count ?? 0)
            return { deleted: Number.isFinite(deleted) ? deleted : 0 }
          }),
        )

      return {
        create,
        findById: findByIdInternal,
        listForPosition,
        listForCandidate,
        setStage,
        setAffinity,
        attachWorkflowRun,
        archive,
        hardDeleteForPosition,
      } satisfies HrApplicationServiceShape
    }),
  )

  /** In-memory implementation for orchestration tests. */
  static readonly layerMemory = Layer.sync(this, () => {
    const rows = new Map<string, HrApplicationRow>()

    const ensureSameOrg = (
      organizationId: string,
      requestId: string,
      applicationId: string,
    ): Effect.Effect<
      HrApplicationRow,
      HrApplicationNotFoundError | HrCrossOrgAccessError
    > => {
      const row = rows.get(applicationId)
      if (!row) {
        return Effect.fail(
          new HrApplicationNotFoundError({
            message: `Application ${applicationId} not found.`,
            organizationId,
            requestId,
            applicationId,
          }),
        )
      }
      if (row.organizationId !== organizationId) {
        return Effect.fail(
          toCrossOrg({
            organizationId,
            requestId,
            resourceId: applicationId,
            actualOrganizationId: row.organizationId,
          }),
        )
      }
      return Effect.succeed(row)
    }

    return {
      create: Effect.fn('HrApplicationService.create.memory')((input) =>
        Effect.sync(() => {
          const existing = Array.from(rows.values()).find(
            (row) =>
              row.organizationId === input.organizationId &&
              row.candidateId === input.candidateId &&
              row.positionId === input.positionId,
          )
          const cvText = normalizeCvText(input.cvText)
          const source = normalizeApplicationSource(input.source)
          const now = Date.now()
          if (existing) {
            const updated: HrApplicationRow = {
              ...existing,
              cvAttachmentId: input.cvAttachmentId ?? existing.cvAttachmentId,
              cvText: cvText ?? existing.cvText,
              source,
              updatedAt: now,
            }
            rows.set(existing.id, updated)
            return updated
          }
          const id = crypto.randomUUID()
          const next: HrApplicationRow = {
            id,
            organizationId: input.organizationId,
            candidateId: input.candidateId,
            positionId: input.positionId,
            stage: 'uploaded',
            affinityScore: null,
            affinityRationale: null,
            affinitySignals: null,
            affinityModel: null,
            cvAttachmentId: input.cvAttachmentId,
            cvText: cvText ? sanitizeCvForEmbedding(cvText) : null,
            source,
            cvEmbedding: null,
            cvEmbeddingModel: null,
            workflowRunId: null,
            lastTransitionAt: now,
            lastError: null,
            rejectionReason: null,
            hiredAt: null,
            archivedAt: null,
            archivedBy: null,
            createdAt: now,
            updatedAt: now,
          }
          rows.set(id, next)
          return next
        }),
      ),
      findById: Effect.fn('HrApplicationService.findById.memory')((input) =>
        ensureSameOrg(
          input.organizationId,
          input.requestId,
          input.applicationId,
        ),
      ),
      listForPosition: Effect.fn('HrApplicationService.listForPosition.memory')(
        (input) =>
          Effect.succeed(
            Array.from(rows.values())
              .filter((row) => row.organizationId === input.organizationId)
              .filter((row) => row.positionId === input.positionId)
              .filter((row) =>
                input.includeArchived ? true : row.archivedAt === null,
              )
              .sort((a, b) => {
                const left = a.affinityScore ?? -1
                const right = b.affinityScore ?? -1
                if (left !== right) return right - left
                return b.updatedAt - a.updatedAt
              }),
          ),
      ),
      listForCandidate: Effect.fn(
        'HrApplicationService.listForCandidate.memory',
      )((input) =>
        Effect.succeed(
          Array.from(rows.values())
            .filter((row) => row.organizationId === input.organizationId)
            .filter((row) => row.candidateId === input.candidateId)
            .sort((a, b) => b.updatedAt - a.updatedAt),
        ),
      ),
      setStage: Effect.fn('HrApplicationService.setStage.memory')((input) =>
        Effect.gen(function* () {
          const existing = yield* ensureSameOrg(
            input.organizationId,
            input.requestId,
            input.applicationId,
          )
          if (
            input.expectedStage &&
            existing.stage !== input.expectedStage &&
            !HR_TERMINAL_APPLICATION_STAGES.has(existing.stage)
          ) {
            return yield* Effect.fail(
              new HrApplicationStageConflictError({
                message: `Application is in stage ${existing.stage}; expected ${input.expectedStage}.`,
                organizationId: input.organizationId,
                requestId: input.requestId,
                applicationId: input.applicationId,
                expectedStage: input.expectedStage,
                actualStage: existing.stage,
              }),
            )
          }
          const next: HrApplicationRow = {
            ...existing,
            stage: input.nextStage,
            rejectionReason:
              input.nextStage === 'rejected'
                ? normalizeTextField(
                    input.rejectionReason ?? existing.rejectionReason ?? '',
                  )
                : null,
            lastError:
              input.lastError !== undefined
                ? normalizeTextField(input.lastError)
                : existing.lastError,
            hiredAt:
              input.nextStage === 'hired'
                ? (input.hiredAt ?? Date.now())
                : null,
            lastTransitionAt: Date.now(),
            updatedAt: Date.now(),
          }
          rows.set(existing.id, next)
          return next
        }),
      ),
      setAffinity: Effect.fn('HrApplicationService.setAffinity.memory')(
        (input) =>
          Effect.gen(function* () {
            const existing = yield* ensureSameOrg(
              input.organizationId,
              input.requestId,
              input.applicationId,
            )
            const next: HrApplicationRow = {
              ...existing,
              affinityScore: clampScore(input.score),
              affinityRationale: input.rationale
                ? normalizeAffinityRationale(input.rationale)
                : null,
              affinitySignals: input.signals ?? null,
              affinityModel: input.model,
              cvEmbedding: input.embedding
                ? Array.from(input.embedding)
                : existing.cvEmbedding,
              cvEmbeddingModel:
                input.embeddingModel ?? existing.cvEmbeddingModel,
              updatedAt: Date.now(),
            }
            rows.set(existing.id, next)
            return next
          }),
      ),
      attachWorkflowRun: Effect.fn(
        'HrApplicationService.attachWorkflowRun.memory',
      )((input) =>
        Effect.gen(function* () {
          const existing = yield* ensureSameOrg(
            input.organizationId,
            input.requestId,
            input.applicationId,
          )
          const next: HrApplicationRow = {
            ...existing,
            workflowRunId: input.workflowRunId,
            updatedAt: Date.now(),
          }
          rows.set(existing.id, next)
          return next
        }),
      ),
      archive: Effect.fn('HrApplicationService.archive.memory')((input) =>
        Effect.gen(function* () {
          const existing = yield* ensureSameOrg(
            input.organizationId,
            input.requestId,
            input.applicationId,
          )
          const now = Date.now()
          const next: HrApplicationRow = {
            ...existing,
            archivedAt: input.archive ? now : null,
            archivedBy: input.archive ? input.userId : null,
            updatedAt: now,
          }
          rows.set(existing.id, next)
          return next
        }),
      ),
      hardDeleteForPosition: Effect.fn(
        'HrApplicationService.hardDeleteForPosition.memory',
      )((input) =>
        Effect.sync(() => {
          let deleted = 0
          for (const [id, row] of rows.entries()) {
            if (
              row.organizationId === input.organizationId &&
              row.positionId === input.positionId
            ) {
              rows.delete(id)
              deleted += 1
            }
          }
          return { deleted }
        }),
      ),
    } satisfies HrApplicationServiceShape
  })
}
