import { Effect, Layer, ServiceMap } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { HrTestDispatchError } from '../domain/errors'
import type { HrTestDispatchRow } from '../domain/types'
import { toHrTestDispatchRow } from './persistence'
import { buildTestDispatchCompletionUrls } from './test-dispatch-urls'

/**
 * Candidate test dispatcher.
 */

export type DispatchTestInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly applicationId: string
  readonly testTemplateId: string
  readonly candidateEmail: string | null
  readonly candidateDisplayName: string
  readonly resumeWebhookUrl: string
  readonly idempotencyKey: string
  readonly expiresAt: number | null
  readonly testTitle: string
}

export type DispatchTestResult = {
  readonly dispatch: HrTestDispatchRow
  readonly replayed: boolean
}

export type HrCandidateTestDispatcherServiceShape = {
  readonly dispatch: (
    input: DispatchTestInput,
  ) => Effect.Effect<DispatchTestResult, HrTestDispatchError>
}

/**
 * Surfaces the underlying `pg` error fields (`code`, `detail`,
 * `constraint`, `column`, `table`, `schema`, chained causes) so retry
 * telemetry shows what Postgres actually said instead of a generic
 * "Failed to record test dispatch."
 */
function describeSqlCause(cause: unknown): string {
  if (!cause) return 'unknown'
  if (cause instanceof Error) {
    const candidate = cause as Error & {
      code?: unknown
      detail?: unknown
      constraint?: unknown
      column?: unknown
      table?: unknown
      schema?: unknown
      cause?: unknown
    }
    const parts = [
      candidate.message,
      candidate.code ? `code=${String(candidate.code)}` : null,
      candidate.detail ? `detail=${String(candidate.detail)}` : null,
      candidate.constraint
        ? `constraint=${String(candidate.constraint)}`
        : null,
      candidate.column ? `column=${String(candidate.column)}` : null,
      candidate.table ? `table=${String(candidate.table)}` : null,
      candidate.schema ? `schema=${String(candidate.schema)}` : null,
    ].filter(Boolean)
    let result = parts.join(' · ')
    if (candidate.cause && candidate.cause !== cause) {
      result += ` || cause: ${describeSqlCause(candidate.cause)}`
    }
    return result
  }
  if (typeof cause === 'object') {
    try {
      return JSON.stringify(cause)
    } catch {
      return String(cause)
    }
  }
  return String(cause)
}

function toDispatchError(input: {
  readonly organizationId: string
  readonly requestId: string
  readonly applicationId: string
  readonly testTemplateId?: string
  readonly message: string
  readonly cause?: unknown
}) {
  const causeDetail = input.cause ? describeSqlCause(input.cause) : undefined
  return new HrTestDispatchError({
    message: causeDetail ? `${input.message} (${causeDetail})` : input.message,
    organizationId: input.organizationId,
    requestId: input.requestId,
    applicationId: input.applicationId,
    testTemplateId: input.testTemplateId,
    cause: causeDetail,
  })
}

type DispatchRawRow = Record<string, unknown>

export class HrCandidateTestDispatcherService extends ServiceMap.Service<
  HrCandidateTestDispatcherService,
  HrCandidateTestDispatcherServiceShape
>()('hr/recruitment/HrCandidateTestDispatcherService') {
  /**
   * Console-stub layer (default). Persists the dispatch row idempotently
   * and prints a pair of pass/fail completion URLs so a developer can
   * advance the workflow locally.
   */
  static readonly layerConsoleStub = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient
      const dispatch: HrCandidateTestDispatcherServiceShape['dispatch'] =
        Effect.fn('HrCandidateTestDispatcherService.dispatchConsoleStub')(
          (input) =>
            Effect.gen(function* () {
              const existing = yield* client<DispatchRawRow>`
                select * from hr_test_dispatch
                where organization_id = ${input.organizationId}
                  and idempotency_key = ${input.idempotencyKey}
                limit 1
              `.pipe(
                Effect.mapError((cause) =>
                  toDispatchError({
                    organizationId: input.organizationId,
                    requestId: input.requestId,
                    applicationId: input.applicationId,
                    testTemplateId: input.testTemplateId,
                    message: 'Failed to look up dispatch idempotency row.',
                    cause,
                  }),
                ),
              )
              const [existingRow] = existing
              if (existingRow) {
                return {
                  dispatch: toHrTestDispatchRow(existingRow),
                  replayed: true,
                }
              }
              const id = crypto.randomUUID()
              const now = Date.now()
              const inserted = yield* client<DispatchRawRow>`
                insert into hr_test_dispatch (
                  id, organization_id, application_id, test_template_id,
                  dispatched_via, status, resume_webhook_url, idempotency_key,
                  expires_at, dispatched_at, completed_at,
                  created_at, updated_at
                )
                values (
                  ${id}, ${input.organizationId}, ${input.applicationId},
                  ${input.testTemplateId}, 'console_stub', 'sent',
                  ${input.resumeWebhookUrl}, ${input.idempotencyKey},
                  ${input.expiresAt}, ${now}, null,
                  ${now}, ${now}
                )
                returning *
              `.pipe(
                Effect.mapError((cause) =>
                  toDispatchError({
                    organizationId: input.organizationId,
                    requestId: input.requestId,
                    applicationId: input.applicationId,
                    testTemplateId: input.testTemplateId,
                    message: 'Failed to record test dispatch.',
                    cause,
                  }),
                ),
              )
              const [row] = inserted
              if (!row) {
                return yield* Effect.fail(
                  toDispatchError({
                    organizationId: input.organizationId,
                    requestId: input.requestId,
                    applicationId: input.applicationId,
                    testTemplateId: input.testTemplateId,
                    message: 'Insert returned no dispatch row.',
                  }),
                )
              }
              const completionUrls = buildTestDispatchCompletionUrls({
                dispatchId: id,
                applicationId: input.applicationId,
              })
              console.info('[hr.recruitment][stub] sending test to candidate', {
                organizationId: input.organizationId,
                applicationId: input.applicationId,
                testTemplateId: input.testTemplateId,
                testTitle: input.testTitle,
                candidateEmail: input.candidateEmail,
                candidateDisplayName: input.candidateDisplayName,
                dispatchId: id,
              })
              console.info(
                '[hr.recruitment][stub] complete as PASSED:',
                completionUrls.passed,
              )
              console.info(
                '[hr.recruitment][stub] complete as FAILED:',
                completionUrls.failed,
              )
              return {
                dispatch: toHrTestDispatchRow(row),
                replayed: false,
              }
            }),
        )
      return { dispatch }
    }),
  )
}
