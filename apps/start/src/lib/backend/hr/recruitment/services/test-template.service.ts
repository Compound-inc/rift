import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import {
  isHrTestKind,
  normalizeTestKind,
  normalizeTextField,
  HR_TEST_KIND_CATALOG,
} from '@/lib/shared/hr/recruitment'
import type { HrTestKind } from '@/lib/shared/hr/recruitment'
import {
  HrCrossOrgAccessError,
  HrPersistenceError,
  HrRecruitmentInvalidInputError,
  HrTestTemplateNotFoundError,
} from '../domain/errors'
import type { HrTestTemplateRow } from '../domain/types'
import { jsonValue, toHrTestTemplateRow } from './persistence'

/**
 * Test template service.
 *
 * Owns the per-org test catalog. Each org gets a baseline of built-in
 * test templates seeded the first time the recruitment addon is used,
 * and can clone or extend them. Built-in rows cannot be deleted (orgs
 * archive them instead) so the workflow can always reference a stable
 * canonical id when seeding new positions.
 */

const QUESTION_FIELD_LIMIT = 1000

function normalizeQuestions(
  value: unknown,
): readonly Record<string, string | number | boolean | null>[] {
  if (!Array.isArray(value)) return []
  const normalized: Record<string, string | number | boolean | null>[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const result: Record<string, string | number | boolean | null> = {}
    for (const [key, raw] of Object.entries(entry as Record<string, unknown>)) {
      if (key.length > QUESTION_FIELD_LIMIT) continue
      if (
        typeof raw === 'string' ||
        typeof raw === 'number' ||
        typeof raw === 'boolean' ||
        raw === null
      ) {
        result[key] = raw
      }
    }
    if (Object.keys(result).length > 0) normalized.push(result)
  }
  return normalized
}

export type EnsureBuiltInsInput = {
  readonly organizationId: string
  readonly requestId: string
}

export type CreateTestTemplateInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly kind: HrTestKind | string
  readonly title: string
  readonly description?: string
  readonly defaultPassingScore?: number
  readonly questions?: readonly Record<string, unknown>[]
}

export type UpdateTestTemplateInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly testTemplateId: string
  readonly title?: string
  readonly description?: string
  readonly defaultPassingScore?: number
  readonly questions?: readonly Record<string, unknown>[]
}

export type ArchiveTestTemplateInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly testTemplateId: string
  readonly archive: boolean
}

export type HrTestTemplateServiceShape = {
  readonly ensureBuiltInsForOrg: (
    input: EnsureBuiltInsInput,
  ) => Effect.Effect<readonly HrTestTemplateRow[], HrPersistenceError>
  readonly createCustom: (
    input: CreateTestTemplateInput,
  ) => Effect.Effect<
    HrTestTemplateRow,
    HrRecruitmentInvalidInputError | HrPersistenceError
  >
  readonly update: (
    input: UpdateTestTemplateInput,
  ) => Effect.Effect<
    HrTestTemplateRow,
    | HrTestTemplateNotFoundError
    | HrPersistenceError
    | HrCrossOrgAccessError
    | HrRecruitmentInvalidInputError
  >
  readonly archive: (
    input: ArchiveTestTemplateInput,
  ) => Effect.Effect<
    HrTestTemplateRow,
    HrTestTemplateNotFoundError | HrPersistenceError | HrCrossOrgAccessError
  >
  readonly findById: (input: {
    readonly organizationId: string
    readonly requestId: string
    readonly testTemplateId: string
  }) => Effect.Effect<
    HrTestTemplateRow,
    HrTestTemplateNotFoundError | HrPersistenceError | HrCrossOrgAccessError
  >
  readonly listForOrg: (input: {
    readonly organizationId: string
    readonly requestId: string
    readonly kinds?: readonly HrTestKind[]
    readonly includeArchived?: boolean
  }) => Effect.Effect<readonly HrTestTemplateRow[], HrPersistenceError>
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
    message: `Test template ${input.resourceId} does not belong to organization ${input.organizationId}.`,
    organizationId: input.organizationId,
    requestId: input.requestId,
    resource: 'hr_test_template',
    resourceId: input.resourceId,
    actualOrganizationId: input.actualOrganizationId,
  })
}

type RawRow = Record<string, unknown>

export class HrTestTemplateService extends ServiceMap.Service<
  HrTestTemplateService,
  HrTestTemplateServiceShape
>()('hr/recruitment/HrTestTemplateService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient

      const findByIdInternal = Effect.fn(
        'HrTestTemplateService.findById.internal',
      )(
        (input: {
          readonly organizationId: string
          readonly requestId: string
          readonly testTemplateId: string
        }): Effect.Effect<
          HrTestTemplateRow,
          | HrTestTemplateNotFoundError
          | HrPersistenceError
          | HrCrossOrgAccessError
        > =>
          Effect.gen(function* () {
            const rows = yield* client<RawRow>`
              select * from hr_test_template
              where id = ${input.testTemplateId}
              limit 1
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'findTestTemplateById',
                  message: 'Failed to load test template.',
                  cause,
                }),
              ),
            )
            const [row] = rows
            if (!row) {
              return yield* Effect.fail(
                new HrTestTemplateNotFoundError({
                  message: `Test template ${input.testTemplateId} not found.`,
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  testTemplateId: input.testTemplateId,
                }),
              )
            }
            const template = toHrTestTemplateRow(row)
            if (template.organizationId !== input.organizationId) {
              return yield* Effect.fail(
                toCrossOrg({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  resourceId: input.testTemplateId,
                  actualOrganizationId: template.organizationId,
                }),
              )
            }
            return template
          }),
      )

      const ensureBuiltInsForOrg: HrTestTemplateServiceShape['ensureBuiltInsForOrg'] =
        Effect.fn('HrTestTemplateService.ensureBuiltInsForOrg')((input) =>
          Effect.gen(function* () {
            const existing = yield* client<RawRow>`
              select * from hr_test_template
              where organization_id = ${input.organizationId}
                and is_built_in = true
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'listBuiltInTemplates',
                  message: 'Failed to load built-in test templates.',
                  cause,
                }),
              ),
            )
            const rowsByKind = new Map<HrTestKind, HrTestTemplateRow>()
            for (const row of existing) {
              const template = toHrTestTemplateRow(row)
              rowsByKind.set(template.kind, template)
            }

            const now = Date.now()
            const created: HrTestTemplateRow[] = []
            for (const definition of Object.values(HR_TEST_KIND_CATALOG)) {
              if (definition.kind === 'custom') continue
              if (rowsByKind.has(definition.kind)) continue
              const id = crypto.randomUUID()
              const inserted = yield* client<RawRow>`
                insert into hr_test_template (
                  id, organization_id, kind, title, description,
                  default_passing_score, questions, is_built_in,
                  archived_at, created_at, updated_at
                )
                values (
                  ${id}, ${input.organizationId}, ${definition.kind},
                  ${definition.label}, ${definition.description},
                  ${definition.defaultPassingScore},
                  ${jsonValue(client, [])},
                  true, null, ${now}, ${now}
                )
                returning *
              `.pipe(
                Effect.mapError((cause) =>
                  toPersistenceError({
                    organizationId: input.organizationId,
                    requestId: input.requestId,
                    operation: 'insertBuiltInTestTemplate',
                    message: 'Failed to seed built-in test template.',
                    cause,
                  }),
                ),
              )
              const [row] = inserted
              if (row) {
                const template = toHrTestTemplateRow(row)
                rowsByKind.set(template.kind, template)
                created.push(template)
              }
            }
            return [
              ...rowsByKind.values(),
              ...created.filter((template) => !rowsByKind.has(template.kind)),
            ]
          }),
        )

      const createCustom: HrTestTemplateServiceShape['createCustom'] =
        Effect.fn('HrTestTemplateService.createCustom')((input) =>
          Effect.gen(function* () {
            const title = normalizeTextField(input.title)
            if (!title) {
              return yield* Effect.fail(
                new HrRecruitmentInvalidInputError({
                  message: 'Test template title is required.',
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  field: 'title',
                }),
              )
            }
            const kind = isHrTestKind(String(input.kind))
              ? (input.kind as HrTestKind)
              : normalizeTestKind(String(input.kind))
            const description = normalizeTextField(input.description ?? '')
            const defaultPassingScore = clampScore(
              input.defaultPassingScore ??
                HR_TEST_KIND_CATALOG[kind].defaultPassingScore,
            )
            const questions = normalizeQuestions(input.questions)
            const id = crypto.randomUUID()
            const now = Date.now()
            const rows = yield* client<RawRow>`
              insert into hr_test_template (
                id, organization_id, kind, title, description,
                default_passing_score, questions, is_built_in,
                archived_at, created_at, updated_at
              )
              values (
                ${id}, ${input.organizationId}, ${kind}, ${title}, ${description},
                ${defaultPassingScore}, ${jsonValue(client, questions)},
                false, null, ${now}, ${now}
              )
              returning *
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'createTestTemplate',
                  message: 'Failed to create test template.',
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
                  operation: 'createTestTemplate',
                  message: 'Insert returned no row.',
                }),
              )
            }
            return toHrTestTemplateRow(row)
          }),
        )

      const update: HrTestTemplateServiceShape['update'] = Effect.fn(
        'HrTestTemplateService.update',
      )((input) =>
        Effect.gen(function* () {
          const existing = yield* findByIdInternal({
            organizationId: input.organizationId,
            requestId: input.requestId,
            testTemplateId: input.testTemplateId,
          })
          const title =
            input.title !== undefined
              ? normalizeTextField(input.title)
              : existing.title
          if (!title) {
            return yield* Effect.fail(
              new HrRecruitmentInvalidInputError({
                message: 'Test template title cannot be empty.',
                organizationId: input.organizationId,
                requestId: input.requestId,
                field: 'title',
              }),
            )
          }
          const description =
            input.description !== undefined
              ? normalizeTextField(input.description)
              : existing.description
          const defaultPassingScore =
            input.defaultPassingScore !== undefined
              ? clampScore(input.defaultPassingScore)
              : existing.defaultPassingScore
          const questions =
            input.questions !== undefined
              ? normalizeQuestions(input.questions)
              : existing.questions
          const now = Date.now()
          const rows = yield* client<RawRow>`
            update hr_test_template
            set
              title = ${title},
              description = ${description},
              default_passing_score = ${defaultPassingScore},
              questions = ${jsonValue(client, questions)},
              updated_at = ${now}
            where id = ${input.testTemplateId}
              and organization_id = ${input.organizationId}
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'updateTestTemplate',
                message: 'Failed to update test template.',
                cause,
              }),
            ),
          )
          const [row] = rows
          if (!row) {
            return yield* Effect.fail(
              new HrTestTemplateNotFoundError({
                message: `Test template ${input.testTemplateId} not found.`,
                organizationId: input.organizationId,
                requestId: input.requestId,
                testTemplateId: input.testTemplateId,
              }),
            )
          }
          return toHrTestTemplateRow(row)
        }),
      )

      const archive: HrTestTemplateServiceShape['archive'] = Effect.fn(
        'HrTestTemplateService.archive',
      )((input) =>
        Effect.gen(function* () {
          yield* findByIdInternal({
            organizationId: input.organizationId,
            requestId: input.requestId,
            testTemplateId: input.testTemplateId,
          })
          const now = Date.now()
          const rows = yield* client<RawRow>`
            update hr_test_template
            set
              archived_at = ${input.archive ? now : null},
              updated_at = ${now}
            where id = ${input.testTemplateId}
              and organization_id = ${input.organizationId}
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'archiveTestTemplate',
                message: 'Failed to archive test template.',
                cause,
              }),
            ),
          )
          const [row] = rows
          if (!row) {
            return yield* Effect.fail(
              new HrTestTemplateNotFoundError({
                message: `Test template ${input.testTemplateId} not found.`,
                organizationId: input.organizationId,
                requestId: input.requestId,
                testTemplateId: input.testTemplateId,
              }),
            )
          }
          return toHrTestTemplateRow(row)
        }),
      )

      const listForOrg: HrTestTemplateServiceShape['listForOrg'] = Effect.fn(
        'HrTestTemplateService.listForOrg',
      )((input) =>
        Effect.gen(function* () {
          const includeArchived = input.includeArchived === true
          const archivedClause = client.literal(
            includeArchived ? 'TRUE' : 'archived_at is null',
          )
          const kinds = (input.kinds ?? []).filter(isHrTestKind)
          const rows =
            kinds.length > 0
              ? yield* client<RawRow>`
                  select * from hr_test_template
                  where organization_id = ${input.organizationId}
                    and ${archivedClause}
                    and kind in ${client.in(kinds)}
                  order by is_built_in desc, kind asc, updated_at desc
                `.pipe(
                  Effect.mapError((cause) =>
                    toPersistenceError({
                      organizationId: input.organizationId,
                      requestId: input.requestId,
                      operation: 'listTestTemplates',
                      message: 'Failed to list test templates.',
                      cause,
                    }),
                  ),
                )
              : yield* client<RawRow>`
                  select * from hr_test_template
                  where organization_id = ${input.organizationId}
                    and ${archivedClause}
                  order by is_built_in desc, kind asc, updated_at desc
                `.pipe(
                  Effect.mapError((cause) =>
                    toPersistenceError({
                      organizationId: input.organizationId,
                      requestId: input.requestId,
                      operation: 'listTestTemplates',
                      message: 'Failed to list test templates.',
                      cause,
                    }),
                  ),
                )
          return rows.map(toHrTestTemplateRow)
        }),
      )

      return {
        ensureBuiltInsForOrg,
        createCustom,
        update,
        archive,
        findById: findByIdInternal,
        listForOrg,
      } satisfies HrTestTemplateServiceShape
    }),
  )

  /** Deterministic in-memory implementation for tests. */
  static readonly layerMemory = Layer.sync(this, () => {
    const rows = new Map<string, HrTestTemplateRow>()

    const ensureSameOrg = (
      organizationId: string,
      requestId: string,
      testTemplateId: string,
    ): Effect.Effect<
      HrTestTemplateRow,
      HrTestTemplateNotFoundError | HrCrossOrgAccessError
    > => {
      const row = rows.get(testTemplateId)
      if (!row) {
        return Effect.fail(
          new HrTestTemplateNotFoundError({
            message: `Test template ${testTemplateId} not found.`,
            organizationId,
            requestId,
            testTemplateId,
          }),
        )
      }
      if (row.organizationId !== organizationId) {
        return Effect.fail(
          toCrossOrg({
            organizationId,
            requestId,
            resourceId: testTemplateId,
            actualOrganizationId: row.organizationId,
          }),
        )
      }
      return Effect.succeed(row)
    }

    return {
      ensureBuiltInsForOrg: Effect.fn(
        'HrTestTemplateService.ensureBuiltInsForOrg.memory',
      )((input) =>
        Effect.sync(() => {
          const now = Date.now()
          const seeded: HrTestTemplateRow[] = []
          for (const definition of Object.values(HR_TEST_KIND_CATALOG)) {
            if (definition.kind === 'custom') continue
            const exists = Array.from(rows.values()).some(
              (row) =>
                row.organizationId === input.organizationId &&
                row.kind === definition.kind &&
                row.isBuiltIn,
            )
            if (exists) continue
            const id = crypto.randomUUID()
            const next: HrTestTemplateRow = {
              id,
              organizationId: input.organizationId,
              kind: definition.kind,
              title: definition.label,
              description: definition.description,
              defaultPassingScore: definition.defaultPassingScore,
              questions: [],
              isBuiltIn: true,
              archivedAt: null,
              createdAt: now,
              updatedAt: now,
            }
            rows.set(id, next)
            seeded.push(next)
          }
          return seeded.concat(
            Array.from(rows.values()).filter(
              (row) =>
                row.organizationId === input.organizationId && row.isBuiltIn,
            ),
          )
        }),
      ),
      createCustom: Effect.fn('HrTestTemplateService.createCustom.memory')(
        (input) =>
          Effect.gen(function* () {
            const title = normalizeTextField(input.title)
            if (!title) {
              return yield* Effect.fail(
                new HrRecruitmentInvalidInputError({
                  message: 'Test template title is required.',
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  field: 'title',
                }),
              )
            }
            const kind = isHrTestKind(String(input.kind))
              ? (input.kind as HrTestKind)
              : normalizeTestKind(String(input.kind))
            const id = crypto.randomUUID()
            const now = Date.now()
            const next: HrTestTemplateRow = {
              id,
              organizationId: input.organizationId,
              kind,
              title,
              description: normalizeTextField(input.description ?? ''),
              defaultPassingScore: clampScore(
                input.defaultPassingScore ??
                  HR_TEST_KIND_CATALOG[kind].defaultPassingScore,
              ),
              questions: normalizeQuestions(input.questions),
              isBuiltIn: false,
              archivedAt: null,
              createdAt: now,
              updatedAt: now,
            }
            rows.set(id, next)
            return next
          }),
      ),
      update: Effect.fn('HrTestTemplateService.update.memory')((input) =>
        Effect.gen(function* () {
          const existing = yield* ensureSameOrg(
            input.organizationId,
            input.requestId,
            input.testTemplateId,
          )
          const title =
            input.title !== undefined
              ? normalizeTextField(input.title)
              : existing.title
          if (!title) {
            return yield* Effect.fail(
              new HrRecruitmentInvalidInputError({
                message: 'Test template title cannot be empty.',
                organizationId: input.organizationId,
                requestId: input.requestId,
                field: 'title',
              }),
            )
          }
          const next: HrTestTemplateRow = {
            ...existing,
            title,
            description:
              input.description !== undefined
                ? normalizeTextField(input.description)
                : existing.description,
            defaultPassingScore:
              input.defaultPassingScore !== undefined
                ? clampScore(input.defaultPassingScore)
                : existing.defaultPassingScore,
            questions:
              input.questions !== undefined
                ? normalizeQuestions(input.questions)
                : existing.questions,
            updatedAt: Date.now(),
          }
          rows.set(existing.id, next)
          return next
        }),
      ),
      archive: Effect.fn('HrTestTemplateService.archive.memory')((input) =>
        Effect.gen(function* () {
          const existing = yield* ensureSameOrg(
            input.organizationId,
            input.requestId,
            input.testTemplateId,
          )
          const now = Date.now()
          const next: HrTestTemplateRow = {
            ...existing,
            archivedAt: input.archive ? now : null,
            updatedAt: now,
          }
          rows.set(existing.id, next)
          return next
        }),
      ),
      findById: Effect.fn('HrTestTemplateService.findById.memory')((input) =>
        ensureSameOrg(
          input.organizationId,
          input.requestId,
          input.testTemplateId,
        ),
      ),
      listForOrg: Effect.fn('HrTestTemplateService.listForOrg.memory')(
        (input) =>
          Effect.succeed(
            Array.from(rows.values())
              .filter((row) => row.organizationId === input.organizationId)
              .filter((row) =>
                input.includeArchived ? true : row.archivedAt === null,
              )
              .filter((row) =>
                input.kinds && input.kinds.length > 0
                  ? input.kinds.includes(row.kind)
                  : true,
              )
              .sort((a, b) => {
                if (a.isBuiltIn !== b.isBuiltIn) {
                  return a.isBuiltIn ? -1 : 1
                }
                if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
                return b.updatedAt - a.updatedAt
              }),
          ),
      ),
    } satisfies HrTestTemplateServiceShape
  })
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 70
  return Math.max(0, Math.min(100, Math.round(score)))
}
