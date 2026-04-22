import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import {
  WritingInvalidRequestError,
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../domain/errors'
import {
  getBlobByIdSql,
  getWritingChangeSetSql,
  listProjectEntriesSql,
  listWritingChangesByChangeSetSql,
  now,
} from './persistence'
import type { WritingEntryRow } from './persistence'
import { WritingProjectService } from './project.service'

function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

type ProjectedEntry = WritingEntryRow & {
  readonly content?: string
  readonly isPending?: boolean
}

/**
 * Projects pending change-set edits over the stored workspace so PI tools can
 * read a consistent "current working tree" view before those edits are applied.
 */
const loadProjectedEntries = Effect.fn('WritingWorkspaceService.loadProjectedEntries')(
  (input: {
    readonly projectId: string
    readonly changeSetId?: string
  }) =>
    Effect.gen(function* () {
      const baseEntries = yield* listProjectEntriesSql(input.projectId)
      const entryMap = new Map<string, ProjectedEntry>(
        baseEntries.map((entry) => [entry.path, { ...entry }]),
      )

      if (!input.changeSetId) {
        return [...entryMap.values()].sort((left, right) =>
          left.path.localeCompare(right.path),
        )
      }

      const changeSet = yield* getWritingChangeSetSql(input.changeSetId)
      if (!changeSet || changeSet.projectId !== input.projectId) {
        return [...entryMap.values()].sort((left, right) =>
          left.path.localeCompare(right.path),
        )
      }

      const changes = yield* listWritingChangesByChangeSetSql(input.changeSetId)

      for (const change of changes) {
        if (change.status !== 'pending') {
          continue
        }

        if (change.operation === 'delete') {
          entryMap.delete(change.path)
          continue
        }

        const proposedBlob = yield* getBlobByIdSql(change.proposedBlobId)
        const projectedAt = now()
        const existing = entryMap.get(change.path)
        entryMap.set(change.path, {
          ...(existing ?? {
            id: `projected:${change.id}`,
            projectId: input.projectId,
            path: change.path,
            parentPath: null,
            name: change.path.split('/').pop() ?? '',
            kind: 'file',
            createdAt: projectedAt,
            updatedAt: projectedAt,
          }),
          blobId: proposedBlob?.id ?? existing?.blobId,
          sha256: proposedBlob?.sha256 ?? existing?.sha256,
          lineCount: proposedBlob?.content.split('\n').length ?? existing?.lineCount,
          sizeBytes: proposedBlob?.byteSize ?? existing?.sizeBytes,
          content: proposedBlob?.content,
          isPending: true,
        })
      }

      return [...entryMap.values()].sort((left, right) =>
        left.path.localeCompare(right.path),
      )
    }),
)

export type WritingWorkspaceServiceShape = {
  readonly listEntries: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly changeSetId?: string
    readonly requestId: string
  }) => Effect.Effect<
    readonly ProjectedEntry[],
    WritingProjectNotFoundError | WritingPersistenceError
  >
  readonly readFile: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly path: string
    readonly changeSetId?: string
    readonly requestId: string
  }) => Effect.Effect<
    {
      readonly path: string
      readonly content: string
      readonly entry?: ProjectedEntry
    },
    WritingProjectNotFoundError | WritingInvalidRequestError | WritingPersistenceError
  >
  readonly grepProject: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly pattern: string
    readonly changeSetId?: string
    readonly requestId: string
  }) => Effect.Effect<
    readonly {
      readonly path: string
      readonly lineNumber: number
      readonly line: string
    }[],
    WritingProjectNotFoundError | WritingPersistenceError
  >
  readonly findPaths: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly pattern: string
    readonly changeSetId?: string
    readonly requestId: string
  }) => Effect.Effect<
    readonly string[],
    WritingProjectNotFoundError | WritingPersistenceError
  >
}

export class WritingWorkspaceService extends ServiceMap.Service<
  WritingWorkspaceService,
  WritingWorkspaceServiceShape
>()('writing-backend/WritingWorkspaceService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const projects = yield* WritingProjectService

      const listEntries: WritingWorkspaceServiceShape['listEntries'] = Effect.fn(
        'WritingWorkspaceService.listEntries',
      )(({ projectId, userId, organizationId, changeSetId, requestId }) =>
        Effect.gen(function* () {
          yield* projects.getProject({
            projectId,
            userId,
            organizationId,
            requestId,
          })

          return yield* loadProjectedEntries({
            projectId,
            changeSetId,
          }).pipe(Effect.provideService(PgClient.PgClient, sql))
        }).pipe(
          Effect.mapError((error) =>
            error instanceof WritingProjectNotFoundError
              ? error
              : toPersistenceError(requestId, 'Failed to list writing entries', error),
          ),
        ),
      )

      const readFile: WritingWorkspaceServiceShape['readFile'] = Effect.fn(
        'WritingWorkspaceService.readFile',
      )(({ projectId, userId, organizationId, path, changeSetId, requestId }) =>
        Effect.gen(function* () {
          yield* projects.getProject({
            projectId,
            userId,
            organizationId,
            requestId,
          })

          const projectedEntries = yield* loadProjectedEntries({
            projectId,
            changeSetId,
          }).pipe(Effect.provideService(PgClient.PgClient, sql))
          const entry = projectedEntries.find((candidate) => candidate.path === path)
          if (!entry || entry.kind !== 'file') {
            return yield* Effect.fail(
              new WritingInvalidRequestError({
                message: 'Writing file not found',
                requestId,
                issue: `File ${path} does not exist`,
              }),
            )
          }

          if (entry.content !== undefined) {
            return {
              path,
              content: entry.content,
              entry,
            }
          }

          const blob = yield* getBlobByIdSql(entry.blobId).pipe(
            Effect.provideService(PgClient.PgClient, sql),
          )
          return {
            path,
            content: blob?.content ?? '',
            entry,
          }
        }).pipe(
          Effect.mapError((error) => {
            if (
              error instanceof WritingProjectNotFoundError ||
              error instanceof WritingInvalidRequestError
            ) {
              return error
            }
            return toPersistenceError(requestId, 'Failed to read writing file', error)
          }),
        ),
      )

      const grepProject: WritingWorkspaceServiceShape['grepProject'] = Effect.fn(
        'WritingWorkspaceService.grepProject',
      )(({ projectId, userId, organizationId, pattern, changeSetId, requestId }) =>
        listEntries({ projectId, userId, organizationId, changeSetId, requestId }).pipe(
          Effect.flatMap((entries) =>
            Effect.gen(function* () {
              const results: { path: string; lineNumber: number; line: string }[] = []
              for (const entry of entries) {
                if (entry.kind !== 'file') {
                  continue
                }

                const content =
                  entry.content ??
                  (yield* getBlobByIdSql(entry.blobId).pipe(
                    Effect.provideService(PgClient.PgClient, sql),
                  ))?.content ??
                  ''
                for (const [index, line] of content.split('\n').entries()) {
                  if (line.toLowerCase().includes(pattern.toLowerCase())) {
                    results.push({
                      path: entry.path,
                      lineNumber: index + 1,
                      line,
                    })
                  }
                }
              }

              return results
            }).pipe(
              Effect.mapError((error) =>
                toPersistenceError(requestId, 'Failed to search writing files', error),
              ),
            ),
          ),
        ),
      )

      const findPaths: WritingWorkspaceServiceShape['findPaths'] = Effect.fn(
        'WritingWorkspaceService.findPaths',
      )(({ projectId, userId, organizationId, pattern, changeSetId, requestId }) =>
        listEntries({ projectId, userId, organizationId, changeSetId, requestId }).pipe(
          Effect.map((entries) =>
            entries
              .map((entry) => entry.path)
              .filter((pathValue) =>
                pathValue.toLowerCase().includes(pattern.toLowerCase()),
              ),
          ),
        ),
      )

      return {
        listEntries,
        readFile,
        grepProject,
        findPaths,
      }
    }),
  )
}
