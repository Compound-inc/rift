import { Effect, Layer, ServiceMap } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { HrEvaluationDispatchError } from '../domain/errors'
import type { HrEvaluationDispatchRow } from '../domain/types'
import { toHrEvaluationDispatchRow } from './persistence'
import { buildEvaluationDispatchUrl } from './evaluation-urls'

/**
 * Evaluation dispatcher.
 *
 * Owns the side effect of "send an evaluation to a candidate". Today
 * we don't have an email pipeline yet, so the dispatch URL is
 * persisted on the row and surfaced inline in the candidates UI; the
 * admin clicks it to take the evaluation. Real email adapters reuse
 * the same URL in the message body without changing the workflow.
 *
 * The dispatch row is the idempotency boundary: every dispatch
 * carries a unique key, replays short-circuit if the row already
 * exists.
 */

export type DispatchEvaluationInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly applicationId: string
  readonly evaluationCatalogId: string
  readonly resumeHookToken: string
  readonly idempotencyKey: string
  readonly expiresAt: number | null
}

export type DispatchEvaluationOutcome = {
  readonly dispatch: HrEvaluationDispatchRow
  /** `true` when an existing row matching `idempotencyKey` was reused. */
  readonly replayed: boolean
}

export type HrEvaluationDispatcherServiceShape = {
  readonly dispatch: (
    input: DispatchEvaluationInput,
  ) => Effect.Effect<DispatchEvaluationOutcome, HrEvaluationDispatchError>
}

/**
 * Surfaces the underlying `pg` error fields (`code`, `detail`,
 * `constraint`, `column`, `table`, `schema`, chained causes) so retry
 * telemetry shows what Postgres actually said.
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
  readonly evaluationCatalogId?: string
  readonly message: string
  readonly cause?: unknown
}) {
  const causeDetail = input.cause ? describeSqlCause(input.cause) : undefined
  return new HrEvaluationDispatchError({
    message: causeDetail ? `${input.message} (${causeDetail})` : input.message,
    organizationId: input.organizationId,
    requestId: input.requestId,
    applicationId: input.applicationId,
    evaluationCatalogId: input.evaluationCatalogId,
    cause: causeDetail,
  })
}

type DispatchRawRow = Record<string, unknown>

export class HrEvaluationDispatcherService extends ServiceMap.Service<
  HrEvaluationDispatcherService,
  HrEvaluationDispatcherServiceShape
>()('hr/recruitment/HrEvaluationDispatcherService') {
  /**
   * Inline-link layer (default). Persists the dispatch row idempotently
   * and stores the signed completion URL on the row so the UI can
   * surface it. No email channel; the admin uses the link to advance
   * candidates manually.
   */
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient
      const dispatch: HrEvaluationDispatcherServiceShape['dispatch'] =
        Effect.fn('HrEvaluationDispatcherService.dispatch')((input) =>
          Effect.gen(function* () {
            const existing = yield* client<DispatchRawRow>`
              select * from hr_evaluation_dispatch
              where organization_id = ${input.organizationId}
                and idempotency_key = ${input.idempotencyKey}
              limit 1
            `.pipe(
              Effect.mapError((cause) =>
                toDispatchError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  applicationId: input.applicationId,
                  evaluationCatalogId: input.evaluationCatalogId,
                  message: 'Failed to look up dispatch idempotency row.',
                  cause,
                }),
              ),
            )
            const [existingRow] = existing
            if (existingRow) {
              return {
                dispatch: toHrEvaluationDispatchRow(existingRow),
                replayed: true,
              }
            }
            const id = crypto.randomUUID()
            const now = Date.now()
            const completionUrl = buildEvaluationDispatchUrl({
              dispatchId: id,
              applicationId: input.applicationId,
            })
            const inserted = yield* client<DispatchRawRow>`
              insert into hr_evaluation_dispatch (
                id, organization_id, application_id, evaluation_catalog_id,
                dispatched_via, status, resume_hook_token, idempotency_key,
                completion_url, expires_at, dispatched_at, completed_at,
                created_at, updated_at
              )
              values (
                ${id}, ${input.organizationId}, ${input.applicationId},
                ${input.evaluationCatalogId}, 'inline_link', 'sent',
                ${input.resumeHookToken}, ${input.idempotencyKey},
                ${completionUrl}, ${input.expiresAt}, ${now}, null,
                ${now}, ${now}
              )
              returning *
            `.pipe(
              Effect.mapError((cause) =>
                toDispatchError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  applicationId: input.applicationId,
                  evaluationCatalogId: input.evaluationCatalogId,
                  message: 'Failed to record evaluation dispatch.',
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
                  evaluationCatalogId: input.evaluationCatalogId,
                  message: 'Insert returned no dispatch row.',
                }),
              )
            }
            console.info('[hr.recruitment][evaluation] dispatched', {
              organizationId: input.organizationId,
              applicationId: input.applicationId,
              evaluationCatalogId: input.evaluationCatalogId,
              dispatchId: id,
              completionUrl,
            })
            return {
              dispatch: toHrEvaluationDispatchRow(row),
              replayed: false,
            }
          }),
        )
      return { dispatch }
    }),
  )
}
