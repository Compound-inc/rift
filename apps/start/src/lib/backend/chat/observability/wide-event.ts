import { Effect } from 'effect'
import type { ChatErrorCode } from '../domain/error-codes'
import type {
  ChatErrorI18nKey,
  ChatErrorI18nParams,
} from '@/lib/shared/chat-contracts/error-i18n'
import {
  addBackendWideEventBreadcrumb,
  createBackendWideEventBase,
  createDrainBackendWideEventEffect,
  finalizeBackendWideEventFailure,
  finalizeBackendWideEventSuccess,
  getBackendErrorTag,
  type BackendWideEventBase,
  type BackendWideEventBreadcrumb,
  type BackendWideEventLevel,
  type BackendWideEventOutcome,
} from '@/lib/backend/server-effect'
import { captureChatWideEventInPostHog } from './posthog.server'

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

type ChatRequestOutcome = BackendWideEventOutcome<
  ChatErrorCode,
  ChatErrorI18nKey,
  ChatErrorI18nParams
>

/**
 * One mutable event per request. Context is accumulated across route parsing,
 * orchestration, streaming, persistence, and final transport mapping.
 */
export type ChatRequestWideEvent = BackendWideEventBase<
  ChatErrorCode,
  ChatErrorI18nKey,
  ChatErrorI18nParams
> & {
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
  breadcrumbs: BackendWideEventBreadcrumb[]
  outcome?: ChatRequestOutcome
}

export function createChatWideEvent(input: {
  readonly eventName: string
  readonly requestId: string
  readonly route: string
  readonly method: string
}): ChatRequestWideEvent {
  return {
    ...createBackendWideEventBase({
      eventName: input.eventName,
      requestId: input.requestId,
      route: input.route,
      method: input.method,
    }),
    actor: {},
    thread: {},
    model: {},
    policy: {},
    stream: {},
    usage: {},
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
  return addBackendWideEventBreadcrumb(event, input)
}

export function finalizeWideEventSuccess(
  event: ChatRequestWideEvent,
  input: {
    readonly status: number
    readonly suppressLog?: boolean
  },
): ChatRequestWideEvent {
  return finalizeBackendWideEventSuccess(event, input)
}

export function finalizeWideEventFailure(
  event: ChatRequestWideEvent,
  input: {
    readonly status: number
    readonly level: BackendWideEventLevel
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
  return finalizeBackendWideEventFailure(event, input)
}

/**
 * Emits one structured log event per request and mirrors failure events to PostHog.
 */
export const drainWideEvent = Effect.fn('ChatObservability.drainWideEvent')((
  event: ChatRequestWideEvent,
) => {
  return createDrainBackendWideEventEffect({
    event,
    logName: 'chat.request',
    annotations: {
      prompt_tokens: event.usage.promptTokens,
      total_tokens: event.usage.totalTokens,
      output_tokens: event.usage.outputTokens,
      estimated_cost_usd: event.usage.estimatedCostUsd,
      actual_cost_usd: event.usage.actualCostUsd,
    },
    afterDrain: (wideEvent) => captureChatWideEventInPostHog(wideEvent),
  })
})

/** Returns stable tag for domain errors; falls back to `UnknownError`. */
export function getErrorTag(error: unknown): string {
  return getBackendErrorTag(error)
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
