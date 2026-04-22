import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import { createWritingHunks } from '@/lib/shared/writing/diff'
import {
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../../domain/errors'
import {
  getScopedProjectWithSql,
  getWritingChangeSetWithSql,
  listWritingChangeHunksByChangeIdWithSql,
  listWritingChangesByChangeSetWithSql,
  replaceChangeHunksWithSql,
  updateChangeSetResolutionWithSql,
} from '../persistence'
import type {
  WritingChangeHunkRow,
  WritingChangeRow,
  WritingChangeSetRow,
  WritingProjectRow,
} from '../persistence'

export function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

export const getScopedChangeSet = Effect.fn('WritingChangeSetStore.getScopedChangeSet')(
  (input: {
    readonly sql: PgClient.PgClient
    readonly changeSetId: string
    readonly userId: string
    readonly organizationId?: string
    readonly forUpdate?: boolean
  }) =>
    Effect.gen(function* () {
      const changeSet = yield* getWritingChangeSetWithSql(
        input.sql,
        input.changeSetId,
        {
          forUpdate: input.forUpdate,
        },
      )

      if (!changeSet) {
        return {
          project: null,
          changeSet: null,
        }
      }

      const project = yield* getScopedProjectWithSql(input.sql, {
        projectId: changeSet.projectId,
        userId: input.userId,
        organizationId: input.organizationId,
        forUpdate: input.forUpdate,
      })

      return { project, changeSet }
    }),
)

export const loadChangeRows = Effect.fn('WritingChangeSetStore.loadChangeRows')(
  (sql: PgClient.PgClient, changeSetId: string) =>
    listWritingChangesByChangeSetWithSql(sql, changeSetId).pipe(
      Effect.map((rows) => [...rows] as WritingChangeRow[]),
    ),
)

export const loadChangeHunks = Effect.fn('WritingChangeSetStore.loadChangeHunks')(
  (sql: PgClient.PgClient, changeId: string) =>
    listWritingChangeHunksByChangeIdWithSql(sql, changeId).pipe(
      Effect.map((rows) => [...rows] as WritingChangeHunkRow[]),
    ),
)

export const replaceChangeHunks = Effect.fn(
  'WritingChangeSetStore.replaceChangeHunks',
)(
  (input: {
    readonly sql: PgClient.PgClient
    readonly changeId: string
    readonly hunks: readonly ReturnType<typeof createWritingHunks>[number][]
    readonly createdAt: number
  }) => replaceChangeHunksWithSql(input.sql, input),
)

export const updateChangeSetResolution = Effect.fn(
  'WritingChangeSetStore.updateChangeSetResolution',
)(
  (input: {
    readonly sql: PgClient.PgClient
    readonly changeSetId: string
  }) => updateChangeSetResolutionWithSql(input.sql, input.changeSetId),
)

export function assertScopedChangeSetProject(input: {
  readonly project: WritingProjectRow | null
  readonly changeSet: WritingChangeSetRow | null
  readonly requestId: string
}) {
  if (!input.project || !input.changeSet) {
    throw new WritingProjectNotFoundError({
      message: 'Writing project not found',
      requestId: input.requestId,
      projectId: input.changeSet?.projectId ?? 'unknown-project',
    })
  }

  return {
    project: input.project,
    changeSet: input.changeSet,
  }
}
