import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import {
  assertValidWritingFilePath,
  assertValidWritingFolderPath,
  getWritingParentPath,
  WritingPathError,
} from '@/lib/shared/writing/path-utils'
import {
  WritingConflictError,
  WritingInvalidRequestError,
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../../domain/errors'
import {
  captureCurrentSnapshotManifestWithSql,
  ensureFolderEntriesWithSql,
  getScopedProjectWithSql,
  insertSnapshotWithSql,
  loadSnapshotManifestWithSql,
  now,
  replaceProjectEntriesWithSql,
  upsertWritingBlobWithSql,
  upsertWritingEntryWithSql,
} from '../persistence'

export function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

export function toInvalidRequestError(
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

function assertExpectedHead(input: {
  readonly project: {
    readonly id: string
    readonly headSnapshotId?: string | null
  }
  readonly expectedHeadSnapshotId?: string
  readonly requestId: string
  readonly message: string
  readonly path?: string
}) {
  if (
    input.expectedHeadSnapshotId &&
    input.project.headSnapshotId &&
    input.expectedHeadSnapshotId !== input.project.headSnapshotId
  ) {
    throw new WritingConflictError({
      message: input.message,
      requestId: input.requestId,
      projectId: input.project.id,
      expectedHeadSnapshotId: input.expectedHeadSnapshotId,
      actualHeadSnapshotId: input.project.headSnapshotId ?? undefined,
      path: input.path,
    })
  }
}

/**
 * Manual writes are serialized through the project row lock so the optimistic
 * `expectedHeadSnapshotId` check and the subsequent head update observe the
 * same project state.
 */
export const manualSaveFileOperation = Effect.fn(
  'WritingSnapshotOperations.manualSaveFileOperation',
)(
  (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly path: string
    readonly content: string
    readonly expectedHeadSnapshotId?: string
    readonly summary?: string
    readonly requestId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const normalizedPath = assertValidWritingFilePath(input.path)
      const parentPath = getWritingParentPath(normalizedPath)
      const createdAt = now()
      let nextHeadSnapshotId = ''

      yield* sql.withTransaction(
        Effect.gen(function* () {
          const project = yield* getScopedProjectWithSql(sql, {
            projectId: input.projectId,
            userId: input.userId,
            organizationId: input.organizationId,
            forUpdate: true,
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

          assertExpectedHead({
            project,
            expectedHeadSnapshotId: input.expectedHeadSnapshotId,
            requestId: input.requestId,
            message: 'Writing project head changed before the save completed',
            path: input.path,
          })

          if (parentPath) {
            yield* ensureFolderEntriesWithSql(sql, {
              projectId: input.projectId,
              folderPath: parentPath,
              createdAt,
            })
          }

          const blob = yield* upsertWritingBlobWithSql(sql, {
            content: input.content,
          })
          yield* upsertWritingEntryWithSql(sql, {
            projectId: input.projectId,
            path: normalizedPath,
            kind: 'file',
            blob,
            createdAt,
          })

          const manifest = yield* captureCurrentSnapshotManifestWithSql(
            sql,
            input.projectId,
          )
          const snapshotId = yield* insertSnapshotWithSql(sql, {
            projectId: input.projectId,
            parentSnapshotId: project.headSnapshotId ?? undefined,
            source: 'user',
            summary: input.summary ?? `Updated ${normalizedPath}`,
            createdByUserId: input.userId,
            entries: manifest,
            createdAt,
          })

          yield* sql`
            update writing_projects
            set
              head_snapshot_id = ${snapshotId},
              updated_at = ${createdAt}
            where id = ${input.projectId}
          `
          nextHeadSnapshotId = snapshotId
        }),
      )

      return {
        headSnapshotId: nextHeadSnapshotId,
      }
    }),
)

export const createFolderOperation = Effect.fn(
  'WritingSnapshotOperations.createFolderOperation',
)(
  (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly path: string
    readonly expectedHeadSnapshotId?: string
    readonly requestId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const normalizedPath = assertValidWritingFolderPath(input.path)
      const createdAt = now()
      let nextHeadSnapshotId = ''

      yield* sql.withTransaction(
        Effect.gen(function* () {
          const project = yield* getScopedProjectWithSql(sql, {
            projectId: input.projectId,
            userId: input.userId,
            organizationId: input.organizationId,
            forUpdate: true,
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

          assertExpectedHead({
            project,
            expectedHeadSnapshotId: input.expectedHeadSnapshotId,
            requestId: input.requestId,
            message: 'Writing project head changed before the folder was created',
            path: input.path,
          })

          yield* ensureFolderEntriesWithSql(sql, {
            projectId: input.projectId,
            folderPath: normalizedPath,
            createdAt,
          })

          const manifest = yield* captureCurrentSnapshotManifestWithSql(
            sql,
            input.projectId,
          )
          const snapshotId = yield* insertSnapshotWithSql(sql, {
            projectId: input.projectId,
            parentSnapshotId: project.headSnapshotId ?? undefined,
            source: 'user',
            summary: `Created folder ${normalizedPath}`,
            createdByUserId: input.userId,
            entries: manifest,
            createdAt,
          })

          yield* sql`
            update writing_projects
            set
              head_snapshot_id = ${snapshotId},
              updated_at = ${createdAt}
            where id = ${input.projectId}
          `
          nextHeadSnapshotId = snapshotId
        }),
      )

      return {
        headSnapshotId: nextHeadSnapshotId,
      }
    }),
)

export const createCheckpointOperation = Effect.fn(
  'WritingSnapshotOperations.createCheckpointOperation',
)(
  (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly summary: string
    readonly requestId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const createdAt = now()
      let nextHeadSnapshotId = ''

      yield* sql.withTransaction(
        Effect.gen(function* () {
          const project = yield* getScopedProjectWithSql(sql, {
            projectId: input.projectId,
            userId: input.userId,
            organizationId: input.organizationId,
            forUpdate: true,
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

          const manifest = yield* captureCurrentSnapshotManifestWithSql(
            sql,
            input.projectId,
          )
          const snapshotId = yield* insertSnapshotWithSql(sql, {
            projectId: input.projectId,
            parentSnapshotId: project.headSnapshotId ?? undefined,
            source: 'user',
            summary: input.summary,
            createdByUserId: input.userId,
            entries: manifest,
            createdAt,
          })

          yield* sql`
            update writing_projects
            set
              head_snapshot_id = ${snapshotId},
              updated_at = ${createdAt}
            where id = ${input.projectId}
          `
          nextHeadSnapshotId = snapshotId
        }),
      )

      return {
        headSnapshotId: nextHeadSnapshotId,
      }
    }),
)

export const restoreSnapshotOperation = Effect.fn(
  'WritingSnapshotOperations.restoreSnapshotOperation',
)(
  (input: {
    readonly projectId: string
    readonly snapshotId: string
    readonly userId: string
    readonly organizationId?: string
    readonly expectedHeadSnapshotId?: string
    readonly requestId: string
  }) =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const createdAt = now()
      let nextHeadSnapshotId = ''

      yield* sql.withTransaction(
        Effect.gen(function* () {
          const project = yield* getScopedProjectWithSql(sql, {
            projectId: input.projectId,
            userId: input.userId,
            organizationId: input.organizationId,
            forUpdate: true,
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

          assertExpectedHead({
            project,
            expectedHeadSnapshotId: input.expectedHeadSnapshotId,
            requestId: input.requestId,
            message: 'Writing project head changed before restore completed',
          })

          const manifest = yield* loadSnapshotManifestWithSql(sql, {
            snapshotId: input.snapshotId,
          })

          yield* replaceProjectEntriesWithSql(sql, {
            projectId: input.projectId,
            entries: manifest,
            createdAt,
          })

          const restoredManifest = yield* captureCurrentSnapshotManifestWithSql(
            sql,
            input.projectId,
          )
          const snapshotId = yield* insertSnapshotWithSql(sql, {
            projectId: input.projectId,
            parentSnapshotId: project.headSnapshotId ?? undefined,
            source: 'restore',
            summary: `Restored checkpoint ${input.snapshotId}`,
            createdByUserId: input.userId,
            restoredFromSnapshotId: input.snapshotId,
            entries: restoredManifest,
            createdAt,
          })

          yield* sql`
            update writing_projects
            set
              head_snapshot_id = ${snapshotId},
              updated_at = ${createdAt}
            where id = ${input.projectId}
          `
          nextHeadSnapshotId = snapshotId
        }),
      )

      return {
        headSnapshotId: nextHeadSnapshotId,
      }
    }),
)

export function mapSnapshotPathError(input: {
  readonly error: unknown
  readonly requestId: string
  readonly invalidMessage: string
  readonly persistenceMessage: string
}) {
  if (
    input.error instanceof WritingProjectNotFoundError ||
    input.error instanceof WritingConflictError ||
    input.error instanceof WritingInvalidRequestError
  ) {
    return input.error
  }
  if (input.error instanceof WritingPathError) {
    return toInvalidRequestError(
      input.requestId,
      input.invalidMessage,
      input.error,
    )
  }
  return toPersistenceError(input.requestId, input.persistenceMessage, input.error)
}
