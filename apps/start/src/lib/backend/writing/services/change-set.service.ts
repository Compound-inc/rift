import { Effect, Layer, ServiceMap } from 'effect'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import { ZeroDatabaseNotConfiguredError, ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import {
  applyAcceptedHunks,
  createWritingHunks,
} from '@/lib/shared/writing/diff'
import {
  WritingChatNotFoundError,
  WritingConflictError,
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../domain/errors'
import {
  captureCurrentSnapshotManifest,
  getBlobById,
  getProjectChat,
  getProjectEntryByPath,
  getScopedProject,
  insertSnapshot,
  now,
  replaceProjectEntries,
  upsertWritingBlob,
} from './persistence'
import type {
  WritingChangeRow,
} from './persistence'
import {
  assertScopedChangeSetProject,
  getScopedChangeSet,
  loadChangeHunks,
  loadChangeRows,
  replaceChangeHunks,
  toPersistenceError,
  updateChangeSetResolution,
} from './change-set/store'

/**
 * Centralizes the hunk-application workflow so manual approvals and auto-accept
 * mode share identical conflict detection, snapshotting, and rebase behavior.
 */
async function acceptChangeSetHunks(input: {
  readonly db: any
  readonly changeSetId: string
  readonly hunkIds: readonly string[]
  readonly userId: string
  readonly organizationId?: string
  readonly requestId: string
}): Promise<{ readonly headSnapshotId?: string }> {
  const { project, changeSet } = await getScopedChangeSet({
    db: input.db,
    changeSetId: input.changeSetId,
    userId: input.userId,
    organizationId: input.organizationId,
  })
  const scoped = assertScopedChangeSetProject({
    project,
    changeSet,
    requestId: input.requestId,
  })

  const changes = await loadChangeRows(input.db, input.changeSetId)
  const manifest = new Map(
    (await captureCurrentSnapshotManifest(input.db, scoped.project.id)).map((entry) => [entry.path, entry]),
  )
  const createdAt = now()
  const selectedIds = new Set(input.hunkIds)
  const conflictingChanges = new Set<string>()
  const changeResults = new Map<
    string,
    {
      nextBaseContent: string
      currentProposedContent: string
      nextBaseBlobId?: string
    }
  >()

  for (const change of changes) {
    const currentHunks = await loadChangeHunks(input.db, change.id)
    const selectedHunks = currentHunks.filter((hunk) => selectedIds.has(hunk.id))
    if (selectedHunks.length === 0) {
      continue
    }

    const currentEntry = manifest.get(change.path)
    const currentBlobId = currentEntry?.blobId
    if ((currentBlobId ?? undefined) !== (change.baseBlobId ?? undefined)) {
      conflictingChanges.add(change.id)
      continue
    }

    const baseBlob = await getBlobById(input.db, change.baseBlobId)
    const proposedBlob = await getBlobById(input.db, change.proposedBlobId)
    const nextBaseContent = applyAcceptedHunks({
      baseContent: baseBlob?.content ?? '',
      acceptedHunks: selectedHunks.map((hunk) => ({
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        patchText: hunk.patchText,
      })),
    })

    changeResults.set(change.id, {
      nextBaseContent,
      currentProposedContent: proposedBlob?.content ?? '',
    })
  }

  let nextHeadSnapshotId: string | undefined
  await input.db.transaction(async (tx: any) => {
    for (const change of changes) {
      const currentHunks = await loadChangeHunks(tx, change.id)
      if (conflictingChanges.has(change.id)) {
        for (const hunk of currentHunks.filter((candidate) => selectedIds.has(candidate.id))) {
          await tx.mutate.writingChangeHunk.update({
            id: hunk.id,
            status: 'conflicted',
          })
        }
        await tx.mutate.writingChange.update({
          id: change.id,
          status: 'conflicted',
        })
        continue
      }

      const result = changeResults.get(change.id)
      if (!result) {
        continue
      }

      if (change.operation === 'delete' && result.nextBaseContent.length === 0) {
        manifest.delete(change.path)
      } else {
        const blob = await upsertWritingBlob({
          tx,
          content: result.nextBaseContent,
        })
        manifest.set(change.path, {
          path: change.path,
          kind: 'file',
          blobId: blob.id,
          sha256: blob.sha256,
          lineCount: result.nextBaseContent.split('\n').length,
          sizeBytes: blob.byteSize,
        })
        result.nextBaseBlobId = blob.id
      }
    }

    if (changeResults.size > conflictingChanges.size) {
      await replaceProjectEntries({
        tx,
        projectId: scoped.project.id,
        entries: [...manifest.values()],
        createdAt,
      })

      nextHeadSnapshotId = await insertSnapshot({
        tx,
        projectId: scoped.project.id,
        parentSnapshotId: scoped.project.headSnapshotId ?? undefined,
        source: 'ai',
        summary: 'Accepted AI writing changes',
        chatId: scoped.changeSet.chatId,
        messageId: scoped.changeSet.assistantMessageId ?? undefined,
        createdByUserId: input.userId,
        entries: [...manifest.values()],
        createdAt,
      })

      await tx.mutate.writingProject.update({
        id: scoped.project.id,
        headSnapshotId: nextHeadSnapshotId,
        updatedAt: createdAt,
      })
    }

    for (const change of changes) {
      const result = changeResults.get(change.id)
      if (!result || conflictingChanges.has(change.id)) {
        continue
      }

      const currentProposedContent = result.currentProposedContent
      if (result.nextBaseContent === currentProposedContent) {
        await tx.mutate.writingChange.update({
          id: change.id,
          baseBlobId: result.nextBaseBlobId,
          proposedBlobId: result.nextBaseBlobId,
          status: 'applied',
        })
        const existingHunks = await loadChangeHunks(tx, change.id)
        for (const hunk of existingHunks) {
          await tx.mutate.writingChangeHunk.update({
            id: hunk.id,
            status: selectedIds.has(hunk.id) ? 'applied' : hunk.status,
          })
        }
        continue
      }

      const nextProposedBlob = await upsertWritingBlob({
        tx,
        content: currentProposedContent,
      })
      const remainingHunks = createWritingHunks({
        path: change.path,
        oldContent: result.nextBaseContent,
        newContent: currentProposedContent,
      })
      await tx.mutate.writingChange.update({
        id: change.id,
        baseBlobId: result.nextBaseBlobId,
        proposedBlobId: nextProposedBlob.id,
        status: 'pending',
      })
      await replaceChangeHunks({
        tx,
        changeId: change.id,
        hunks: remainingHunks,
        createdAt,
      })
    }

    await updateChangeSetResolution({
      tx,
      changeSetId: input.changeSetId,
    })
  })

  if (conflictingChanges.size > 0 && changeResults.size === conflictingChanges.size) {
    throw new WritingConflictError({
      message: 'Some pending writing hunks could not be applied cleanly',
      requestId: input.requestId,
      projectId: scoped.project.id,
      expectedHeadSnapshotId: scoped.changeSet.baseSnapshotId,
      actualHeadSnapshotId: scoped.project.headSnapshotId ?? undefined,
    })
  }

  return {
    headSnapshotId: nextHeadSnapshotId,
  }
}

export type WritingChangeSetServiceShape = {
  readonly createChangeSet: (input: {
    readonly projectId: string
    readonly chatId: string
    readonly userId: string
    readonly organizationId?: string
    readonly summary: string
    readonly autoAccept: boolean
    readonly requestId: string
  }) => Effect.Effect<
    { readonly changeSetId: string; readonly baseSnapshotId: string },
    WritingProjectNotFoundError | WritingChatNotFoundError | WritingPersistenceError
  >
  readonly attachAssistantMessage: (input: {
    readonly changeSetId: string
    readonly assistantMessageId: string
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) => Effect.Effect<void, WritingProjectNotFoundError | WritingPersistenceError>
  readonly upsertFileChange: (input: {
    readonly changeSetId: string
    readonly userId: string
    readonly organizationId?: string
    readonly path: string
    readonly operation: 'create' | 'update' | 'delete'
    readonly proposedContent?: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly changeId: string; readonly hunkCount: number },
    WritingProjectNotFoundError | WritingPersistenceError
  >
  readonly acceptHunks: (input: {
    readonly changeSetId: string
    readonly hunkIds: readonly string[]
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly headSnapshotId?: string },
    WritingProjectNotFoundError | WritingConflictError | WritingPersistenceError
  >
  readonly rejectHunks: (input: {
    readonly changeSetId: string
    readonly hunkIds: readonly string[]
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) => Effect.Effect<void, WritingProjectNotFoundError | WritingPersistenceError>
  readonly discardChangeSet: (input: {
    readonly changeSetId: string
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) => Effect.Effect<void, WritingProjectNotFoundError | WritingPersistenceError>
  readonly applyChangeSet: (input: {
    readonly changeSetId: string
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly headSnapshotId?: string },
    WritingProjectNotFoundError | WritingConflictError | WritingPersistenceError
  >
}

export class WritingChangeSetService extends ServiceMap.Service<
  WritingChangeSetService,
  WritingChangeSetServiceShape
>()('writing-backend/WritingChangeSetService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const zeroDatabase = yield* ZeroDatabaseService

      const createChangeSet: WritingChangeSetServiceShape['createChangeSet'] = Effect.fn(
        'WritingChangeSetService.createChangeSet',
      )(({ projectId, chatId, userId, organizationId, summary, autoAccept, requestId }) =>
        zeroDatabase.withDatabase((db) =>
          Effect.tryPromise({
            try: async () => {
              const project = await getScopedProject({
                db,
                projectId,
                userId,
                organizationId,
              })
              if (!project) {
                throw new WritingProjectNotFoundError({
                  message: 'Writing project not found',
                  requestId,
                  projectId,
                })
              }
              const chat = await getProjectChat({ db, chatId, projectId })
              if (!chat) {
                throw new WritingChatNotFoundError({
                  message: 'Writing chat not found',
                  requestId,
                  chatId,
                })
              }
              const changeSetId = crypto.randomUUID()
              await db.transaction(async (tx) => {
                await tx.mutate.writingChangeSet.insert({
                  id: changeSetId,
                  projectId,
                  chatId,
                  baseSnapshotId: project.headSnapshotId ?? '',
                  status: 'pending',
                  autoAccept,
                  summary,
                  createdAt: now(),
                })
              })
              return {
                changeSetId,
                baseSnapshotId: project.headSnapshotId ?? '',
              }
            },
            catch: (error) => {
              if (
                error instanceof WritingProjectNotFoundError ||
                error instanceof WritingChatNotFoundError
              ) {
                return error
              }
              return toPersistenceError(requestId, 'Failed to create the change set', error)
            },
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof ZeroDatabaseNotConfiguredError
              ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
              : error,
          ),
        ),
      )

      const attachAssistantMessage: WritingChangeSetServiceShape['attachAssistantMessage'] =
        Effect.fn('WritingChangeSetService.attachAssistantMessage')(
          ({ changeSetId, assistantMessageId, userId, organizationId, requestId }) =>
            zeroDatabase.withDatabase((db) =>
              Effect.tryPromise({
                try: async () => {
                  const { project, changeSet } = await getScopedChangeSet({
                    db,
                    changeSetId,
                    userId,
                    organizationId,
                  })
                  if (!project || !changeSet) {
                    throw new WritingProjectNotFoundError({
                      message: 'Writing project not found',
                      requestId,
                      projectId: changeSet?.projectId ?? 'unknown-project',
                    })
                  }

                  await db.transaction(async (tx) => {
                    await tx.mutate.writingChangeSet.update({
                      id: changeSetId,
                      assistantMessageId,
                    })
                  })
                },
                catch: (error) =>
                  error instanceof WritingProjectNotFoundError
                    ? error
                    : toPersistenceError(requestId, 'Failed to attach the assistant message', error),
              }),
            ).pipe(
              Effect.mapError((error) =>
                error instanceof ZeroDatabaseNotConfiguredError
                  ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
                  : error,
              ),
            ),
        )

      const upsertFileChange: WritingChangeSetServiceShape['upsertFileChange'] = Effect.fn(
        'WritingChangeSetService.upsertFileChange',
      )(({ changeSetId, userId, organizationId, path, operation, proposedContent, requestId }) =>
        zeroDatabase.withDatabase((db) =>
          Effect.tryPromise({
            try: async () => {
              const { project, changeSet } = await getScopedChangeSet({
                db,
                changeSetId,
                userId,
                organizationId,
              })
              if (!project || !changeSet) {
                throw new WritingProjectNotFoundError({
                  message: 'Writing project not found',
                  requestId,
                  projectId: changeSet?.projectId ?? 'unknown-project',
                })
              }

              const existingChange = (await db.run(
                zql.writingChange
                  .where('changeSetId', changeSetId)
                  .where('path', path)
                  .one(),
              )) as WritingChangeRow | null

              const currentEntry = await getProjectEntryByPath({
                db,
                projectId: project.id,
                path,
              })
              const baseBlob = existingChange
                ? await getBlobById(db, existingChange.baseBlobId)
                : await getBlobById(db, currentEntry?.blobId)
              const baseContent = baseBlob?.content ?? ''
              const nextContent = operation === 'delete' ? '' : (proposedContent ?? '')
              const hunks = createWritingHunks({
                path,
                oldContent: baseContent,
                newContent: nextContent,
              })

              const createdAt = now()
              let changeId = existingChange?.id ?? crypto.randomUUID()
              await db.transaction(async (tx) => {
                const proposedBlob =
                  operation === 'delete'
                    ? null
                    : await upsertWritingBlob({
                        tx,
                        content: nextContent,
                      })

                if (!existingChange) {
                  await tx.mutate.writingChange.insert({
                    id: changeId,
                    changeSetId,
                    path,
                    operation,
                    baseBlobId: baseBlob?.id,
                    proposedBlobId: proposedBlob?.id,
                    status: hunks.length === 0 ? 'rejected' : 'pending',
                    createdAt,
                  })
                } else {
                  await tx.mutate.writingChange.update({
                    id: existingChange.id,
                    operation,
                    proposedBlobId: proposedBlob?.id,
                    status: hunks.length === 0 ? 'rejected' : 'pending',
                  })
                }

                await replaceChangeHunks({
                  tx,
                  changeId,
                  hunks,
                  createdAt,
                })

                await updateChangeSetResolution({
                  tx,
                  changeSetId,
                })
              })

              return {
                changeId,
                hunkCount: hunks.length,
              }
            },
            catch: (error) =>
              error instanceof WritingProjectNotFoundError
                ? error
                : toPersistenceError(requestId, 'Failed to update the proposed file change', error),
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof ZeroDatabaseNotConfiguredError
              ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
              : error,
          ),
        ),
      )

      const acceptHunks: WritingChangeSetServiceShape['acceptHunks'] = Effect.fn(
        'WritingChangeSetService.acceptHunks',
      )(({ changeSetId, hunkIds, userId, organizationId, requestId }) =>
        zeroDatabase.withDatabase((db) =>
          Effect.tryPromise({
            try: () =>
              acceptChangeSetHunks({
                db,
                changeSetId,
                hunkIds,
                userId,
                organizationId,
                requestId,
              }),
            catch: (error) => {
              if (
                error instanceof WritingProjectNotFoundError ||
                error instanceof WritingConflictError
              ) {
                return error
              }
              return toPersistenceError(requestId, 'Failed to accept writing hunks', error)
            },
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof ZeroDatabaseNotConfiguredError
              ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
              : error,
          ),
        ),
      )

      const rejectHunks: WritingChangeSetServiceShape['rejectHunks'] = Effect.fn(
        'WritingChangeSetService.rejectHunks',
      )(({ changeSetId, hunkIds, userId, organizationId, requestId }) =>
        zeroDatabase.withDatabase((db) =>
          Effect.tryPromise({
            try: async () => {
              const { project, changeSet } = await getScopedChangeSet({
                db,
                changeSetId,
                userId,
                organizationId,
              })
              if (!project || !changeSet) {
                throw new WritingProjectNotFoundError({
                  message: 'Writing project not found',
                  requestId,
                  projectId: changeSet?.projectId ?? 'unknown-project',
                })
              }

              const selectedIds = new Set(hunkIds)
              const changes = await loadChangeRows(db, changeSetId)
              const createdAt = now()

              await db.transaction(async (tx) => {
                for (const change of changes) {
                  const currentHunks = await loadChangeHunks(tx, change.id)
                  const keptHunks = currentHunks.filter((hunk) => !selectedIds.has(hunk.id))
                  if (keptHunks.length === currentHunks.length) {
                    continue
                  }

                  const baseBlob = await getBlobById(tx, change.baseBlobId)
                  const baseContent = baseBlob?.content ?? ''
                  const nextProposedContent = applyAcceptedHunks({
                    baseContent,
                    acceptedHunks: keptHunks.map((hunk) => ({
                      oldStart: hunk.oldStart,
                      oldLines: hunk.oldLines,
                      patchText: hunk.patchText,
                    })),
                  })

                  if (nextProposedContent === baseContent) {
                    for (const hunk of currentHunks) {
                      await tx.mutate.writingChangeHunk.update({
                        id: hunk.id,
                        status: selectedIds.has(hunk.id) ? 'rejected' : hunk.status,
                      })
                    }
                    await tx.mutate.writingChange.update({
                      id: change.id,
                      status: 'rejected',
                    })
                    continue
                  }

                  const nextProposedBlob = await upsertWritingBlob({
                    tx,
                    content: nextProposedContent,
                  })
                  const replacementHunks = createWritingHunks({
                    path: change.path,
                    oldContent: baseContent,
                    newContent: nextProposedContent,
                  })
                  await tx.mutate.writingChange.update({
                    id: change.id,
                    proposedBlobId: nextProposedBlob.id,
                    status: 'pending',
                  })
                  await replaceChangeHunks({
                    tx,
                    changeId: change.id,
                    hunks: replacementHunks,
                    createdAt,
                  })
                }

                await updateChangeSetResolution({
                  tx,
                  changeSetId,
                })
              })
            },
            catch: (error) =>
              error instanceof WritingProjectNotFoundError
                ? error
                : toPersistenceError(requestId, 'Failed to reject writing hunks', error),
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof ZeroDatabaseNotConfiguredError
              ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
              : error,
          ),
        ),
      )

      const discardChangeSet: WritingChangeSetServiceShape['discardChangeSet'] = Effect.fn(
        'WritingChangeSetService.discardChangeSet',
      )(({ changeSetId, userId, organizationId, requestId }) =>
        zeroDatabase.withDatabase((db) =>
          Effect.tryPromise({
            try: async () => {
              const { project, changeSet } = await getScopedChangeSet({
                db,
                changeSetId,
                userId,
                organizationId,
              })
              if (!project || !changeSet) {
                throw new WritingProjectNotFoundError({
                  message: 'Writing project not found',
                  requestId,
                  projectId: changeSet?.projectId ?? 'unknown-project',
                })
              }

              const changes = await loadChangeRows(db, changeSetId)
              await db.transaction(async (tx) => {
                for (const change of changes) {
                  await tx.mutate.writingChange.update({
                    id: change.id,
                    status: 'rejected',
                  })
                  const currentHunks = await loadChangeHunks(tx, change.id)
                  for (const hunk of currentHunks) {
                    await tx.mutate.writingChangeHunk.update({
                      id: hunk.id,
                      status: 'rejected',
                    })
                  }
                }
                await tx.mutate.writingChangeSet.update({
                  id: changeSetId,
                  status: 'rejected',
                  resolvedAt: now(),
                })
              })
            },
            catch: (error) =>
              error instanceof WritingProjectNotFoundError
                ? error
                : toPersistenceError(requestId, 'Failed to discard the change set', error),
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof ZeroDatabaseNotConfiguredError
              ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
              : error,
          ),
        ),
      )

      const applyChangeSet: WritingChangeSetServiceShape['applyChangeSet'] = Effect.fn(
        'WritingChangeSetService.applyChangeSet',
      )(({ changeSetId, userId, organizationId, requestId }) =>
        zeroDatabase.withDatabase((db) =>
          Effect.tryPromise({
            try: async () => {
              const changes = await loadChangeRows(db, changeSetId)
              const allHunkIds: string[] = []
              for (const change of changes) {
                const hunks = await loadChangeHunks(db, change.id)
                allHunkIds.push(...hunks.map((hunk) => hunk.id))
              }

              return acceptChangeSetHunks({
                db,
                changeSetId,
                hunkIds: allHunkIds,
                userId,
                organizationId,
                requestId,
              })
            },
            catch: (error) =>
              error instanceof WritingProjectNotFoundError || error instanceof WritingConflictError
                ? error
                : toPersistenceError(requestId, 'Failed to auto-apply the change set', error),
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof ZeroDatabaseNotConfiguredError
              ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
              : error,
          ),
        ),
      )

      return {
        createChangeSet,
        attachAssistantMessage,
        upsertFileChange,
        acceptHunks,
        rejectHunks,
        discardChangeSet,
        applyChangeSet,
      }
    }),
  )
}
