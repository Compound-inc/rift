/**
 * Stable translation keys returned by the chat API. These keys are resolved on
 * the client so backend error classification stays locale-agnostic.
 */
export const ChatErrorI18nKey = {
  Unauthorized: 'error_chat_unauthorized',
  InvalidRequest: 'error_chat_invalid_request',
  ThreadNotFound: 'error_chat_thread_not_found',
  ThreadForbidden: 'error_chat_thread_forbidden',
  BranchVersionConflict: 'error_chat_branch_version_conflict',
  InvalidEditTarget: 'error_chat_invalid_edit_target',
  ModelNotAllowed: 'error_chat_model_not_allowed',
  ModelRequiresPaidPlan: 'error_chat_model_requires_paid_plan',
  ProviderKeyMissing: 'error_chat_provider_key_missing',
  ProviderModelKeyIncompatible: 'error_chat_provider_model_key_incompatible',
  ContextWindowExceeded: 'error_chat_context_window_exceeded',
  ContextWindowExceededMaxAvailable: 'error_chat_context_window_exceeded_max_available',
  RateLimited: 'error_chat_rate_limited',
  QuotaExceeded: 'error_chat_quota_exceeded',
  FreeAllowanceExhausted: 'error_chat_free_allowance_exhausted',
  ProviderUnavailable: 'error_chat_provider_unavailable',
  ToolFailed: 'error_chat_tool_failed',
  PersistenceFailed: 'error_chat_persistence_failed',
  StreamFailed: 'error_chat_stream_failed',
  FileUploadPlanRestricted: 'error_chat_file_upload_plan_restricted',
  Unknown: 'error_chat_unknown',
} as const

export type ChatErrorI18nKey =
  (typeof ChatErrorI18nKey)[keyof typeof ChatErrorI18nKey]

/**
 * Translation params are intentionally primitive so they can be serialized in
 * the API envelope and consumed by Paraglide without backend runtime imports.
 */
export type ChatErrorI18nParams = Readonly<
  Record<string, string | number | boolean>
>
