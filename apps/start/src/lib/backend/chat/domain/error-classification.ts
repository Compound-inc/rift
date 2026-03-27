import { ChatErrorCode, chatErrorCodeFromTag } from './error-codes'
import type { ChatDomainError } from './errors'
import { ChatErrorI18nKey } from '@/lib/shared/chat-contracts/error-i18n'
import type {
  ChatErrorI18nKey as TChatErrorI18nKey,
  ChatErrorI18nParams,
} from '@/lib/shared/chat-contracts/error-i18n'

export type ChatErrorClassification = {
  readonly status: number
  readonly code: ChatErrorCode
  readonly i18nKey: TChatErrorI18nKey
  readonly i18nParams?: ChatErrorI18nParams
  readonly retryable: boolean
  readonly severity: 'info' | 'warn' | 'error'
  readonly captureMode: 'none' | 'signal' | 'exception'
}

/**
 * Collapses tagged chat failures into one transport + observability decision so
 * routes, stream hooks, and external drains stay consistent.
 */
export function classifyChatError(error: ChatDomainError): ChatErrorClassification {
  const base = {
    code: chatErrorCodeFromTag(error._tag),
    i18nKey: defaultI18nKeyForTag(error._tag),
    retryable: isRetryable(error._tag),
    severity: severityForTag(error._tag),
    captureMode: severityForTag(error._tag) === 'error' ? 'exception' : 'none',
  } satisfies Omit<
    ChatErrorClassification,
    'status' | 'i18nParams'
  >

  switch (error._tag) {
    case 'UnauthorizedError':
      return {
        ...base,
        status: 401,
        captureMode: 'none',
      }
    case 'InvalidRequestError':
      return {
        ...base,
        status: 400,
        i18nKey:
          error.issue === 'feature_denied:chat.fileUpload'
            ? ChatErrorI18nKey.FileUploadPlanRestricted
            : ChatErrorI18nKey.InvalidRequest,
        captureMode: invalidRequestCaptureMode(error.issue),
      }
    case 'ThreadNotFoundError':
      return {
        ...base,
        status: 404,
        captureMode: 'none',
      }
    case 'ThreadForbiddenError':
      return {
        ...base,
        status: 403,
        captureMode: 'signal',
      }
    case 'BranchVersionConflictError':
      return {
        ...base,
        status: 409,
        retryable: true,
        captureMode: 'exception',
      }
    case 'InvalidEditTargetError':
      return {
        ...base,
        status: 400,
        severity: 'warn',
        captureMode: 'none',
      }
    case 'RateLimitExceededError':
      return {
        ...base,
        status: 429,
        i18nKey: ChatErrorI18nKey.RateLimited,
        i18nParams: {
          retryAfterSeconds: Math.max(1, Math.ceil(error.retryAfterMs / 1000)),
        },
        severity: 'warn',
        captureMode: 'none',
      }
    case 'RateLimitPersistenceError':
      return {
        ...base,
        status: 500,
        i18nKey: ChatErrorI18nKey.PersistenceFailed,
        captureMode: 'exception',
      }
    case 'QuotaExceededError':
      return {
        ...base,
        status: 429,
        i18nKey:
          error.reasonCode === 'free_allowance_exhausted'
            ? ChatErrorI18nKey.FreeAllowanceExhausted
            : ChatErrorI18nKey.QuotaExceeded,
        i18nParams: {
          retryAfterSeconds: Math.max(1, Math.ceil(error.retryAfterMs / 1000)),
        },
        severity: 'warn',
        captureMode: 'none',
      }
    case 'ModelProviderError':
      return {
        ...base,
        status: 502,
        i18nKey: ChatErrorI18nKey.ProviderUnavailable,
        captureMode: 'exception',
      }
    case 'ModelPolicyDeniedError':
      return {
        ...base,
        status: 403,
        i18nKey: getModelPolicyDeniedI18nKey(error.reason),
        captureMode: modelPolicyDeniedCaptureMode(error.reason),
      }
    case 'ContextWindowExceededError':
      return {
        ...base,
        status: 413,
        i18nKey:
          error.contextWindowMode === 'standard'
            ? ChatErrorI18nKey.ContextWindowExceededMaxAvailable
            : ChatErrorI18nKey.ContextWindowExceeded,
        i18nParams: {
          usedTokens: error.usedTokens,
          maxTokens: error.maxTokens,
        },
        severity: 'warn',
        captureMode: 'none',
      }
    case 'ToolExecutionError':
      return {
        ...base,
        status: 500,
        i18nKey: ChatErrorI18nKey.ToolFailed,
        captureMode: 'exception',
      }
    case 'MessagePersistenceError':
      return {
        ...base,
        status: 500,
        i18nKey: ChatErrorI18nKey.PersistenceFailed,
        captureMode: 'exception',
      }
    case 'StreamProtocolError':
      return {
        ...base,
        status: 500,
        i18nKey: ChatErrorI18nKey.StreamFailed,
        retryable: true,
        captureMode: 'exception',
      }
  }
}

export function classifyUnknownChatError(): ChatErrorClassification {
  return {
    status: 500,
    code: ChatErrorCode.Unknown,
    i18nKey: ChatErrorI18nKey.Unknown,
    retryable: false,
    severity: 'error',
    captureMode: 'exception',
  }
}

function invalidRequestCaptureMode(
  issue: string | undefined,
): ChatErrorClassification['captureMode'] {
  if (!issue) return 'signal'
  if (issue === 'feature_denied:chat.fileUpload') return 'none'
  if (issue === 'thread is currently generating') return 'none'
  if (
    issue === 'expectedBranchVersion is required' ||
    issue === 'message is required for submit-message' ||
    issue === 'messageId is required for regenerate-message' ||
    issue === 'messageId is required for edit-message' ||
    issue === 'editedText is required for edit-message' ||
    issue === 'threadId is required for stream resume'
  ) {
    return 'signal'
  }
  if (issue.includes('Schema decode')) {
    return 'signal'
  }
  return 'none'
}

function modelPolicyDeniedCaptureMode(
  reason: string,
): ChatErrorClassification['captureMode'] {
  if (
    reason.startsWith('free_tier_model_denied:') ||
    reason.includes('missing_provider_api_key') ||
    reason.includes('model_not_supported_for_provider_key')
  ) {
    return 'signal'
  }

  return 'none'
}

function defaultI18nKeyForTag(tag: string): TChatErrorI18nKey {
  switch (tag) {
    case 'UnauthorizedError':
      return ChatErrorI18nKey.Unauthorized
    case 'InvalidRequestError':
      return ChatErrorI18nKey.InvalidRequest
    case 'ThreadNotFoundError':
      return ChatErrorI18nKey.ThreadNotFound
    case 'ThreadForbiddenError':
      return ChatErrorI18nKey.ThreadForbidden
    case 'BranchVersionConflictError':
      return ChatErrorI18nKey.BranchVersionConflict
    case 'InvalidEditTargetError':
      return ChatErrorI18nKey.InvalidEditTarget
    case 'RateLimitExceededError':
      return ChatErrorI18nKey.RateLimited
    case 'RateLimitPersistenceError':
      return ChatErrorI18nKey.PersistenceFailed
    case 'QuotaExceededError':
      return ChatErrorI18nKey.QuotaExceeded
    case 'ModelProviderError':
      return ChatErrorI18nKey.ProviderUnavailable
    case 'ModelPolicyDeniedError':
      return ChatErrorI18nKey.ModelNotAllowed
    case 'ContextWindowExceededError':
      return ChatErrorI18nKey.ContextWindowExceeded
    case 'ToolExecutionError':
      return ChatErrorI18nKey.ToolFailed
    case 'MessagePersistenceError':
      return ChatErrorI18nKey.PersistenceFailed
    case 'StreamProtocolError':
      return ChatErrorI18nKey.StreamFailed
    default:
      return ChatErrorI18nKey.Unknown
  }
}

function getModelPolicyDeniedI18nKey(reason: string): TChatErrorI18nKey {
  if (reason.startsWith('free_tier_model_denied:')) {
    return ChatErrorI18nKey.ModelRequiresPaidPlan
  }
  if (reason.includes('model_not_supported_for_provider_key')) {
    return ChatErrorI18nKey.ProviderModelKeyIncompatible
  }
  if (reason.includes('missing_provider_api_key')) {
    return ChatErrorI18nKey.ProviderKeyMissing
  }

  return ChatErrorI18nKey.ModelNotAllowed
}

function isRetryable(tag: string): boolean {
  switch (tag) {
    case 'RateLimitExceededError':
    case 'QuotaExceededError':
    case 'ModelProviderError':
    case 'StreamProtocolError':
      return true
    default:
      return false
  }
}

function severityForTag(tag: string): 'info' | 'warn' | 'error' {
  switch (tag) {
    case 'UnauthorizedError':
    case 'InvalidRequestError':
    case 'ThreadNotFoundError':
    case 'ThreadForbiddenError':
    case 'BranchVersionConflictError':
    case 'InvalidEditTargetError':
    case 'RateLimitExceededError':
    case 'QuotaExceededError':
    case 'ModelPolicyDeniedError':
    case 'ContextWindowExceededError':
      return 'warn'
    default:
      return 'error'
  }
}
