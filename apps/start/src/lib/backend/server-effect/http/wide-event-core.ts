import { inspect } from 'node:util'
import { Effect } from 'effect'

export type BackendWideEventLevel = 'info' | 'warn' | 'error'

export type BackendWideEventBreadcrumb = {
  readonly at: number
  readonly name: string
  readonly detail?: Readonly<Record<string, unknown>>
}

export type BackendWideEventOutcome<
  TCode extends string,
  TI18nKey extends string,
  TParams extends Readonly<Record<string, string | number | boolean>> | undefined,
> = {
  ok: boolean
  status: number
  level: BackendWideEventLevel
  captureMode: 'none' | 'signal' | 'exception'
  suppressLog: boolean
  retryable: boolean
  latencyMs: number
  finalizedAt: number
  error?: {
    readonly code?: TCode
    readonly tag: string
    readonly message: string
    readonly cause?: string
    readonly i18nKey?: TI18nKey
    readonly i18nParams?: TParams
  }
}

export type BackendWideEventBase<
  TCode extends string,
  TI18nKey extends string,
  TParams extends Readonly<Record<string, string | number | boolean>> | undefined,
> = {
  readonly eventName: string
  readonly request: {
    readonly requestId: string
    readonly route: string
    readonly method: string
    readonly startedAt: number
  }
  breadcrumbs: BackendWideEventBreadcrumb[]
  outcome?: BackendWideEventOutcome<TCode, TI18nKey, TParams>
  _drained: boolean
}

export function createBackendWideEventBase<
  TCode extends string,
  TI18nKey extends string,
  TParams extends Readonly<Record<string, string | number | boolean>> | undefined,
>(input: {
  readonly eventName: string
  readonly requestId: string
  readonly route: string
  readonly method: string
}): BackendWideEventBase<TCode, TI18nKey, TParams> {
  return {
    eventName: input.eventName,
    request: {
      requestId: input.requestId,
      route: input.route,
      method: input.method,
      startedAt: Date.now(),
    },
    breadcrumbs: [],
    _drained: false,
  }
}

export function addBackendWideEventBreadcrumb<
  TEvent extends { breadcrumbs: BackendWideEventBreadcrumb[] },
>(
  event: TEvent,
  input: {
    readonly name: string
    readonly detail?: Readonly<Record<string, unknown>>
  },
): TEvent {
  event.breadcrumbs.push({
    at: Date.now(),
    name: input.name,
    detail: input.detail,
  })
  return event
}

export function finalizeBackendWideEventSuccess<
  TCode extends string,
  TI18nKey extends string,
  TParams extends Readonly<Record<string, string | number | boolean>> | undefined,
  TEvent extends BackendWideEventBase<TCode, TI18nKey, TParams>,
>(
  event: TEvent,
  input: {
    readonly status: number
    readonly suppressLog?: boolean
  },
): TEvent {
  if (event.outcome) return event
  event.outcome = {
    ok: true,
    status: input.status,
    level: input.status >= 400 ? 'warn' : 'info',
    captureMode: 'none',
    suppressLog: Boolean(input.suppressLog),
    retryable: false,
    latencyMs: Date.now() - event.request.startedAt,
    finalizedAt: Date.now(),
  }
  return event
}

export function finalizeBackendWideEventFailure<
  TCode extends string,
  TI18nKey extends string,
  TParams extends Readonly<Record<string, string | number | boolean>> | undefined,
  TEvent extends BackendWideEventBase<TCode, TI18nKey, TParams>,
>(
  event: TEvent,
  input: {
    readonly status: number
    readonly level: BackendWideEventLevel
    readonly captureMode: 'none' | 'signal' | 'exception'
    readonly suppressLog?: boolean
    readonly retryable: boolean
    readonly errorTag: string
    readonly message: string
    readonly errorCode?: TCode
    readonly cause?: string
    readonly i18nKey?: TI18nKey
    readonly i18nParams?: TParams
  },
): TEvent {
  if (event.outcome) return event
  event.outcome = {
    ok: false,
    status: input.status,
    level: input.level,
    captureMode: input.captureMode,
    suppressLog: Boolean(input.suppressLog),
    retryable: input.retryable,
    latencyMs: Date.now() - event.request.startedAt,
    finalizedAt: Date.now(),
    error: {
      code: input.errorCode,
      tag: input.errorTag,
      message: input.message,
      cause: input.cause,
      i18nKey: input.i18nKey,
      i18nParams: input.i18nParams,
    },
  }
  return event
}

export function createDrainBackendWideEventEffect<
  TCode extends string,
  TI18nKey extends string,
  TParams extends Readonly<Record<string, string | number | boolean>> | undefined,
  TEvent extends BackendWideEventBase<TCode, TI18nKey, TParams>,
>(input: {
  readonly event: TEvent
  readonly logName: string
  readonly annotations: Record<string, unknown>
  readonly afterDrain?: (event: TEvent) => Promise<unknown> | unknown
}) {
  if (input.event._drained) {
    return Effect.void
  }
  input.event._drained = true
  if (input.event.outcome?.suppressLog) {
    return Effect.void
  }

  const effect =
    input.event.outcome?.level === 'error'
      ? Effect.logError(input.logName)
      : input.event.outcome?.level === 'warn'
        ? Effect.logWarning(input.logName)
        : Effect.logInfo(input.logName)

  const isProduction = process.env.NODE_ENV === 'production'
  const wideEventLogValue = isProduction
    ? input.event
    : inspect(input.event, {
        depth: null,
        colors: false,
        compact: false,
        breakLength: 120,
      })

  const annotated = Effect.annotateLogs(effect, {
    event_name: input.event.eventName,
    request_id: input.event.request.requestId,
    route: input.event.request.route,
    method: input.event.request.method,
    status: input.event.outcome?.status,
    latency_ms: input.event.outcome?.latencyMs,
    error_code: input.event.outcome?.error?.code,
    error_tag: input.event.outcome?.error?.tag,
    error_message: input.event.outcome?.error?.message,
    error_cause: input.event.outcome?.error?.cause,
    error_i18n_key: input.event.outcome?.error?.i18nKey,
    error_i18n_params: input.event.outcome?.error?.i18nParams,
    retryable: input.event.outcome?.retryable,
    capture_mode: input.event.outcome?.captureMode,
    breadcrumbs_count: input.event.breadcrumbs.length,
    wide_event: wideEventLogValue,
    ...input.annotations,
  })

  if (!input.afterDrain) {
    return annotated
  }

  return annotated.pipe(
    Effect.tap(() => Effect.promise(() => Promise.resolve(input.afterDrain!(input.event)))),
  )
}
