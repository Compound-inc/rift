export const WritingErrorI18nKey = {
  Unauthorized: 'error_writing_unauthorized',
  InvalidRequest: 'error_writing_invalid_request',
  ProjectNotFound: 'error_writing_project_not_found',
  ChatNotFound: 'error_writing_chat_not_found',
  Conflict: 'error_writing_conflict',
  PersistenceFailed: 'error_writing_persistence_failed',
  ToolFailed: 'error_writing_tool_failed',
  AgentFailed: 'error_writing_agent_failed',
  Unknown: 'error_writing_unknown',
} as const

export type WritingErrorI18nKey =
  (typeof WritingErrorI18nKey)[keyof typeof WritingErrorI18nKey]

export type WritingErrorI18nParams = Readonly<
  Record<string, string | number | boolean>
>
