import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { sqlJson } from '@/lib/backend/server-effect'
import {
  HrBackgroundCheckPersistenceError,
  HrBackgroundCheckProviderError,
} from '../domain/errors'

export type RequestBackgroundCheckInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly applicationId: string
  readonly candidateId: string
  readonly resumeHookToken: string
  readonly idempotencyKey: string
}

export type CompleteBackgroundCheckInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly applicationId: string
  readonly checkId: string
  readonly passed: boolean
  readonly creditScore?: number
  readonly legalFlags: readonly {
    readonly code: string
    readonly severity: string
    readonly message: string
  }[]
  readonly rawPayload?: Record<string, string | number | boolean | null>
}

export type BackgroundCheckRow = {
  readonly id: string
  readonly applicationId: string
  readonly status:
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'cancelled'
  readonly passed: boolean | null
  readonly creditScore: number | null
  readonly legalFlags: readonly {
    readonly code: string
    readonly severity: string
    readonly message: string
  }[]
  readonly resumeHookToken: string | null
}

export type HrBackgroundCheckServiceShape = {
  readonly request: (
    input: RequestBackgroundCheckInput,
  ) => Effect.Effect<
    BackgroundCheckRow,
    HrBackgroundCheckPersistenceError | HrBackgroundCheckProviderError
  >
  readonly complete: (
    input: CompleteBackgroundCheckInput,
  ) => Effect.Effect<BackgroundCheckRow, HrBackgroundCheckPersistenceError>
}

function toPersistenceError(input: {
  readonly organizationId: string
  readonly requestId: string
  readonly operation: string
  readonly message: string
  readonly cause?: unknown
}) {
  return new HrBackgroundCheckPersistenceError({
    message: input.message,
    operation: input.operation,
    organizationId: input.organizationId,
    requestId: input.requestId,
    cause: input.cause ? String(input.cause) : undefined,
  })
}

type RawRow = Record<string, unknown>

function toRow(row: RawRow): BackgroundCheckRow {
  return {
    id: String(row.id),
    applicationId: String(row.application_id),
    status: ((): BackgroundCheckRow['status'] => {
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
      return 'pending'
    })(),
    passed: typeof row.passed === 'boolean' ? row.passed : null,
    creditScore: typeof row.credit_score === 'number' ? row.credit_score : null,
    legalFlags: Array.isArray(row.legal_flags)
      ? (row.legal_flags as BackgroundCheckRow['legalFlags'])
      : [],
    resumeHookToken:
      typeof row.resume_webhook_url === 'string'
        ? row.resume_webhook_url
        : null,
  }
}

export class HrBackgroundCheckService extends ServiceMap.Service<
  HrBackgroundCheckService,
  HrBackgroundCheckServiceShape
>()('hr/background-check/HrBackgroundCheckService') {
  static readonly layerMock = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient

      const request: HrBackgroundCheckServiceShape['request'] = Effect.fn(
        'HrBackgroundCheckService.request.mock',
      )((input) =>
        Effect.gen(function* () {
          const existing = yield* client<RawRow>`
            select * from hr_background_check
            where organization_id = ${input.organizationId}
              and idempotency_key = ${input.idempotencyKey}
            limit 1
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'lookupBackgroundCheckIdempotency',
                message: 'Failed to look up background check idempotency row.',
                cause,
              }),
            ),
          )
          const [existingRow] = existing
          if (existingRow) {
            return toRow(existingRow)
          }
          const id = crypto.randomUUID()
          const now = Date.now()
          const inserted = yield* client<RawRow>`
            insert into hr_background_check (
              id, organization_id, application_id, candidate_id,
              provider, status, passed, credit_score,
              legal_flags, raw_payload,
              resume_webhook_url, idempotency_key,
              requested_at, completed_at,
              created_at, updated_at
            )
            values (
              ${id}, ${input.organizationId}, ${input.applicationId},
              ${input.candidateId},
              'mock', 'pending', null, null,
              ${sqlJson(client, [])}, null,
              ${input.resumeHookToken}, ${input.idempotencyKey},
              ${now}, null,
              ${now}, ${now}
            )
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'insertBackgroundCheck',
                message: 'Failed to record background check request.',
                cause,
              }),
            ),
          )
          const [row] = inserted
          if (!row) {
            return yield* Effect.fail(
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'insertBackgroundCheck',
                message: 'Insert returned no row.',
              }),
            )
          }
          return toRow(row)
        }),
      )

      const complete: HrBackgroundCheckServiceShape['complete'] = Effect.fn(
        'HrBackgroundCheckService.complete.mock',
      )((input) =>
        Effect.gen(function* () {
          const now = Date.now()
          const rows = yield* client<RawRow>`
            update hr_background_check
            set
              status = 'completed',
              passed = ${input.passed},
              credit_score = ${input.creditScore ?? null},
              legal_flags = ${sqlJson(client, input.legalFlags)},
              raw_payload = ${
                input.rawPayload
                  ? sqlJson(client, input.rawPayload)
                  : sqlJson(client, {})
              },
              completed_at = ${now},
              updated_at = ${now}
            where id = ${input.checkId}
              and organization_id = ${input.organizationId}
              and application_id = ${input.applicationId}
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'completeBackgroundCheck',
                message: 'Failed to mark background check completed.',
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
                operation: 'completeBackgroundCheck',
                message: 'Background check not found.',
              }),
            )
          }
          return toRow(row)
        }),
      )

      return { request, complete }
    }),
  )

  /** Pure in-memory implementation for tests. */
  static readonly layerMemory = Layer.sync(this, () => {
    const rows = new Map<
      string,
      BackgroundCheckRow & { idempotencyKey: string }
    >()
    return {
      request: Effect.fn('HrBackgroundCheckService.request.memory')((input) =>
        Effect.sync(() => {
          for (const candidate of rows.values()) {
            if (candidate.idempotencyKey === input.idempotencyKey) {
              return candidate
            }
          }
          const id = crypto.randomUUID()
          const next = {
            id,
            applicationId: input.applicationId,
            status: 'pending' as const,
            passed: null,
            creditScore: null,
            legalFlags: [] as BackgroundCheckRow['legalFlags'],
            resumeHookToken: input.resumeHookToken,
            idempotencyKey: input.idempotencyKey,
          }
          rows.set(id, next)
          return next
        }),
      ),
      complete: Effect.fn('HrBackgroundCheckService.complete.memory')((input) =>
        Effect.gen(function* () {
          const existing = rows.get(input.checkId)
          if (!existing) {
            return yield* Effect.fail(
              new HrBackgroundCheckPersistenceError({
                message: `Background check ${input.checkId} not found.`,
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'completeBackgroundCheck',
              }),
            )
          }
          const next = {
            ...existing,
            status: 'completed' as const,
            passed: input.passed,
            creditScore: input.creditScore ?? null,
            legalFlags: input.legalFlags,
          }
          rows.set(existing.id, next)
          return next
        }),
      ),
    } satisfies HrBackgroundCheckServiceShape
  })
}
