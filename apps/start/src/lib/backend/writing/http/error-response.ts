import {
  buildStandardApiErrorEnvelope,
  jsonResponse,
  resolveBackendErrorMetadata,
} from '@/lib/backend/server-effect'
import {
  classifyUnknownWritingError,
  classifyWritingError,
} from '../domain/error-classification'
import {
  extractWritingErrorContext,
  toReadableWritingErrorCause,
  toReadableWritingErrorMessage,
} from '../domain/error-formatting'

/**
 * Normalizes writing backend failures into a compact JSON envelope that keeps
 * request ids and domain context attached for debugging.
 */
export function toWritingErrorResponse(
  error: unknown,
  fallbackRequestId: string,
  defaultMessage = 'Unexpected writing backend error',
): Response {
  const resolved = resolveBackendErrorMetadata({
    error,
    fallbackRequestId,
    defaultMessage,
    classifyTagged: classifyWritingError,
    classifyUnknown: classifyUnknownWritingError,
    toReadableMessage: toReadableWritingErrorMessage,
    toReadableCause: toReadableWritingErrorCause,
    extractContext: extractWritingErrorContext,
  })

  if (resolved.taggedError) {
    return jsonResponse(
      buildStandardApiErrorEnvelope({
        requestId: resolved.requestId,
        code: resolved.classification.code,
        i18nKey: resolved.classification.i18nKey,
        i18nParams: resolved.classification.i18nParams,
        retryable: resolved.classification.retryable,
        details: {
          ...resolved.context,
          tag: resolved.taggedError._tag,
          message: resolved.readableMessage,
          cause:
            resolved.readableCause !== resolved.readableMessage
              ? resolved.readableCause
              : undefined,
        },
      }),
      resolved.classification.status,
    )
  }

  return jsonResponse(
    buildStandardApiErrorEnvelope({
      requestId: resolved.requestId,
      code: resolved.classification.code,
      i18nKey: resolved.classification.i18nKey,
      i18nParams: resolved.classification.i18nParams,
      retryable: resolved.classification.retryable,
      details: {
        tag: resolved.errorTag,
        message: resolved.readableMessage,
        cause: resolved.readableCause,
      },
    }),
    resolved.classification.status,
  )
}
