import type { ChatDomainError } from '../domain/errors'
import { ChatErrorCode, chatErrorCodeFromTag } from '../domain/error-codes'
import { getChatErrorMessage } from '../domain/error-messages'

export function toErrorResponse(error: unknown, fallbackRequestId: string): Response {
  if (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    typeof error._tag === 'string'
  ) {
    const tagged = error as ChatDomainError
    const status = statusForTag(tagged._tag)
    const errorCode = chatErrorCodeFromTag(tagged._tag)
    const userMessage = getChatErrorMessage(errorCode)
    const requestId =
      'requestId' in tagged && typeof tagged.requestId === 'string'
        ? tagged.requestId
        : fallbackRequestId
    const threadId =
      'threadId' in tagged && typeof tagged.threadId === 'string'
        ? tagged.threadId
        : undefined

    const payload = {
      ok: false,
      error: {
        code: errorCode,
        message: userMessage,
        requestId,
        retryable: isRetryable(tagged._tag),
      },
      requestId,
      details: {
        tag: tagged._tag,
        message:
          'message' in tagged && typeof tagged.message === 'string'
            ? tagged.message
            : userMessage,
        threadId,
      },
    }

    return jsonResponse(payload, status)
  }

  return jsonResponse(
    {
      ok: false,
      error: {
        code: ChatErrorCode.Unknown,
        message: getChatErrorMessage(ChatErrorCode.Unknown),
        requestId: fallbackRequestId,
        retryable: false,
      },
      requestId: fallbackRequestId,
      details: {
        tag: 'UnknownError',
        message: 'Unexpected server error',
      },
    },
    500,
  )
}

function statusForTag(tag: string): number {
  switch (tag) {
    case 'UnauthorizedError':
      return 401
    case 'InvalidRequestError':
      return 400
    case 'ThreadNotFoundError':
      return 404
    case 'ThreadForbiddenError':
      return 403
    case 'RateLimitExceededError':
      return 429
    case 'ModelProviderError':
    case 'ToolExecutionError':
    case 'MessagePersistenceError':
    case 'StreamProtocolError':
      return 500
    default:
      return 500
  }
}

function isRetryable(tag: string): boolean {
  switch (tag) {
    case 'RateLimitExceededError':
    case 'ModelProviderError':
    case 'StreamProtocolError':
      return true
    default:
      return false
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
