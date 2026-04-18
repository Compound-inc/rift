import { WritingErrorI18nKey } from '@/lib/shared/writing-contracts/error-i18n'
import type {
  WritingErrorI18nKey as TWritingErrorI18nKey,
  WritingErrorI18nParams,
} from '@/lib/shared/writing-contracts/error-i18n'
import { WritingErrorCode, writingErrorCodeFromTag } from './error-codes'
import type { WritingDomainError } from './errors'

export type WritingErrorClassification = {
  readonly status: number
  readonly code: WritingErrorCode
  readonly i18nKey: TWritingErrorI18nKey
  readonly i18nParams?: WritingErrorI18nParams
  readonly retryable: boolean
  readonly severity: 'info' | 'warn' | 'error'
  readonly captureMode: 'none' | 'signal' | 'exception'
}

export function classifyWritingError(
  error: WritingDomainError,
): WritingErrorClassification {
  const base = {
    code: writingErrorCodeFromTag(error._tag),
    i18nKey: defaultI18nKeyForTag(error._tag),
    retryable: false,
    severity: severityForTag(error._tag),
    captureMode: severityForTag(error._tag) === 'error' ? 'exception' : 'none',
  } satisfies Omit<WritingErrorClassification, 'status' | 'i18nParams'>

  switch (error._tag) {
    case 'WritingUnauthorizedError':
      return {
        ...base,
        status: 401,
        captureMode: 'none',
      }
    case 'WritingInvalidRequestError':
      return {
        ...base,
        status: 400,
        severity: 'warn',
        captureMode: 'none',
      }
    case 'WritingProjectNotFoundError':
      return {
        ...base,
        status: 404,
        severity: 'info',
        captureMode: 'none',
      }
    case 'WritingChatNotFoundError':
      return {
        ...base,
        status: 404,
        severity: 'info',
        captureMode: 'none',
      }
    case 'WritingConflictError':
      return {
        ...base,
        status: 409,
        retryable: true,
        severity: 'warn',
        captureMode: 'signal',
      }
    case 'WritingPersistenceError':
    case 'WritingToolExecutionError':
    case 'WritingAgentError':
      return {
        ...base,
        status: 500,
        captureMode: 'exception',
      }
  }
}

export function classifyUnknownWritingError(): WritingErrorClassification {
  return {
    status: 500,
    code: WritingErrorCode.Unknown,
    i18nKey: WritingErrorI18nKey.Unknown,
    retryable: false,
    severity: 'error',
    captureMode: 'exception',
  }
}

function defaultI18nKeyForTag(tag: string): TWritingErrorI18nKey {
  switch (tag) {
    case 'WritingUnauthorizedError':
      return WritingErrorI18nKey.Unauthorized
    case 'WritingInvalidRequestError':
      return WritingErrorI18nKey.InvalidRequest
    case 'WritingProjectNotFoundError':
      return WritingErrorI18nKey.ProjectNotFound
    case 'WritingChatNotFoundError':
      return WritingErrorI18nKey.ChatNotFound
    case 'WritingConflictError':
      return WritingErrorI18nKey.Conflict
    case 'WritingPersistenceError':
      return WritingErrorI18nKey.PersistenceFailed
    case 'WritingToolExecutionError':
      return WritingErrorI18nKey.ToolFailed
    case 'WritingAgentError':
      return WritingErrorI18nKey.AgentFailed
    default:
      return WritingErrorI18nKey.Unknown
  }
}

function severityForTag(
  tag: string,
): WritingErrorClassification['severity'] {
  switch (tag) {
    case 'WritingUnauthorizedError':
    case 'WritingProjectNotFoundError':
    case 'WritingChatNotFoundError':
      return 'info'
    case 'WritingInvalidRequestError':
    case 'WritingConflictError':
      return 'warn'
    default:
      return 'error'
  }
}
