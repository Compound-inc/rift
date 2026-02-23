/**
 * Stable error codes intended for client-facing UX and future i18n keys.
 * Keep values immutable once released because clients may persist or branch on them.
 */
export const ChatErrorCode = {
  Unauthorized: 'error_chat_unauthorized',
  InvalidRequest: 'error_chat_invalid_request',
  ThreadNotFound: 'error_chat_thread_not_found',
  ThreadForbidden: 'error_chat_thread_forbidden',
  ModelNotAllowed: 'error_chat_model_not_allowed',
  RateLimited: 'error_chat_rate_limited',
  ProviderUnavailable: 'error_chat_provider_unavailable',
  ToolFailed: 'error_chat_tool_failed',
  PersistenceFailed: 'error_chat_persistence_failed',
  StreamFailed: 'error_chat_stream_failed',
  Unknown: 'error_chat_unknown',
} as const

export type ChatErrorCode = (typeof ChatErrorCode)[keyof typeof ChatErrorCode]

/**
 * Maps backend tagged domain errors to stable transport codes.
 */
export function chatErrorCodeFromTag(tag: string): ChatErrorCode {
  switch (tag) {
    case 'UnauthorizedError':
      return ChatErrorCode.Unauthorized
    case 'InvalidRequestError':
      return ChatErrorCode.InvalidRequest
    case 'ThreadNotFoundError':
      return ChatErrorCode.ThreadNotFound
    case 'ThreadForbiddenError':
      return ChatErrorCode.ThreadForbidden
    case 'ModelPolicyDeniedError':
      return ChatErrorCode.ModelNotAllowed
    case 'RateLimitExceededError':
      return ChatErrorCode.RateLimited
    case 'ModelProviderError':
      return ChatErrorCode.ProviderUnavailable
    case 'ToolExecutionError':
      return ChatErrorCode.ToolFailed
    case 'MessagePersistenceError':
      return ChatErrorCode.PersistenceFailed
    case 'StreamProtocolError':
      return ChatErrorCode.StreamFailed
    default:
      return ChatErrorCode.Unknown
  }
}
