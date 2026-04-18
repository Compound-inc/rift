import { Effect } from 'effect'
import { handleBackendRouteFailure } from '@/lib/backend/server-effect'
import {
  classifyUnknownWritingError,
  classifyWritingError,
} from '../domain/error-classification'
import {
  extractWritingErrorContext,
  toReadableWritingErrorCause,
  toReadableWritingErrorMessage,
} from '../domain/error-formatting'
import {
  drainWritingWideEvent,
  finalizeWritingWideEventFailure,
  type WritingRequestWideEvent,
} from '../observability/wide-event'
import { logWritingFailure, type WritingFailureLogInput } from './failure-logging'
import { toWritingErrorResponse } from './error-response'

export type WritingRouteFailureInput = Omit<WritingFailureLogInput, 'surface'> & {
  readonly wideEvent?: WritingRequestWideEvent
}

/**
 * Central route failure helper for writing endpoints. It keeps route handlers
 * thin while guaranteeing structured logs and a predictable JSON envelope.
 */
export async function handleWritingRouteFailure(
  input: WritingRouteFailureInput,
): Promise<Response> {
  return handleBackendRouteFailure({
    error: input.error,
    requestId: input.requestId,
    defaultMessage: input.defaultMessage,
    classifyTagged: classifyWritingError,
    classifyUnknown: classifyUnknownWritingError,
    toReadableMessage: toReadableWritingErrorMessage,
    toReadableCause: toReadableWritingErrorCause,
    extractContext: extractWritingErrorContext,
    wideEvent: input.wideEvent,
    finalizeWideEvent: ({ wideEvent, resolved }) => {
      finalizeWritingWideEventFailure(wideEvent, {
        status: resolved.classification.status,
        level: resolved.classification.severity,
        captureMode: resolved.classification.captureMode,
        retryable: resolved.classification.retryable,
        errorTag: resolved.errorTag,
        message: resolved.readableMessage,
        errorCode: resolved.classification.code,
        cause: resolved.readableCause,
        i18nKey: resolved.classification.i18nKey,
        i18nParams: resolved.classification.i18nParams,
      })
    },
    drainWideEvent: (wideEvent) =>
      Effect.runPromise(drainWritingWideEvent(wideEvent)).catch(() => undefined),
    onMissingWideEvent: () =>
      logWritingFailure({
        ...input,
        surface: 'route',
      }),
    toResponse: ({ error }) =>
      toWritingErrorResponse(error, input.requestId, input.defaultMessage),
  })
}
