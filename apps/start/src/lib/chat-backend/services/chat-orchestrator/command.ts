import { Effect } from 'effect'
import { InvalidRequestError } from '@/lib/chat-backend/domain/errors'
import type { IncomingUserMessage } from '@/lib/chat-backend/domain/schemas'

export type StreamChatTrigger =
  | 'submit-message'
  | 'regenerate-message'
  | 'edit-message'

export type NormalizedStreamCommand = {
  readonly trigger: StreamChatTrigger
  readonly expectedBranchVersion: number
  readonly message?: IncomingUserMessage
  readonly messageId?: string
  readonly editedText?: string
}

/**
 * Central trigger validation so orchestrator execution receives a decision-complete command.
 */
export const normalizeStreamCommand = Effect.fn(
  'ChatOrchestrator.normalizeStreamCommand',
)(
  function* (input: {
    readonly trigger?: StreamChatTrigger
    readonly expectedBranchVersion?: number
    readonly message?: IncomingUserMessage
    readonly messageId?: string
    readonly editedText?: string
    readonly requestId: string
  }): Effect.fn.Return<NormalizedStreamCommand, InvalidRequestError> {
    const trigger = input.trigger ?? 'submit-message'
    const expectedBranchVersion = input.expectedBranchVersion

    if (typeof expectedBranchVersion !== 'number') {
      return yield* Effect.fail(
        new InvalidRequestError({
          message: 'Missing expectedBranchVersion',
          requestId: input.requestId,
          issue: 'expectedBranchVersion is required',
        }),
      )
    }

    if (trigger === 'submit-message' && !input.message) {
      return yield* Effect.fail(
        new InvalidRequestError({
          message: 'Missing user message',
          requestId: input.requestId,
          issue: 'message is required for submit-message',
        }),
      )
    }

    if (
      trigger === 'regenerate-message' &&
      (!input.messageId || input.messageId.trim().length === 0)
    ) {
      return yield* Effect.fail(
        new InvalidRequestError({
          message: 'Missing regenerate target message',
          requestId: input.requestId,
          issue: 'messageId is required for regenerate-message',
        }),
      )
    }

    if (
      trigger === 'edit-message' &&
      (!input.messageId || input.messageId.trim().length === 0)
    ) {
      return yield* Effect.fail(
        new InvalidRequestError({
          message: 'Missing edit target message',
          requestId: input.requestId,
          issue: 'messageId is required for edit-message',
        }),
      )
    }

    if (
      trigger === 'edit-message' &&
      (!input.editedText || input.editedText.trim().length === 0)
    ) {
      return yield* Effect.fail(
        new InvalidRequestError({
          message: 'Missing edited text',
          requestId: input.requestId,
          issue: 'editedText is required for edit-message',
        }),
      )
    }

    return {
      trigger,
      expectedBranchVersion,
      message: input.message,
      messageId: input.messageId,
      editedText: input.editedText,
    }
  },
)
