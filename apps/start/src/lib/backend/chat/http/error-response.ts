import {
  buildStandardApiErrorEnvelope,
  jsonResponse,
  resolveBackendErrorMetadata,
} from '@/lib/backend/server-effect'
import type { ChatDomainError } from '../domain/errors'
import {
  classifyChatError,
  classifyUnknownChatError,
} from '../domain/error-classification'
import { ChatErrorCode } from '../domain/error-codes'
import type { ChatApiErrorEnvelope } from '@/lib/shared/chat-contracts/error-envelope'
export { jsonResponse } from '@/lib/backend/server-effect'

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
  return buildStandardApiErrorEnvelope({
    requestId: input.requestId,
    code: input.code,
    i18nKey: input.i18nKey,
    i18nParams: input.i18nParams,
    retryable: input.retryable,
    details: {
      tag: input.tag,
      message: input.detailsMessage,
      threadId: input.threadId,
    },
  })
}

/**
 * Converts backend failures into the normalized error envelope consumed by
 * chat clients.
 */
export function toErrorResponse(
  error: unknown,
  fallbackRequestId: string,
): Response {
  const resolved = resolveBackendErrorMetadata({
    error,
    fallbackRequestId,
    defaultMessage: 'Unexpected server error',
    classifyTagged: classifyChatError,
    classifyUnknown: classifyUnknownChatError,
    toReadableMessage: () => 'Unexpected server error',
  })

  if (resolved.taggedError) {
    const tagged = resolved.taggedError as ChatDomainError
    const threadId =
      'threadId' in tagged && typeof tagged.threadId === 'string'
        ? tagged.threadId
        : undefined

    const payload = buildChatApiErrorEnvelope({
      requestId: resolved.requestId,
      code: resolved.classification.code,
      i18nKey: resolved.classification.i18nKey,
      i18nParams: resolved.classification.i18nParams,
      retryable: resolved.classification.retryable,
      tag: tagged._tag,
      detailsMessage:
        'message' in tagged && typeof tagged.message === 'string'
          ? tagged.message
          : undefined,
      threadId,
    })

    return jsonResponse(payload, resolved.classification.status)
  }

  return jsonResponse(
    buildChatApiErrorEnvelope({
      requestId: resolved.requestId,
      code: ChatErrorCode.Unknown,
      i18nKey: resolved.classification.i18nKey,
      retryable: false,
      tag: resolved.errorTag,
      detailsMessage: 'Unexpected server error',
    }),
    500,
  )
}
