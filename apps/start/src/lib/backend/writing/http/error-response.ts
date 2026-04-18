import {
  classifyUnknownWritingError,
  classifyWritingError,
} from '../domain/error-classification'
import {
  extractWritingErrorContext,
  getWritingErrorTag,
  toReadableWritingErrorCause,
  toReadableWritingErrorMessage,
} from '../domain/error-formatting'
import type { WritingDomainError } from '../domain/errors'

export type WritingApiErrorEnvelope = {
  readonly ok: false
  readonly requestId: string
  readonly error: {
    readonly tag: string
    readonly message: string
    readonly retryable: boolean
  }
  readonly details?: {
    readonly cause?: string
    readonly issue?: string
    readonly projectId?: string
    readonly chatId?: string
    readonly path?: string
    readonly toolName?: string
    readonly expectedHeadSnapshotId?: string
    readonly actualHeadSnapshotId?: string
  }
}

export function buildWritingApiErrorEnvelope(input: {
  readonly requestId: string
  readonly tag: string
  readonly message: string
  readonly retryable: boolean
  readonly details?: WritingApiErrorEnvelope['details']
}): WritingApiErrorEnvelope {
  return {
    ok: false,
    requestId: input.requestId,
    error: {
      tag: input.tag,
      message: input.message,
      retryable: input.retryable,
    },
    details: input.details,
  }
}

/**
 * Normalizes writing backend failures into a compact JSON envelope that keeps
 * request ids and domain context attached for debugging.
 */
export function toWritingErrorResponse(
  error: unknown,
  fallbackRequestId: string,
  defaultMessage = 'Unexpected writing backend error',
): Response {
  if (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    typeof (error as { _tag?: unknown })._tag === 'string'
  ) {
    const tagged = error as WritingDomainError
    const classification = classifyWritingError(tagged)
    const requestId =
      'requestId' in tagged && typeof tagged.requestId === 'string'
        ? tagged.requestId
        : fallbackRequestId
    const message = toReadableWritingErrorMessage(tagged, defaultMessage)
    const cause = toReadableWritingErrorCause(tagged, 'No additional error details')
    const context = extractWritingErrorContext(tagged)

    const payload = buildWritingApiErrorEnvelope({
      requestId,
      tag: tagged._tag,
      message,
      retryable: classification.retryable,
      details: {
        ...context,
        cause: cause !== message ? cause : undefined,
      },
    })

    return jsonResponse(payload, classification.status)
  }

  const classification = classifyUnknownWritingError()
  return jsonResponse(
    buildWritingApiErrorEnvelope({
      requestId: fallbackRequestId,
      tag: getWritingErrorTag(error),
      message: toReadableWritingErrorMessage(error, defaultMessage),
      retryable: classification.retryable,
      details: {
        cause: toReadableWritingErrorCause(error, 'No additional error details'),
      },
    }),
    classification.status,
  )
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
