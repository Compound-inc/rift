import { Effect } from 'effect'
import { ServerRuntime } from '@/lib/backend/server-effect'
import {
  classifyUnknownWritingError,
  classifyWritingError,
} from '../domain/error-classification'
import {
  extractWritingErrorContext,
  getWritingErrorTag,
  toReadableWritingErrorCause,
  toReadableWritingErrorMessage,
} from '../domain/error-formatting'
import type { WritingDomainError } from '../domain/errors'

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

/**
 * Shared writing failure logger used by both route handlers and server
 * functions. The goal is to make every failure searchable with the same core
 * fields: request id, error tag, operation, user/project context, and cause.
 */
export const createWritingFailureLogEffect = Effect.fn(
  'WritingHttp.createWritingFailureLogEffect',
)((input: WritingFailureLogInput) => {
  const errorTag = getWritingErrorTag(input.error)
  const context = extractWritingErrorContext(input.error)
  const readableMessage = toReadableWritingErrorMessage(input.error, input.defaultMessage)
  const readableCause = toReadableWritingErrorCause(
    input.error,
    'No additional error details',
  )
  const isTaggedDomainError =
    typeof input.error === 'object' &&
    input.error !== null &&
    '_tag' in input.error &&
    typeof (input.error as { _tag?: unknown })._tag === 'string'

  const classification =
    isTaggedDomainError
      ? classifyWritingError(input.error as WritingDomainError)
      : classifyUnknownWritingError()

  const effect =
    classification.severity === 'error'
      ? Effect.logError('writing.request')
      : classification.severity === 'warn'
        ? Effect.logWarning('writing.request')
        : Effect.logInfo('writing.request')

  return Effect.annotateLogs(effect, {
    surface: input.surface,
    operation: input.operation,
    route: input.route,
    method: input.method,
    request_id: input.requestId,
    user_id: input.userId,
    organization_id: input.organizationId,
    project_id: input.projectId ?? context.projectId,
    chat_id: input.chatId ?? context.chatId,
    status: classification.status,
    retryable: classification.retryable,
    capture_mode: classification.captureMode,
    error_tag: errorTag,
    error_message: readableMessage,
    error_cause: readableCause,
    error_issue: context.issue,
    error_path: context.path,
    error_tool_name: context.toolName,
    expected_head_snapshot_id: context.expectedHeadSnapshotId,
    actual_head_snapshot_id: context.actualHeadSnapshotId,
  })
})

export async function logWritingFailure(input: WritingFailureLogInput): Promise<void> {
  await ServerRuntime.run(createWritingFailureLogEffect(input)).catch(() => undefined)
}
