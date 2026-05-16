/**
 * HR Recruitment wide-event observability.
 */

import { inspect } from 'node:util'
import { Effect } from 'effect'

type WideEventLevel = 'info' | 'warn' | 'error'

type HrRequestOutcome = {
  ok: boolean
  status: number
  level: WideEventLevel
  suppressLog: boolean
  retryable: boolean
  latencyMs: number
  finalizedAt: number
  error?: {
    readonly tag: string
    readonly message: string
    readonly cause?: string
    readonly stack?: string
  }
}

type HrWideEventBreadcrumb = {
  readonly at: number
  readonly name: string
  readonly detail?: Readonly<Record<string, unknown>>
}

export type HrRequestWideEvent = {
  readonly eventName: string
  readonly request: {
    readonly requestId: string
    readonly route: string
    readonly method: string
    readonly startedAt: number
  }
  actor: { userId?: string; organizationId?: string }
  position: { positionId?: string; status?: string }
  application: {
    applicationId?: string
    candidateId?: string
    stage?: string
    affinityScore?: number | null
  }
  workflow: {
    workflowRunId?: string
    stepName?: string
    attempt?: number
  }
  files: { received?: number; uploadedKeys?: string[]; failed?: number }
  breadcrumbs: HrWideEventBreadcrumb[]
  outcome?: HrRequestOutcome
  _drained: boolean
}

export function createHrRecruitmentWideEvent(input: {
  readonly eventName: string
  readonly requestId: string
  readonly route: string
  readonly method: string
}): HrRequestWideEvent {
  return {
    eventName: input.eventName,
    request: {
      requestId: input.requestId,
      route: input.route,
      method: input.method,
      startedAt: Date.now(),
    },
    actor: {},
    position: {},
    application: {},
    workflow: {},
    files: {},
    breadcrumbs: [],
    _drained: false,
  }
}

export function setHrWideEventContext(
  event: HrRequestWideEvent,
  patch: Partial<
    Omit<
      HrRequestWideEvent,
      'breadcrumbs' | 'eventName' | 'request' | '_drained' | 'outcome'
    >
  >,
): HrRequestWideEvent {
  if (patch.actor) Object.assign(event.actor, patch.actor)
  if (patch.position) Object.assign(event.position, patch.position)
  if (patch.application) Object.assign(event.application, patch.application)
  if (patch.workflow) Object.assign(event.workflow, patch.workflow)
  if (patch.files) Object.assign(event.files, patch.files)
  return event
}

export function addHrWideEventBreadcrumb(
  event: HrRequestWideEvent,
  input: {
    readonly name: string
    readonly detail?: Readonly<Record<string, unknown>>
  },
): HrRequestWideEvent {
  event.breadcrumbs.push({
    at: Date.now(),
    name: input.name,
    detail: input.detail,
  })
  return event
}

export function finalizeHrWideEventSuccess(
  event: HrRequestWideEvent,
  input: { readonly status: number; readonly suppressLog?: boolean },
): HrRequestWideEvent {
  if (event.outcome) return event
  event.outcome = {
    ok: true,
    status: input.status,
    level: input.status >= 400 ? 'warn' : 'info',
    suppressLog: Boolean(input.suppressLog),
    retryable: false,
    latencyMs: Date.now() - event.request.startedAt,
    finalizedAt: Date.now(),
  }
  return event
}

export function finalizeHrWideEventFailure(
  event: HrRequestWideEvent,
  input: {
    readonly status: number
    readonly level?: WideEventLevel
    readonly retryable?: boolean
    readonly errorTag: string
    readonly message: string
    readonly cause?: string
    readonly stack?: string
  },
): HrRequestWideEvent {
  if (event.outcome) return event
  event.outcome = {
    ok: false,
    status: input.status,
    level: input.level ?? 'error',
    suppressLog: false,
    retryable: input.retryable ?? false,
    latencyMs: Date.now() - event.request.startedAt,
    finalizedAt: Date.now(),
    error: {
      tag: input.errorTag,
      message: input.message,
      cause: input.cause,
      stack: input.stack,
    },
  }
  return event
}

export function getHrErrorTag(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    typeof (error as { _tag?: unknown })._tag === 'string'
  ) {
    return (error as { _tag: string })._tag
  }
  if (error instanceof Error) return error.name
  return 'UnknownError'
}

export function describeHrCause(error: unknown): string | undefined {
  if (error instanceof Error) {
    const stack = error.cause
    if (stack instanceof Error) return `${stack.name}: ${stack.message}`
    if (typeof stack === 'string') return stack
    return undefined
  }
  if (typeof error === 'string') return error
  return undefined
}

export const drainHrWideEvent = Effect.fn('HrObservability.drainHrWideEvent')((
  event: HrRequestWideEvent,
) => {
  if (event._drained) return Effect.void
  event._drained = true
  if (event.outcome?.suppressLog) return Effect.void

  const effect =
    event.outcome?.level === 'error'
      ? Effect.logError('hr.recruitment.request')
      : event.outcome?.level === 'warn'
        ? Effect.logWarning('hr.recruitment.request')
        : Effect.logInfo('hr.recruitment.request')

  const isProduction = process.env.NODE_ENV === 'production'
  const verboseLogs =
    process.env.HR_RECRUITMENT_VERBOSE_LOGS?.trim().toLowerCase() === 'true'

  const annotations: Record<string, unknown> = {
    event_name: event.eventName,
    request_id: event.request.requestId,
    route: event.request.route,
    method: event.request.method,
    status: event.outcome?.status,
    latency_ms: event.outcome?.latencyMs,
    error_tag: event.outcome?.error?.tag,
    error_message: event.outcome?.error?.message,
    error_cause: event.outcome?.error?.cause,
    retryable: event.outcome?.retryable,
    organization_id: event.actor.organizationId,
    user_id: event.actor.userId,
    position_id: event.position.positionId,
    application_id: event.application.applicationId,
    candidate_id: event.application.candidateId,
    application_stage: event.application.stage,
    affinity_score: event.application.affinityScore,
    workflow_run_id: event.workflow.workflowRunId,
    workflow_step: event.workflow.stepName,
    workflow_attempt: event.workflow.attempt,
    files_received: event.files.received,
    files_failed: event.files.failed,
    breadcrumbs_count: event.breadcrumbs.length,
  }

  if (verboseLogs || isProduction) {
    annotations.wide_event = isProduction
      ? event
      : inspect(event, {
          depth: null,
          colors: false,
          compact: false,
          breakLength: 120,
        })
  } else if (event.breadcrumbs.length > 0) {
    annotations.breadcrumbs = event.breadcrumbs.map((entry) => entry.name)
  }

  return Effect.annotateLogs(effect, annotations)
})

/**
 * Fire-and-forget failure event for workflow steps + background jobs
 * outside the request lifecycle. Reuses the same drain path so the
 * `request_id` always correlates back to the route that started the
 * workflow.
 */
export type HrBackgroundFailure = {
  readonly eventName: string
  readonly route: string
  readonly requestId: string
  readonly errorTag: string
  readonly message: string
  readonly cause?: string
  readonly stack?: string
  readonly organizationId?: string
  readonly userId?: string
  readonly applicationId?: string
  readonly candidateId?: string
  readonly positionId?: string
  readonly workflowRunId?: string
  readonly stepName?: string
  readonly retryable?: boolean
}

export const emitHrBackgroundFailure = Effect.fn(
  'HrObservability.emitHrBackgroundFailure',
)((input: HrBackgroundFailure) => {
  const event = createHrRecruitmentWideEvent({
    eventName: input.eventName,
    requestId: input.requestId,
    route: input.route,
    method: 'BACKGROUND',
  })
  setHrWideEventContext(event, {
    actor: { userId: input.userId, organizationId: input.organizationId },
    application: {
      applicationId: input.applicationId,
      candidateId: input.candidateId,
    },
    position: { positionId: input.positionId },
    workflow: {
      workflowRunId: input.workflowRunId,
      stepName: input.stepName,
    },
  })
  finalizeHrWideEventFailure(event, {
    status: 500,
    errorTag: input.errorTag,
    message: input.message,
    cause: input.cause,
    stack: input.stack,
    retryable: input.retryable ?? false,
  })
  return drainHrWideEvent(event)
})
