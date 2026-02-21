import type { ChatDomainError } from '../domain/errors'

export function toErrorResponse(error: unknown, fallbackRequestId: string): Response {
  if (
    typeof error === 'object' &&
    error !== null &&
    '_tag' in error &&
    typeof error._tag === 'string'
  ) {
    const tagged = error as ChatDomainError
    const status = statusForTag(tagged._tag)
    const userMessage = userMessageForTag(tagged._tag)
    const requestId =
      'requestId' in tagged && typeof tagged.requestId === 'string'
        ? tagged.requestId
        : fallbackRequestId
    const threadId =
      'threadId' in tagged && typeof tagged.threadId === 'string'
        ? tagged.threadId
        : undefined

    const payload = {
      error: userMessage,
      errorCode: tagged._tag,
      requestId,
      details: {
        tag: tagged._tag,
        message:
          'message' in tagged && typeof tagged.message === 'string'
            ? tagged.message
            : userMessage,
        threadId,
        retryable: isRetryable(tagged._tag),
      },
    }

    return jsonResponse(payload, status)
  }

  return jsonResponse(
    {
      error: 'Unexpected server error',
      errorCode: 'UnknownError',
      requestId: fallbackRequestId,
      details: {
        tag: 'UnknownError',
        message: 'Unexpected server error',
        retryable: false,
      },
    },
    500,
  )
}

function userMessageForTag(tag: string): string {
  switch (tag) {
    case 'UnauthorizedError':
      return 'Please sign in and try again.'
    case 'InvalidRequestError':
      return 'Your request was invalid. Please refresh and retry.'
    case 'ThreadNotFoundError':
      return 'This chat thread could not be found.'
    case 'ThreadForbiddenError':
      return 'You do not have access to this chat thread.'
    case 'RateLimitExceededError':
      return 'Too many requests. Please wait a moment and retry.'
    case 'ModelProviderError':
      return 'The AI provider is currently unavailable. Please retry.'
    case 'ToolExecutionError':
      return 'A tool failed while processing your request.'
    case 'MessagePersistenceError':
      return 'Your message could not be saved. Please retry.'
    case 'StreamProtocolError':
      return 'The response stream failed. Please retry.'
    default:
      return 'Unexpected server error'
  }
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
