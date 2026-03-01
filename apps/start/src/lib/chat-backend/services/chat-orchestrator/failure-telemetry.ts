import { Effect } from 'effect'
import { ChatErrorCode } from '@/lib/chat-contracts/error-codes'
import { emitWideErrorEvent } from '@/lib/chat-backend/observability/wide-event'

export const emitBranchVersionConflictTelemetry = Effect.fn(
  'ChatOrchestrator.emitBranchVersionConflictTelemetry',
)(
  ({
    route,
    requestId,
    userId,
    threadId,
    model,
    latencyMs,
    message,
    trigger,
    expectedBranchVersion,
    actualBranchVersion,
  }: {
    readonly route: string
    readonly requestId: string
    readonly userId: string
    readonly threadId: string
    readonly model?: string
    readonly latencyMs: number
    readonly message: string
    readonly trigger: string
    readonly expectedBranchVersion?: number
    readonly actualBranchVersion?: number
  }) => {
    const conflictCause =
      typeof expectedBranchVersion === 'number' && typeof actualBranchVersion === 'number'
        ? `expected=${expectedBranchVersion},actual=${actualBranchVersion},trigger=${trigger}`
        : `trigger=${trigger}`

    return Effect.annotateLogs(
      Effect.logWarning('chat_branch_version_conflict'),
      {
        route,
        request_id: requestId,
        user_id: userId,
        thread_id: threadId,
        trigger,
        expected_branch_version: expectedBranchVersion,
        actual_branch_version: actualBranchVersion,
      },
    ).pipe(
      Effect.andThen(
        emitWideErrorEvent({
          eventName: 'chat.branch.version.conflict',
          route,
          requestId,
          userId,
          threadId,
          model,
          errorCode: ChatErrorCode.BranchVersionConflict,
          errorTag: 'BranchVersionConflictError',
          message,
          latencyMs,
          retryable: true,
          cause: conflictCause,
        }),
      ),
    )
  },
)

export const emitInvalidEditTargetTelemetry = Effect.fn(
  'ChatOrchestrator.emitInvalidEditTargetTelemetry',
)(
  ({
    route,
    requestId,
    userId,
    threadId,
    model,
    latencyMs,
    message,
    targetMessageId,
    issue,
  }: {
    readonly route: string
    readonly requestId: string
    readonly userId: string
    readonly threadId: string
    readonly model?: string
    readonly latencyMs: number
    readonly message: string
    readonly targetMessageId?: string
    readonly issue?: string
  }) =>
    emitWideErrorEvent({
      eventName: 'chat.edit.rejected_invalid_target',
      route,
      requestId,
      userId,
      threadId,
      model,
      errorCode: ChatErrorCode.InvalidEditTarget,
      errorTag: 'InvalidEditTargetError',
      message,
      latencyMs,
      retryable: false,
      cause: `target=${targetMessageId ?? 'unknown'}:${issue ?? 'unknown'}`,
    }),
)
