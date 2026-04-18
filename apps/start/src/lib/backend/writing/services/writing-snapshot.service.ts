import { Effect, Layer, ServiceMap } from 'effect'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import { ZeroDatabaseNotConfiguredError, ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import {
  assertValidWritingFilePath,
  assertValidWritingFolderPath,
  getWritingParentPath,
  WritingPathError,
} from '@/lib/shared/writing'
import {
  WritingConflictError,
  WritingInvalidRequestError,
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../domain/errors'
import {
  captureCurrentSnapshotManifest,
  ensureFolderEntries,
  getScopedProject,
  insertSnapshot,
  loadSnapshotManifest,
  now,
  replaceProjectEntries,
  upsertWritingBlob,
  upsertWritingEntry,
} from './writing-persistence'

function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

function toInvalidRequestError(
  requestId: string,
  message: string,
  issue: unknown,
) {
  return new WritingInvalidRequestError({
    message,
    requestId,
    issue: issue instanceof Error ? issue.message : String(issue ?? ''),
  })
}

export type WritingSnapshotServiceShape = {
  readonly manualSaveFile: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly path: string
    readonly content: string
    readonly expectedHeadSnapshotId?: string
    readonly summary?: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly headSnapshotId: string },
    WritingProjectNotFoundError | WritingConflictError | WritingInvalidRequestError | WritingPersistenceError
  >
  readonly createFolder: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly path: string
    readonly expectedHeadSnapshotId?: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly headSnapshotId: string },
    WritingProjectNotFoundError | WritingConflictError | WritingInvalidRequestError | WritingPersistenceError
  >
  readonly createCheckpoint: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly summary: string
    readonly requestId: string
  }) => Effect.Effect<{ readonly headSnapshotId: string }, WritingProjectNotFoundError | WritingPersistenceError>
  readonly restoreSnapshot: (input: {
    readonly projectId: string
    readonly snapshotId: string
    readonly userId: string
    readonly organizationId?: string
    readonly expectedHeadSnapshotId?: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly headSnapshotId: string },
    WritingProjectNotFoundError | WritingConflictError | WritingPersistenceError
  >
}

export class WritingSnapshotService extends ServiceMap.Service<
  WritingSnapshotService,
  WritingSnapshotServiceShape
>()('writing-backend/WritingSnapshotService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const zeroDatabase = yield* ZeroDatabaseService

      const manualSaveFile: WritingSnapshotServiceShape['manualSaveFile'] = Effect.fn(
        'WritingSnapshotService.manualSaveFile',
      )(({ projectId, userId, organizationId, path, content, expectedHeadSnapshotId, summary, requestId }) =>
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
              if (
                expectedHeadSnapshotId &&
                project.headSnapshotId &&
                expectedHeadSnapshotId !== project.headSnapshotId
              ) {
                throw new WritingConflictError({
                  message: 'Writing project head changed before the save completed',
                  requestId,
                  projectId,
                  expectedHeadSnapshotId,
                  actualHeadSnapshotId: project.headSnapshotId ?? undefined,
                  path,
                })
              }

              const normalizedPath = assertValidWritingFilePath(path)
              const parentPath = getWritingParentPath(normalizedPath)
              const createdAt = now()

              await db.transaction(async (tx) => {
                if (parentPath) {
                  await ensureFolderEntries({
                    tx,
                    projectId,
                    folderPath: parentPath,
                    createdAt,
                  })
                }

                const blob = await upsertWritingBlob({
                  tx,
                  content,
                })
                await upsertWritingEntry({
                  tx,
                  projectId,
                  path: normalizedPath,
                  kind: 'file',
                  blob,
                  createdAt,
                })

                const manifest = await captureCurrentSnapshotManifest(tx, projectId)
                const snapshotId = await insertSnapshot({
                  tx,
                  projectId,
                  parentSnapshotId: project.headSnapshotId ?? undefined,
                  source: 'user',
                  summary: summary ?? `Updated ${normalizedPath}`,
                  createdByUserId: userId,
                  entries: manifest,
                  createdAt,
                })

                await tx.mutate.writingProject.update({
                  id: projectId,
                  headSnapshotId: snapshotId,
                  updatedAt: createdAt,
                })
              })

              const updated = await db.run(zql.writingProject.where('id', projectId).one())
              return {
                headSnapshotId: updated?.headSnapshotId ?? project.headSnapshotId ?? '',
              }
            },
            catch: (error) => {
              if (
                error instanceof WritingProjectNotFoundError ||
                error instanceof WritingConflictError ||
                error instanceof WritingInvalidRequestError
              ) {
                return error
              }
              if (error instanceof WritingPathError) {
                return toInvalidRequestError(
                  requestId,
                  'The requested writing file path is invalid',
                  error,
                )
              }
              return toPersistenceError(requestId, 'Failed to save the writing file', error)
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

      const createFolder: WritingSnapshotServiceShape['createFolder'] = Effect.fn(
        'WritingSnapshotService.createFolder',
      )(({ projectId, userId, organizationId, path, expectedHeadSnapshotId, requestId }) =>
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
              if (
                expectedHeadSnapshotId &&
                project.headSnapshotId &&
                expectedHeadSnapshotId !== project.headSnapshotId
              ) {
                throw new WritingConflictError({
                  message: 'Writing project head changed before the folder was created',
                  requestId,
                  projectId,
                  expectedHeadSnapshotId,
                  actualHeadSnapshotId: project.headSnapshotId ?? undefined,
                  path,
                })
              }

              const normalizedPath = assertValidWritingFolderPath(path)
              const createdAt = now()
              await db.transaction(async (tx) => {
                await ensureFolderEntries({
                  tx,
                  projectId,
                  folderPath: normalizedPath,
                  createdAt,
                })
                const manifest = await captureCurrentSnapshotManifest(tx, projectId)
                const snapshotId = await insertSnapshot({
                  tx,
                  projectId,
                  parentSnapshotId: project.headSnapshotId ?? undefined,
                  source: 'user',
                  summary: `Created folder ${normalizedPath}`,
                  createdByUserId: userId,
                  entries: manifest,
                  createdAt,
                })
                await tx.mutate.writingProject.update({
                  id: projectId,
                  headSnapshotId: snapshotId,
                  updatedAt: createdAt,
                })
              })

              const updated = await db.run(zql.writingProject.where('id', projectId).one())
              return {
                headSnapshotId: updated?.headSnapshotId ?? project.headSnapshotId ?? '',
              }
            },
            catch: (error) => {
              if (
                error instanceof WritingProjectNotFoundError ||
                error instanceof WritingConflictError ||
                error instanceof WritingInvalidRequestError
              ) {
                return error
              }
              if (error instanceof WritingPathError) {
                return toInvalidRequestError(
                  requestId,
                  'The requested writing folder path is invalid',
                  error,
                )
              }
              return toPersistenceError(requestId, 'Failed to create the writing folder', error)
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

      const createCheckpoint: WritingSnapshotServiceShape['createCheckpoint'] = Effect.fn(
        'WritingSnapshotService.createCheckpoint',
      )(({ projectId, userId, organizationId, summary, requestId }) =>
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

              const createdAt = now()
              await db.transaction(async (tx) => {
                const manifest = await captureCurrentSnapshotManifest(tx, projectId)
                const snapshotId = await insertSnapshot({
                  tx,
                  projectId,
                  parentSnapshotId: project.headSnapshotId ?? undefined,
                  source: 'user',
                  summary,
                  createdByUserId: userId,
                  entries: manifest,
                  createdAt,
                })
                await tx.mutate.writingProject.update({
                  id: projectId,
                  headSnapshotId: snapshotId,
                  updatedAt: createdAt,
                })
              })

              const updated = await db.run(zql.writingProject.where('id', projectId).one())
              return {
                headSnapshotId: updated?.headSnapshotId ?? project.headSnapshotId ?? '',
              }
            },
            catch: (error) =>
              error instanceof WritingProjectNotFoundError
                ? error
                : toPersistenceError(requestId, 'Failed to create a writing checkpoint', error),
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof ZeroDatabaseNotConfiguredError
              ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
              : error,
          ),
        ),
      )

      const restoreSnapshot: WritingSnapshotServiceShape['restoreSnapshot'] = Effect.fn(
        'WritingSnapshotService.restoreSnapshot',
      )(({ projectId, snapshotId, userId, organizationId, expectedHeadSnapshotId, requestId }) =>
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
              if (
                expectedHeadSnapshotId &&
                project.headSnapshotId &&
                expectedHeadSnapshotId !== project.headSnapshotId
              ) {
                throw new WritingConflictError({
                  message: 'Writing project head changed before restore completed',
                  requestId,
                  projectId,
                  expectedHeadSnapshotId,
                  actualHeadSnapshotId: project.headSnapshotId ?? undefined,
                })
              }

              const manifest = await loadSnapshotManifest({
                db,
                snapshotId,
              })
              const createdAt = now()
              await db.transaction(async (tx) => {
                await replaceProjectEntries({
                  tx,
                  projectId,
                  entries: manifest,
                  createdAt,
                })

                const restoredManifest = await captureCurrentSnapshotManifest(tx, projectId)
                const nextSnapshotId = await insertSnapshot({
                  tx,
                  projectId,
                  parentSnapshotId: project.headSnapshotId ?? undefined,
                  source: 'restore',
                  summary: `Restored checkpoint ${snapshotId}`,
                  createdByUserId: userId,
                  restoredFromSnapshotId: snapshotId,
                  entries: restoredManifest,
                  createdAt,
                })

                await tx.mutate.writingProject.update({
                  id: projectId,
                  headSnapshotId: nextSnapshotId,
                  updatedAt: createdAt,
                })
              })

              const updated = await db.run(zql.writingProject.where('id', projectId).one())
              return {
                headSnapshotId: updated?.headSnapshotId ?? project.headSnapshotId ?? '',
              }
            },
            catch: (error) => {
              if (
                error instanceof WritingProjectNotFoundError ||
                error instanceof WritingConflictError
              ) {
                return error
              }
              return toPersistenceError(requestId, 'Failed to restore the writing checkpoint', error)
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

      return {
        manualSaveFile,
        createFolder,
        createCheckpoint,
        restoreSnapshot,
      }
    }),
  )
}
