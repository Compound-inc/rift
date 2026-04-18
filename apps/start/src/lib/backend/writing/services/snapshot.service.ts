import { Effect, Layer, ServiceMap } from 'effect'
import { ZeroDatabaseNotConfiguredError, ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import {
  WritingConflictError,
  WritingInvalidRequestError,
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../domain/errors'
import {
  createCheckpointOperation,
  createFolderOperation,
  manualSaveFileOperation,
  mapSnapshotPathError,
  restoreSnapshotOperation,
  toPersistenceError,
} from './snapshot/operations'

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
    | WritingProjectNotFoundError
    | WritingConflictError
    | WritingInvalidRequestError
    | WritingPersistenceError
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
    | WritingProjectNotFoundError
    | WritingConflictError
    | WritingInvalidRequestError
    | WritingPersistenceError
  >
  readonly createCheckpoint: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly summary: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly headSnapshotId: string },
    WritingProjectNotFoundError | WritingPersistenceError
  >
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
            try: async () =>
              manualSaveFileOperation({
                db,
                projectId,
                userId,
                organizationId,
                path,
                content,
                expectedHeadSnapshotId,
                summary,
                requestId,
              }),
            catch: (error) =>
              mapSnapshotPathError({
                error,
                requestId,
                invalidMessage: 'The requested writing file path is invalid',
                persistenceMessage: 'Failed to save the writing file',
              }),
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
            try: async () =>
              createFolderOperation({
                db,
                projectId,
                userId,
                organizationId,
                path,
                expectedHeadSnapshotId,
                requestId,
              }),
            catch: (error) =>
              mapSnapshotPathError({
                error,
                requestId,
                invalidMessage: 'The requested writing folder path is invalid',
                persistenceMessage: 'Failed to create the writing folder',
              }),
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
            try: async () =>
              createCheckpointOperation({
                db,
                projectId,
                userId,
                organizationId,
                summary,
                requestId,
              }),
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
            try: async () =>
              restoreSnapshotOperation({
                db,
                projectId,
                snapshotId,
                userId,
                organizationId,
                expectedHeadSnapshotId,
                requestId,
              }),
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
