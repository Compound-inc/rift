import { Effect } from 'effect'
import {
  BranchVersionConflictError,
  InvalidRequestError,
  MessagePersistenceError,
} from '@/lib/chat-backend/domain/errors'
import { zql } from '@/lib/chat-backend/infra/zero/db'
import type { ZeroDatabaseService } from '@/lib/server-effect/services/zero-database.service'
import { resolveRegenerationAnchor } from '@/lib/chat-branching/branch-resolver'
import { normalizeThreadActiveChildMap } from '../helpers'
import type { MessageStoreServiceShape } from '../../message-store.service'

export const makePrepareRegenerationOperation = (dependencies: {
  readonly zeroDatabase: ZeroDatabaseService['Service']
}): MessageStoreServiceShape['prepareRegeneration'] => {
  /**
   * Validates regenerate targets and advances branch metadata so the next
   * assistant response is generated from the selected anchor.
   */
  const { zeroDatabase } = dependencies

  return Effect.fn('MessageStoreService.prepareRegeneration')(
    ({
      threadDbId,
      threadId,
      userId,
      targetMessageId,
      expectedBranchVersion,
      requestId,
    }) =>
      Effect.gen(function* () {
        const db = yield* zeroDatabase.getOrFail.pipe(
          Effect.mapError(
            () =>
              new MessagePersistenceError({
                message: 'Failed to prepare regeneration',
                requestId,
                threadId,
                cause: 'ZERO_UPSTREAM_DB is not configured',
              }),
          ),
        )

        return yield* Effect.tryPromise({
          try: async () => {
            return await db.transaction(async (tx) => {
              const thread = await tx.run(
                zql.thread.where('id', threadDbId).where('userId', userId).one(),
              )
              if (!thread) {
                throw new Error('thread not found')
              }

              if (thread.branchVersion !== expectedBranchVersion) {
                throw new BranchVersionConflictError({
                  message: 'Branch version mismatch while preparing regeneration',
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
              const anchor = resolveRegenerationAnchor(
                threadMessages.map((message) => ({
                  messageId: message.messageId,
                  role: message.role,
                  parentMessageId: message.parentMessageId ?? undefined,
                  branchIndex: message.branchIndex ?? 1,
                  createdAt: message.created_at,
                })),
                targetMessageId,
              )
              if (!anchor) {
                throw new InvalidRequestError({
                  message: 'Invalid regenerate target',
                  requestId,
                  issue: 'target message is not regeneratable',
                })
              }

              await tx.mutate.thread.update({
                id: threadDbId,
                activeChildByParent: (() => {
                  const activeChildByParent = normalizeThreadActiveChildMap(
                    thread.activeChildByParent,
                  )
                  // Regenerate must truncate canonical path at the anchor until
                  // the new assistant branch is finalized.
                  delete activeChildByParent[anchor.anchorMessageId]
                  return activeChildByParent
                })(),
                branchVersion: thread.branchVersion + 1,
                generationStatus: 'generation',
                updatedAt: Date.now(),
              })

              return {
                anchorMessageId: anchor.anchorMessageId,
                regenSourceMessageId: anchor.targetMessageId,
              }
            })
          },
          catch: (error) => {
            if (
              error instanceof BranchVersionConflictError ||
              error instanceof InvalidRequestError
            ) {
              return error
            }
            return new MessagePersistenceError({
              message: 'Failed to prepare regeneration',
              requestId,
              threadId,
              cause: String(error),
            })
          },
        })
      }),
  )
}
