import type { ChatErrorCode } from './error-codes'
import type { ChatErrorI18nKey, ChatErrorI18nParams } from './error-i18n'

/**
 * Transport envelope returned by chat API routes for predictable client parsing.
 */
export type ChatApiErrorEnvelope = {
  readonly ok: false
  readonly error: {
    readonly code: ChatErrorCode
    readonly i18nKey: ChatErrorI18nKey
    readonly i18nParams?: ChatErrorI18nParams
    readonly requestId: string
    readonly retryable: boolean
  }
  readonly requestId: string
  readonly telemetry: {
    readonly owner: 'server'
  }
  readonly details: {
    readonly tag: string
    readonly message?: string
    readonly threadId?: string
  }
}
