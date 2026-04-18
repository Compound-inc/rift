import { Effect, Layer, ServiceMap } from 'effect'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import { ZeroDatabaseNotConfiguredError, ZeroDatabaseService } from '@/lib/backend/server-effect/services/zero-database.service'
import {
  WritingInvalidRequestError,
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../domain/errors'
import {
  getBlobById,
  getScopedProject,
  listProjectEntries,
} from './persistence'
import type {
  WritingChangeRow,
  WritingChangeSetRow,
  WritingEntryRow,
} from './persistence'

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

async function loadProjectedEntries(input: {
  readonly db: any
  readonly projectId: string
  readonly changeSetId?: string
}): Promise<readonly ProjectedEntry[]> {
  const baseEntries = await listProjectEntries(input.db, input.projectId)
  const entryMap = new Map<string, ProjectedEntry>(
    baseEntries.map((entry) => [entry.path, { ...entry }]),
  )

  if (!input.changeSetId) {
    return [...entryMap.values()].sort((left, right) => left.path.localeCompare(right.path))
  }

  const changeSet = (await input.db.run(
    zql.writingChangeSet.where('id', input.changeSetId).one(),
  )) as WritingChangeSetRow | null
  if (!changeSet || changeSet.projectId !== input.projectId) {
    return [...entryMap.values()].sort((left, right) => left.path.localeCompare(right.path))
  }

  const changes = (await input.db.run(
    zql.writingChange.where('changeSetId', input.changeSetId).orderBy('path', 'asc'),
  )) as WritingChangeRow[]

  for (const change of changes) {
    if (change.status !== 'pending') {
      continue
    }

    if (change.operation === 'delete') {
      entryMap.delete(change.path)
      continue
    }

    const proposedBlob = await getBlobById(input.db, change.proposedBlobId)
    const existing = entryMap.get(change.path)
    entryMap.set(change.path, {
      ...(existing ?? {
        id: `projected:${change.id}`,
        projectId: input.projectId,
        path: change.path,
        parentPath: null,
        name: change.path.split('/').pop() ?? '',
        kind: 'file',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      blobId: proposedBlob?.id ?? existing?.blobId,
      sha256: proposedBlob?.sha256 ?? existing?.sha256,
      lineCount: proposedBlob?.content.split('\n').length ?? existing?.lineCount,
      sizeBytes: proposedBlob?.byteSize ?? existing?.sizeBytes,
      content: proposedBlob?.content,
      isPending: true,
    })
  }

  return [...entryMap.values()].sort((left, right) => left.path.localeCompare(right.path))
}

export type WritingWorkspaceServiceShape = {
  readonly listEntries: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly changeSetId?: string
    readonly requestId: string
  }) => Effect.Effect<readonly ProjectedEntry[], WritingProjectNotFoundError | WritingPersistenceError>
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
  }) => Effect.Effect<readonly string[], WritingProjectNotFoundError | WritingPersistenceError>
}

export class WritingWorkspaceService extends ServiceMap.Service<
  WritingWorkspaceService,
  WritingWorkspaceServiceShape
>()('writing-backend/WritingWorkspaceService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const zeroDatabase = yield* ZeroDatabaseService

      const listEntries: WritingWorkspaceServiceShape['listEntries'] = Effect.fn(
        'WritingWorkspaceService.listEntries',
      )(({ projectId, userId, organizationId, changeSetId, requestId }) =>
        zeroDatabase
          .withDatabase((db) =>
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

                return loadProjectedEntries({
                  db,
                  projectId,
                  changeSetId,
                })
              },
              catch: (error) =>
                error instanceof WritingProjectNotFoundError
                  ? error
                  : toPersistenceError(requestId, 'Failed to list writing entries', error),
            }),
          )
          .pipe(
            Effect.mapError((error) =>
              error instanceof ZeroDatabaseNotConfiguredError
                ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
                : error,
            ),
          ),
      )

      const readFile: WritingWorkspaceServiceShape['readFile'] = Effect.fn(
        'WritingWorkspaceService.readFile',
      )(({ projectId, userId, organizationId, path, changeSetId, requestId }) =>
        zeroDatabase
          .withDatabase((db) =>
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

                const projectedEntries = await loadProjectedEntries({
                  db,
                  projectId,
                  changeSetId,
                })
                const entry = projectedEntries.find((candidate) => candidate.path === path)
                if (!entry || entry.kind !== 'file') {
                  throw new WritingInvalidRequestError({
                    message: 'Writing file not found',
                    requestId,
                    issue: `File ${path} does not exist`,
                  })
                }

                if (entry.content !== undefined) {
                  return {
                    path,
                    content: entry.content,
                    entry,
                  }
                }

                const blob = await getBlobById(db, entry.blobId)
                return {
                  path,
                  content: blob?.content ?? '',
                  entry,
                }
              },
              catch: (error) => {
                if (
                  error instanceof WritingProjectNotFoundError ||
                  error instanceof WritingInvalidRequestError
                ) {
                  return error
                }
                return toPersistenceError(requestId, 'Failed to read writing file', error)
              },
            }),
          )
          .pipe(
            Effect.mapError((error) =>
              error instanceof ZeroDatabaseNotConfiguredError
                ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
                : error,
            ),
          ),
      )

      const grepProject: WritingWorkspaceServiceShape['grepProject'] = Effect.fn(
        'WritingWorkspaceService.grepProject',
      )(({ projectId, userId, organizationId, pattern, changeSetId, requestId }) =>
        listEntries({ projectId, userId, organizationId, changeSetId, requestId }).pipe(
          Effect.flatMap((entries) =>
            zeroDatabase.withDatabase((db) =>
              Effect.tryPromise({
                try: async () => {
                  const results: { path: string; lineNumber: number; line: string }[] = []
                  for (const entry of entries) {
                    if (entry.kind !== 'file') {
                      continue
                    }
                    const content = entry.content ?? (await getBlobById(db, entry.blobId))?.content ?? ''
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
                },
                catch: (error) => toPersistenceError(requestId, 'Failed to search writing files', error),
              }),
            ).pipe(
              Effect.mapError((error): WritingPersistenceError =>
                error instanceof ZeroDatabaseNotConfiguredError
                  ? toPersistenceError(requestId, 'Writing storage is unavailable', error)
                  : toPersistenceError(requestId, 'Failed to search writing files', error),
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
              .filter((pathValue) => pathValue.toLowerCase().includes(pattern.toLowerCase())),
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
