import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import {
  getRecommendedEvaluationKinds,
  normalizeArrangement,
  normalizeEmploymentType,
  normalizePositionDescription,
  normalizePositionStatus,
  normalizePositionTitle,
  normalizeTags,
  normalizeTextField,
} from '@/lib/shared/hr/recruitment'
import type {
  HrEvaluationKind,
  HrPositionEmploymentType,
  HrPositionStatus,
  HrPositionWorkArrangement,
} from '@/lib/shared/hr/recruitment'
import {
  HrCrossOrgAccessError,
  HrPersistenceError,
  HrPositionNotFoundError,
  HrRecruitmentInvalidInputError,
} from '../domain/errors'
import type { HrPositionRow } from '../domain/types'
import { jsonValue, toHrPositionRow } from './persistence'

/**
 * Position service.
 */

export type CreatePositionInput = {
  readonly organizationId: string
  readonly userId: string
  readonly requestId: string
  readonly title: string
  readonly department?: string
  readonly location?: string
  readonly arrangement?: HrPositionWorkArrangement | string
  readonly employmentType?: HrPositionEmploymentType | string
  readonly status?: HrPositionStatus | string
  readonly hiringManager?: string
  readonly compensation?: string
  readonly description?: string
  readonly tags?: readonly string[]
}

export type UpdatePositionInput = {
  readonly organizationId: string
  readonly userId: string
  readonly requestId: string
  readonly positionId: string
  readonly title?: string
  readonly department?: string
  readonly location?: string
  readonly arrangement?: HrPositionWorkArrangement | string
  readonly employmentType?: HrPositionEmploymentType | string
  readonly status?: HrPositionStatus | string
  readonly hiringManager?: string
  readonly compensation?: string
  readonly description?: string
  readonly tags?: readonly string[]
}

export type ListPositionsInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly includeArchived?: boolean
  readonly statuses?: readonly HrPositionStatus[]
}

export type ArchivePositionInput = {
  readonly organizationId: string
  readonly positionId: string
  readonly userId: string
  readonly requestId: string
  readonly archive: boolean
}

export type HrPositionServiceShape = {
  readonly create: (
    input: CreatePositionInput,
  ) => Effect.Effect<
    HrPositionRow,
    HrRecruitmentInvalidInputError | HrPersistenceError
  >
  readonly update: (
    input: UpdatePositionInput,
  ) => Effect.Effect<
    HrPositionRow,
    | HrRecruitmentInvalidInputError
    | HrPositionNotFoundError
    | HrPersistenceError
    | HrCrossOrgAccessError
  >
  readonly archive: (
    input: ArchivePositionInput,
  ) => Effect.Effect<
    HrPositionRow,
    HrPositionNotFoundError | HrPersistenceError | HrCrossOrgAccessError
  >
  readonly list: (
    input: ListPositionsInput,
  ) => Effect.Effect<readonly HrPositionRow[], HrPersistenceError>
  readonly findById: (input: {
    readonly organizationId: string
    readonly positionId: string
    readonly requestId: string
  }) => Effect.Effect<
    HrPositionRow,
    HrPositionNotFoundError | HrPersistenceError | HrCrossOrgAccessError
  >
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
  readonly resource: string
  readonly resourceId: string
  readonly actualOrganizationId?: string
}) {
  return new HrCrossOrgAccessError({
    message: `Resource ${input.resource}:${input.resourceId} does not belong to organization ${input.organizationId}.`,
    organizationId: input.organizationId,
    requestId: input.requestId,
    resource: input.resource,
    resourceId: input.resourceId,
    actualOrganizationId: input.actualOrganizationId,
  })
}

function buildRecommendedEvaluationKinds(input: {
  readonly title: string
  readonly department: string
  readonly tags: readonly string[]
}): readonly HrEvaluationKind[] {
  return getRecommendedEvaluationKinds({
    title: input.title,
    department: input.department,
    tags: input.tags,
  })
}

type PositionRawRow = Record<string, unknown>

export class HrPositionService extends ServiceMap.Service<
  HrPositionService,
  HrPositionServiceShape
>()('hr/recruitment/HrPositionService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient

      const findByIdInternal = Effect.fn('HrPositionService.findById.internal')(
        (input: {
          readonly organizationId: string
          readonly positionId: string
          readonly requestId: string
        }) =>
          Effect.gen(function* () {
            const rows = yield* client<PositionRawRow>`
              select * from hr_position
              where id = ${input.positionId}
              limit 1
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'findPositionById',
                  message: 'Failed to load position.',
                  cause,
                }),
              ),
            )
            const [row] = rows
            if (!row) {
              return yield* Effect.fail(
                new HrPositionNotFoundError({
                  message: `Position ${input.positionId} not found.`,
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  positionId: input.positionId,
                }),
              )
            }
            const position = toHrPositionRow(row)
            if (position.organizationId !== input.organizationId) {
              return yield* Effect.fail(
                toCrossOrg({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  resource: 'hr_position',
                  resourceId: input.positionId,
                  actualOrganizationId: position.organizationId,
                }),
              )
            }
            return position
          }),
      )

      const create: HrPositionServiceShape['create'] = Effect.fn(
        'HrPositionService.create',
      )((input) =>
        Effect.gen(function* () {
          const title = normalizePositionTitle(input.title)
          if (!title) {
            return yield* Effect.fail(
              new HrRecruitmentInvalidInputError({
                message: 'Position title is required.',
                organizationId: input.organizationId,
                requestId: input.requestId,
                field: 'title',
              }),
            )
          }

          const department = normalizeTextField(input.department)
          const location = normalizeTextField(input.location)
          const hiringManager = normalizeTextField(input.hiringManager)
          const compensation = normalizeTextField(input.compensation)
          const description = normalizePositionDescription(
            input.description ?? '',
          )
          const tags = normalizeTags(input.tags)
          const arrangement = normalizeArrangement(input.arrangement)
          const employmentType = normalizeEmploymentType(input.employmentType)
          const status = normalizePositionStatus(input.status)
          const recommendedEvaluationKinds = buildRecommendedEvaluationKinds({
            title,
            department,
            tags,
          })

          const id = crypto.randomUUID()
          const now = Date.now()

          const rows = yield* client<PositionRawRow>`
            insert into hr_position (
              id, organization_id, title, department, location,
              arrangement, employment_type, status, description,
              hiring_manager, compensation, tags, recommended_evaluation_kinds,
              archived_at, archived_by,
              created_at, updated_at, created_by
            )
            values (
              ${id}, ${input.organizationId}, ${title}, ${department}, ${location},
              ${arrangement}, ${employmentType}, ${status}, ${description},
              ${hiringManager}, ${compensation},
              ${jsonValue(client, tags)}, ${jsonValue(client, recommendedEvaluationKinds)},
              null, null,
              ${now}, ${now}, ${input.userId}
            )
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'createPosition',
                message: 'Failed to create position.',
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
                operation: 'createPosition',
                message: 'Insert returned no row.',
              }),
            )
          }
          return toHrPositionRow(row)
        }),
      )

      const findById: HrPositionServiceShape['findById'] = findByIdInternal

      const update: HrPositionServiceShape['update'] = Effect.fn(
        'HrPositionService.update',
      )((input) =>
        Effect.gen(function* () {
          const existing = yield* findByIdInternal({
            organizationId: input.organizationId,
            requestId: input.requestId,
            positionId: input.positionId,
          })

          const title =
            input.title !== undefined
              ? normalizePositionTitle(input.title)
              : existing.title
          if (!title) {
            return yield* Effect.fail(
              new HrRecruitmentInvalidInputError({
                message: 'Position title cannot be empty.',
                organizationId: input.organizationId,
                requestId: input.requestId,
                field: 'title',
              }),
            )
          }

          const department =
            input.department !== undefined
              ? normalizeTextField(input.department)
              : existing.department
          const location =
            input.location !== undefined
              ? normalizeTextField(input.location)
              : existing.location
          const hiringManager =
            input.hiringManager !== undefined
              ? normalizeTextField(input.hiringManager)
              : existing.hiringManager
          const compensation =
            input.compensation !== undefined
              ? normalizeTextField(input.compensation)
              : existing.compensation
          const description =
            input.description !== undefined
              ? normalizePositionDescription(input.description)
              : existing.description
          const tags =
            input.tags !== undefined ? normalizeTags(input.tags) : existing.tags
          const arrangement =
            input.arrangement !== undefined
              ? normalizeArrangement(input.arrangement)
              : existing.arrangement
          const employmentType =
            input.employmentType !== undefined
              ? normalizeEmploymentType(input.employmentType)
              : existing.employmentType
          const status =
            input.status !== undefined
              ? normalizePositionStatus(input.status)
              : existing.status
          const recommendedEvaluationKinds = buildRecommendedEvaluationKinds({
            title,
            department,
            tags,
          })
          const now = Date.now()

          const rows = yield* client<PositionRawRow>`
            update hr_position
            set
              title = ${title},
              department = ${department},
              location = ${location},
              arrangement = ${arrangement},
              employment_type = ${employmentType},
              status = ${status},
              description = ${description},
              hiring_manager = ${hiringManager},
              compensation = ${compensation},
              tags = ${jsonValue(client, tags)},
              recommended_evaluation_kinds = ${jsonValue(client, recommendedEvaluationKinds)},
              updated_at = ${now}
            where id = ${input.positionId}
              and organization_id = ${input.organizationId}
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'updatePosition',
                message: 'Failed to update position.',
                cause,
              }),
            ),
          )
          const [row] = rows
          if (!row) {
            return yield* Effect.fail(
              new HrPositionNotFoundError({
                message: `Position ${input.positionId} not found.`,
                organizationId: input.organizationId,
                requestId: input.requestId,
                positionId: input.positionId,
              }),
            )
          }
          return toHrPositionRow(row)
        }),
      )

      const archive: HrPositionServiceShape['archive'] = Effect.fn(
        'HrPositionService.archive',
      )((input) =>
        Effect.gen(function* () {
          yield* findByIdInternal({
            organizationId: input.organizationId,
            requestId: input.requestId,
            positionId: input.positionId,
          })
          const now = Date.now()
          const archivedAt = input.archive ? now : null
          const archivedBy = input.archive ? input.userId : null
          const status = input.archive ? 'archived' : 'paused'

          const rows = yield* client<PositionRawRow>`
            update hr_position
            set
              archived_at = ${archivedAt},
              archived_by = ${archivedBy},
              status = ${status},
              updated_at = ${now}
            where id = ${input.positionId}
              and organization_id = ${input.organizationId}
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'archivePosition',
                message: 'Failed to archive position.',
                cause,
              }),
            ),
          )
          const [row] = rows
          if (!row) {
            return yield* Effect.fail(
              new HrPositionNotFoundError({
                message: `Position ${input.positionId} not found.`,
                organizationId: input.organizationId,
                requestId: input.requestId,
                positionId: input.positionId,
              }),
            )
          }
          return toHrPositionRow(row)
        }),
      )

      const list: HrPositionServiceShape['list'] = Effect.fn(
        'HrPositionService.list',
      )((input) =>
        Effect.gen(function* () {
          const includeArchived = input.includeArchived === true
          const statusFilter = (input.statuses ?? []).filter(
            (status): status is HrPositionStatus =>
              status === 'draft' ||
              status === 'open' ||
              status === 'paused' ||
              status === 'filled' ||
              status === 'archived',
          )

          const archivedClause = client.literal(
            includeArchived ? 'TRUE' : 'archived_at is null',
          )

          const rows =
            statusFilter.length > 0
              ? yield* client<PositionRawRow>`
                  select * from hr_position
                  where organization_id = ${input.organizationId}
                    and ${archivedClause}
                    and status in ${client.in(statusFilter)}
                  order by updated_at desc
                `.pipe(
                  Effect.mapError((cause) =>
                    toPersistenceError({
                      organizationId: input.organizationId,
                      requestId: input.requestId,
                      operation: 'listPositions',
                      message: 'Failed to list positions.',
                      cause,
                    }),
                  ),
                )
              : yield* client<PositionRawRow>`
                  select * from hr_position
                  where organization_id = ${input.organizationId}
                    and ${archivedClause}
                  order by updated_at desc
                `.pipe(
                  Effect.mapError((cause) =>
                    toPersistenceError({
                      organizationId: input.organizationId,
                      requestId: input.requestId,
                      operation: 'listPositions',
                      message: 'Failed to list positions.',
                      cause,
                    }),
                  ),
                )

          return rows.map(toHrPositionRow)
        }),
      )

      return {
        create,
        findById,
        update,
        archive,
        list,
      } satisfies HrPositionServiceShape
    }),
  )

  /**
   * In-memory implementation for deterministic tests. Mirrors the real
   * service exactly: org isolation, archive flow, recommended test kinds.
   */
  static readonly layerMemory = Layer.sync(this, () => {
    const rows = new Map<string, HrPositionRow>()

    const ensureSameOrg = (
      organizationId: string,
      requestId: string,
      positionId: string,
    ): Effect.Effect<
      HrPositionRow,
      HrPositionNotFoundError | HrCrossOrgAccessError
    > => {
      const row = rows.get(positionId)
      if (!row) {
        return Effect.fail(
          new HrPositionNotFoundError({
            message: `Position ${positionId} not found.`,
            organizationId,
            requestId,
            positionId,
          }),
        )
      }
      if (row.organizationId !== organizationId) {
        return Effect.fail(
          toCrossOrg({
            organizationId,
            requestId,
            resource: 'hr_position',
            resourceId: positionId,
            actualOrganizationId: row.organizationId,
          }),
        )
      }
      return Effect.succeed(row)
    }

    return {
      create: Effect.fn('HrPositionService.create.memory')((input) =>
        Effect.gen(function* () {
          const title = normalizePositionTitle(input.title)
          if (!title) {
            return yield* Effect.fail(
              new HrRecruitmentInvalidInputError({
                message: 'Position title is required.',
                organizationId: input.organizationId,
                requestId: input.requestId,
                field: 'title',
              }),
            )
          }
          const id = crypto.randomUUID()
          const now = Date.now()
          const tags = normalizeTags(input.tags)
          const department = normalizeTextField(input.department)
          const next: HrPositionRow = {
            id,
            organizationId: input.organizationId,
            title,
            department,
            location: normalizeTextField(input.location),
            arrangement: normalizeArrangement(input.arrangement),
            employmentType: normalizeEmploymentType(input.employmentType),
            status: normalizePositionStatus(input.status),
            description: normalizePositionDescription(input.description ?? ''),
            hiringManager: normalizeTextField(input.hiringManager),
            compensation: normalizeTextField(input.compensation),
            tags,
            recommendedEvaluationKinds: buildRecommendedEvaluationKinds({
              title,
              department,
              tags,
            }),
            descriptionEmbedding: null,
            descriptionEmbeddingModel: null,
            descriptionEmbeddingDimensions: null,
            descriptionEmbeddingUpdatedAt: null,
            archivedAt: null,
            archivedBy: null,
            createdAt: now,
            updatedAt: now,
            createdBy: input.userId,
          }
          rows.set(id, next)
          return next
        }),
      ),
      findById: Effect.fn('HrPositionService.findById.memory')((input) =>
        ensureSameOrg(input.organizationId, input.requestId, input.positionId),
      ),
      update: Effect.fn('HrPositionService.update.memory')((input) =>
        Effect.gen(function* () {
          const existing = yield* ensureSameOrg(
            input.organizationId,
            input.requestId,
            input.positionId,
          )
          const title =
            input.title !== undefined
              ? normalizePositionTitle(input.title)
              : existing.title
          if (!title) {
            return yield* Effect.fail(
              new HrRecruitmentInvalidInputError({
                message: 'Position title cannot be empty.',
                organizationId: input.organizationId,
                requestId: input.requestId,
                field: 'title',
              }),
            )
          }
          const tags =
            input.tags !== undefined ? normalizeTags(input.tags) : existing.tags
          const department =
            input.department !== undefined
              ? normalizeTextField(input.department)
              : existing.department
          const next: HrPositionRow = {
            ...existing,
            title,
            department,
            location:
              input.location !== undefined
                ? normalizeTextField(input.location)
                : existing.location,
            arrangement:
              input.arrangement !== undefined
                ? normalizeArrangement(input.arrangement)
                : existing.arrangement,
            employmentType:
              input.employmentType !== undefined
                ? normalizeEmploymentType(input.employmentType)
                : existing.employmentType,
            status:
              input.status !== undefined
                ? normalizePositionStatus(input.status)
                : existing.status,
            description:
              input.description !== undefined
                ? normalizePositionDescription(input.description)
                : existing.description,
            hiringManager:
              input.hiringManager !== undefined
                ? normalizeTextField(input.hiringManager)
                : existing.hiringManager,
            compensation:
              input.compensation !== undefined
                ? normalizeTextField(input.compensation)
                : existing.compensation,
            tags,
            recommendedEvaluationKinds: buildRecommendedEvaluationKinds({
              title,
              department,
              tags,
            }),
            updatedAt: Date.now(),
          }
          rows.set(existing.id, next)
          return next
        }),
      ),
      archive: Effect.fn('HrPositionService.archive.memory')((input) =>
        Effect.gen(function* () {
          const existing = yield* ensureSameOrg(
            input.organizationId,
            input.requestId,
            input.positionId,
          )
          const now = Date.now()
          const next: HrPositionRow = {
            ...existing,
            archivedAt: input.archive ? now : null,
            archivedBy: input.archive ? input.userId : null,
            status: input.archive ? 'archived' : 'paused',
            updatedAt: now,
          }
          rows.set(existing.id, next)
          return next
        }),
      ),
      list: Effect.fn('HrPositionService.list.memory')((input) =>
        Effect.succeed(
          Array.from(rows.values())
            .filter((row) => row.organizationId === input.organizationId)
            .filter((row) =>
              input.includeArchived ? true : row.archivedAt === null,
            )
            .filter((row) =>
              input.statuses && input.statuses.length > 0
                ? input.statuses.includes(row.status)
                : true,
            )
            .sort((a, b) => b.updatedAt - a.updatedAt),
        ),
      ),
    } satisfies HrPositionServiceShape
  })
}
