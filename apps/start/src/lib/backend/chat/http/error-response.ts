import type { ChatDomainError } from '../domain/errors'
import {
  classifyChatError,
  classifyUnknownChatError,
} from '../domain/error-classification'
import { ChatErrorCode } from '../domain/error-codes'
import type { ChatApiErrorEnvelope } from '@/lib/shared/chat-contracts/error-envelope'

export function buildChatApiErrorEnvelope(input: {
  readonly requestId: string
  readonly code: ChatErrorCode
  readonly i18nKey: ChatApiErrorEnvelope['error']['i18nKey']
  readonly i18nParams?: ChatApiErrorEnvelope['error']['i18nParams']
  readonly retryable: boolean
  readonly tag: string
  readonly detailsMessage?: string
  readonly threadId?: string
}): ChatApiErrorEnvelope {
  return {
    ok: false,
    error: {
      code: input.code,
      i18nKey: input.i18nKey,
      i18nParams: input.i18nParams,
      requestId: input.requestId,
      retryable: input.retryable,
    },
    requestId: input.requestId,
    telemetry: {
      owner: 'server',
    },
    details: {
      tag: input.tag,
      message: input.detailsMessage,
      threadId: input.threadId,
    },
  }
}

/**
 * Converts backend failures into the normalized error envelope consumed by
 * chat clients.
 */
export function toErrorResponse(
  error: unknown,
  fallbackRequestId: string,
): Response {
  if (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    typeof error._tag === 'string'
  ) {
    const tagged = error as ChatDomainError
    const classification = classifyChatError(tagged)
    const requestId =
      'requestId' in tagged && typeof tagged.requestId === 'string'
        ? tagged.requestId
        : fallbackRequestId
    const threadId =
      'threadId' in tagged && typeof tagged.threadId === 'string'
        ? tagged.threadId
        : undefined

    const payload = buildChatApiErrorEnvelope({
      requestId,
      code: classification.code,
      i18nKey: classification.i18nKey,
      i18nParams: classification.i18nParams,
      retryable: classification.retryable,
      tag: tagged._tag,
      detailsMessage:
        'message' in tagged && typeof tagged.message === 'string'
          ? tagged.message
          : undefined,
      threadId,
    })

    return jsonResponse(payload, classification.status)
  }

  const classification = classifyUnknownChatError()
  return jsonResponse(
    buildChatApiErrorEnvelope({
      requestId: fallbackRequestId,
      code: ChatErrorCode.Unknown,
      i18nKey: classification.i18nKey,
      retryable: false,
      tag: 'UnknownError',
      detailsMessage: 'Unexpected server error',
    }),
    500,
  )
}

/** JSON helper used by chat API routes for consistent response headers. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
