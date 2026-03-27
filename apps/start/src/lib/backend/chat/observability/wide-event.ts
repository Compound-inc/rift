import { inspect } from 'node:util'
import { Effect } from 'effect'
import type { ChatErrorCode } from '../domain/error-codes'
import type {
  ChatErrorI18nKey,
  ChatErrorI18nParams,
} from '@/lib/shared/chat-contracts/error-i18n'
import { captureChatWideEventInPostHog } from './posthog.server'

type WideEventLevel = 'info' | 'warn' | 'error'

export type WideErrorEvent = {
  readonly eventName: string
  readonly route: string
  readonly requestId: string
  readonly userId?: string
  readonly threadId?: string
  readonly model?: string
  readonly errorCode?: ChatErrorCode
  readonly errorTag: string
  readonly message: string
  readonly latencyMs?: number
  readonly retryable?: boolean
  readonly cause?: string
}

type WideEventBreadcrumb = {
  readonly at: number
  readonly name: string
  readonly detail?: Readonly<Record<string, unknown>>
}

type ChatRequestOutcome = {
  ok: boolean
  status: number
  level: WideEventLevel
  captureMode: 'none' | 'signal' | 'exception'
  suppressLog: boolean
  retryable: boolean
  latencyMs: number
  finalizedAt: number
  error?: {
    readonly code?: ChatErrorCode
    readonly tag: string
    readonly message: string
    readonly cause?: string
    readonly i18nKey?: ChatErrorI18nKey
    readonly i18nParams?: ChatErrorI18nParams
  }
}

/**
 * One mutable event per request. Context is accumulated across route parsing,
 * orchestration, streaming, persistence, and final transport mapping.
 */
export type ChatRequestWideEvent = {
  readonly eventName: string
  readonly request: {
    readonly requestId: string
    readonly route: string
    readonly method: string
    readonly startedAt: number
    trigger?: string
  }
  actor: {
    userId?: string
    organizationId?: string
    isAnonymous?: boolean
  }
  thread: {
    threadId?: string
    createIfMissing?: boolean
    expectedBranchVersion?: number
    actualBranchVersion?: number
    targetMessageId?: string
  }
  model: {
    requestedModelId?: string
    resolvedModelId?: string
    modelSource?: string
    reasoningEffort?: string
    contextWindowMode?: string
    providerOverride?: boolean
  }
  policy: {
    deniedFeature?: string
    providerKeyRequired?: boolean
    zeroDataRetentionRequired?: boolean
    allowedToolKeys?: readonly string[]
    deniedToolKeys?: readonly string[]
  }
  stream: {
    streamId?: string
    resumed?: boolean
    activePhase?: string
    aborted?: boolean
    cleanupState?: string
  }
  usage: {
    promptTokens?: number
    totalTokens?: number
    outputTokens?: number
    reservationBypassed?: boolean
    estimatedCostUsd?: number
    actualCostUsd?: number
    usedByok?: boolean
  }
  breadcrumbs: WideEventBreadcrumb[]
  outcome?: ChatRequestOutcome
  _drained: boolean
}

export function createChatWideEvent(input: {
  readonly eventName: string
  readonly requestId: string
  readonly route: string
  readonly method: string
}): ChatRequestWideEvent {
  return {
    eventName: input.eventName,
    request: {
      requestId: input.requestId,
      route: input.route,
      method: input.method,
      startedAt: Date.now(),
    },
    actor: {},
    thread: {},
    model: {},
    policy: {},
    stream: {},
    usage: {},
    breadcrumbs: [],
    _drained: false,
  }
}

export function setWideEventContext(
  event: ChatRequestWideEvent,
  patch: Partial<
    Omit<
      ChatRequestWideEvent,
      'breadcrumbs' | 'eventName' | 'request' | '_drained' | 'outcome'
    >
  > & {
    readonly request?: Partial<ChatRequestWideEvent['request']>
  },
): ChatRequestWideEvent {
  if (patch.request) {
    Object.assign(event.request, patch.request)
  }
  if (patch.actor) {
    Object.assign(event.actor, patch.actor)
  }
  if (patch.thread) {
    Object.assign(event.thread, patch.thread)
  }
  if (patch.model) {
    Object.assign(event.model, patch.model)
  }
  if (patch.policy) {
    Object.assign(event.policy, patch.policy)
  }
  if (patch.stream) {
    Object.assign(event.stream, patch.stream)
  }
  if (patch.usage) {
    Object.assign(event.usage, patch.usage)
  }

  return event
}

export function addWideEventBreadcrumb(
  event: ChatRequestWideEvent,
  input: {
    readonly name: string
    readonly detail?: Readonly<Record<string, unknown>>
  },
): ChatRequestWideEvent {
  event.breadcrumbs.push({
    at: Date.now(),
    name: input.name,
    detail: input.detail,
  })
  return event
}

export function finalizeWideEventSuccess(
  event: ChatRequestWideEvent,
  input: {
    readonly status: number
    readonly suppressLog?: boolean
  },
): ChatRequestWideEvent {
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

export function finalizeWideEventFailure(
  event: ChatRequestWideEvent,
  input: {
    readonly status: number
    readonly level: WideEventLevel
    readonly captureMode: 'none' | 'signal' | 'exception'
    readonly suppressLog?: boolean
    readonly retryable: boolean
    readonly errorTag: string
    readonly message: string
    readonly errorCode?: ChatErrorCode
    readonly cause?: string
    readonly i18nKey?: ChatErrorI18nKey
    readonly i18nParams?: ChatErrorI18nParams
  },
): ChatRequestWideEvent {
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

/**
 * Emits one structured log event per request and mirrors failure events to PostHog.
 */
export const drainWideEvent = Effect.fn('ChatObservability.drainWideEvent')((
  event: ChatRequestWideEvent,
) => {
  if (event._drained) {
    return Effect.void
  }
  event._drained = true
  if (event.outcome?.suppressLog) {
    return Effect.void
  }

  const effect =
    event.outcome?.level === 'error'
      ? Effect.logError('chat.request')
      : event.outcome?.level === 'warn'
        ? Effect.logWarning('chat.request')
        : Effect.logInfo('chat.request')
  const isProduction = process.env.NODE_ENV === 'production'
  const wideEventLogValue = isProduction
    ? event
    : inspect(event, {
        depth: null,
        colors: false,
        compact: false,
        breakLength: 120,
      })

  return Effect.annotateLogs(effect, {
    event_name: event.eventName,
    request_id: event.request.requestId,
    route: event.request.route,
    method: event.request.method,
    status: event.outcome?.status,
    latency_ms: event.outcome?.latencyMs,
    error_code: event.outcome?.error?.code,
    error_tag: event.outcome?.error?.tag,
    error_message: event.outcome?.error?.message,
    error_cause: event.outcome?.error?.cause,
    error_i18n_key: event.outcome?.error?.i18nKey,
    error_i18n_params: event.outcome?.error?.i18nParams,
    retryable: event.outcome?.retryable,
    capture_mode: event.outcome?.captureMode,
    prompt_tokens: event.usage.promptTokens,
    total_tokens: event.usage.totalTokens,
    output_tokens: event.usage.outputTokens,
    estimated_cost_usd: event.usage.estimatedCostUsd,
    actual_cost_usd: event.usage.actualCostUsd,
    breadcrumbs_count: event.breadcrumbs.length,
    wide_event: wideEventLogValue,
  }).pipe(
    Effect.tap(() =>
      Effect.promise(() => captureChatWideEventInPostHog(event)),
    ),
  )
})

/** Returns stable tag for domain errors; falls back to `UnknownError`. */
export function getErrorTag(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    typeof error._tag === 'string'
  ) {
    return error._tag
  }

  return 'UnknownError'
}

/**
 * Compatibility helper for detached/background failures that are not the
 * authoritative request-wide event but should still emit one structured record.
 */
export const emitWideErrorEvent = Effect.fn(
  'ChatObservability.emitWideErrorEvent',
)((input: WideErrorEvent) => {
  const event = createChatWideEvent({
    eventName: input.eventName,
    requestId: input.requestId,
    route: input.route,
    method: 'BACKGROUND',
  })
  setWideEventContext(event, {
    actor: { userId: input.userId },
    thread: { threadId: input.threadId },
    model: { resolvedModelId: input.model },
  })
  finalizeWideEventFailure(event, {
    status: 500,
    level: 'error',
    captureMode: 'exception',
    retryable: input.retryable ?? false,
    errorTag: input.errorTag,
    message: input.message,
    errorCode: input.errorCode,
    cause: input.cause,
  })
  if (typeof input.latencyMs === 'number' && event.outcome) {
    event.outcome.latencyMs = input.latencyMs
  }
  return drainWideEvent(event)
})
