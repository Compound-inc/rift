import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import type {
  ProjectSourceSummary,
  ProjectSourceMetadata,
} from '@/lib/shared/projects/source-summary'
import { ProjectSourcesPersistenceError } from '../domain/errors'

type ReadInput = {
  readonly projectId: string
  readonly userId: string
  readonly organizationId?: string
}

// Postgres returns BIGINT columns as strings through the shared pg pool.
type ProjectSourceMetadataRow = Omit<
  ProjectSourceMetadata,
  'fileSize' | 'vectorIndexedAt' | 'updatedAt'
> & {
  readonly fileSize: number | string
  readonly vectorIndexedAt: number | string | null
  readonly updatedAt: number | string
}

export type ProjectSourcesReadServiceShape = {
  readonly list: (
    input: ReadInput,
  ) => Effect.Effect<
    readonly ProjectSourceMetadata[],
    ProjectSourcesPersistenceError
  >
  readonly summary: (
    input: ReadInput,
  ) => Effect.Effect<ProjectSourceSummary, ProjectSourcesPersistenceError>
}

/** Bounded metadata for the home page. Never replicate extracted document text. */
export class ProjectSourcesReadService extends ServiceMap.Service<
  ProjectSourcesReadService,
  ProjectSourcesReadServiceShape
>()('project-sources/ProjectSourcesReadService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      return {
        list: Effect.fn('ProjectSourcesReadService.list')(function* (
          input: ReadInput,
        ) {
          // Explicit projection keeps newly added attachment columns private.
          return yield* sql<ProjectSourceMetadataRow>`
            select a.id, a.file_name as "fileName", a.mime_type as "mimeType",
              a.file_size as "fileSize", a.embedding_status as "embeddingStatus",
              a.vector_indexed_at as "vectorIndexedAt", a.updated_at as "updatedAt"
            from attachments a join projects p on p.id = a.project_id
            where p.id = ${input.projectId} and p.deleted_at is null
              and a.status = 'uploaded' and a.org_knowledge_kind is null
              and (p.user_id = ${input.userId} or (
                p.visibility = 'org' and p.organization_id = ${input.organizationId ?? null}
                and exists (select 1 from member m where m."organizationId" = p.organization_id and m."userId" = ${input.userId})
                and exists (select 1 from member m where m."organizationId" = p.organization_id and m."userId" = p.user_id)
              ))
            order by a.updated_at desc, a.id desc
          `.pipe(
            Effect.map((rows) =>
              rows.map((file) => ({
                ...file,
                fileSize: Number(file.fileSize),
                updatedAt: Number(file.updatedAt),
                vectorIndexedAt:
                  file.vectorIndexedAt == null
                    ? null
                    : Number(file.vectorIndexedAt),
              })),
            ),
            Effect.mapError(
              (cause) =>
                new ProjectSourcesPersistenceError({
                  message: 'Failed to load project files',
                  requestId: 'project-files',
                  projectId: input.projectId,
                  cause: String(cause),
                }),
            ),
          )
        }),
        summary: Effect.fn('ProjectSourcesReadService.summary')(
          function* (input) {
            const rows = yield* sql<{
              count: string | number
              files: ProjectSourceSummary['files']
            }>`
          with accessible_project as (
            select p.id from projects p
            where p.id = ${input.projectId} and p.deleted_at is null
              and (p.user_id = ${input.userId} or (
                p.visibility = 'org' and p.organization_id = ${input.organizationId ?? null}
                and exists (select 1 from member owner_member where owner_member."organizationId" = p.organization_id and owner_member."userId" = p.user_id)
                and exists (select 1 from member m where m."organizationId" = p.organization_id and m."userId" = ${input.userId})
              ))
          ), sources as (
            select a.id, a.file_name, a.embedding_status, a.updated_at
            from attachments a join accessible_project p on p.id = a.project_id
            where a.status = 'uploaded' and a.org_knowledge_kind is null
          )
          select (select count(*) from sources) as count,
            coalesce((select json_agg(json_build_object('id', f.id, 'fileName', f.file_name, 'embeddingStatus', f.embedding_status))
              from (select * from sources order by updated_at desc, id desc limit 4) f), '[]'::json) as files
          from accessible_project
        `.pipe(
              Effect.mapError(
                (cause) =>
                  new ProjectSourcesPersistenceError({
                    message: 'Failed to load project files',
                    requestId: 'project-home',
                    projectId: input.projectId,
                    cause: String(cause),
                  }),
              ),
            )
            const row = rows[0]
            if (!row)
              return yield* Effect.fail(
                new ProjectSourcesPersistenceError({
                  message: 'Project is not available',
                  requestId: 'project-home',
                  projectId: input.projectId,
                }),
              )
            return { count: Number(row.count), files: row.files }
          },
        ),
      }
    }),
  )
}
