import { Effect } from 'effect'
import type { ChatAttachment } from '@/lib/chat-contracts/attachments'
import {
  BranchVersionConflictError,
  MessagePersistenceError,
} from '@/lib/chat-backend/domain/errors'
import { getUserMessageText } from '@/lib/chat-backend/domain/schemas'
import { zql } from '@/lib/chat-backend/infra/zero/db'
import type { ZeroDatabaseService } from '@/lib/server-effect/services/zero-database.service'
import type { AttachmentRagService } from '@/lib/chat-backend/services/rag'
import { resolveCanonicalBranch } from '@/lib/chat-branching/branch-resolver'
import { requireMessagePersistenceDb } from '../../message-persistence-db'
import {
  nextBranchIndexForParent,
  normalizeThreadActiveChildMap,
  toUserMessage,
} from '../helpers'
import type { MessageStoreServiceShape } from '../../message-store.service'

export const makeAppendUserMessageOperation = (dependencies: {
  readonly zeroDatabase: ZeroDatabaseService['Service']
  readonly attachmentRag: AttachmentRagService['Service']
}): MessageStoreServiceShape['appendUserMessage'] => {
  /**
   * Persists a new user turn with optimistic branch-version checks and links
   * any validated attachments to both the relational and vector stores.
   */
  const { zeroDatabase, attachmentRag } = dependencies

  return Effect.fn('MessageStoreService.appendUserMessage')(
    ({
      threadDbId,
      threadId,
      message,
      attachments,
      userId,
      model,
      reasoningEffort,
      modelParams,
      expectedBranchVersion,
      requestId,
    }) =>
      Effect.gen(function* () {
        const db = yield* requireMessagePersistenceDb({
          zeroDatabase,
          message: 'Failed to append user message',
          requestId,
          threadId,
        })

        const now = Date.now()
        const linkedAttachmentsForReturn: ChatAttachment[] = []
        let insertedParentMessageId: string | undefined
        const vectorLinks: Array<{
          attachmentId: string
          userId: string
          threadId: string
          messageId: string
          updatedAt: number
        }> = []

        yield* Effect.tryPromise({
          try: () =>
            db.transaction(async (tx) => {
              const thread = await tx.run(
                zql.thread.where('id', threadDbId).where('userId', userId).one(),
              )
              if (!thread) {
                throw new Error('thread not found')
              }

              if (thread.branchVersion !== expectedBranchVersion) {
                throw new BranchVersionConflictError({
                  message: 'Branch version mismatch while appending user message',
                  requestId,
                  threadId,
                  expectedBranchVersion,
                  actualBranchVersion: thread.branchVersion,
                })
              }

              try {
                const existing = await tx.run(
                  zql.message.where('id', message.id).where('userId', userId).one(),
                )
                if (existing) return

                const attachmentIds = (attachments ?? [])
                  .map((attachment) => attachment.id)
                  .filter((id) => id.trim().length > 0)
                const linkedAttachments: ChatAttachment[] = []

                for (const attachmentId of attachmentIds) {
                  const existingAttachment = await tx.run(
                    zql.attachment.where('id', attachmentId).where('userId', userId).one(),
                  )
                  if (!existingAttachment) continue

                  linkedAttachments.push({
                    id: existingAttachment.id,
                    key: existingAttachment.fileKey,
                    url: existingAttachment.attachmentUrl,
                    name: existingAttachment.fileName,
                    size: existingAttachment.fileSize,
                    contentType: existingAttachment.mimeType,
                  })

                  await tx.mutate.attachment.update({
                    id: existingAttachment.id,
                    messageId: message.id,
                    threadId,
                    updatedAt: now,
                  })

                  vectorLinks.push({
                    attachmentId: existingAttachment.id,
                    userId,
                    threadId,
                    messageId: message.id,
                    updatedAt: now,
                  })
                }
                linkedAttachmentsForReturn.push(...linkedAttachments)

                const threadMessages = await tx.run(
                  zql.message
                    .where('threadId', threadId)
                    .where('userId', userId)
                    .orderBy('created_at', 'asc'),
                )
                const { canonicalMessages } = resolveCanonicalBranch(
                  threadMessages.map((row) => ({
                    messageId: row.messageId,
                    role: row.role,
                    parentMessageId: row.parentMessageId,
                    branchIndex: row.branchIndex,
                    createdAt: row.created_at,
                  })),
                  normalizeThreadActiveChildMap(thread.activeChildByParent),
                )

                const parentMessageId = canonicalMessages.at(-1)?.messageId
                insertedParentMessageId = parentMessageId

                const branchIndex = nextBranchIndexForParent({
                  messages: threadMessages,
                  parentMessageId,
                })

                await tx.mutate.message.insert({
                  // Deterministic key makes retries naturally idempotent.
                  id: message.id,
                  messageId: message.id,
                  threadId,
                  userId,
                  content: getUserMessageText(message),
                  status: 'done',
                  role: 'user',
                  created_at: now,
                  updated_at: now,
                  parentMessageId,
                  branchIndex,
                  branchAnchorMessageId: undefined,
                  regenSourceMessageId: undefined,
                  model,
                  modelParams,
                  sources: linkedAttachments.map((attachment) => ({
                    sourceId: attachment.id,
                    url: attachment.url,
                    title: attachment.name,
                  })),
                  attachmentsIds: linkedAttachments.map((attachment) => attachment.id),
                })
              } catch {
                // Duplicate insert on retry; row already exists.
                return
              }

              const activeChildByParent = normalizeThreadActiveChildMap(
                thread.activeChildByParent,
              )
              if (insertedParentMessageId) {
                activeChildByParent[insertedParentMessageId] = message.id
              }

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
            }),
          catch: (error) => {
            if (error instanceof BranchVersionConflictError) {
              return error
            }
            return new MessagePersistenceError({
              message: 'Failed to append user message',
              requestId,
              threadId,
              cause: String(error),
            })
          },
        })

        for (const link of vectorLinks) {
          yield* attachmentRag
            .linkAttachmentToThread(link)
            .pipe(Effect.catch(() => Effect.void))
        }

        return toUserMessage(message, linkedAttachmentsForReturn)
      }),
  )
}
