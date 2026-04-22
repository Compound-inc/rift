import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
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
      const client = yield* PgClient.PgClient
      const provideSql = <TValue, TError>(
        effect: Effect.Effect<TValue, TError, PgClient.PgClient>,
      ): Effect.Effect<TValue, TError> =>
        Effect.provideService(effect, PgClient.PgClient, client)

      const manualSaveFile: WritingSnapshotServiceShape['manualSaveFile'] = Effect.fn(
        'WritingSnapshotService.manualSaveFile',
      )(
        ({
          projectId,
          userId,
          organizationId,
          path,
          content,
          expectedHeadSnapshotId,
          summary,
          requestId,
        }) =>
          provideSql(
            manualSaveFileOperation({
              projectId,
              userId,
              organizationId,
              path,
              content,
              expectedHeadSnapshotId,
              summary,
              requestId,
            }),
          ).pipe(
            Effect.mapError((error) =>
              mapSnapshotPathError({
                error,
                requestId,
                invalidMessage: 'The requested writing file path is invalid',
                persistenceMessage: 'Failed to save the writing file',
              }),
            ),
          ),
      )

      const createFolder: WritingSnapshotServiceShape['createFolder'] = Effect.fn(
        'WritingSnapshotService.createFolder',
      )(({ projectId, userId, organizationId, path, expectedHeadSnapshotId, requestId }) =>
        provideSql(
          createFolderOperation({
            projectId,
            userId,
            organizationId,
            path,
            expectedHeadSnapshotId,
            requestId,
          }),
        ).pipe(
          Effect.mapError((error) =>
            mapSnapshotPathError({
              error,
              requestId,
              invalidMessage: 'The requested writing folder path is invalid',
              persistenceMessage: 'Failed to create the writing folder',
            }),
          ),
        ),
      )

      const createCheckpoint: WritingSnapshotServiceShape['createCheckpoint'] = Effect.fn(
        'WritingSnapshotService.createCheckpoint',
      )(({ projectId, userId, organizationId, summary, requestId }) =>
        provideSql(
          createCheckpointOperation({
            projectId,
            userId,
            organizationId,
            summary,
            requestId,
          }),
        ).pipe(
          Effect.mapError((error) =>
            error instanceof WritingProjectNotFoundError
              ? error
              : toPersistenceError(requestId, 'Failed to create a writing checkpoint', error),
          ),
        ),
      )

      const restoreSnapshot: WritingSnapshotServiceShape['restoreSnapshot'] = Effect.fn(
        'WritingSnapshotService.restoreSnapshot',
      )(({ projectId, snapshotId, userId, organizationId, expectedHeadSnapshotId, requestId }) =>
        provideSql(
          restoreSnapshotOperation({
            projectId,
            snapshotId,
            userId,
            organizationId,
            expectedHeadSnapshotId,
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
            return toPersistenceError(
              requestId,
              'Failed to restore the writing checkpoint',
              error,
            )
          }),
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
