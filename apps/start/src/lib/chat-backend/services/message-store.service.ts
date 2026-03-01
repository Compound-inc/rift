import type { UIMessage } from 'ai'
import { Effect, Layer, ServiceMap } from 'effect'
import type { AiReasoningEffort } from '@/lib/ai-catalog/types'
import type { ChatAttachmentInput } from '@/lib/chat-contracts/attachments'
import {
  BranchVersionConflictError,
  InvalidEditTargetError,
  InvalidRequestError,
  MessagePersistenceError,
} from '@/lib/chat-backend/domain/errors'
import type { IncomingUserMessage } from '@/lib/chat-backend/domain/schemas'
import { getMemoryState } from '@/lib/chat-backend/infra/memory/state'
import { ZeroDatabaseService } from '@/lib/server-effect/services/zero-database.service'
import { AttachmentRagService } from './rag'
import { toUserMessage } from './message-store/helpers'
import { makeAppendUserMessageOperation } from './message-store/operations/append-user-message'
import { makeFinalizeAssistantMessageOperation } from './message-store/operations/finalize-assistant-message'
import { makeLoadThreadMessagesOperation } from './message-store/operations/load-thread-messages'
import { makePrepareEditOperation } from './message-store/operations/prepare-edit'
import { makePrepareRegenerationOperation } from './message-store/operations/prepare-regeneration'

/**
 * Message persistence adapter backed by Zero + upstream Postgres.
 * Responsible for loading thread history and persisting user/assistant turns.
 */
export type MessageStoreServiceShape = {
  readonly loadThreadMessages: (input: {
    readonly threadId: string
    readonly model: string
    readonly untilMessageId?: string
    readonly requestId: string
  }) => Effect.Effect<UIMessage[], MessagePersistenceError>
  readonly appendUserMessage: (input: {
    readonly threadDbId: string
    readonly threadId: string
    readonly message: IncomingUserMessage
    readonly attachments?: readonly ChatAttachmentInput[]
    readonly userId: string
    readonly model: string
    readonly reasoningEffort?: AiReasoningEffort
    readonly modelParams?: {
      readonly reasoningEffort?: AiReasoningEffort
    }
    readonly expectedBranchVersion: number
    readonly requestId: string
  }) => Effect.Effect<
    UIMessage,
    MessagePersistenceError | BranchVersionConflictError
  >
  readonly prepareRegeneration: (input: {
    readonly threadDbId: string
    readonly threadId: string
    readonly userId: string
    readonly targetMessageId: string
    readonly expectedBranchVersion: number
    readonly requestId: string
  }) => Effect.Effect<
    {
      readonly anchorMessageId: string
      readonly regenSourceMessageId: string
    },
    MessagePersistenceError | BranchVersionConflictError | InvalidRequestError
  >
  readonly prepareEdit: (input: {
    readonly threadDbId: string
    readonly threadId: string
    readonly userId: string
    readonly targetMessageId: string
    readonly editedText: string
    readonly model: string
    readonly reasoningEffort?: AiReasoningEffort
    readonly expectedBranchVersion: number
    readonly requestId: string
  }) => Effect.Effect<
    {
      readonly editedMessageId: string
      readonly regenSourceMessageId: string
    },
    | MessagePersistenceError
    | BranchVersionConflictError
    | InvalidEditTargetError
    | InvalidRequestError
  >
  readonly finalizeAssistantMessage: (input: {
    readonly threadDbId: string
    readonly threadModel: string
    readonly threadId: string
    readonly userId: string
    readonly assistantMessageId: string
    readonly parentMessageId?: string
    readonly branchAnchorMessageId?: string
    readonly regenSourceMessageId?: string
    readonly ok: boolean
    readonly finalContent: string
    readonly reasoning?: string
    readonly errorMessage?: string
    readonly modelParams?: {
      readonly reasoningEffort?: AiReasoningEffort
    }
    readonly requestId: string
  }) => Effect.Effect<void, MessagePersistenceError>
}

export class MessageStoreService extends ServiceMap.Service<
  MessageStoreService,
  MessageStoreServiceShape
>()('chat-backend/MessageStoreService') {}

export namespace MessageStoreService {
/** Production message store implementation. */
export const layer = Layer.effect(
  MessageStoreService,
  Effect.gen(function* () {
    const attachmentRag = yield* AttachmentRagService
    const zeroDatabase = yield* ZeroDatabaseService

    return {
      loadThreadMessages: makeLoadThreadMessagesOperation({
        zeroDatabase,
        attachmentRag,
      }),
      appendUserMessage: makeAppendUserMessageOperation({
        zeroDatabase,
        attachmentRag,
      }),
      prepareRegeneration: makePrepareRegenerationOperation({ zeroDatabase }),
      prepareEdit: makePrepareEditOperation({ zeroDatabase }),
      finalizeAssistantMessage: makeFinalizeAssistantMessageOperation({
        zeroDatabase,
      }),
    }
  }),
)

/** Test-only adapter retained for deterministic unit tests. */
export const layerMemory = Layer.succeed(MessageStoreService, {
  loadThreadMessages: ({ threadId, model: _model, untilMessageId, requestId }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw new Error('missing thread message store')
      }
      if (!untilMessageId) return existing.slice()
      const endIndex = existing.findIndex((message) => message.id === untilMessageId)
      return endIndex >= 0 ? existing.slice(0, endIndex + 1) : existing.slice()
    }).pipe(
      Effect.catch((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to load messages',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),

  appendUserMessage: ({ threadId, message, requestId }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw new Error('missing thread message store')
      }
      const uiMessage = toUserMessage(message, [])
      existing.push(uiMessage)
      return uiMessage
    }).pipe(
      Effect.catch((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to append user message',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),

  prepareRegeneration: ({ threadId, targetMessageId, requestId }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw new Error('missing thread message store')
      }

      const targetIndex = existing.findIndex((message) => message.id === targetMessageId)
      if (targetIndex < 0) {
        throw new Error('target message not found')
      }

      const target = existing[targetIndex]
      if (target.role === 'user') {
        return {
          anchorMessageId: target.id,
          regenSourceMessageId: target.id,
        }
      }

      const previous = targetIndex > 0 ? existing[targetIndex - 1] : undefined
      if (!previous || previous.role !== 'user') {
        throw new Error('assistant regenerate requires parent user')
      }

      return {
        anchorMessageId: previous.id,
        regenSourceMessageId: target.id,
      }
    }).pipe(
      Effect.catch((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to prepare regeneration',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),

  prepareEdit: ({ threadId, targetMessageId, editedText, requestId }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw new Error('missing thread message store')
      }
      const targetIndex = existing.findIndex(
        (message) => message.id === targetMessageId,
      )
      if (targetIndex < 0) {
        throw new Error('target message not found')
      }
      const target = existing[targetIndex]
      if (!target || target.role !== 'user') {
        throw new Error('target message is not editable')
      }
      const nextId = crypto.randomUUID()
      const nextText = editedText.trim()
      if (nextText.length === 0) {
        throw new Error('edited text cannot be empty')
      }

      const truncated = existing.slice(0, targetIndex + 1)
      const nextParts = target.parts.map((part) =>
        part.type === 'text' ? { ...part, text: nextText } : part,
      )
      truncated[targetIndex] = {
        ...target,
        id: nextId,
        parts: nextParts,
      }
      getMemoryState().messages.set(threadId, truncated)

      return {
        editedMessageId: nextId,
        regenSourceMessageId: nextId,
      }
    }).pipe(
      Effect.catch((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to prepare edit',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),

  finalizeAssistantMessage: ({
    threadId,
    assistantMessageId,
    finalContent,
    reasoning,
    requestId,
  }) =>
    Effect.sync(() => {
      const existing = getMemoryState().messages.get(threadId)
      if (!existing) {
        throw new Error('missing thread message store')
      }
      const target = existing.find((message) => message.id === assistantMessageId)
      if (!target) {
        const parts: UIMessage['parts'] = []
        if (reasoning && reasoning.trim().length > 0) {
          parts.push({ type: 'reasoning', text: reasoning, state: 'done' })
        }
        parts.push({ type: 'text', text: finalContent })
        existing.push({
          id: assistantMessageId,
          role: 'assistant',
          parts,
        })
        return
      }

      const parts: UIMessage['parts'] = []
      if (reasoning && reasoning.trim().length > 0) {
        parts.push({ type: 'reasoning', text: reasoning, state: 'done' })
      }
      parts.push({ type: 'text', text: finalContent })
      target.parts = parts
    }).pipe(
      Effect.catch((error) =>
        Effect.fail(
          new MessagePersistenceError({
            message: 'Failed to finalize assistant message',
            requestId,
            threadId,
            cause: String(error),
          }),
        ),
      ),
    ),
})
}
