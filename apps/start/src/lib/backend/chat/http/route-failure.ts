import { Effect } from 'effect'
import { handleBackendRouteFailure } from '@/lib/backend/server-effect'
import {
  classifyChatError,
  classifyUnknownChatError,
} from '../domain/error-classification'
import { toReadableErrorCause, toReadableErrorMessage } from '../domain/error-formatting'
import {
  drainWideEvent,
  finalizeWideEventFailure,
} from '../observability/wide-event'
import type { ChatRequestWideEvent } from '../observability/wide-event'
import { toErrorResponse } from './error-response'

export type RouteFailureInput = {
  readonly error: unknown
  readonly requestId: string
  readonly defaultMessage: string
  readonly wideEvent?: ChatRequestWideEvent
}

/**
 * Central route-level failure handler.
 * Ensures consistent logging + transport error shapes across chat endpoints.
 */
export async function handleRouteFailure(input: RouteFailureInput): Promise<Response> {
  return handleBackendRouteFailure({
    error: input.error,
    requestId: input.requestId,
    defaultMessage: input.defaultMessage,
    classifyTagged: classifyChatError,
    classifyUnknown: classifyUnknownChatError,
    toReadableMessage: toReadableErrorMessage,
    toReadableCause: toReadableErrorCause,
    wideEvent: input.wideEvent,
    finalizeWideEvent: ({ wideEvent, error, resolved }) => {
      finalizeWideEventFailure(wideEvent, {
        status: resolved.classification.status,
        level: resolved.classification.severity,
        captureMode: resolved.classification.captureMode,
        retryable: resolved.classification.retryable,
        errorTag: resolved.errorTag,
        message: resolved.readableMessage,
        errorCode: resolved.classification.code,
        cause:
          typeof error === 'object' &&
          error !== null &&
          'cause' in error &&
          typeof (error as { cause?: unknown }).cause === 'string'
            ? (error as { cause: string }).cause
            : undefined,
        i18nKey: resolved.classification.i18nKey,
        i18nParams: resolved.classification.i18nParams,
      })
    },
    drainWideEvent: (wideEvent) =>
      Effect.runPromise(drainWideEvent(wideEvent)).catch(() => undefined),
    toResponse: ({ error }) => toErrorResponse(error, input.requestId),
  })
}
