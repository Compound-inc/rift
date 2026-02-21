import type { ChatErrorCode } from './error-codes'

/**
 * Transport envelope returned by chat API routes for predictable client parsing.
 */
export type ChatApiErrorEnvelope = {
  readonly ok: false
  readonly error: {
    readonly code: ChatErrorCode
    readonly message: string
    readonly requestId: string
    readonly retryable: boolean
  }
  readonly requestId: string
  readonly details: {
    readonly tag: string
    readonly message: string
    readonly threadId?: string
  }
}
