import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
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
  captureCurrentSnapshotManifestWithSql,
  getBlobByIdWithSql,
  getProjectConversationWithSql,
  getProjectEntryByPathWithSql,
  getScopedProjectWithSql,
  getWritingChangeByPathWithSql,
  insertSnapshotWithSql,
  now,
  replaceProjectEntriesWithSql,
  upsertWritingBlobWithSql,
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
 * Centralizes hunk application so explicit approvals and auto-apply share the
 * same project locking, snapshot creation, and conflict detection rules.
 */
const acceptChangeSetHunksOperation = Effect.fn(
  'WritingChangeSetService.acceptChangeSetHunksOperation',
)(
  (input: {
    readonly changeSetId: string
    readonly hunkIds: readonly string[]
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
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
      let projectId = 'unknown-project'
      let projectHeadSnapshotId: string | undefined
      let changeSetBaseSnapshotId = ''
      let changeSetConversationId = ''
      let assistantMessageId: string | undefined
      let nextHeadSnapshotId: string | undefined

      yield* sql.withTransaction(
        Effect.gen(function* () {
          const { project, changeSet } = yield* getScopedChangeSet({
            sql,
            changeSetId: input.changeSetId,
            userId: input.userId,
            organizationId: input.organizationId,
            forUpdate: true,
          })
          const scoped = assertScopedChangeSetProject({
            project,
            changeSet,
            requestId: input.requestId,
          })

          projectId = scoped.project.id
          projectHeadSnapshotId = scoped.project.headSnapshotId ?? undefined
          changeSetBaseSnapshotId = scoped.changeSet.baseSnapshotId
          changeSetConversationId = scoped.changeSet.conversationId
          assistantMessageId = scoped.changeSet.assistantMessageId ?? undefined

          const changes = yield* loadChangeRows(sql, input.changeSetId)
          const manifest = new Map(
            (
              yield* captureCurrentSnapshotManifestWithSql(sql, scoped.project.id)
            ).map((entry) => [entry.path, entry]),
          )
          const createdAt = now()

          for (const change of changes) {
            const currentHunks = yield* loadChangeHunks(sql, change.id)
            const selectedHunks = currentHunks.filter((hunk) =>
              selectedIds.has(hunk.id),
            )
            if (selectedHunks.length === 0) {
              continue
            }

            const currentEntry = manifest.get(change.path)
            const currentBlobId = currentEntry?.blobId
            if ((currentBlobId ?? undefined) !== (change.baseBlobId ?? undefined)) {
              conflictingChanges.add(change.id)
              continue
            }

            const baseBlob = yield* getBlobByIdWithSql(sql, change.baseBlobId)
            const proposedBlob = yield* getBlobByIdWithSql(sql, change.proposedBlobId)
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

          for (const change of changes) {
            const currentHunks = yield* loadChangeHunks(sql, change.id)
            if (conflictingChanges.has(change.id)) {
              for (const hunk of currentHunks.filter((candidate) =>
                selectedIds.has(candidate.id),
              )) {
                yield* sql`
                  update writing_change_hunks
                  set status = 'conflicted'
                  where id = ${hunk.id}
                `
              }
              yield* sql`
                update writing_changes
                set status = 'conflicted'
                where id = ${change.id}
              `
              continue
            }

            const result = changeResults.get(change.id)
            if (!result) {
              continue
            }

            if (change.operation === 'delete' && result.nextBaseContent.length === 0) {
              manifest.delete(change.path)
            } else {
              const blob = yield* upsertWritingBlobWithSql(sql, {
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
            yield* replaceProjectEntriesWithSql(sql, {
              projectId: scoped.project.id,
              entries: [...manifest.values()],
              createdAt,
            })

            nextHeadSnapshotId = yield* insertSnapshotWithSql(sql, {
              projectId: scoped.project.id,
              parentSnapshotId: scoped.project.headSnapshotId ?? undefined,
              source: 'ai',
              summary: 'Accepted AI writing changes',
              conversationId: changeSetConversationId,
              messageId: assistantMessageId,
              createdByUserId: input.userId,
              entries: [...manifest.values()],
              createdAt,
            })

            yield* sql`
              update writing_projects
              set
                head_snapshot_id = ${nextHeadSnapshotId},
                updated_at = ${createdAt}
              where id = ${scoped.project.id}
            `
          }

          for (const change of changes) {
            const result = changeResults.get(change.id)
            if (!result || conflictingChanges.has(change.id)) {
              continue
            }

            const currentProposedContent = result.currentProposedContent
            if (result.nextBaseContent === currentProposedContent) {
              yield* sql`
                update writing_changes
                set
                  base_blob_id = ${result.nextBaseBlobId ?? null},
                  proposed_blob_id = ${result.nextBaseBlobId ?? null},
                  status = 'applied'
                where id = ${change.id}
              `

              const existingHunks = yield* loadChangeHunks(sql, change.id)
              for (const hunk of existingHunks) {
                yield* sql`
                  update writing_change_hunks
                  set status = ${selectedIds.has(hunk.id) ? 'applied' : hunk.status}
                  where id = ${hunk.id}
                `
              }
              continue
            }

            const nextProposedBlob = yield* upsertWritingBlobWithSql(sql, {
              content: currentProposedContent,
            })
            const remainingHunks = createWritingHunks({
              path: change.path,
              oldContent: result.nextBaseContent,
              newContent: currentProposedContent,
            })
            yield* sql`
              update writing_changes
              set
                base_blob_id = ${result.nextBaseBlobId ?? null},
                proposed_blob_id = ${nextProposedBlob.id},
                status = 'pending'
              where id = ${change.id}
            `
            yield* replaceChangeHunks({
              sql,
              changeId: change.id,
              hunks: remainingHunks,
              createdAt,
            })
          }

          yield* updateChangeSetResolution({
            sql,
            changeSetId: input.changeSetId,
          })
        }),
      )

      if (
        conflictingChanges.size > 0 &&
        changeResults.size === conflictingChanges.size
      ) {
        return yield* Effect.fail(
          new WritingConflictError({
            message: 'Some pending writing hunks could not be applied cleanly',
            requestId: input.requestId,
            projectId,
            expectedHeadSnapshotId: changeSetBaseSnapshotId,
            actualHeadSnapshotId: projectHeadSnapshotId,
          }),
        )
      }

      return {
        headSnapshotId: nextHeadSnapshotId,
      }
    }),
)

const createChangeSetOperation = Effect.fn(
  'WritingChangeSetService.createChangeSetOperation',
)(
  (input: {
    readonly projectId: string
    readonly conversationId: string
    readonly userId: string
    readonly organizationId?: string
    readonly summary: string
    readonly autoAccept: boolean
    readonly requestId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const project = yield* getScopedProjectWithSql(sql, {
        projectId: input.projectId,
        userId: input.userId,
        organizationId: input.organizationId,
      })
      if (!project) {
        return yield* Effect.fail(
          new WritingProjectNotFoundError({
            message: 'Writing project not found',
            requestId: input.requestId,
            projectId: input.projectId,
          }),
        )
      }

      const conversation = yield* getProjectConversationWithSql(sql, {
        conversationId: input.conversationId,
        projectId: input.projectId,
      })
      if (!conversation) {
        return yield* Effect.fail(
          new WritingChatNotFoundError({
            message: 'Writing conversation not found',
            requestId: input.requestId,
            chatId: input.conversationId,
          }),
        )
      }

      const changeSetId = crypto.randomUUID()
      yield* sql`
        insert into writing_change_sets (
          id,
          project_id,
          conversation_id,
          assistant_message_id,
          base_snapshot_id,
          status,
          auto_accept,
          summary,
          created_at,
          resolved_at
        ) values (
          ${changeSetId},
          ${input.projectId},
          ${input.conversationId},
          null,
          ${project.headSnapshotId ?? ''},
          'pending',
          ${input.autoAccept},
          ${input.summary},
          ${now()},
          null
        )
      `

      return {
        changeSetId,
        baseSnapshotId: project.headSnapshotId ?? '',
      }
    }),
)

const attachAssistantMessageOperation = Effect.fn(
  'WritingChangeSetService.attachAssistantMessageOperation',
)(
  (input: {
    readonly changeSetId: string
    readonly assistantMessageId: string
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      yield* sql.withTransaction(
        Effect.gen(function* () {
          const { project, changeSet } = yield* getScopedChangeSet({
            sql,
            changeSetId: input.changeSetId,
            userId: input.userId,
            organizationId: input.organizationId,
            forUpdate: true,
          })
          if (!project || !changeSet) {
            return yield* Effect.fail(
              new WritingProjectNotFoundError({
                message: 'Writing project not found',
                requestId: input.requestId,
                projectId: changeSet?.projectId ?? 'unknown-project',
              }),
            )
          }

          yield* sql`
            update writing_change_sets
            set assistant_message_id = ${input.assistantMessageId}
            where id = ${input.changeSetId}
          `
        }),
      )
    }),
)

const upsertFileChangeOperation = Effect.fn(
  'WritingChangeSetService.upsertFileChangeOperation',
)(
  (input: {
    readonly changeSetId: string
    readonly userId: string
    readonly organizationId?: string
    readonly path: string
    readonly operation: 'create' | 'update' | 'delete'
    readonly proposedContent?: string
    readonly requestId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient

      return yield* sql.withTransaction(
        Effect.gen(function* () {
          const { project, changeSet } = yield* getScopedChangeSet({
            sql,
            changeSetId: input.changeSetId,
            userId: input.userId,
            organizationId: input.organizationId,
            forUpdate: true,
          })
          if (!project || !changeSet) {
            return yield* Effect.fail(
              new WritingProjectNotFoundError({
                message: 'Writing project not found',
                requestId: input.requestId,
                projectId: changeSet?.projectId ?? 'unknown-project',
              }),
            )
          }

          const existingChange = yield* getWritingChangeByPathWithSql(sql, {
            changeSetId: input.changeSetId,
            path: input.path,
          })
          const currentEntry = yield* getProjectEntryByPathWithSql(sql, {
            projectId: project.id,
            path: input.path,
          })
          const baseBlob = existingChange
            ? yield* getBlobByIdWithSql(sql, existingChange.baseBlobId)
            : yield* getBlobByIdWithSql(sql, currentEntry?.blobId)
          const baseContent = baseBlob?.content ?? ''
          const nextContent =
            input.operation === 'delete' ? '' : (input.proposedContent ?? '')
          const hunks = createWritingHunks({
            path: input.path,
            oldContent: baseContent,
            newContent: nextContent,
          })

          const createdAt = now()
          const changeId = existingChange?.id ?? crypto.randomUUID()
          const proposedBlob =
            input.operation === 'delete'
              ? null
              : yield* upsertWritingBlobWithSql(sql, {
                  content: nextContent,
                })

          if (!existingChange) {
            yield* sql`
              insert into writing_changes (
                id,
                change_set_id,
                path,
                from_path,
                operation,
                base_blob_id,
                proposed_blob_id,
                status,
                created_at
              ) values (
                ${changeId},
                ${input.changeSetId},
                ${input.path},
                null,
                ${input.operation},
                ${baseBlob?.id ?? null},
                ${proposedBlob?.id ?? null},
                ${hunks.length === 0 ? 'rejected' : 'pending'},
                ${createdAt}
              )
            `
          } else {
            yield* sql`
              update writing_changes
              set
                operation = ${input.operation},
                proposed_blob_id = ${proposedBlob?.id ?? null},
                status = ${hunks.length === 0 ? 'rejected' : 'pending'}
              where id = ${existingChange.id}
            `
          }

          yield* replaceChangeHunks({
            sql,
            changeId,
            hunks,
            createdAt,
          })

          yield* updateChangeSetResolution({
            sql,
            changeSetId: input.changeSetId,
          })

          return {
            changeId,
            hunkCount: hunks.length,
          }
        }),
      )
    }),
)

const rejectHunksOperation = Effect.fn(
  'WritingChangeSetService.rejectHunksOperation',
)(
  (input: {
    readonly changeSetId: string
    readonly hunkIds: readonly string[]
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const selectedIds = new Set(input.hunkIds)

      yield* sql.withTransaction(
        Effect.gen(function* () {
          const { project, changeSet } = yield* getScopedChangeSet({
            sql,
            changeSetId: input.changeSetId,
            userId: input.userId,
            organizationId: input.organizationId,
            forUpdate: true,
          })
          if (!project || !changeSet) {
            return yield* Effect.fail(
              new WritingProjectNotFoundError({
                message: 'Writing project not found',
                requestId: input.requestId,
                projectId: changeSet?.projectId ?? 'unknown-project',
              }),
            )
          }

          const changes = yield* loadChangeRows(sql, input.changeSetId)
          const createdAt = now()

          for (const change of changes) {
            const currentHunks = yield* loadChangeHunks(sql, change.id)
            const keptHunks = currentHunks.filter((hunk) => !selectedIds.has(hunk.id))
            if (keptHunks.length === currentHunks.length) {
              continue
            }

            const baseBlob = yield* getBlobByIdWithSql(sql, change.baseBlobId)
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
                yield* sql`
                  update writing_change_hunks
                  set status = ${selectedIds.has(hunk.id) ? 'rejected' : hunk.status}
                  where id = ${hunk.id}
                `
              }
              yield* sql`
                update writing_changes
                set status = 'rejected'
                where id = ${change.id}
              `
              continue
            }

            const nextProposedBlob = yield* upsertWritingBlobWithSql(sql, {
              content: nextProposedContent,
            })
            const replacementHunks = createWritingHunks({
              path: change.path,
              oldContent: baseContent,
              newContent: nextProposedContent,
            })
            yield* sql`
              update writing_changes
              set
                proposed_blob_id = ${nextProposedBlob.id},
                status = 'pending'
              where id = ${change.id}
            `
            yield* replaceChangeHunks({
              sql,
              changeId: change.id,
              hunks: replacementHunks,
              createdAt,
            })
          }

          yield* updateChangeSetResolution({
            sql,
            changeSetId: input.changeSetId,
          })
        }),
      )
    }),
)

const discardChangeSetOperation = Effect.fn(
  'WritingChangeSetService.discardChangeSetOperation',
)(
  (input: {
    readonly changeSetId: string
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      yield* sql.withTransaction(
        Effect.gen(function* () {
          const { project, changeSet } = yield* getScopedChangeSet({
            sql,
            changeSetId: input.changeSetId,
            userId: input.userId,
            organizationId: input.organizationId,
            forUpdate: true,
          })
          if (!project || !changeSet) {
            return yield* Effect.fail(
              new WritingProjectNotFoundError({
                message: 'Writing project not found',
                requestId: input.requestId,
                projectId: changeSet?.projectId ?? 'unknown-project',
              }),
            )
          }

          const changes = yield* loadChangeRows(sql, input.changeSetId)
          for (const change of changes) {
            yield* sql`
              update writing_changes
              set status = 'rejected'
              where id = ${change.id}
            `
            const currentHunks = yield* loadChangeHunks(sql, change.id)
            for (const hunk of currentHunks) {
              yield* sql`
                update writing_change_hunks
                set status = 'rejected'
                where id = ${hunk.id}
              `
            }
          }

          yield* sql`
            update writing_change_sets
            set
              status = 'rejected',
              resolved_at = ${now()}
            where id = ${input.changeSetId}
          `
        }),
      )
    }),
)

const applyChangeSetOperation = Effect.fn(
  'WritingChangeSetService.applyChangeSetOperation',
)(
  (input: {
    readonly changeSetId: string
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const changes = yield* loadChangeRows(sql, input.changeSetId)
      const allHunkIds: string[] = []
      for (const change of changes) {
        const hunks = yield* loadChangeHunks(sql, change.id)
        allHunkIds.push(...hunks.map((hunk) => hunk.id))
      }

      return yield* acceptChangeSetHunksOperation({
        changeSetId: input.changeSetId,
        hunkIds: allHunkIds,
        userId: input.userId,
        organizationId: input.organizationId,
        requestId: input.requestId,
      })
    }),
)

export type WritingChangeSetServiceShape = {
  readonly createChangeSet: (input: {
    readonly projectId: string
    readonly conversationId: string
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
      const client = yield* PgClient.PgClient
      const provideSql = <TValue, TError>(
        effect: Effect.Effect<TValue, TError, PgClient.PgClient>,
      ): Effect.Effect<TValue, TError> =>
        Effect.provideService(effect, PgClient.PgClient, client)

      const createChangeSet: WritingChangeSetServiceShape['createChangeSet'] = Effect.fn(
        'WritingChangeSetService.createChangeSet',
      )(
        ({
          projectId,
          conversationId,
          userId,
          organizationId,
          summary,
          autoAccept,
          requestId,
        }) =>
          provideSql(
            createChangeSetOperation({
              projectId,
              conversationId,
              userId,
              organizationId,
              summary,
              autoAccept,
              requestId,
            }),
          ).pipe(
            Effect.mapError((error) => {
              if (
                error instanceof WritingProjectNotFoundError ||
                error instanceof WritingChatNotFoundError
              ) {
                return error
              }
              return toPersistenceError(
                requestId,
                'Failed to create the change set',
                error,
              )
            }),
          ),
      )

      const attachAssistantMessage: WritingChangeSetServiceShape['attachAssistantMessage'] =
        Effect.fn('WritingChangeSetService.attachAssistantMessage')(
          ({ changeSetId, assistantMessageId, userId, organizationId, requestId }) =>
            provideSql(
              attachAssistantMessageOperation({
                changeSetId,
                assistantMessageId,
                userId,
                organizationId,
                requestId,
              }),
            ).pipe(
              Effect.mapError((error) =>
                error instanceof WritingProjectNotFoundError
                  ? error
                  : toPersistenceError(
                      requestId,
                      'Failed to attach the assistant message',
                      error,
                    ),
              ),
            ),
        )

      const upsertFileChange: WritingChangeSetServiceShape['upsertFileChange'] = Effect.fn(
        'WritingChangeSetService.upsertFileChange',
      )(({ changeSetId, userId, organizationId, path, operation, proposedContent, requestId }) =>
        provideSql(
          upsertFileChangeOperation({
            changeSetId,
            userId,
            organizationId,
            path,
            operation,
            proposedContent,
            requestId,
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof WritingProjectNotFoundError
              ? error
              : toPersistenceError(
                  requestId,
                  'Failed to update the proposed file change',
                  error,
                ),
          ),
        ),
      )

      const acceptHunks: WritingChangeSetServiceShape['acceptHunks'] = Effect.fn(
        'WritingChangeSetService.acceptHunks',
      )(({ changeSetId, hunkIds, userId, organizationId, requestId }) =>
        provideSql(
          acceptChangeSetHunksOperation({
            changeSetId,
            hunkIds,
            userId,
            organizationId,
            requestId,
          }),
        ).pipe(
          Effect.mapError((error) => {
            if (
              error instanceof WritingProjectNotFoundError ||
              error instanceof WritingConflictError
            ) {
              return error
            }
            return toPersistenceError(requestId, 'Failed to accept writing hunks', error)
          }),
        ),
      )

      const rejectHunks: WritingChangeSetServiceShape['rejectHunks'] = Effect.fn(
        'WritingChangeSetService.rejectHunks',
      )(({ changeSetId, hunkIds, userId, organizationId, requestId }) =>
        provideSql(
          rejectHunksOperation({
            changeSetId,
            hunkIds,
            userId,
            organizationId,
            requestId,
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof WritingProjectNotFoundError
              ? error
              : toPersistenceError(requestId, 'Failed to reject writing hunks', error),
          ),
        ),
      )

      const discardChangeSet: WritingChangeSetServiceShape['discardChangeSet'] = Effect.fn(
        'WritingChangeSetService.discardChangeSet',
      )(({ changeSetId, userId, organizationId, requestId }) =>
        provideSql(
          discardChangeSetOperation({
            changeSetId,
            userId,
            organizationId,
            requestId,
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof WritingProjectNotFoundError
              ? error
              : toPersistenceError(requestId, 'Failed to discard the change set', error),
          ),
        ),
      )

      const applyChangeSet: WritingChangeSetServiceShape['applyChangeSet'] = Effect.fn(
        'WritingChangeSetService.applyChangeSet',
      )(({ changeSetId, userId, organizationId, requestId }) =>
        provideSql(
          applyChangeSetOperation({
            changeSetId,
            userId,
            organizationId,
            requestId,
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof WritingProjectNotFoundError ||
            error instanceof WritingConflictError
              ? error
              : toPersistenceError(requestId, 'Failed to auto-apply the change set', error),
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
