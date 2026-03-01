import { Effect } from 'effect'
import {
  BranchVersionConflictError,
  InvalidEditTargetError,
  InvalidRequestError,
  MessagePersistenceError,
} from '@/lib/chat-backend/domain/errors'
import { zql } from '@/lib/chat-backend/infra/zero/db'
import type { ZeroDatabaseService } from '@/lib/server-effect/services/zero-database.service'
import { resolveEditableUserTarget } from '@/lib/chat-branching/branch-resolver'
import { requireMessagePersistenceDb } from '../../message-persistence-db'
import {
  nextBranchIndexForParent,
  normalizeThreadActiveChildMap,
} from '../helpers'
import type { MessageStoreServiceShape } from '../../message-store.service'

export const makePrepareEditOperation = (dependencies: {
  readonly zeroDatabase: ZeroDatabaseService['Service']
}): MessageStoreServiceShape['prepareEdit'] => {
  /**
   * Creates a new edited user branch from a canonical message and marks the
   * thread as generating so the orchestrator can stream a replacement assistant turn.
   */
  const { zeroDatabase } = dependencies

  return Effect.fn('MessageStoreService.prepareEdit')(
    ({
      threadDbId,
      threadId,
      userId,
      targetMessageId,
      editedText,
      model,
      reasoningEffort,
      expectedBranchVersion,
      requestId,
    }) =>
      Effect.gen(function* () {
        const db = yield* requireMessagePersistenceDb({
          zeroDatabase,
          message: 'Failed to prepare edit',
          requestId,
          threadId,
        })

        return yield* Effect.tryPromise({
          try: async () => {
            const normalizedEditedText = editedText.trim()
            if (normalizedEditedText.length === 0) {
              throw new InvalidRequestError({
                message: 'Edited message text cannot be empty',
                requestId,
                issue: 'editedText must contain non-whitespace text',
              })
            }

            return await db.transaction(async (tx) => {
              const thread = await tx.run(
                zql.thread.where('id', threadDbId).where('userId', userId).one(),
              )
              if (!thread) {
                throw new Error('thread not found')
              }

              if (thread.branchVersion !== expectedBranchVersion) {
                throw new BranchVersionConflictError({
                  message: 'Branch version mismatch while preparing edit',
                  requestId,
                  threadId,
                  expectedBranchVersion,
                  actualBranchVersion: thread.branchVersion,
                })
              }

              const threadMessages = await tx.run(
                zql.message
                  .where('threadId', threadId)
                  .where('userId', userId)
                  .orderBy('created_at', 'asc'),
              )
              const editableTarget = resolveEditableUserTarget(
                threadMessages.map((message) => ({
                  messageId: message.messageId,
                  role: message.role,
                  parentMessageId: message.parentMessageId,
                  branchIndex: message.branchIndex,
                  createdAt: message.created_at,
                })),
                normalizeThreadActiveChildMap(thread.activeChildByParent),
                targetMessageId,
              )
              if (!editableTarget) {
                throw new InvalidEditTargetError({
                  message: 'Invalid edit target',
                  requestId,
                  threadId,
                  targetMessageId,
                  issue: 'target message must be a canonical-path user message',
                })
              }

              const nextMessageId = crypto.randomUUID()
              const now = Date.now()
              const branchIndex = nextBranchIndexForParent({
                messages: threadMessages,
                parentMessageId: editableTarget.parentMessageId,
              })

              await tx.mutate.message.insert({
                id: nextMessageId,
                messageId: nextMessageId,
                threadId,
                userId,
                content: normalizedEditedText,
                status: 'done',
                role: 'user',
                created_at: now,
                updated_at: now,
                parentMessageId: editableTarget.parentMessageId,
                branchIndex,
                branchAnchorMessageId:
                  editableTarget.parentMessageId ?? targetMessageId,
                regenSourceMessageId: targetMessageId,
                model,
                modelParams: {
                  reasoningEffort,
                },
                attachmentsIds: [],
              })

              const activeChildByParent = normalizeThreadActiveChildMap(
                thread.activeChildByParent,
              )
              activeChildByParent[editableTarget.parentSelectionKey] = nextMessageId

              await tx.mutate.thread.update({
                id: threadDbId,
                model,
                reasoningEffort,
                activeChildByParent,
                branchVersion: thread.branchVersion + 1,
                generationStatus: 'generation',
                updatedAt: now,
                lastMessageAt: now,
              })

              return {
                editedMessageId: nextMessageId,
                regenSourceMessageId: nextMessageId,
              }
            })
          },
          catch: (error) => {
            if (
              error instanceof BranchVersionConflictError ||
              error instanceof InvalidRequestError ||
              error instanceof InvalidEditTargetError
            ) {
              return error
            }
            return new MessagePersistenceError({
              message: 'Failed to prepare edit',
              requestId,
              threadId,
              cause: String(error),
            })
          },
        })
      }),
  )
}
