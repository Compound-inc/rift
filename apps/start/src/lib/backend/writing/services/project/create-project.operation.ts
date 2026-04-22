import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import {
  WRITING_DEFAULT_MODEL_ID,
  WRITING_ROOT_PATH,
} from '@/lib/shared/writing/constants'
import { createDefaultWritingScaffold } from '@/lib/shared/writing/scaffold'
import {
  createProjectSlug,
  getWritingBaseName,
  getWritingParentPath,
} from '@/lib/shared/writing/path-utils'
import {
  formatSqlClientCause,
  sqlJson,
} from '@/lib/backend/server-effect/services/upstream-postgres.service'
import {
  WritingConflictError,
  WritingInvalidRequestError,
  WritingPersistenceError,
} from '../../domain/errors'
import type { WritingProjectServiceShape } from '../project.service'
import {
  hashWritingContent,
  normalizeScopedOrgId,
  now,
} from '../persistence'

type ProjectSlugRow = {
  readonly slug: string
}

type CreatedProjectRow = {
  readonly head_snapshot_id: string | null
  readonly default_conversation_id: string | null
}

type WritingBlobRow = {
  readonly id: string
  readonly sha256: string
  readonly byte_size: number
}

type SnapshotEntryManifest = {
  readonly path: string
  readonly kind: 'file' | 'folder'
  readonly blobId?: string
  readonly sha256?: string
  readonly lineCount?: number
  readonly sizeBytes?: number
}

function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: formatSqlClientCause(cause),
  })
}

const insertFolderEntry = Effect.fn('WritingProjectService.insertFolderEntry')(
  (input: {
    readonly sql: PgClient.PgClient
    readonly projectId: string
    readonly path: string
    readonly createdAt: number
  }) =>
    Effect.gen(function* () {
      yield* input.sql`
        insert into writing_entries (
          id,
          project_id,
          path,
          parent_path,
          name,
          kind,
          blob_id,
          sha256,
          line_count,
          size_bytes,
          created_at,
          updated_at
        ) values (
          ${crypto.randomUUID()},
          ${input.projectId},
          ${input.path},
          ${getWritingParentPath(input.path) ?? WRITING_ROOT_PATH},
          ${getWritingBaseName(input.path)},
          'folder',
          null,
          null,
          null,
          null,
          ${input.createdAt},
          ${input.createdAt}
        )
        on conflict (project_id, path) do nothing
      `
    }),
)

const ensureFolderEntriesSql = Effect.fn('WritingProjectService.ensureFolderEntriesSql')(
  (input: {
    readonly sql: PgClient.PgClient
    readonly projectId: string
    readonly folderPath: string
    readonly createdAt: number
  }) =>
    Effect.gen(function* () {
      if (input.folderPath === WRITING_ROOT_PATH) {
        return
      }

      const segments = input.folderPath.split('/').filter(Boolean)
      let currentPath = ''

      for (const segment of segments) {
        currentPath += `/${segment}`
        yield* insertFolderEntry({
          sql: input.sql,
          projectId: input.projectId,
          path: currentPath,
          createdAt: input.createdAt,
        })
      }
    }),
)

const upsertWritingBlobSql = Effect.fn('WritingProjectService.upsertWritingBlobSql')(
  (input: {
    readonly sql: PgClient.PgClient
    readonly content: string
  }) =>
    Effect.gen(function* () {
      const sha256 = hashWritingContent(input.content)
      const existingRows = yield* input.sql<WritingBlobRow>`
        select id, sha256, byte_size
        from writing_blobs
        where sha256 = ${sha256}
        limit 1
      `
      const existing = existingRows[0]
      if (existing) {
        return existing
      }

      const blob: WritingBlobRow = {
        id: crypto.randomUUID(),
        sha256,
        byte_size: Buffer.byteLength(input.content, 'utf8'),
      }

      yield* input.sql`
        insert into writing_blobs (
          id,
          sha256,
          content,
          byte_size,
          created_at
        ) values (
          ${blob.id},
          ${blob.sha256},
          ${input.content},
          ${blob.byte_size},
          ${now()}
        )
      `

      return blob
    }),
)

const upsertWritingFileEntrySql = Effect.fn(
  'WritingProjectService.upsertWritingFileEntrySql',
)(
  (input: {
    readonly sql: PgClient.PgClient
    readonly projectId: string
    readonly path: string
    readonly blob: WritingBlobRow
    readonly content: string
    readonly createdAt: number
  }) =>
    Effect.gen(function* () {
      yield* input.sql`
        insert into writing_entries (
          id,
          project_id,
          path,
          parent_path,
          name,
          kind,
          blob_id,
          sha256,
          line_count,
          size_bytes,
          created_at,
          updated_at
        ) values (
          ${crypto.randomUUID()},
          ${input.projectId},
          ${input.path},
          ${getWritingParentPath(input.path) ?? WRITING_ROOT_PATH},
          ${getWritingBaseName(input.path)},
          'file',
          ${input.blob.id},
          ${input.blob.sha256},
          ${input.content.split('\n').length},
          ${input.blob.byte_size},
          ${input.createdAt},
          ${input.createdAt}
        )
        on conflict (project_id, path) do update
        set
          parent_path = excluded.parent_path,
          name = excluded.name,
          kind = excluded.kind,
          blob_id = excluded.blob_id,
          sha256 = excluded.sha256,
          line_count = excluded.line_count,
          size_bytes = excluded.size_bytes,
          updated_at = excluded.updated_at
      `
    }),
)

const resolveUniqueProjectSlug = Effect.fn('WritingProjectService.resolveUniqueProjectSlug')(
  (input: {
    readonly sql: PgClient.PgClient
    readonly userId: string
    readonly ownerOrgId: string
    readonly title: string
  }) =>
    Effect.gen(function* () {
      const baseSlug = createProjectSlug(input.title)
      const siblingProjects = yield* input.sql<ProjectSlugRow>`
        select slug
        from writing_projects
        where owner_user_id = ${input.userId}
          and owner_org_id = ${input.ownerOrgId}
        order by created_at asc
      `

      const existingSlugs = new Set(siblingProjects.map((project) => project.slug))
      let slug = baseSlug
      let suffix = 2
      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix}`
        suffix += 1
      }

      return slug
    }),
)

const insertInitialSnapshot = Effect.fn('WritingProjectService.insertInitialSnapshot')(
  (input: {
    readonly sql: PgClient.PgClient
    readonly projectId: string
    readonly conversationId: string
    readonly createdByUserId: string
    readonly entries: readonly SnapshotEntryManifest[]
    readonly createdAt: number
  }) =>
    Effect.gen(function* () {
      const snapshotId = crypto.randomUUID()

      yield* input.sql`
        insert into writing_snapshots (
          id,
          project_id,
          parent_snapshot_id,
          source,
          summary,
          conversation_id,
          message_id,
          created_by_user_id,
          restored_from_snapshot_id,
          created_at
        ) values (
          ${snapshotId},
          ${input.projectId},
          null,
          'system',
          'Initial project scaffold',
          ${input.conversationId},
          null,
          ${input.createdByUserId},
          null,
          ${input.createdAt}
        )
      `

      for (const entry of input.entries) {
        if (entry.path === WRITING_ROOT_PATH) {
          continue
        }

        yield* input.sql`
          insert into writing_snapshot_entries (
            id,
            snapshot_id,
            path,
            kind,
            blob_id,
            sha256,
            line_count
          ) values (
            ${crypto.randomUUID()},
            ${snapshotId},
            ${entry.path},
            ${entry.kind},
            ${entry.blobId ?? null},
            ${entry.sha256 ?? null},
            ${entry.lineCount ?? null}
          )
        `
      }

      return snapshotId
    }),
)

export const makeCreateProjectOperation = ({
  sql,
}: {
  readonly sql: PgClient.PgClient
}): WritingProjectServiceShape['createProject'] =>
  Effect.fn('WritingProjectService.createProject')(
    ({ userId, organizationId, title, description, requestId }) =>
      Effect.gen(function* () {
        const normalizedTitle = title.trim()
        if (normalizedTitle.length === 0) {
          return yield* Effect.fail(
            new WritingInvalidRequestError({
              message: 'Project title is required',
              requestId,
            }),
          )
        }

        const ownerOrgId = normalizeScopedOrgId(organizationId)

        return yield* sql.withTransaction(
          Effect.gen(function* () {
            const slug = yield* resolveUniqueProjectSlug({
              sql,
              userId,
              ownerOrgId,
              title: normalizedTitle,
            })

            const createdAt = now()
            const projectId = crypto.randomUUID()
            const defaultConversationId = crypto.randomUUID()

            yield* sql`
              insert into writing_projects (
                id,
                owner_user_id,
                owner_org_id,
                title,
                slug,
                description,
                head_snapshot_id,
                default_conversation_id,
                auto_accept_mode,
                archived_at,
                created_at,
                updated_at
              ) values (
                ${projectId},
                ${userId},
                ${ownerOrgId},
                ${normalizedTitle},
                ${slug},
                ${description?.trim() || null},
                null,
                null,
                false,
                null,
                ${createdAt},
                ${createdAt}
              )
            `

            yield* sql`
              insert into agent_conversations (
                id,
                product,
                scope_type,
                scope_id,
                owner_user_id,
                owner_org_id,
                title,
                default_model_id,
                status,
                metadata_json,
                created_at,
                updated_at,
                last_message_at
              ) values (
                ${defaultConversationId},
                'writing',
                'writing_project',
                ${projectId},
                ${userId},
                ${ownerOrgId},
                'Main chat',
                ${WRITING_DEFAULT_MODEL_ID},
                'active',
                ${sqlJson(sql, {})},
                ${createdAt},
                ${createdAt},
                ${createdAt}
              )
            `

            const manifest: SnapshotEntryManifest[] = []

            for (const entry of createDefaultWritingScaffold(normalizedTitle)) {
              if (entry.kind === 'folder') {
                if (entry.path !== WRITING_ROOT_PATH) {
                  yield* ensureFolderEntriesSql({
                    sql,
                    projectId,
                    folderPath: entry.path,
                    createdAt,
                  })
                  manifest.push({
                    path: entry.path,
                    kind: 'folder',
                  })
                }
                continue
              }

              const parentPath = getWritingParentPath(entry.path)
              if (parentPath) {
                yield* ensureFolderEntriesSql({
                  sql,
                  projectId,
                  folderPath: parentPath,
                  createdAt,
                })
              }

              const blob = yield* upsertWritingBlobSql({
                sql,
                content: entry.content,
              })

              yield* upsertWritingFileEntrySql({
                sql,
                projectId,
                path: entry.path,
                blob,
                content: entry.content,
                createdAt,
              })

              manifest.push({
                path: entry.path,
                kind: 'file',
                blobId: blob.id,
                sha256: blob.sha256,
                lineCount: entry.content.split('\n').length,
                sizeBytes: blob.byte_size,
              })
            }

            const snapshotId = yield* insertInitialSnapshot({
              sql,
              projectId,
              conversationId: defaultConversationId,
              createdByUserId: userId,
              entries: manifest,
              createdAt,
            })

            yield* sql`
              update writing_projects
              set
                head_snapshot_id = ${snapshotId},
                default_conversation_id = ${defaultConversationId},
                updated_at = ${createdAt}
              where id = ${projectId}
            `

            const rows = yield* sql<CreatedProjectRow>`
              select head_snapshot_id, default_conversation_id
              from writing_projects
              where id = ${projectId}
              limit 1
            `
            const createdProject = rows[0]

            if (
              !createdProject?.head_snapshot_id ||
              !createdProject.default_conversation_id
            ) {
              return yield* Effect.fail(
                new WritingConflictError({
                  message: 'Project scaffold was not created correctly',
                  requestId,
                  projectId,
                }),
              )
            }

            return {
              projectId,
              defaultConversationId: createdProject.default_conversation_id,
              headSnapshotId: createdProject.head_snapshot_id,
            }
          }),
        )
      }).pipe(
        Effect.mapError((error) => {
          if (
            error instanceof WritingInvalidRequestError ||
            error instanceof WritingConflictError
          ) {
            return error
          }

          return toPersistenceError(requestId, 'Failed to create writing project', error)
        }),
      ),
  )
