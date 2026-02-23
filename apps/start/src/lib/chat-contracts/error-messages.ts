import { ChatErrorCode } from './error-codes'
import type { ChatErrorCode as TChatErrorCode } from './error-codes'

/**
 * Default English copy for user-facing errors.
 * Replace with i18n lookup when translations are introduced.
 */
export const chatErrorMessages: Record<TChatErrorCode, string> = {
  [ChatErrorCode.Unauthorized]: 'Please sign in and try again.',
  [ChatErrorCode.InvalidRequest]: 'Your request was invalid. Please refresh and retry.',
  [ChatErrorCode.ThreadNotFound]: 'This chat thread could not be found.',
  [ChatErrorCode.ThreadForbidden]: 'You do not have access to this chat thread.',
  [ChatErrorCode.ModelNotAllowed]: 'The selected AI model is not allowed for your organization.',
  [ChatErrorCode.RateLimited]: 'Too many requests. Please wait a moment and retry.',
  [ChatErrorCode.ProviderUnavailable]: 'The AI provider is currently unavailable. Please retry.',
  [ChatErrorCode.ToolFailed]: 'A tool failed while processing your request.',
  [ChatErrorCode.PersistenceFailed]: 'Your message could not be saved. Please retry.',
  [ChatErrorCode.StreamFailed]: 'The response stream failed. Please retry.',
  [ChatErrorCode.Unknown]: 'Unexpected server error.',
}

export function getChatErrorMessage(code: TChatErrorCode): string {
  return chatErrorMessages[code]
}
