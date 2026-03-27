import { Effect } from 'effect'
import {
  classifyChatError,
  classifyUnknownChatError,
} from '../domain/error-classification'
import { ChatErrorCode } from '../domain/error-codes'
import { toReadableErrorMessage } from '../domain/error-formatting'
import {
  drainWideEvent,
  finalizeWideEventFailure,
  getErrorTag,
} from '../observability/wide-event'
import type { ChatRequestWideEvent } from '../observability/wide-event'
import { jsonResponse, toErrorResponse } from './error-response'
import type { ChatApiErrorEnvelope } from '@/lib/shared/chat-contracts/error-envelope'

export type RouteFailureInput = {
  readonly error: unknown
  readonly requestId: string
  readonly route: string
  readonly eventName: string
  readonly userId?: string
  readonly defaultMessage: string
  readonly wideEvent?: ChatRequestWideEvent
}

/**
 * Central route-level failure handler.
 * Ensures consistent logging + transport error shapes across chat endpoints.
 */
export async function handleRouteFailure(input: RouteFailureInput): Promise<Response> {
  const { error, requestId, defaultMessage, wideEvent } = input
  const errorTag = getErrorTag(error)
  const readableMessage = toReadableErrorMessage(error, defaultMessage)
  const isTaggedDomainError =
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    typeof (error as { _tag?: unknown })._tag === 'string'

  const classification =
    isTaggedDomainError
      ? classifyChatError(error as Parameters<typeof classifyChatError>[0])
      : classifyUnknownChatError()

  if (wideEvent) {
    finalizeWideEventFailure(wideEvent, {
      status: classification.status,
      level: classification.severity,
      captureMode: classification.captureMode,
      retryable: classification.retryable,
      errorTag,
      message: readableMessage,
      errorCode: classification.code,
      cause:
        typeof error === 'object' &&
        error !== null &&
        'cause' in error &&
        typeof (error as { cause?: unknown }).cause === 'string'
          ? (error as { cause: string }).cause
          : undefined,
      i18nKey: classification.i18nKey,
      i18nParams: classification.i18nParams,
    })
    await Effect.runPromise(drainWideEvent(wideEvent)).catch(() => undefined)
  }

  if (isTaggedDomainError) {
    return toErrorResponse(error, requestId)
  }

  const fallbackPayload: ChatApiErrorEnvelope = {
    ok: false,
    error: {
      code: ChatErrorCode.Unknown,
      i18nKey: classification.i18nKey,
      requestId,
      retryable: false,
    },
    requestId,
    telemetry: {
      owner: 'server',
    },
    details: {
      tag: errorTag,
      message: readableMessage,
    },
  }

  return jsonResponse(fallbackPayload, 500)
}
