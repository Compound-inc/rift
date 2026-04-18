import type { WritingDomainError } from './errors'

export type WritingErrorClassification = {
  readonly status: number
  readonly retryable: boolean
  readonly severity: 'info' | 'warn' | 'error'
  readonly captureMode: 'none' | 'signal' | 'exception'
}

export function classifyWritingError(
  error: WritingDomainError,
): WritingErrorClassification {
  switch (error._tag) {
    case 'WritingUnauthorizedError':
      return {
        status: 401,
        retryable: false,
        severity: 'info',
        captureMode: 'none',
      }
    case 'WritingInvalidRequestError':
      return {
        status: 400,
        retryable: false,
        severity: 'warn',
        captureMode: 'none',
      }
    case 'WritingProjectNotFoundError':
    case 'WritingChatNotFoundError':
      return {
        status: 404,
        retryable: false,
        severity: 'info',
        captureMode: 'none',
      }
    case 'WritingConflictError':
      return {
        status: 409,
        retryable: true,
        severity: 'warn',
        captureMode: 'signal',
      }
    case 'WritingPersistenceError':
    case 'WritingToolExecutionError':
    case 'WritingAgentError':
      return {
        status: 500,
        retryable: false,
        severity: 'error',
        captureMode: 'exception',
      }
  }
}

export function classifyUnknownWritingError(): WritingErrorClassification {
  return {
    status: 500,
    retryable: false,
    severity: 'error',
    captureMode: 'exception',
  }
}
