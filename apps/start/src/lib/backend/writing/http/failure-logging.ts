import { logBackendFailure } from '@/lib/backend/server-effect'
import {
  extractWritingErrorContext,
  toReadableWritingErrorCause,
  toReadableWritingErrorMessage,
} from '../domain/error-formatting'
import { classifyUnknownWritingError, classifyWritingError } from '../domain/error-classification'

export type WritingFailureLogInput = {
  readonly error: unknown
  readonly requestId: string
  readonly surface: 'route' | 'server-function'
  readonly operation: string
  readonly defaultMessage: string
  readonly route?: string
  readonly method?: string
  readonly userId?: string
  readonly organizationId?: string
  readonly projectId?: string
  readonly chatId?: string
}

export async function logWritingFailure(input: WritingFailureLogInput): Promise<void> {
  await logBackendFailure({
    logName: 'writing.request',
    error: input.error,
    requestId: input.requestId,
    defaultMessage: input.defaultMessage,
    classifyTagged: classifyWritingError,
    classifyUnknown: classifyUnknownWritingError,
    toReadableMessage: toReadableWritingErrorMessage,
    toReadableCause: toReadableWritingErrorCause,
    extractContext: extractWritingErrorContext,
    annotations: (resolved) => ({
      surface: input.surface,
      operation: input.operation,
      route: input.route,
      method: input.method,
      user_id: input.userId,
      organization_id: input.organizationId,
      project_id: input.projectId ?? resolved.context.projectId,
      chat_id: input.chatId ?? resolved.context.chatId,
      error_issue: resolved.context.issue,
      error_path: resolved.context.path,
      error_tool_name: resolved.context.toolName,
      expected_head_snapshot_id: resolved.context.expectedHeadSnapshotId,
      actual_head_snapshot_id: resolved.context.actualHeadSnapshotId,
    }),
  })
}
