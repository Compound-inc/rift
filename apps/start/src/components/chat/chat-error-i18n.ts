'use client'

import type {
  ChatErrorI18nKey,
  ChatErrorI18nParams,
} from '@/lib/shared/chat-contracts/error-i18n'
import { m } from '@/paraglide/messages.js'

/**
 * Resolves server-sent translation keys into localized prompt-error copy.
 */
export function resolveChatErrorMessage(
  key: ChatErrorI18nKey,
  params?: ChatErrorI18nParams,
): string {
  switch (key) {
    case 'error_chat_unauthorized':
      return m.error_chat_unauthorized()
    case 'error_chat_invalid_request':
      return m.error_chat_invalid_request()
    case 'error_chat_thread_not_found':
      return m.error_chat_thread_not_found()
    case 'error_chat_thread_forbidden':
      return m.error_chat_thread_forbidden()
    case 'error_chat_branch_version_conflict':
      return m.error_chat_branch_version_conflict()
    case 'error_chat_invalid_edit_target':
      return m.error_chat_invalid_edit_target()
    case 'error_chat_model_not_allowed':
      return m.error_chat_model_not_allowed()
    case 'error_chat_model_requires_paid_plan':
      return m.error_chat_model_requires_paid_plan()
    case 'error_chat_provider_key_missing':
      return m.error_chat_provider_key_missing()
    case 'error_chat_provider_model_key_incompatible':
      return m.error_chat_provider_model_key_incompatible()
    case 'error_chat_context_window_exceeded':
      return m.error_chat_context_window_exceeded({
        maxTokens: asNumberParam(params?.maxTokens),
      })
    case 'error_chat_context_window_exceeded_max_available':
      return m.error_chat_context_window_exceeded_max_available({
        maxTokens: asNumberParam(params?.maxTokens),
      })
    case 'error_chat_rate_limited':
      return m.error_chat_rate_limited({
        retryAfterSeconds: asNumberParam(params?.retryAfterSeconds),
      })
    case 'error_chat_quota_exceeded':
      return m.error_chat_quota_exceeded({
        retryAfterSeconds: asNumberParam(params?.retryAfterSeconds),
      })
    case 'error_chat_free_allowance_exhausted':
      return m.error_chat_free_allowance_exhausted({
        retryAfterSeconds: asNumberParam(params?.retryAfterSeconds),
      })
    case 'error_chat_provider_unavailable':
      return m.error_chat_provider_unavailable()
    case 'error_chat_tool_failed':
      return m.error_chat_tool_failed()
    case 'error_chat_persistence_failed':
      return m.error_chat_persistence_failed()
    case 'error_chat_stream_failed':
      return m.error_chat_stream_failed()
    case 'error_chat_file_upload_plan_restricted':
      return m.error_chat_file_upload_plan_restricted()
    case 'error_chat_unknown':
    default:
      return m.error_chat_unknown()
  }
}

function asNumberParam(value: string | number | boolean | undefined): number {
  return typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : 0
}
