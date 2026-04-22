import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { createProjectSlug } from '@/lib/shared/writing/path-utils'
import {
  WRITING_PROJECT_INSTRUCTION_PATH,
} from '@/lib/shared/writing/constants'
import {
  WritingConflictError,
  WritingInvalidRequestError,
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../domain/errors'
import {
  getBlobByIdWithSql,
  getProjectEntryByPathWithSql,
  getScopedProjectWithSql,
  getScopedProjectSql,
  normalizeScopedOrgId,
  now,
  upsertWritingBlobWithSql,
  upsertWritingEntryWithSql,
} from './persistence'
import { makeCreateProjectOperation } from './project/create-project.operation'

export type WritingProjectServiceShape = {
  readonly createProject: (input: {
    readonly userId: string
    readonly organizationId?: string
    readonly title: string
    readonly description?: string
    readonly requestId: string
  }) => Effect.Effect<
    {
      readonly projectId: string
      readonly defaultConversationId: string
      readonly headSnapshotId: string
    },
    WritingInvalidRequestError | WritingConflictError | WritingPersistenceError
  >
  readonly renameProject: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly title: string
    readonly requestId: string
  }) => Effect.Effect<void, WritingProjectNotFoundError | WritingPersistenceError>
  readonly setAutoAcceptMode: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly enabled: boolean
    readonly requestId: string
  }) => Effect.Effect<void, WritingProjectNotFoundError | WritingPersistenceError>
  readonly getProject: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly requestId: string
  }) => Effect.Effect<
    {
      readonly id: string
      readonly ownerUserId: string
      readonly ownerOrgId: string
      readonly title: string
      readonly description?: string | null
      readonly slug: string
      readonly headSnapshotId?: string | null
      readonly defaultConversationId?: string | null
      readonly autoAcceptMode: boolean
    },
    WritingProjectNotFoundError | WritingPersistenceError
  >
}

function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

export class WritingProjectService extends ServiceMap.Service<
  WritingProjectService,
  WritingProjectServiceShape
>()('writing-backend/WritingProjectService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const createProject = makeCreateProjectOperation({ sql })
      const provideSql = <TValue, TError>(
        effect: Effect.Effect<TValue, TError, PgClient.PgClient>,
      ): Effect.Effect<TValue, TError> =>
        Effect.provideService(effect, PgClient.PgClient, sql)

      const resolveProjectSlugForRename = Effect.fn(
        'WritingProjectService.resolveProjectSlugForRename',
      )(
        (input: {
          readonly projectId: string
          readonly userId: string
          readonly organizationId?: string
          readonly title: string
        }) =>
          Effect.gen(function* () {
            const baseSlug = createProjectSlug(input.title)
            const rows = yield* sql<{ readonly slug: string }>`
              select slug
              from writing_projects
              where owner_user_id = ${input.userId}
                and owner_org_id = ${normalizeScopedOrgId(input.organizationId)}
                and id <> ${input.projectId}
              order by created_at asc
            `

            const existingSlugs = new Set(rows.map((row) => row.slug))
            let slug = baseSlug
            let suffix = 2
            while (existingSlugs.has(slug)) {
              slug = `${baseSlug}-${suffix}`
              suffix += 1
            }

            return slug
          }),
      )

      const getProject: WritingProjectServiceShape['getProject'] = Effect.fn(
        'WritingProjectService.getProject',
      )(({ projectId, userId, organizationId, requestId }) =>
        provideSql(
          getScopedProjectSql({
            projectId,
            userId,
            organizationId,
          }),
        ).pipe(
          Effect.flatMap((project) =>
            project
              ? Effect.succeed(project)
              : Effect.fail(
                  new WritingProjectNotFoundError({
                    message: 'Writing project not found',
                    requestId,
                    projectId,
                  }),
                ),
          ),
          Effect.mapError((error) =>
            error instanceof WritingProjectNotFoundError
              ? error
              : toPersistenceError(requestId, 'Failed to load writing project', error),
          ),
        ),
      )

      const renameProject: WritingProjectServiceShape['renameProject'] = Effect.fn(
        'WritingProjectService.renameProject',
      )(({ projectId, userId, organizationId, title, requestId }) =>
        Effect.gen(function* () {
          const normalizedTitle = title.trim()
          const updatedAt = now()

          yield* sql.withTransaction(
            Effect.gen(function* () {
              const project = yield* getScopedProjectWithSql(sql, {
                projectId,
                userId,
                organizationId,
                forUpdate: true,
              })
              if (!project) {
                return yield* Effect.fail(
                  new WritingProjectNotFoundError({
                    message: 'Writing project not found',
                    requestId,
                    projectId,
                  }),
                )
              }

              const nextSlug = yield* resolveProjectSlugForRename({
                projectId,
                userId,
                organizationId,
                title: normalizedTitle,
              })

              yield* sql`
                update writing_projects
                set
                  title = ${normalizedTitle},
                  slug = ${nextSlug},
                  updated_at = ${updatedAt}
                where id = ${projectId}
              `

              const instructionEntry = yield* getProjectEntryByPathWithSql(sql, {
                projectId,
                path: WRITING_PROJECT_INSTRUCTION_PATH,
              })
              if (!instructionEntry?.blobId) {
                return
              }

              const existingBlob = yield* getBlobByIdWithSql(
                sql,
                instructionEntry.blobId,
              )
              if (!existingBlob) {
                return
              }

              const updatedInstructions = String(existingBlob.content).replace(
                /Project: .*/,
                `Project: ${normalizedTitle}`,
              )
              const blob = yield* upsertWritingBlobWithSql(sql, {
                content: updatedInstructions,
              })
              yield* upsertWritingEntryWithSql(sql, {
                projectId,
                path: WRITING_PROJECT_INSTRUCTION_PATH,
                kind: 'file',
                blob,
                createdAt: updatedAt,
              })
            }),
          )
        }).pipe(
          Effect.mapError((error) =>
            error instanceof WritingProjectNotFoundError
              ? error
              : toPersistenceError(requestId, 'Failed to rename writing project', error),
          ),
        ),
      )

      const setAutoAcceptMode: WritingProjectServiceShape['setAutoAcceptMode'] = Effect.fn(
        'WritingProjectService.setAutoAcceptMode',
      )(({ projectId, userId, organizationId, enabled, requestId }) =>
        provideSql(Effect.gen(function* () {
          yield* getProject({
            projectId,
            userId,
            organizationId,
            requestId,
          })

          yield* sql`
            update writing_projects
            set
              auto_accept_mode = ${enabled},
              updated_at = ${now()}
            where id = ${projectId}
          `
        })).pipe(
          Effect.mapError((error) =>
            error instanceof WritingProjectNotFoundError
              ? error
              : toPersistenceError(requestId, 'Failed to update auto-accept mode', error),
          ),
        ),
      )

      return {
        createProject,
        renameProject,
        setAutoAcceptMode,
        getProject,
      }
    }),
  )
}
