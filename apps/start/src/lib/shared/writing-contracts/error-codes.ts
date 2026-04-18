export const WritingErrorCode = {
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

export type WritingErrorCode =
  (typeof WritingErrorCode)[keyof typeof WritingErrorCode]

export function writingErrorCodeFromTag(tag: string): WritingErrorCode {
  switch (tag) {
    case 'WritingUnauthorizedError':
      return WritingErrorCode.Unauthorized
    case 'WritingInvalidRequestError':
      return WritingErrorCode.InvalidRequest
    case 'WritingProjectNotFoundError':
      return WritingErrorCode.ProjectNotFound
    case 'WritingChatNotFoundError':
      return WritingErrorCode.ChatNotFound
    case 'WritingConflictError':
      return WritingErrorCode.Conflict
    case 'WritingPersistenceError':
      return WritingErrorCode.PersistenceFailed
    case 'WritingToolExecutionError':
      return WritingErrorCode.ToolFailed
    case 'WritingAgentError':
      return WritingErrorCode.AgentFailed
    default:
      return WritingErrorCode.Unknown
  }
}
